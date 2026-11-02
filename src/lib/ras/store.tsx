// Client-side application store: localStorage persistence, simulated auth,
// role permissions and a central mutate() that all modules share.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RasData, Role, User } from "./types";
import { buildSeedData } from "./seed";
import { uid } from "./services";
import { hasSupabaseDatabase, loadRasData, saveRasData } from "./repository";

const DATA_KEY = "ras-data-v1";
const SESSION_KEY = "ras-session-v1";

export type ModuleId =
  | "overview"
  | "orders"
  | "tables"
  | "menu"
  | "billing"
  | "kitchen"
  | "inventory"
  | "purchase-orders"
  | "suppliers"
  | "invoices"
  | "accounts"
  | "reports"
  | "users"
  | "settings";

export const ALL_MODULES: ModuleId[] = [
  "overview",
  "orders",
  "tables",
  "menu",
  "billing",
  "kitchen",
  "inventory",
  "purchase-orders",
  "suppliers",
  "invoices",
  "accounts",
  "reports",
  "users",
  "settings",
];

export const ROLE_MODULES: Record<Role, ModuleId[]> = {
  manager: [...ALL_MODULES],
  clerk: ["overview", "orders", "tables", "billing"],
  kitchen: ["kitchen", "inventory"],
  stock: ["inventory", "purchase-orders", "suppliers", "invoices"],
};

export const ROLE_HOME: Record<Role, string> = {
  manager: "/overview",
  clerk: "/orders",
  kitchen: "/kitchen",
  stock: "/inventory",
};

export function roleCan(role: Role, moduleId: ModuleId): boolean {
  return ROLE_MODULES[role].includes(moduleId);
}

function loadLocalOrSeed(): RasData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RasData;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.users)) return parsed;
    }
  } catch {
    // fall through to seeding
  }
  const seeded = buildSeedData();
  localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
  return seeded;
}

interface RasContextValue {
  data: RasData;
  ready: boolean;
  databaseStatus: "connecting" | "synced" | "saving" | "local" | "error";
  databaseError: string | null;
  /** Apply a mutation to the shared dataset; persists locally and to Supabase when connected. */
  mutate: (fn: (draft: RasData) => void) => void;
  session: User | null;
  login: (userId: string, password: string) => { ok: boolean; error?: string };
  loginAsRole: (role: Role) => void;
  logout: () => void;
  resetDemoData: () => void;
}

const RasContext = createContext<RasContextValue | null>(null);

