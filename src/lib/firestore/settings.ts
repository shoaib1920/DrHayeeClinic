import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  DEFAULT_CONSULTATION_FEE,
  DEFAULT_DIAGNOSES,
  DEFAULT_LAB_TESTS,
  type LabTestOption,
} from "@/lib/lab-tests";
import type { ClinicSettings } from "@/types/settings";

const SETTINGS_DOC = "settings/clinic";

export const FALLBACK_SETTINGS: ClinicSettings = {
  consultationFee: DEFAULT_CONSULTATION_FEE,
  labTests: DEFAULT_LAB_TESTS,
  commonDiagnoses: DEFAULT_DIAGNOSES,
};

function toSettings(data: Record<string, unknown> | undefined): ClinicSettings {
  if (!data) return FALLBACK_SETTINGS;
  return {
    consultationFee:
      typeof data.consultationFee === "number"
        ? data.consultationFee
        : FALLBACK_SETTINGS.consultationFee,
    labTests: Array.isArray(data.labTests)
      ? (data.labTests as LabTestOption[])
      : FALLBACK_SETTINGS.labTests,
    commonDiagnoses: Array.isArray(data.commonDiagnoses)
      ? (data.commonDiagnoses as string[])
      : FALLBACK_SETTINGS.commonDiagnoses,
  };
}

/**
 * Live settings. Falls back to the built-in defaults when the document doesn't
 * exist yet, so a fresh clinic works before anyone visits the settings screen.
 */
export function subscribeToSettings(
  onChange: (settings: ClinicSettings) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, SETTINGS_DOC),
    (snap) => onChange(toSettings(snap.data())),
    (error) => {
      console.error(error);
      onChange(FALLBACK_SETTINGS);
      onError?.(error);
    },
  );
}

export async function saveSettings(settings: ClinicSettings): Promise<void> {
  await setDoc(doc(db, SETTINGS_DOC), settings, { merge: true });
}
