import type { Timestamp } from "firebase/firestore";

/**
 * The clinic runs two independent cash drawers, so a visit produces up to two
 * separate bills collected by two different people:
 *
 *  consultation — taken at the token desk by reception, before the doctor
 *  lab          — taken at the lab counter by the lab technician, if tests are ordered
 *
 * They are deliberately not combined into one total; each station reconciles
 * its own drawer at the end of the day.
 */
export type BillType = "consultation" | "lab";

export interface BillItem {
  label: string;
  amount: number;
}

export interface Bill {
  id: string;
  type: BillType;
  visitId: string;
  patientId: string;
  patientName: string;
  tokenNumber?: number;
  date: string; // YYYY-MM-DD, so "today's collection" can be queried directly
  items: BillItem[];
  total: number;
  paid: boolean;
  paidAt?: Timestamp;
  /** Which staff account took the money — for drawer reconciliation. */
  collectedByUid?: string;
  createdAt: Timestamp;
}
