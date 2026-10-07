import { describe, expect, it } from "vitest";
import { matchesQuery, medicineLabel, tokenize } from "./medicine";

const amox500 = { genericName: "Amoxicillin", brandName: "Amoxil", strength: "500mg", dosageForm: "Capsules", packSize: "Pack of 20" };
const amox250 = { ...amox500, strength: "250mg", brandName: null };
const amoxSusp = { ...amox500, strength: "250mg/5ml", dosageForm: "Suspension", brandName: null };

describe("medicine search", () => {
  it("normalises strengths and plurals", () => {
    expect(tokenize("Amoxicillin 500 mg Capsules")).toEqual(["amoxicillin", "500mg", "capsule"]);
  });

  it("matches generic, brand, strength and form", () => {
    expect(matchesQuery(amox500, "amoxicillin")).toBe(true);
    expect(matchesQuery(amox500, "amoxil")).toBe(true);
    expect(matchesQuery(amox500, "Amoxicillin 500mg")).toBe(true);
    expect(matchesQuery(amox500, "amoxicillin 500 mg capsule")).toBe(true);
    expect(matchesQuery(amox500, "amox caps")).toBe(true);
  });

  it("does not treat different strengths or forms as the same product", () => {
    expect(matchesQuery(amox250, "amoxicillin 500mg")).toBe(false);
    expect(matchesQuery(amoxSusp, "amoxicillin 500mg capsules")).toBe(false);
    expect(matchesQuery(amox500, "amoxicillin suspension")).toBe(false);
  });

  it("labels medicines with strength and form", () => {
    expect(medicineLabel(amox500)).toBe("Amoxicillin 500mg Capsules");
  });
});
