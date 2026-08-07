import type { Timestamp } from "firebase/firestore";

export type LabTestStatus = "pending" | "completed";

export interface LabTest {
  name: string;
  result?: string;
  unit?: string;
  status: LabTestStatus;
}

export interface LabOrder {
  id: string;
  visitId: string;
  patientId: string;
  // Denormalized so the lab tech screen can render without an extra patient read.
  patientName: string;
  tokenNumber?: number;
  tests: LabTest[];
  orderedAt: Timestamp;
  completedAt?: Timestamp;
}
