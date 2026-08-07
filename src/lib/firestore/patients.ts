import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAt,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Patient, PatientInput } from "@/types/patient";

const PATIENTS_COLLECTION = "patients";
const COUNTERS_COLLECTION = "counters";
const MR_COUNTER_DOC = "mrNo";

// A code point past any character a user could type — the standard Firestore
// trick for turning a startAt/endAt range into a prefix ("starts with") match.
const PREFIX_END_MARKER = String.fromCharCode(0xf8ff);

// Strip everything but digits and a leading "+" so phone search/dedup isn't
// thrown off by spaces, dashes, or parentheses the receptionist types.
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/(?!^\+)[^\d]/g, "");
}

function toPatient(id: string, data: Record<string, unknown>): Patient {
  return { id, ...data } as Patient;
}

/**
 * Creates the patient and assigns the next MR number in one transaction, so two
 * receptionists registering at the same moment can't be given the same number.
 */
export async function createPatient(input: PatientInput): Promise<Patient> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const counterRef = doc(db, COUNTERS_COLLECTION, MR_COUNTER_DOC);
  const patientRef = doc(collection(db, PATIENTS_COLLECTION));

  const mrNo = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const last = counterSnap.exists() ? (counterSnap.data().lastMrNo as number) : 1000;
    const next = last + 1;

    transaction.set(counterRef, { lastMrNo: next }, { merge: true });
    transaction.set(patientRef, {
      mrNo: next,
      name,
      nameLower: name.toLowerCase(),
      phone,
      age: input.age ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      bloodGroup: input.bloodGroup ?? null,
      allergies: input.allergies ?? [],
      chronicConditions: input.chronicConditions ?? [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return next;
  });

  const snap = await getDoc(patientRef);
  return toPatient(patientRef.id, { ...(snap.data() as Record<string, unknown>), mrNo });
}

export async function getPatient(id: string): Promise<Patient | null> {
  const snap = await getDoc(doc(db, PATIENTS_COLLECTION, id));
  if (!snap.exists()) return null;
  return toPatient(snap.id, snap.data());
}

export async function updatePatient(
  id: string,
  updates: Partial<PatientInput>,
): Promise<void> {
  const patch: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (typeof updates.name === "string") {
    patch.nameLower = updates.name.trim().toLowerCase();
  }
  if (typeof updates.phone === "string") {
    patch.phone = normalizePhone(updates.phone);
  }
  await updateDoc(doc(db, PATIENTS_COLLECTION, id), patch);
}

/**
 * Finds a patient by MR number, phone, or name — in that order of precision.
 * Records already merged into another patient are filtered out so reception
 * never checks someone in against a dead duplicate.
 */
export async function searchPatients(rawQuery: string, max = 8): Promise<Patient[]> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const results = new Map<string, Patient>();
  const digitsOnly = /^\d+$/.test(trimmed);

  // A short all-digit string is far more likely an MR number than a phone.
  if (digitsOnly && trimmed.length <= 6) {
    const snap = await getDocs(
      query(
        collection(db, PATIENTS_COLLECTION),
        where("mrNo", "==", Number(trimmed)),
        limit(max),
      ),
    );
    snap.forEach((d) => results.set(d.id, toPatient(d.id, d.data())));
  }

  if (/^[\d+]+$/.test(trimmed)) {
    const phonePrefix = normalizePhone(trimmed);
    const snap = await getDocs(
      query(
        collection(db, PATIENTS_COLLECTION),
        orderBy("phone"),
        startAt(phonePrefix),
        endAt(phonePrefix + PREFIX_END_MARKER),
        limit(max),
      ),
    );
    snap.forEach((d) => results.set(d.id, toPatient(d.id, d.data())));
  } else {
    const namePrefix = trimmed.toLowerCase();
    const snap = await getDocs(
      query(
        collection(db, PATIENTS_COLLECTION),
        orderBy("nameLower"),
        startAt(namePrefix),
        endAt(namePrefix + PREFIX_END_MARKER),
        limit(max),
      ),
    );
    snap.forEach((d) => results.set(d.id, toPatient(d.id, d.data())));
  }

  return Array.from(results.values())
    .filter((p) => !p.mergedInto)
    .slice(0, max);
}

/** Other live records sharing this patient's phone number — likely duplicates. */
export async function findDuplicatesByPhone(patient: Patient): Promise<Patient[]> {
  if (!patient.phone) return [];
  const snap = await getDocs(
    query(collection(db, PATIENTS_COLLECTION), where("phone", "==", patient.phone), limit(10)),
  );
  return snap.docs
    .map((d) => toPatient(d.id, d.data()))
    .filter((p) => p.id !== patient.id && !p.mergedInto);
}

/**
 * Marks `duplicateId` as merged into `primaryId`.
 *
 * Nothing is reassigned or deleted: visits and bills keep pointing at the old
 * patient ID, and the profile screen pulls history for the primary plus every
 * record merged into it. That keeps the merge a single write, which matters
 * because the security rules deliberately stop reception from touching lab
 * bills (and vice versa) — reassigning them would be refused.
 */
export async function mergePatients(primaryId: string, duplicateId: string): Promise<void> {
  await updateDoc(doc(db, PATIENTS_COLLECTION, duplicateId), {
    mergedInto: primaryId,
    updatedAt: serverTimestamp(),
  });
}

/** The primary's own ID plus any records merged into it. */
export async function getMergedPatientIds(primaryId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, PATIENTS_COLLECTION), where("mergedInto", "==", primaryId), limit(20)),
  );
  return [primaryId, ...snap.docs.map((d) => d.id)];
}
