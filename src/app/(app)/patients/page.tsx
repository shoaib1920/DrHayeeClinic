"use client";

import { Search, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import { searchPatients } from "@/lib/firestore/patients";
import type { Patient } from "@/types/patient";

/**
 * Patient lookup, for when someone needs a record outside the live queue —
 * a patient who lost their slip, or a phone enquiry about an old visit.
 */
export default function PatientsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setSearching(true);
      searchPatients(query, 25)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setError(null);
        })
        .catch((err: Error) => {
          console.error(err);
          if (!cancelled) setError(err);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const trimmed = query.trim();
  const displayed = trimmed ? results : [];

  return (
    <AppShell title="Patient Records">
      <div className="mx-auto max-w-4xl space-y-lg p-margin-mobile md:p-margin-desktop">
        <div className="space-y-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Find a Patient</h1>
          <p className="text-on-surface-variant">
            Search by phone number or name to open the full record, past visits and slips.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-md h-5 w-5 -translate-y-1/2 text-outline" />
          <input
            autoFocus
            dir="auto"
            placeholder="Phone number or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[56px] w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest pr-md pl-14 font-body-md text-body-lg text-on-surface outline-none transition-all focus:border-secondary"
          />
        </div>

        <QueryError error={error} />

        {searching && <p className="py-lg text-center text-on-surface-variant">Searching…</p>}

        {!searching && !trimmed && (
          <p className="py-xl text-center text-on-surface-variant">
            Start typing a name or phone number.
          </p>
        )}

        {!searching && trimmed && displayed.length === 0 && !error && (
          <p className="py-xl text-center text-on-surface-variant">
            No patient found for “{trimmed}”.
          </p>
        )}

        <div className="space-y-sm">
          {displayed.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="flex items-center justify-between gap-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-lg transition-all hover:border-primary hover:bg-surface-container-low"
            >
              <div className="flex items-center gap-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-body-lg font-bold" dir="auto">
                    {patient.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {patient.phone}
                    {patient.age ? ` · ${patient.age} yrs` : ""}
                    {patient.gender ? ` · ${patient.gender}` : ""}
                  </p>
                </div>
              </div>
              <span className="font-label-md font-bold text-primary">Open →</span>
            </Link>
          ))}
        </div>

        <p className="pt-lg text-center text-xs text-on-surface-variant">
          Search matches the start of a name or phone number.
        </p>
      </div>
    </AppShell>
  );
}
