import { describe, expect, it } from "vitest";
import { candidateWords, strengthsIn, suggestMedicines, type CatalogueMedicine } from "./scanMatch";

const med = (id: string, genericName: string, brandName: string | null, strength: string, dosageForm = "Tablets"): CatalogueMedicine => ({
  id,
  genericName,
  brandName,
  strength,
  dosageForm,
  packSize: "Pack",
});

const CATALOGUE = [
  med("a1", "Amoxicillin", "Amoxil", "500mg", "Capsules"),
  med("a2", "Amoxicillin", null, "250mg", "Capsules"),
  med("p1", "Paracetamol", "Panadol", "500mg"),
  med("m1", "Metformin", "Glucophage", "500mg"),
  med("m2", "Metformin", null, "850mg"),
  med("l1", "Losartan", "Cozaar", "50mg"),
  med("c1", "Ciprofloxacin", "Ciprobay", "500mg"),
  med("c2", "Cetirizine", "Zyrtec", "10mg"),
  med("art", "Artemether/Lumefantrine", "Coartem", "20mg/120mg"),
];

describe("strengthsIn", () => {
  it("normalises spacing, case and O/0 confusion", () => {
    expect(strengthsIn("Amoxicillin 500 mg tds")).toContain("500mg");
    expect(strengthsIn("Metformin 5OOMG")).toContain("500mg");
    expect(strengthsIn("take once daily")).toEqual([]);
  });
});

describe("candidateWords", () => {
  it("keeps only word-like tokens of 4+ letters", () => {
    expect(candidateWords("Rx: Amox 500mg x 7d")).toEqual(["amox"]);
  });
});

describe("suggestMedicines", () => {
  it("finds exact names and ranks the written strength first", () => {
    const [s] = suggestMedicines("Amoxicillin 250 mg  1 cap tds x 5/7", CATALOGUE);
    expect(s.name).toBe("Amoxicillin");
    expect(s.medicines[0].id).toBe("a2");
    expect(s.medicines[0].strengthMatch).toBe(true);
  });

  it("tolerates handwriting/OCR misreads", () => {
    const names = (t: string) => suggestMedicines(t, CATALOGUE).map((s) => s.name);
    expect(names("Amoxicilin 500mg")).toContain("Amoxicillin");
    expect(names("Paracetamoi 500mg")).toContain("Paracetamol");
    expect(names("Metfornin 85Omg")).toContain("Metformin");
    expect(names("Cipro floxacin")).not.toContain("Cetirizine");
  });

  it("matches brand names", () => {
    expect(suggestMedicines("Panadol two tabs", CATALOGUE).map((s) => s.name)).toContain("Panadol");
  });

  it("matches each part of a compound name", () => {
    expect(suggestMedicines("Coartem 4 tabs bd", CATALOGUE)[0].medicines[0].id).toBe("art");
  });

  it("does not match unrelated words", () => {
    expect(suggestMedicines("Take twice daily after meals for seven days", CATALOGUE)).toEqual([]);
    expect(suggestMedicines("", CATALOGUE)).toEqual([]);
  });

  it("never merges different strengths", () => {
    const [s] = suggestMedicines("Metformin", CATALOGUE);
    expect(s.medicines.map((m) => m.strength).sort()).toEqual(["500mg", "850mg"]);
  });
});

describe("strength association", () => {
  it("only credits a strength written on the same line as the medicine", () => {
    const res = suggestMedicines("Amoxicillin 500mg tds\nParacetamol 1g prn", CATALOGUE);
    const para = res.find((r) => r.name === "Paracetamol")!;
    expect(para.medicines.every((m) => !m.strengthMatch)).toBe(true);
    expect(res.find((r) => r.name === "Amoxicillin")!.medicines[0].strengthMatch).toBe(true);
  });
});
