import type { Timestamp } from "firebase/firestore";
import type { Gender } from "@/types/patient";

export type VisitStatus = "waiting" | "in_consultation" | "done";

export interface Vitals {
  bp?: string;
  temperature?: number;
  weight?: number;
}

export interface Visit {
  id: string;
  patientId: string;
  // Denormalized so the queue screen can render without a join/extra read per row.
  patientName: string;
  patientAge?: number;
  patientGender?: Gender;
  date: string; // YYYY-MM-DD — token numbering resets per day on this field
  tokenNumber: number;
  status: VisitStatus;
  checkedInAt: Timestamp;
  calledAt?: Timestamp;
  doneAt?: Timestamp;
  complaint?: string;
  diagnosis?: string;
  vitals?: Vitals;
  // No prescriptionId: the doctor writes medicines by hand on the printed slip,
  // so prescriptions are not stored digitally.
  labOrderIds?: string[];
  /** YYYY-MM-DD the doctor asked the patient to return; reception works from this. */
  followUpDate?: string;
  // No billId: a visit can produce two independent bills (consultation at the
  // token desk, lab at the lab counter). Look them up by visitId instead.
}
