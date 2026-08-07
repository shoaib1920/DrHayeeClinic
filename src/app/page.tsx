"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { ROLE_HOME } from "@/types/staff";

export default function RootPage() {
  const { user, staff, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Send each person straight to their own station.
    router.replace(staff ? ROLE_HOME[staff.role] : "/queue");
  }, [loading, user, staff, router]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-surface">
      <p className="text-body-lg text-on-surface-variant">Loading…</p>
    </div>
  );
}
