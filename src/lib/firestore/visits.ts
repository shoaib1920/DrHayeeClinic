import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Gender } from "@/types/patient";
import type { Visit, VisitStatus, Vitals } from "@/types/visit";

const VISITS_COLLECTION = "visits";
const COUNTERS_COLLECTION = "counters";

export function getTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toVisit(id: string, data: Record<string, unknown>): Visit {
  return { id, ...data } as Visit;
}

interface CheckInPatient {
  id: string;
  name: string;
  age?: number;
  gender?: Gender;
}

/**
 * Assigns the next daily token number and creates the visit doc atomically,
 * so two walk-ins checking in at the same moment never get the same token.
 */
export async function checkInPatient(patient: CheckInPatient): Promise<Visit> {
  const date = getTodayDateString();
  const counterRef = doc(db, COUNTERS_COLLECTION, date);
  const visitRef = doc(collection(db, VISITS_COLLECTION));

  const tokenNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastToken = counterSnap.exists() ? (counterSnap.data().lastToken as number) : 0;
    const nextToken = lastToken + 1;

    transaction.set(counterRef, { lastToken: nextToken }, { merge: true });
    transaction.set(visitRef, {
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age ?? null,
      patientGender: patient.gender ?? null,
      date,
      tokenNumber: nextToken,
      status: "waiting" satisfies VisitStatus,
      checkedInAt: serverTimestamp(),
    });

    return nextToken;
  });

  return {
    id: visitRef.id,
    patientId: patient.id,
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    date,
    tokenNumber,
    status: "waiting",
    checkedInAt: Timestamp.now(),
  };
}

export function subscribeToTodayQueue(
  onChange: (visits: Visit[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const date = getTodayDateString();
  const q = query(
    collection(db, VISITS_COLLECTION),
    where("date", "==", date),
    orderBy("tokenNumber", "asc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => toVisit(d.id, d.data())));
    },
    (error) => onError?.(error),
  );
}

const NEXT_STATUS: Record<VisitStatus, VisitStatus | null> = {
  waiting: "in_consultation",
  in_consultation: "done",
  done: null,
};

export async function advanceVisitStatus(visitId: string, currentStatus: VisitStatus): Promise<void> {
  const nextStatus = NEXT_STATUS[currentStatus];
  if (!nextStatus) return;

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "in_consultation") patch.calledAt = serverTimestamp();
  if (nextStatus === "done") patch.doneAt = serverTimestamp();

  await updateDoc(doc(db, VISITS_COLLECTION, visitId), patch);
}

export async function getVisit(visitId: string): Promise<Visit | null> {
  const snap = await getDoc(doc(db, VISITS_COLLECTION, visitId));
  if (!snap.exists()) return null;
  return toVisit(snap.id, snap.data());
}

export function subscribeToVisit(
  visitId: string,
  onChange: (visit: Visit | null) => void,
): () => void {
  return onSnapshot(doc(db, VISITS_COLLECTION, visitId), (snap) => {
    onChange(snap.exists() ? toVisit(snap.id, snap.data()) : null);
  });
}

/** All of today's visits currently in the doctor's room (usually just one). */
export function subscribeToInConsultation(
  onChange: (visits: Visit[]) => void,
): () => void {
  const date = getTodayDateString();
  const q = query(
    collection(db, VISITS_COLLECTION),
    where("date", "==", date),
    where("status", "==", "in_consultation" satisfies VisitStatus),
    orderBy("tokenNumber", "asc"),
  );
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => toVisit(d.id, d.data()))));
}

export async function getVisitsInDateRange(startDate: string, endDate: string): Promise<Visit[]> {
  const q = query(
    collection(db, VISITS_COLLECTION),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVisit(d.id, d.data()));
}

/** Patients the doctor asked to come back on this date. */
export function subscribeToFollowUpsDue(
  date: string,
  onChange: (visits: Visit[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, VISITS_COLLECTION), where("followUpDate", "==", date));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toVisit(d.id, d.data()))),
    (error) => onError?.(error),
  );
}

export async function getPatientVisits(patientId: string): Promise<Visit[]> {
  const q = query(
    collection(db, VISITS_COLLECTION),
    where("patientId", "==", patientId),
    orderBy("checkedInAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVisit(d.id, d.data()));
}

interface ConsultationData {
  complaint: string;
  diagnosis: string;
  vitals: Vitals;
  labOrderId?: string;
  followUpDate?: string;
}

/**
 * Closes out the visit from the doctor's side. No money is involved here —
 * reception already took the consultation fee at the token desk, and the lab
 * takes its own fee separately if tests were ordered.
 */
export async function finalizeConsultation(
  visitId: string,
  data: ConsultationData,
): Promise<void> {
  const vitals: Record<string, unknown> = {};
  if (data.vitals.bp !== undefined) vitals.bp = data.vitals.bp;
  if (data.vitals.temperature !== undefined) vitals.temperature = data.vitals.temperature;
  if (data.vitals.weight !== undefined) vitals.weight = data.vitals.weight;

  const patch: Record<string, unknown> = {
    complaint: data.complaint,
    diagnosis: data.diagnosis,
    vitals,
    status: "done" satisfies VisitStatus,
    doneAt: serverTimestamp(),
  };
  if (data.labOrderId) patch.labOrderIds = [data.labOrderId];
  if (data.followUpDate) patch.followUpDate = data.followUpDate;

  await updateDoc(doc(db, VISITS_COLLECTION, visitId), patch);
}

/**
 * Rough estimate only: average actual consultation time from today's
 * completed visits, times how many waiting tokens are ahead of this one.
 * Returns null until there's at least one completed visit to base it on.
 */
export function estimateWaitMinutes(visits: Visit[], targetVisit: Visit): number | null {
  if (targetVisit.status !== "waiting") return 0;

  const completed = visits.filter(
    (v) => v.status === "done" && v.calledAt && v.doneAt,
  );
  if (completed.length === 0) return null;

  const totalMinutes = completed.reduce((sum, v) => {
    const minutes = (v.doneAt!.toMillis() - v.calledAt!.toMillis()) / 60000;
    return sum + minutes;
  }, 0);
  const avgMinutes = totalMinutes / completed.length;

  const waitingAhead = visits.filter(
    (v) =>
      (v.status === "waiting" || v.status === "in_consultation") &&
      v.tokenNumber < targetVisit.tokenNumber,
  ).length;

  return Math.round(avgMinutes * waitingAhead);
}
