import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import type { RasData } from "./types";

const STATE_ID = "default";

export interface RemoteRasSnapshot {
  data: RasData;
  revision: number;
}

function isRasData(value: unknown): value is RasData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RasData>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.ingredients) &&
    Boolean(candidate.settings)
  );
}

export function hasSupabaseDatabase(): boolean {
  return supabaseConfigured;
}

export async function loadRasData(): Promise<RemoteRasSnapshot | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ras_state")
    .select("data, revision")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) throw new Error(`Supabase load failed: ${error.message}`);
  if (!data) return null;
  if (!isRasData(data.data)) throw new Error("Supabase contains an incompatible RAS dataset");

  return { data: data.data, revision: Number(data.revision ?? 0) };
}

export async function saveRasData(data: RasData): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: saved, error } = await supabase
    .from("ras_state")
    .upsert({ id: STATE_ID, data }, { onConflict: "id" })
    .select("revision")
    .single();

  if (error) throw new Error(`Supabase save failed: ${error.message}`);
  return Number(saved.revision ?? 0);
}
