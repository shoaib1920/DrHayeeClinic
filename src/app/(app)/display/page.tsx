"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToTodayQueue } from "@/lib/firestore/visits";
import type { Visit } from "@/types/visit";

/**
 * Waiting-room screen for a TV or spare phone. No chrome, no navigation —
 * just the number being served, readable from across the room, so patients
 * stop asking the desk whether their turn is coming.
 */
export default function DisplayPage() {
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => subscribeToTodayQueue(setVisits, (e) => console.error(e)), []);

  const serving = useMemo(() => visits.find((v) => v.status === "in_consultation"), [visits]);
  const upcoming = useMemo(
    () => visits.filter((v) => v.status === "waiting").slice(0, 4),
    [visits],
  );

  return (
    <div className="flex min-h-screen flex-col bg-inverse-surface text-inverse-on-surface">
      <header className="flex items-center justify-between px-xl py-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Dr. Abdul Hayee Medical Centre</h1>
          <p className="opacity-70">Nankana Sahib</p>
        </div>
        <p className="font-urdu text-urdu-body opacity-90">ڈاکٹر عبدالحئی میڈیکل سینٹر</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-lg px-xl">
        <p className="text-xl tracking-[0.3em] uppercase opacity-70">Now Serving</p>
        <p className="font-display-lg text-[clamp(6rem,28vw,20rem)] leading-none font-bold text-primary-fixed">
          {serving ? serving.tokenNumber : "—"}
        </p>
        {serving ? (
          <p className="text-center text-[clamp(1.5rem,4vw,3rem)] font-bold" dir="auto">
            {serving.patientName}
          </p>
        ) : (
          <p className="text-center text-[clamp(1.2rem,3vw,2rem)] opacity-70">
            Please wait — the doctor will call the next token shortly.
          </p>
        )}
      </main>

      <footer className="border-t border-white/15 px-xl py-lg">
        <p className="mb-md text-sm tracking-[0.2em] uppercase opacity-60">Next in line</p>
        <div className="flex flex-wrap gap-md">
          {upcoming.length === 0 && <p className="opacity-60">No one waiting.</p>}
          {upcoming.map((visit, i) => (
            <div
              key={visit.id}
              className={`flex items-center gap-md rounded-2xl px-lg py-md ${
                i === 0 ? "bg-primary/30" : "bg-white/10"
              }`}
            >
              <span className="text-3xl font-bold">{visit.tokenNumber}</span>
              <span className="text-lg opacity-80" dir="auto">
                {visit.patientName}
              </span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
