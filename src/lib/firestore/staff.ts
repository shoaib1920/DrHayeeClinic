import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STAFF_ROLES, type Staff, type StaffRole } from "@/types/staff";

const STAFF_COLLECTION = "staff";

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

/**
 * Loads the signed-in user's staff record. Returns null when no record exists
 * (or its role is unrecognised), which the UI surfaces as "no role assigned"
 * rather than silently granting access.
 */
export async function getStaffProfile(uid: string): Promise<Staff | null> {
  const snap = await getDoc(doc(db, STAFF_COLLECTION, uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (!isStaffRole(data.role)) return null;

  return {
    uid: snap.id,
    name: typeof data.name === "string" ? data.name : "",
    email: typeof data.email === "string" ? data.email : "",
    role: data.role,
  };
}
