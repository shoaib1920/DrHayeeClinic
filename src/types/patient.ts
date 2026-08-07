import type { Timestamp } from "firebase/firestore";

export type Gender = "male" | "female" | "other";

export interface Patient {
  id: string;
  /**
   * Short sequential number printed on the patient's card — far easier for
   * reception to type than the Firestore document ID, and it sidesteps
   * guessing at name spellings for repeat visitors.
   */
  mrNo?: number;
  name: string;
  phone: string;
  age?: number;
  gender?: Gender;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  /**
   * Set when this record was merged into another as a duplicate. Merged records
   * are hidden from search; their history is shown under the surviving patient.
   */
  mergedInto?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PatientInput = Pick<Patient, "name" | "phone"> &
  Partial<
    Pick<
      Patient,
      "age" | "gender" | "address" | "bloodGroup" | "allergies" | "chronicConditions"
    >
  >;
