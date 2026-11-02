import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { RasProvider } from "@/lib/ras/store";
import App from "@/routes/index";

describe("role navigation", () => {
  beforeEach(() => localStorage.clear());

  it("redirects kitchen staff away from the manager-only menu URL", async () => {
    render(
      <MemoryRouter initialEntries={["/menu"]}>
        <RasProvider>
          <App />
        </RasProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Kitchen Staff" }));
    expect(await screen.findByRole("heading", { name: "Kitchen display" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Menu management" })).toBeNull();
  });

  it("opens the manager dashboard after sign-in from an accessible kitchen URL", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <RasProvider>
          <App />
        </RasProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Manager" }));
    expect(await screen.findByRole("heading", { name: "Restaurant overview" })).toBeTruthy();
  });
});
