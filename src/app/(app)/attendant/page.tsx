"use client";

import { ArrowRight, CheckCircle2, DoorOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import { advanceVisitStatus, subscribeToTodayQueue } from "@/lib/firestore/visits";
import type { Visit } from "@/types/visit";

/**
 * The token attendant's screen. Deliberately sparse: this person stands at the
 * cabin door and only needs to know who is inside and who is next, so the whole
 * screen is built around two large, unmistakable actions.
 */
export default function AttendantPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToTodayQueue(
      (next) => {
        setVisits(next);
        setLoadError(null);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoadError(error);
        setLoading(false);
      },
    );
  }, []);

  const inCabin = useMemo(() => visits.filter((v) => v.status === "in_consultation"), [visits]);
  const waiting = useMemo(() => visits.filter((v) => v.status === "waiting"), [visits]);
  const doneCount = useMemo(() => visits.filter((v) => v.status === "done").length, [visits]);

  async function handleAdvance(visit: Visit, label: string) {
    setBusyId(visit.id);
    try {
      await advanceVisitStatus(visit.id, visit.status);
      toast.success(`Token #${visit.tokenNumber} — ${label}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not update. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  const next = waiting[0];

  return (
    <AppShell title="Token Desk">
      <div className="mx-auto max-w-5xl space-y-lg px-margin-mobile py-lg md:px-margin-desktop">
        <QueryError error={loadError} />

        {/* Who is with the doctor right now */}
        <section className="rounded-3xl border-2 border-secondary/30 bg-secondary-container/20 p-lg">
          <p className="mb-md text-xs font-bold tracking-widest text-on-surface-variant uppercase">
            Inside the Doctor&apos;s Cabin
          </p>
          {inCabin.length === 0 ? (
            <div className="flex flex-col items-center gap-md py-lg text-center">
              <DoorOpen className="h-10 w-10 text-on-surface-variant" />
              <p className="text-body-lg text-on-surface-variant">
                Cabin is free — send in the next token.
              </p>
            </div>
          ) : (
            <div className="space-y-md">
              {inCabin.map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-wrap items-center justify-between gap-md rounded-2xl bg-surface-container-lowest p-lg shadow-sm"
                >
                  <div className="flex items-center gap-lg">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-on-secondary">
                      {visit.tokenNumber}
                    </div>
                    <div>
                      <p className="font-headline-md text-headline-md" dir="auto">
                        {visit.patientName}
                      </p>
                      <p className="text-sm text-on-surface-variant">With the doctor now</p>
                    </div>
                  </div>
                  <button
                    disabled={busyId === visit.id}
                    onClick={() => handleAdvance(visit, "finished")}
                    className="flex h-14 items-center gap-sm rounded-xl bg-primary px-lg text-base font-bold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {busyId === visit.id ? "…" : "Patient Came Out"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* The next token to send in */}
        {next && (
          <section className="flex flex-wrap items-center justify-between gap-md rounded-3xl border-2 border-primary/30 bg-primary/5 p-lg">
            <div className="flex items-center gap-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-on-primary">
                {next.tokenNumber}
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
                  Next in line
                </p>
                <p className="font-headline-md text-headline-md" dir="auto">
                  {next.patientName}
                </p>
              </div>
            </div>
            <button
              disabled={busyId === next.id}
              onClick={() => handleAdvance(next, "sent in")}
              className="flex h-16 items-center gap-sm rounded-xl bg-primary px-xl text-lg font-bold text-on-primary shadow-lg transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
            >
              {busyId === next.id ? "…" : "Send In"}
              <ArrowRight className="h-6 w-6" />
            </button>
          </section>
        )}

        {/* Everyone else still waiting */}
        <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-lg py-md">
            <span className="font-bold text-on-surface">Waiting</span>
            <span className="text-label-md text-on-surface-variant">
              {waiting.length} waiting · {doneCount} done today
            </span>
          </div>

          {loading && <p className="py-8 text-center text-on-surface-variant">Loading…</p>}
          {!loading && waiting.length === 0 && (
            <p className="py-8 text-center text-on-surface-variant">
              Nobody is waiting right now.
            </p>
          )}
          {/* The only waiting patient is already shown in the "Next in line"
              card above, so say so rather than rendering an empty box. */}
          {!loading && waiting.length === 1 && (
            <p className="py-8 text-center text-on-surface-variant">
              Only token #{waiting[0].tokenNumber} is waiting — shown above.
            </p>
          )}

          <div className="divide-y divide-outline-variant">
            {waiting.slice(1).map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-md px-lg py-md">
                <div className="flex items-center gap-lg">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-lg font-bold text-on-surface">
                    {visit.tokenNumber}
                  </div>
                  <p className="text-body-lg font-medium" dir="auto">
                    {visit.patientName}
                  </p>
                </div>
                <button
                  disabled={busyId === visit.id || inCabin.length > 0}
                  onClick={() => handleAdvance(visit, "sent in")}
                  title={inCabin.length > 0 ? "The cabin is occupied" : undefined}
                  className="rounded-xl border border-outline px-lg py-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container disabled:opacity-40"
                >
                  Send In
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
