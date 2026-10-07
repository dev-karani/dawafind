import { describe, expect, it } from "vitest";
import { defaultHours, openStatus } from "./hours";

describe("opening status (Africa/Nairobi)", () => {
  it("is open during hours", () => {
    // Wed 2026-10-07 09:00 Nairobi = 06:00 UTC
    expect(openStatus(defaultHours(), new Date("2026-10-07T06:00:00Z"))).toMatchObject({ open: true });
  });
  it("is closed before opening", () => {
    // Wed 06:00 Nairobi = 03:00 UTC
    const s = openStatus(defaultHours(), new Date("2026-10-07T03:00:00Z"));
    expect(s.open).toBe(false);
    expect(s.label).toContain("opens 8:00 AM");
  });
  it("finds the next open day when closed on Sunday", () => {
    // Sun 2026-10-04 12:00 Nairobi
    const s = openStatus(defaultHours(), new Date("2026-10-04T09:00:00Z"));
    expect(s.open).toBe(false);
    expect(s.label).toContain("tomorrow");
  });
  it("handles missing hours", () => {
    expect(openStatus(null).open).toBeNull();
  });
});
