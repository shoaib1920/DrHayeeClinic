"use client";

import { CalendarClock, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getPatient } from "@/lib/firestore/patients";
import { getTodayDateString, subscribeToFollowUpsDue } from "@/lib/firestore/visits";
import { shareOnWhatsApp } from "@/lib/share";
import type { Visit } from "@/types/visit";

/**
 * Patients the doctor asked to come back today. Shown at the token desk so
 * reception can nudge no-shows with one tap instead of nobody ever following up.
 */
export function FollowUpsDue() {
  const [due, setDue] = useState<Visit[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});

  useEffect(
    () => subscribeToFollowUpsDue(getTodayDateString(), setDue, (e) => console.error(e)),
    [],
  );

  useEffect(() => {
    const missing = due.map((v) => v.patientId).filter((id) => !(id in phones));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => getPatient(id).catch(() => null)))
      .then((patients) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        patients.forEach((p, i) => {
          if (p) next[missing[i]] = p.phone;
        });
        setPhones((prev) => ({ ...prev, ...next }));
      })
      .catch((e: Error) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [due, phones]);

  if (due.length === 0) return null;

  return (
    <section className="mb-xl rounded-2xl border border-secondary/30 bg-secondary-container/15 p-lg">
      <div className="mb-md flex items-center gap-sm">
        <CalendarClock className="h-5 w-5 text-on-secondary-container" />
        <h2 className="font-headline-md text-on-surface">
          {due.length} patient(s) due back today
        </h2>
      </div>
      <div className="space-y-sm">
        {due.map((visit) => (
          <div
            key={visit.id}
            className="flex flex-wrap items-center justify-between gap-md rounded-xl bg-surface-container-lowest p-md"
          >
            <div>
              <p className="font-bold" dir="auto">
                {visit.patientName}
              </p>
              <p className="text-xs text-on-surface-variant">
                Last seen {visit.date}
                {visit.diagnosis ? ` · ${visit.diagnosis}` : ""}
              </p>
            </div>
            <button
              onClick={() =>
                shareOnWhatsApp(
                  phones[visit.patientId],
                  `Assalam o Alaikum ${visit.patientName}, this is Dr. Abdul Hayee Medical Centre, Nankana Sahib. You are due for your follow-up visit today. Please visit us at your convenience.`,
                )
              }
              className="flex items-center gap-xs rounded-lg border border-outline px-md py-sm text-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