export function RasProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RasData | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<RasContextValue["databaseStatus"]>(
    hasSupabaseDatabase() ? "connecting" : "local",
  );
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const remoteEnabledRef = useRef(false);
  const pendingRemoteRef = useRef<RasData | null>(null);
  const savingRemoteRef = useRef(false);
  const lastRemoteRevisionRef = useRef(0);

  const writeLocal = useCallback((next: RasData) => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(next));
    } catch {
      // Keep the in-memory state when browser storage is unavailable or full.
    }
  }, []);

  const flushRemote = useCallback(async () => {
    if (savingRemoteRef.current || !remoteEnabledRef.current) return;
    savingRemoteRef.current = true;
    try {
      while (pendingRemoteRef.current) {
        const snapshot = pendingRemoteRef.current;
        pendingRemoteRef.current = null;
        setDatabaseStatus("saving");
        lastRemoteRevisionRef.current = await saveRasData(snapshot);
      }
      setDatabaseError(null);
      setDatabaseStatus("synced");
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "Supabase save failed");
      setDatabaseStatus("error");
    } finally {
      savingRemoteRef.current = false;
      if (pendingRemoteRef.current && remoteEnabledRef.current) void flushRemote();
    }
  }, []);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const refreshFromRemote = async () => {
      try {
        const snapshot = await loadRasData();
        if (!active || !snapshot || snapshot.revision <= lastRemoteRevisionRef.current) return;
        lastRemoteRevisionRef.current = snapshot.revision;
        writeLocal(snapshot.data);
        setData(snapshot.data);
        setDatabaseError(null);
        setDatabaseStatus((current) => (current === "saving" ? current : "synced"));
      } catch (error) {
        if (!active) return;
        setDatabaseError(error instanceof Error ? error.message : "Supabase refresh failed");
        setDatabaseStatus("error");
      }
    };

    const start = async () => {
      const local = loadLocalOrSeed();
      let loaded = local;

      if (hasSupabaseDatabase()) {
        setDatabaseStatus("connecting");
        try {
          const remote = await loadRasData();
          if (remote) {
            loaded = remote.data;
            lastRemoteRevisionRef.current = remote.revision;
          } else {
            lastRemoteRevisionRef.current = await saveRasData(local);
          }
          remoteEnabledRef.current = true;
          setDatabaseError(null);
          setDatabaseStatus("synced");
          pollTimer = setInterval(() => void refreshFromRemote(), 5_000);
        } catch (error) {
          remoteEnabledRef.current = false;
          setDatabaseError(error instanceof Error ? error.message : "Supabase connection failed");
          setDatabaseStatus("error");
        }
      } else {
        setDatabaseStatus("local");
      }

      if (!active) return;
      writeLocal(loaded);
      setData(loaded);
      try {
        const sessionId = localStorage.getItem(SESSION_KEY);
        if (sessionId && loaded.users.some((user) => user.userId === sessionId && user.active))
          setSessionUserId(sessionId);
      } catch {
        // Ignore unavailable browser session storage.
      }
      setReady(true);
    };

    void start();
    return () => {
      active = false;
      remoteEnabledRef.current = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [writeLocal]);

  const persist = useCallback(
    (next: RasData) => {
      writeLocal(next);
      if (remoteEnabledRef.current) {
        pendingRemoteRef.current = structuredClone(next);
        void flushRemote();
      }
    },
    [flushRemote, writeLocal],
  );

  const mutate = useCallback(
    (fn: (draft: RasData) => void) => {
      setData((prev) => {
        if (!prev) return prev;
        const draft: RasData = JSON.parse(JSON.stringify(prev));
        fn(draft);
        persist(draft);
        return draft;
      });
    },
    [persist],
  );

  const login = useCallback(
    (userId: string, password: string) => {
      const user = (data?.users ?? []).find(
        (u) => u.userId.toLowerCase() === userId.trim().toLowerCase(),
      );
      if (!user) return { ok: false, error: "Unknown user ID" };
      if (!user.active) return { ok: false, error: "This account is deactivated" };
      if (user.password !== password) return { ok: false, error: "Incorrect password" };
      localStorage.setItem(SESSION_KEY, user.userId);
      setSessionUserId(user.userId);
      setData((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        next.auditLog.unshift({
          id: uid("audit"),
          at: new Date().toISOString(),
          actor: user.id,
          action: "user_login",
          details: user.userId,
        });
        persist(next);
        return next;
      });
      return { ok: true };
    },
    [data, persist],
  );

  const loginAsRole = useCallback(
    (role: Role) => {
      const user = (data?.users ?? []).find((u) => u.role === role && u.active);
      if (user) {
        localStorage.setItem(SESSION_KEY, user.userId);
        setSessionUserId(user.userId);
        setData((prev) => {
          if (!prev) return prev;
          const next = structuredClone(prev);
          next.auditLog.unshift({
            id: uid("audit"),
            at: new Date().toISOString(),
            actor: user.id,
            action: "demo_role_login",
            details: user.userId,
          });
          persist(next);
          return next;
        });
      }
    },
    [data, persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionUserId(null);
  }, []);

  const resetDemoData = useCallback(() => {
    const seeded = buildSeedData();
    persist(seeded);
    setData(seeded);
  }, [persist]);

  const session = useMemo(
    () =>
      data && sessionUserId
        ? (data.users.find((u) => u.userId === sessionUserId && u.active) ?? null)
        : null,
    [data, sessionUserId],
  );

  const value = useMemo<RasContextValue>(
    () => ({
      data: data ?? buildEmptyData(),
      ready,
      databaseStatus,
      databaseError,
      mutate,
      session,
      login,
      loginAsRole,
      logout,
      resetDemoData,
    }),
    [
      data,
      ready,
      databaseStatus,
      databaseError,
      mutate,
      session,
      login,
      loginAsRole,
      logout,
      resetDemoData,
    ],
  );

  return <RasContext.Provider value={value}>{children}</RasContext.Provider>;
}

function buildEmptyData(): RasData {
  // Placeholder until the effect loads real data; pages wait on `ready`.
  return { ...JSON.parse(JSON.stringify(buildSeedData())), notifications: [], auditLog: [] };
}

export function useRas(): RasContextValue {
  const ctx = useContext(RasContext);
  if (!ctx) throw new Error("useRas must be used within RasProvider");
  return ctx;
}
