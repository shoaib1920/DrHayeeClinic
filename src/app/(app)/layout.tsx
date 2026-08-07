"use client";

import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { auth } from "@/lib/firebase/client";
import { ROLE_HOME, canAccessPath } from "@/types/staff";

export default function AppRouteGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, staff, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = staff ? canAccessPath(staff.role, pathname) : false;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Signed in with a role, but on a screen belonging to another station —
    // bounce to their own home rather than showing a bare error.
    if (staff && !allowed) {
      router.replace(ROLE_HOME[staff.role]);
    }
  }, [loading, user, staff, allowed, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-surface">
        <p className="text-body-lg text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  // Authenticated, but the admin hasn't created a staff record for this account.
  if (!staff) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-surface p-md">
        <div className="w-full max-w-[32rem] space-y-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-xl text-center shadow-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface">No role assigned yet</h1>
          <p className="text-on-surface-variant">
            This account can sign in, but it hasn&apos;t been given a station yet. Ask the admin to
            create a <code className="rounded bg-surface-container px-1">staff</code> record for the
            ID below and set its role to one of{" "}
            <code className="rounded bg-surface-container px-1">reception</code>,{" "}
            <code className="rounded bg-surface-container px-1">attendant</code>,{" "}
            <code className="rounded bg-surface-container px-1">doctor</code> or{" "}
            <code className="rounded bg-surface-container px-1">lab</code>.
          </p>
          <div className="space-y-xs rounded-lg bg-surface-container-low p-md text-left">
            <p className="text-xs font-bold tracking-wider text-on-surface-variant uppercase">
              Account ID (UID)
            </p>
            <p className="font-mono text-sm break-all text-on-surface">{user.uid}</p>
            {user.email && (
              <p className="pt-xs text-sm text-on-surface-variant">{user.email}</p>
            )}
          </div>
          <button
            onClick={() => signOut(auth)}
            className="rounded-xl border border-outline-variant px-lg py-md font-bold text-on-surface-variant transition-all hover:bg-surface-container-low"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  // Redirecting to the role's own screen; avoid flashing the wrong panel.
  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-surface">
        <p className="text-body-lg text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
