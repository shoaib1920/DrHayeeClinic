"use client";

import { AlertTriangle, Download, Printer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import { subscribeToTodayBills } from "@/lib/firestore/bills";
import { subscribeToLabOrders } from "@/lib/firestore/lab-orders";
import { getStaffProfile } from "@/lib/firestore/staff";
import { getTodayDateString, subscribeToTodayQueue } from "@/lib/firestore/visits";
import { downloadCsv, printClosingReport } from "@/lib/share";
import type { Bill } from "@/types/bill";
import type { LabOrder } from "@/types/lab-order";
import type { Visit } from "@/types/visit";

export default function ClosingPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [collectorNames, setCollectorNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubVisits = subscribeToTodayQueue(setVisits, setError);
    const unsubBills = subscribeToTodayBills(setBills, setError);
    const unsubLab = subscribeToLabOrders(setLabOrders, setError);
    return () => {
      unsubVisits();
      unsubBills();
      unsubLab();
    };
  }, []);

  // Resolve the UIDs stored on each bill into readable staff names.
  useEffect(() => {
    const uids = Array.from(
      new Set(bills.map((b) => b.collectedByUid).filter(Boolean) as string[]),
    ).filter((uid) => !(uid in collectorNames));
    if (uids.length === 0) return;

    let cancelled = false;
    Promise.all(uids.map((uid) => getStaffProfile(uid).catch(() => null)))
      .then((profiles) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        profiles.forEach((p, i) => {
          next[uids[i]] = p?.name || p?.email || "Unknown";
        });
        setCollectorNames((prev) => ({ ...prev, ...next }));
      })
      .catch((err: Error) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [bills, collectorNames]);

  const paid = useMemo(() => bills.filter((b) => b.paid), [bills]);
  const consultationBills = paid.filter((b) => b.type === "consultation");
  const labBills = paid.filter((b) => b.type === "lab");
  const consultationTotal = consultationBills.reduce((s, b) => s + b.total, 0);
  const labTotal = labBills.reduce((s, b) => s + b.total, 0);

  // A patient the doctor sent to the lab today who never paid the lab counter.
  const unpaidLab = useMemo(() => {
    const paidVisitIds = new Set(labBills.map((b) => b.visitId));
    const todayVisitIds = new Set(visits.map((v) => v.id));
    return labOrders.filter((o) => todayVisitIds.has(o.visitId) && !paidVisitIds.has(o.visitId));
  }, [labOrders, labBills, visits]);

  const byCollector = useMemo(() => {
    const map = new Map<string, { name: string; consultation: number; lab: number }>();
    for (const bill of paid) {
      const uid = bill.collectedByUid ?? "unknown";
      const name = collectorNames[uid] ?? (uid === "unknown" ? "Not recorded" : "Loading…");
      const entry = map.get(uid) ?? { name, consultation: 0, lab: 0 };
      entry.name = name;
      if (bill.type === "consultation") entry.consultation += bill.total;
      else entry.lab += bill.total;
      map.set(uid, entry);
    }
    return Array.from(map.values()).map((e) => ({ ...e, total: e.consultation + e.lab }));
  }, [paid, collectorNames]);

  const reportData = {
    date: getTodayDateString(),
    patientsSeen: visits.filter((v) => v.status === "done").length,
    patientsWaiting: visits.filter((v) => v.status !== "done").length,
    consultationCount: consultationBills.length,
    consultationTotal,
    labCount: labBills.length,
    labTotal,
    unpaidLabCount: unpaidLab.length,
    byCollector,
  };

  function handleExport() {
    const rows: (string | number)[][] = [
      ["Token", "Patient", "Status", "Complaint", "Diagnosis", "Consultation Rs", "Lab Rs"],
      ...visits.map((v) => {
        const visitBills = paid.filter((b) => b.visitId === v.id);
        return [
          v.tokenNumber,
          v.patientName,
          v.status,
          v.complaint ?? "",
          v.diagnosis ?? "",
          visitBills.filter((b) => b.type === "consultation").reduce((s, b) => s + b.total, 0),
          visitBills.filter((b) => b.type === "lab").reduce((s, b) => s + b.total, 0),
        ];
      }),
    ];
    downloadCsv(`clinic-${getTodayDateString()}.csv`, rows);
    toast.success("Exported today's visits as CSV.");
  }

  return (
    <AppShell
      title="Daily Closing"
      actions={
        <button
          onClick={() => printClosingReport(reportData)}
          className="flex items-center gap-sm rounded-full bg-primary px-lg py-sm font-label-md font-bold text-on-primary shadow-md transition-all hover:opacity-90"
        >
          <Printer className="h-4 w-4" /> Print Closing Sheet
        </button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-lg p-margin-mobile md:p-margin-desktop">
        <QueryError error={error} />

        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            End of Day — {reportData.date}
          </h1>
          <p className="text-on-surface-variant">
            Count each drawer and check it against these totals before locking up.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <DrawerCard
            label="Reception Drawer"
            sub={`${consultationBills.length} consultation payment(s)`}
            amount={consultationTotal}
          />
          <DrawerCard
            label="Lab Drawer"
            sub={`${labBills.length} lab payment(s)`}
            amount={labTotal}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border-2 border-primary/30 bg-primary/5 px-lg py-md">
          <span className="font-headline-md text-on-surface">Total expected in hand</span>
          <span className="font-headline-lg text-headline-lg text-primary">
            Rs {(consultationTotal + labTotal).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
          <MiniStat label="Patients Seen" value={String(reportData.patientsSeen)} />
          <MiniStat label="Still in Queue" value={String(reportData.patientsWaiting)} />
          <MiniStat label="Tokens Issued" value={String(visits.length)} />
        </div>

        {unpaidLab.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-lg">
            <div className="mb-md flex items-center gap-sm text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-headline-md">
                {unpaidLab.length} patient(s) sent to the lab without paying
              </h2>
            </div>
            <div className="space-y-sm">
              {unpaidLab.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-white p-md"
                >
                  <div>
                    <p className="font-bold" dir="auto">
                      {order.patientName}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {order.tokenNumber ? `Token #${order.tokenNumber} · ` : ""}
                      {order.tests.map((t) => t.name).join(", ")}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-error">Fee not collected</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant bg-surface-container-low px-lg py-md">
            <h2 className="font-bold text-on-surface">Collected By</h2>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-label-md text-on-surface-variant">
                <th className="px-lg py-sm">Staff</th>
                <th className="px-lg py-sm text-right">Consultation</th>
                <th className="px-lg py-sm text-right">Lab</th>
                <th className="px-lg py-sm text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {byCollector.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-lg text-center text-on-surface-variant">
                    No payments recorded today.
                  </td>
                </tr>
              )}
              {byCollector.map((c) => (
                <tr key={c.name}>
                  <td className="px-lg py-md font-medium">{c.name}</td>
                  <td className="px-lg py-md text-right">Rs {c.consultation}</td>
                  <td className="px-lg py-md text-right">Rs {c.lab}</td>
                  <td className="px-lg py-md text-right font-bold">Rs {c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <button
          onClick={handleExport}
          className="flex items-center gap-sm rounded-xl border border-outline px-lg py-md font-bold text-on-surface-variant transition-all hover:bg-surface-container"
        >
          <Download className="h-4 w-4" /> Export today as CSV
        </button>
      </div>
    </AppShell>
  );
}

function DrawerCard({ label, sub, amount }: { label: string; sub: string; amount: number }) {
  return (
    <div className="flex items-center gap-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
        <Wallet className="h-6 w-6" />
      </div>
      <div>
        <p className="font-label-md text-on-surface-variant">{label}</p>
        <p className="font-headline-lg text-headline-lg text-primary">
          Rs {amount.toLocaleString()}
        </p>
        <p className="text-xs text-on-surface-variant">{sub}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg text-center">
      <p className="font-headline-lg text-headline-lg text-on-surface">{value}</p>
      <p className="font-label-md text-on-surface-variant">{label}</p>
    </div>
  );
}
