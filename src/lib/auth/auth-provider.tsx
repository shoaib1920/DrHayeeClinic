"use client";

import { type User, onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { getStaffProfile } from "@/lib/firestore/staff";
import type { Staff } from "@/types/staff";

interface AuthContextValue {
  user: User | null;
  /** Null when signed out, or when the account has no staff record yet. */
  staff: Staff | null;
  /** True until both the auth state and the staff record have resolved. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  staff: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (cancelled) return;
      setUser(nextUser);

      if (!nextUser) {
        setStaff(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await getStaffProfile(nextUser.uid);
        if (!cancelled) setStaff(profile);
      } catch (error) {
        console.error("[auth] could not load staff profile", error);
        if (!cancelled) setStaff(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, staff, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
