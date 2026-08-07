/**
 * One role per person, mirroring the clinic's physical stations:
 *
 *  reception — writes the token, takes the consultation fee into the front drawer
 *  attendant — holds the tokens and sends patients into the doctor's cabin one by one
 *  doctor    — consults and prints the prescription slip (handles no money)
 *  lab       — takes samples, collects the separate lab fee, enters results
 */
export type StaffRole = "reception" | "attendant" | "doctor" | "lab";

export const STAFF_ROLES: StaffRole[] = ["reception", "attendant", "doctor", "lab"];

export const ROLE_LABEL: Record<StaffRole, string> = {
  reception: "Reception",
  attendant: "Token Attendant",
  doctor: "Doctor",
  lab: "Laboratory",
};

/** Where each role lands after login, and the only pages it may open. */
export const ROLE_HOME: Record<StaffRole, string> = {
  reception: "/queue",
  attendant: "/attendant",
  doctor: "/consultation",
  lab: "/lab",
};

export const ROLE_ALLOWED_PATHS: Record<StaffRole, string[]> = {
  reception: ["/queue", "/patients", "/closing"],
  attendant: ["/attendant", "/display"],
  doctor: ["/consultation", "/patients", "/dashboard", "/closing", "/settings"],
  lab: ["/lab", "/patients"],
};

export function canAccessPath(role: StaffRole, pathname: string): boolean {
  return ROLE_ALLOWED_PATHS[role].some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

export interface Staff {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
}
