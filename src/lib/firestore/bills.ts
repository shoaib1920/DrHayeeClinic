import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getTodayDateString } from "@/lib/firestore/visits";
import type { Bill, BillItem, BillType } from "@/types/bill";

const BILLS_COLLECTION = "bills";

function toBill(id: string, data: Record<string, unknown>): Bill {
  return { id, ...data } as Bill;
}

interface CreateBillInput {
  type: BillType;
  visitId: string;
  patientId: string;
  patientName: string;
  tokenNumber?: number;
  items: BillItem[];
  /** Reception takes the consultation fee at the desk, so it's usually paid on creation. */
  paid: boolean;
  collectedByUid?: string;
}

export async function createBill(input: CreateBillInput): Promise<Bill> {
  const total = input.items.reduce((sum, item) => sum + item.amount, 0);
  const ref = await addDoc(collection(db, BILLS_COLLECTION), {
    type: input.type,
    visitId: input.visitId,
    patientId: input.patientId,
    patientName: input.patientName,
    tokenNumber: input.tokenNumber ?? null,
    date: getTodayDateString(),
    items: input.items,
    total,
    paid: input.paid,
    ...(input.paid ? { paidAt: serverTimestamp() } : {}),
    ...(input.collectedByUid ? { collectedByUid: input.collectedByUid } : {}),
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return toBill(ref.id, snap.data() as Record<string, unknown>);
}

export async function getBill(id: string): Promise<Bill | null> {
  const snap = await getDoc(doc(db, BILLS_COLLECTION, id));
  if (!snap.exists()) return null;
  return toBill(snap.id, snap.data());
}

export async function markBillPaid(billId: string, collectedByUid?: string): Promise<void> {
  await updateDoc(doc(db, BILLS_COLLECTION, billId), {
    paid: true,
    paidAt: serverTimestamp(),
    ...(collectedByUid ? { collectedByUid } : {}),
  });
}

/** Live view of one drawer's takings for today. */
export function subscribeToTodayBillsOfType(
  type: BillType,
  onChange: (bills: Bill[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, BILLS_COLLECTION),
    where("date", "==", getTodayDateString()),
    where("type", "==", type),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toBill(d.id, d.data()))),
    (error) => onError?.(error),
  );
}

/** Both drawers for today — used by the doctor's dashboard. */
export function subscribeToTodayBills(
  onChange: (bills: Bill[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, BILLS_COLLECTION),
    where("date", "==", getTodayDateString()),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toBill(d.id, d.data()))),
    (error) => onError?.(error),
  );
}

export async function getBillsForVisit(visitId: string): Promise<Bill[]> {
  const snap = await getDocs(
    query(collection(db, BILLS_COLLECTION), where("visitId", "==", visitId)),
  );
  return snap.docs.map((d) => toBill(d.id, d.data()));
}

export async function getBillsForPatient(patientId: string): Promise<Bill[]> {
  const snap = await getDocs(
    query(collection(db, BILLS_COLLECTION), where("patientId", "==", patientId)),
  );
  return snap.docs.map((d) => toBill(d.id, d.data()));
}
