"use client";

import { Briefcase, CheckCircle, Clock3, Printer, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import { FollowUpsDue } from "@/components/queue/follow-ups-due";
import { PatientCheckInDialog } from "@/components/queue/patient-checkin-dialog";
import { subscribeToTodayBillsOfType } from "@/lib/firestore/bills";
import { subscribeToTodayQueue } from "@/lib/firestore/visits";
import { printTokenSlip } from "@/lib/share";
import { cn } from "@/lib/utils";
import type { Bill } from "@/types/bill";
import type { Visit, VisitStatus } from "@/types/visit";

const STATUS_PILL: Record<VisitStatus, string> = {
  waiting: "bg-amber-100 text-amber-800 border border-amber-200",
  in_consultation: "bg-secondary-container text-on-secondary-container border border-secondary/20",
  done: "bg-primary-container/20 text-primary border border-primary/10",
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  waiting: "Waiting",
  in_consultation: "With Doctor",
  done: "Done",
};

export default function ReceptionPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const unsubVisits = subscribeToTodayQueue(
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
    const unsubBills = subscribeToTodayBillsOfType("consultation", setBills, (error) =>
      console.error(error),
    );
    return () => {
      unsubVisits();
      unsubBills();
    };
  }, []);

  const visibleVisits = useMemo(
    () => (showCompleted ? visits : visits.filter((v) => v.status !== "done")),
    [visits, showCompleted],
  );

  const counts = useMemo(
    () => ({
      waiting: visits.filter((v) => v.status === "waiting").length,
      inConsultation: visits.filter((v) => v.status === "in_consultation").length,
      done: visits.filter((v) => v.status === "done").length,
    }),
    [visits],
  );

  const drawerTotal = useMemo(
    () => bills.filter((b) => b.paid).reduce((sum, b) => sum + b.total, 0),
    [bills],
  );

  return (
    <AppShell title="Reception">
      <div className="mx-auto max-w-7xl px-margin-mobile py-lg md:px-margin-desktop">
        {loadError && (
          <div className="mb-lg">
            <QueryError error={loadError} />
          </div>
        )}

        <FollowUpsDue />

        <div className="mb-xl flex flex-col justify-between gap-lg md:flex-row md:items-end">
          <div className="space-y-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Token Desk</h1>
            <p className="text-on-surface-variant">
              Register the patient, issue the token, and take the consultation fee.
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex min-h-[48px] transform items-center gap-sm rounded-xl bg-primary px-lg py-md font-bold text-on-primary shadow-lg transition-all hover:bg-primary-container active:scale-95"
          >
            <UserPlus className="h-5 w-5" />
            <span className="text-label-md">+ New Patient Check-in</span>
          </button>
        </div>

        <div className="mb-xl grid grid-cols-1 gap-md md:grid-cols-4">
          <StatCard icon={Clock3} iconBg="bg-amber-100" iconColor="text-amber-700" label="Waiting" value={String(counts.waiting)} />
          <StatCard
            icon={Briefcase}
            iconBg="bg-secondary-container"
            iconColor="text-on-secondary-container"
            label="With Doctor"
            value={String(counts.inConsultation)}
          />
          <StatCard
            icon={CheckCircle}
            iconBg="bg-primary-container"
            iconColor="text-on-primary-container"
            label="Done Today"
            value={String(counts.done)}
          />
          <StatCard
            icon={Wallet}
            iconBg="bg-primary-fixed"
            iconColor="text-on-primary-fixed"
            label="Consultation Drawer"
            value={`Rs ${drawerTotal.toLocaleString()}`}
            highlight
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-lg py-md">
            <div className="flex items-center gap-md">
              <span className="font-bold text-on-surface">Today&apos;s Tokens</span>
              <span className="rounded-full bg-outline-variant px-sm py-0.5 text-xs font-bold text-on-surface-variant">
                {visits.length} Issued
              </span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="text-label-md text-on-surface-variant">Show Completed</span>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  showCompleted ? "bg-primary" : "bg-outline-variant"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCompleted ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface font-label-md text-label-md text-on-surface-variant">
                  <th className="px-lg py-md font-semibold">Token</th>
                  <th className="px-lg py-md font-semibold">Patient Details</th>
                  <th className="px-lg py-md font-semibold">Fee</th>
                  <th className="px-lg py-md font-semibold">Status</th>
                  <th className="px-lg py-md text-right font-semibold">Slip</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Loading today&apos;s queue…
                    </td>
                  </tr>
                )}
                {!loading && visibleVisits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      No tokens issued yet today.
                    </td>
                  </tr>
                )}
                {visibleVisits.map((visit) => {
                  const bill = bills.find((b) => b.visitId === visit.id);
                  const isDone = visit.status === "done";
                  return (
                    <tr
                      key={visit.id}
                      className={cn(
                        "transition-colors hover:bg-surface-container",
                        isDone && "opacity-60",
                      )}
                    >
                      <td className="px-lg py-lg">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-on-primary">
                          {visit.tokenNumber}
                        </div>
                      </td>
                      <td className="px-lg py-lg">
                        <Link
                          href={`/patients/${visit.patientId}`}
                          className="font-bold text-primary hover:underline"
                          dir="auto"
                        >
                          {visit.patientName}
                        </Link>
                        <p className="text-xs text-on-surface-variant">
                          {[
                            visit.patientGender ? visit.patientGender[0]?.toUpperCase() : null,
                            visit.patientAge ? `${visit.patientAge} years` : null,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                      </td>
                      <td className="px-lg py-lg">
                        {bill ? (
                          <span className="font-bold text-primary">Rs {bill.total}</span>
                        ) : (
                          <span className="text-sm text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-lg py-lg">
                        <span
                          className={cn(
                            "rounded-full px-md py-sm text-xs font-bold",
                            STATUS_PILL[visit.status],
                          )}
                        >
                          {STATUS_LABEL[visit.status]}
                        </span>
                      </td>
                      <td className="px-lg py-lg text-right">
                        <button
                          onClick={() =>
                            printTokenSlip({
                              patientId: visit.patientId,
                              tokenNumber: visit.tokenNumber,
                              patientName: visit.patientName,
                              age: visit.patientAge,
                              gender: visit.patientGender,
                              fee: bill?.total ?? 0,
                            })
                          }
                          className="inline-flex items-center gap-xs rounded-lg border border-outline px-md py-2 font-label-md text-on-surface-variant transition-all hover:bg-surface-variant"
                        >
                          <Printer className="h-4 w-4" /> Token Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PatientCheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCheckedIn={(visit, fee) => {
          toast.success(`Token #${visit.tokenNumber} — ${visit.patientName}. Rs ${fee} received.`);
        }}
      />
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  highlight,
}: {
  icon: typeof Clock3;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-lg rounded-2xl border p-lg",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-outline-variant bg-surface-container-low",
      )}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-label-md text-label-md text-on-surface-variant">{label}</div>
        <div className="font-headline-md text-headline-md">{value}</div>
      </div>
    </div>
  );
}
