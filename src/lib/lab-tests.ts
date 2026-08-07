/**
 * Fallback test menu, used before the clinic has saved its own price list.
 * Once settings exist in Firestore they take priority — see
 * `src/lib/firestore/settings.ts`.
 */
export interface LabTestOption {
  name: string;
  fee: number;
}

export const DEFAULT_LAB_TESTS: LabTestOption[] = [
  { name: "CBC (Complete Blood Count)", fee: 850 },
  { name: "Blood Sugar Random", fee: 200 },
  { name: "Blood Sugar Fasting", fee: 200 },
  { name: "Urine R/E", fee: 450 },
  { name: "LFTs (Liver Function)", fee: 1200 },
  { name: "RFTs (Renal Function)", fee: 1200 },
  { name: "Lipid Profile", fee: 1500 },
  { name: "Widal Test", fee: 600 },
  { name: "Malaria Parasite (MP)", fee: 400 },
  { name: "ESR", fee: 300 },
];

export const DEFAULT_CONSULTATION_FEE = 500;

export const DEFAULT_DIAGNOSES = [
  "Upper Respiratory Tract Infection",
  "Fever — viral",
  "Hypertension",
  "Type 2 Diabetes",
  "Gastroenteritis",
  "Seasonal Allergy",
  "Vitamin D Deficiency",
  "Urinary Tract Infection",
];

const FALLBACK_TEST_FEE = 500;

export function feeForTest(name: string, tests: LabTestOption[] = DEFAULT_LAB_TESTS): number {
  return tests.find((t) => t.name === name)?.fee ?? FALLBACK_TEST_FEE;
}
