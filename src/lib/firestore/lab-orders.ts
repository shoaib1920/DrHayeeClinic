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
import type { LabOrder, LabTest } from "@/types/lab-order";

const LAB_ORDERS_COLLECTION = "labOrders";

function toLabOrder(id: string, data: Record<string, unknown>): LabOrder {
  return { id, ...data } as LabOrder;
}

export async function createLabOrder(
  visitId: string,
  patientId: string,
  patientName: string,
  testNames: string[],
  tokenNumber?: number,
): Promise<LabOrder> {
  const tests: LabTest[] = testNames.map((name) => ({ name, status: "pending" }));
  const ref = await addDoc(collection(db, LAB_ORDERS_COLLECTION), {
    visitId,
    patientId,
    patientName,
    tokenNumber: tokenNumber ?? null,
    tests,
    orderedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return toLabOrder(ref.id, snap.data() as Record<string, unknown>);
}

export async function getLabOrder(id: string): Promise<LabOrder | null> {
  const snap = await getDoc(doc(db, LAB_ORDERS_COLLECTION, id));
  if (!snap.exists()) return null;
  return toLabOrder(snap.id, snap.data());
}

export async function getLabOrdersForPatient(patientId: string): Promise<LabOrder[]> {
  const snap = await getDocs(
    query(collection(db, LAB_ORDERS_COLLECTION), where("patientId", "==", patientId)),
  );
  return snap.docs.map((d) => toLabOrder(d.id, d.data()));
}

/** All lab orders, newest first — the lab tech screen filters to ones with pending tests client-side. */
export function subscribeToLabOrders(
  onChange: (orders: LabOrder[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, LAB_ORDERS_COLLECTION), orderBy("orderedAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toLabOrder(d.id, d.data()))),
    (error) => onError?.(error),
  );
}

export async function saveLabResults(labOrderId: string, tests: LabTest[]): Promise<void> {
  const allComplete = tests.every((t) => t.status === "completed");
  await updateDoc(doc(db, LAB_ORDERS_COLLECTION, labOrderId), {
    tests,
    ...(allComplete ? { completedAt: serverTimestamp() } : {}),
  });
}
