import { describe, expect, it } from "vitest";
import { freshness, freshnessLevel, stockAgeSentence, timeAgo } from "./freshness";

const now = new Date("2026-10-03T12:00:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60000);

describe("stock freshness", () => {
  it.each([
    [0, "HIGH"],
    [60, "HIGH"],
    [61, "MEDIUM"],
    [360, "MEDIUM"],
    [361, "LOW"],
    [1440, "LOW"],
    [1441, "STALE"],
  ])("%i minutes → %s", (m, level) => {
    expect(freshnessLevel(m)).toBe(level);
  });

  it("formats relative time", () => {
    expect(timeAgo(ago(18), now)).toBe("18 minutes ago");
    expect(timeAgo(ago(1), now)).toBe("1 minute ago");
    expect(timeAgo(ago(180), now)).toBe("3 hours ago");
    expect(timeAgo(ago(2 * 1440), now)).toBe("2 days ago");
  });

  it("never describes stale stock as live", () => {
    expect(stockAgeSentence(freshness(ago(18), now))).toBe("Stock updated 18 minutes ago");
    expect(stockAgeSentence(freshness(ago(2 * 1440), now))).toBe("Stock information is 2 days old");
  });
});
