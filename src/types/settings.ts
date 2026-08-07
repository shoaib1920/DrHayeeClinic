import type { LabTestOption } from "@/lib/lab-tests";

/**
 * Clinic-wide settings, stored in a single `settings/clinic` document so prices
 * can be changed by the doctor without touching code.
 */
export interface ClinicSettings {
  consultationFee: number;
  labTests: LabTestOption[];
  /** Tap-to-fill options on the doctor's diagnosis field. */
  commonDiagnoses: string[];
}
