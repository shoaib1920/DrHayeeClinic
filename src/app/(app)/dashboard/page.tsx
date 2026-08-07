"use client";

import { CalendarCheck, Hourglass, RefreshCw, TestTube, UserRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { subscribeToTodayBills } from "@/lib/firestore/bills";
import { getTodayDateString, getVisitsInDateRange } from "@/lib/firestore/visits";
import type { Bill } from "@/types/bill";
import type { Visit } from "@/types/visit";

function daysAgoString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getTodayDateString(d);
}

const DIAGNOSIS_BAR_COLORS = [
  "bg-primary text-primary",
  "bg-secondary text-secondary",
  "bg-surface-tint text-surface-tint",
  "bg-outline text-outline",
  "bg-tertiary text-tertiary",
];

export default function DashboardPage() {
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [weekVisits, setWeekVisits] = useState<Visit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const today = getTodayDateString();
    const [todayResult, weekResult] = await Promise.all([
      getVisitsInDateRange(today, today),
      getVisitsInDateRange(daysAgoString(6), today),
    ]);
    setTodayVisits(todayResult);
    setWeekVisits(weekResult);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    const unsubscribe = subscribeToTodayBills(setBills);
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const paid = bills.filter((b) => b.paid);
  const consultationTotal = paid
    .filter((b) => b.type === "consultation")
    .reduce((sum, b) => sum + b.total, 0);
  const labTotal = paid.filter((b) => b.type === "lab").reduce((sum, b) => sum + b.total, 0);

  const doneToday = todayVisits.filter((v) => v.status === "done").length;
  const donePercent =
    todayVisits.length > 0 ? Math.round((doneToday / todayVisits.length) * 100) : 0;
  const waitingNow = todayVisits.filter((v) => v.status === "waiting").length;

  const diagnosisCounts = new Map<string, number>();
  for (const v of weekVisits) {
    const key = v.diagnosis?.trim();
    if (!key) continue;
    diagnosisCounts.set(key, (diagnosisCounts.get(key) ?? 0) + 1);
  }
  const topDiagnoses = Array.from(diagnosisCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hourCounts = new Array(24).fill(0) as number[];
  for (const v of weekVisits) {
    const hour = v.checkedInAt?.toDate?.().getHours();
    if (typeof hour === "number") hourCounts[hour] += 1;
  }
  const maxHourCount = Math.max(1, ...hourCounts);
  const activeHourRange = { start: 8, end: 20 };

  return (
    <AppShell
      title="Doctor's Dashboard"
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-sm rounded-full bg-primary px-lg py-sm font-label-md font-bold text-on-primary shadow-md transition-all hover:opacity-90 disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-gutter p-margin-mobile md:p-margin-desktop">
        <StatTile
          icon={UserRound}
          iconBg="bg-primary-fixed"
          iconColor="text-on-primary-fixed"
          label="Patients Today"
          value={String(todayVisits.length)}
        />
        <StatTile
          icon={Wallet}
          iconBg="bg-secondary-fixed"
          iconColor="text-on-secondary-fixed"
          label="Reception Drawer"
          value={`Rs ${consultationTotal.toLocaleString()}`}
        />
        <StatTile
          icon={TestTube}
          iconBg="bg-primary-container"
          iconColor="text-on-primary-container"
          label="Lab Drawer"
          value={`Rs ${labTotal.toLocaleString()}`}
        />
        <StatTile
          icon={CalendarCheck}
          iconBg="bg-surface-container-highest"
          iconColor="text-on-surface"
          label="Done Today"
          value={String(doneToday)}
          badge={`${donePercent}%`}
        />

        {/* Combined total, stated separately so the two drawers stay distinct. */}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest px-lg py-md shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-md">
            <Hourglass className="h-5 w-5 text-on-surface-variant" />
            <span className="font-label-md text-on-surface-variant">
              {waitingNow} patient(s) waiting right now
            </span>
          </div>
          <div className="flex items-center gap-lg">
            <span className="font-label-md text-on-surface-variant">Total collected today</span>
            <span className="font-headline-md text-headline-md text-primary">
              Rs {(consultationTotal + labTotal).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)] lg:col-span-8">
          <div className="mb-xl flex items-end justify-between">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                Busiest Hours This Week
              </h4>
              <p className="text-label-md text-on-surface-variant">
                Patient flow distribution (8am - 8pm)
              </p>
            </div>
            <span className="inline-flex items-center gap-xs text-label-md text-on-surface-variant">
              <span className="h-3 w-3 rounded-full bg-primary" /> Check-ins
            </span>
          </div>
          <div className="flex h-64 items-end justify-between gap-sm pt-md">
            {hourCounts.slice(activeHourRange.start, activeHourRange.end).map((count, i) => {
              const hour = activeHourRange.start + i;
              const heightPercent = (count / maxHourCount) * 100;
              return (
                <div key={hour} className="flex flex-1 flex-col items-center gap-sm">
                  <div className="flex h-full w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-primary transition-all duration-500"
                      style={{ height: `${heightPercent}%`, minHeight: count > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-on-surface-variant">
                    {hour % 12 === 0 ? 12 : hour % 12}
                    {hour < 12 ? "am" : "pm"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)] lg:col-span-4">
          <div className="mb-lg flex items-center justify-between">
            <h4 className="font-headline-md text-headline-md text-on-surface">Common Diagnoses</h4>
            <span className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
              This Week
            </span>
          </div>
          {topDiagnoses.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No diagnoses recorded this week. The diagnosis field on the consultation screen is
              optional — fill it in if you want this report.
            </p>
          ) : (
            <div className="flex flex-col gap-md">
              {topDiagnoses.map(([name, count], i) => {
                const [barBg, textColor] =
                  DIAGNOSIS_BAR_COLORS[i % DIAGNOSIS_BAR_COLORS.length].split(" ");
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low p-md transition-colors hover:bg-surface-container"
                  >
                    <div className="flex items-center gap-md">
                      <div className={`h-8 w-2 rounded-full ${barBg}`} />
                      <p className="font-label-md font-bold text-on-surface" dir="auto">
                        {name}
                      </p>
                    </div>
                    <span className={`font-headline-md text-headline-md ${textColor}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  badge,
}: {
  icon: typeof UserRound;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="col-span-12 flex h-40 flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)] sm:col-span-6 lg:col-span-3">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-sm ${iconBg} ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        {badge && <span className="font-label-md font-bold text-primary">{badge}</span>}
      </div>
      <div>
        <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
        <h3 className="font-headline-lg text-headline-lg text-on-surface">{value}</h3>
      </div>
    </div>
  );
}
