"use client";

import { CheckCircle, ChevronDown, Printer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { createBill, subscribeToTodayBillsOfType } from "@/lib/firestore/bills";
import { saveLabResults, subscribeToLabOrders } from "@/lib/firestore/lab-orders";
import { feeForTest } from "@/lib/lab-tests";
import { useSettings } from "@/lib/use-settings";
import { printLabReport, printReceipt } from "@/lib/share";
import type { Bill } from "@/types/bill";
import type { LabOrder, LabTest } from "@/types/lab-order";

export default function LabPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const unsubOrders = subscribeToLabOrders(
      (next) => {
        setOrders(next);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        toast.error("Could not load lab orders. Check your connection.");
        setLoading(false);
      },
    );
    const unsubBills = subscribeToTodayBillsOfType("lab", setBills, (error) => console.error(error));
    return () => {
      unsubOrders();
      unsubBills();
    };
  }, []);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.tests.some((t) => t.status === "pending")),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => o.tests.every((t) => t.status === "completed")),
    [orders],
  );
  const drawerTotal = useMemo(
    () => bills.filter((b) => b.paid).reduce((sum, b) => sum + b.total, 0),
    [bills],
  );

  return (
    <AppShell title="Laboratory" searchPlaceholder="Search orders or patients...">
      <div className="mx-auto max-w-7xl space-y-lg p-margin-mobile md:p-margin-desktop">
        <div className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h3 className="font-headline-lg text-headline-lg text-on-surface">Sample Collection</h3>
            <p className="text-on-surface-variant">
              <span className="font-bold text-primary">{pendingOrders.length}</span> patient(s) sent
              by the doctor today.
            </p>
          </div>
          <div className="flex items-center gap-lg rounded-2xl border border-primary/30 bg-primary/5 px-lg py-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface-variant">Lab Drawer Today</div>
              <div className="font-headline-md text-headline-md text-primary">
                Rs {drawerTotal.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {loading && <p className="py-8 text-center text-on-surface-variant">Loading…</p>}
        {!loading && pendingOrders.length === 0 && (
          <p className="py-8 text-center text-on-surface-variant">No patients waiting for samples.</p>
        )}

        <div className="grid grid-cols-1 gap-lg xl:grid-cols-2">
          {pendingOrders.map((order) => (
            <LabOrderCard
              key={order.id}
              order={order}
              bill={bills.find((b) => b.visitId === order.visitId)}
            />
          ))}
        </div>

        <section className="pt-xl">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface-container p-lg transition-all hover:bg-surface-container-high"
          >
            <div className="flex items-center gap-md">
              <span className="rounded-lg bg-primary-container/20 p-sm text-primary">
                <CheckCircle className="h-5 w-5" />
              </span>
              <div className="text-left">
                <h4 className="font-bold text-on-surface">Completed</h4>
                <p className="text-label-md text-on-surface-variant">
                  {completedOrders.length} report{completedOrders.length === 1 ? "" : "s"} finalized
                </p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${showCompleted ? "rotate-180" : ""}`} />
          </button>
          {showCompleted && (
            <div className="mt-sm grid grid-cols-1 gap-md rounded-xl border border-t-0 border-outline-variant bg-surface-container-low p-md md:grid-cols-2 lg:grid-cols-3">
              {completedOrders.length === 0 && (
                <p className="col-span-full py-md text-center text-sm text-on-surface-variant">
                  Nothing completed yet.
                </p>
              )}
              {completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-sm"
                >
                  <div>
                    <p className="font-bold text-on-surface" dir="auto">
                      {order.patientName}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {order.tokenNumber ? `Token #${order.tokenNumber} • ` : ""}
                      {order.tests.map((t) => t.name).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      printLabReport({
                        patientName: order.patientName,
                        tokenNumber: order.tokenNumber,
                        tests: order.tests,
                      })
                    }
                    className="rounded-lg p-sm text-primary transition-all hover:bg-primary-container/10"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function LabOrderCard({ order, bill }: { order: LabOrder; bill?: Bill }) {
  const { user } = useAuth();
  const settings = useSettings();
  const [tests, setTests] = useState<LabTest[]>(order.tests);
  const [feeOverride, setFeeOverride] = useState<string | null>(null);
  // Priced from the clinic's own list until the technician types over it.
  const listTotal = order.tests.reduce((sum, t) => sum + feeForTest(t.name, settings.labTests), 0);
  const fee = feeOverride ?? String(listTotal);
  const [saving, setSaving] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const feePaid = bill?.paid ?? false;

  function updateTest(index: number, patch: Partial<LabTest>) {
    setTests((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  /** Takes the lab's own fee — separate from the consultation money at reception. */
  async function handleCollectFee() {
    setCollecting(true);
    try {
      const created = await createBill({
        type: "lab",
        visitId: order.visitId,
        patientId: order.patientId,
        patientName: order.patientName,
        tokenNumber: order.tokenNumber,
        items: order.tests.map((t) => ({ label: t.name, amount: feeForTest(t.name, settings.labTests) })),
        paid: true,
        collectedByUid: user?.uid,
      });
      toast.success(`Rs ${created.total} received from ${order.patientName}.`);
      printReceipt({
        title: "Lab Receipt",
        patientName: order.patientName,
        tokenNumber: order.tokenNumber,
        items: created.items,
        total: created.total,
        paid: true,
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not record the payment. Check your connection and try again.");
    } finally {
      setCollecting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // A test counts as done once a result is entered for it.
      const next = tests.map((t) => ({
        ...t,
        status: t.result ? ("completed" as const) : t.status,
      }));
      setTests(next);
      await saveLabResults(order.id, next);
      toast.success(`Results saved for ${order.patientName}.`);
    } catch (error) {
      console.error(error);
      toast.error("Could not save results. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const allComplete = tests.every((t) => t.status === "completed");
  const initials = order.patientName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-md">
        <div className="flex items-center gap-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-xl font-bold text-on-primary-container">
            {initials}
          </div>
          <div>
            <h4 className="font-headline-md text-headline-md text-on-surface" dir="auto">
              {order.patientName}
            </h4>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {order.tokenNumber ? `Token: #${order.tokenNumber}` : ""}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-md py-xs text-xs font-bold ${
            feePaid
              ? "bg-[#d1fae5] text-[#065f46]"
              : "bg-error-container text-on-error-container"
          }`}
        >
          {feePaid ? "Fee Paid" : "Fee Due"}
        </span>
      </div>

      {/* Money first: the sample isn't taken until the lab fee is collected. */}
      {!feePaid && (
        <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-primary/20 bg-primary/5 p-md">
          <div>
            <p className="font-label-md font-bold text-on-surface">Lab Fee</p>
            <p className="text-xs text-on-surface-variant">
              {order.tests.length} test(s) — collected here at the lab
            </p>
          </div>
          <div className="flex items-center gap-md">
            <span className="font-headline-md text-primary">Rs {Number(fee) || 0}</span>
            <input
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFeeOverride(e.target.value)}
              className="w-24 rounded-lg border border-outline-variant bg-white px-sm py-1 text-right text-sm outline-none focus:border-secondary"
            />
            <button
              onClick={handleCollectFee}
              disabled={collecting}
              className="rounded-xl bg-primary px-lg py-sm font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60"
            >
              {collecting ? "…" : "Take Fee"}
            </button>
          </div>
        </div>
      )}

      <div className="h-px w-full bg-outline-variant opacity-30" />

      <div className="space-y-md">
        <h5 className="text-label-md font-bold tracking-wider text-primary-container uppercase">
          Test Requisition
        </h5>
        <div className="grid grid-cols-1 gap-md">
          {tests.map((test, index) => (
            <div
              key={test.name}
              className="flex flex-col gap-md rounded-xl border border-transparent bg-surface-container-low p-md transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">{test.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="px-xs text-label-md text-on-surface-variant">Result</label>
                  <input
                    placeholder="Value"
                    value={test.result ?? ""}
                    onChange={(e) => updateTest(index, { result: e.target.value })}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest p-sm transition-all outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="px-xs text-label-md text-on-surface-variant">Unit</label>
                  <input
                    value={test.unit ?? ""}
                    onChange={(e) => updateTest(index, { unit: e.target.value })}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest p-sm transition-all outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-md pt-md">
        {allComplete && (
          <button
            onClick={() =>
              printLabReport({
                patientName: order.patientName,
                tokenNumber: order.tokenNumber,
                tests,
              })
            }
            className="flex items-center gap-sm rounded-xl border-2 border-primary px-lg py-md font-bold text-primary transition-all hover:bg-primary-container/10"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-sm rounded-xl bg-primary px-xl py-md font-bold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-95 disabled:opacity-70"
        >
          {saving ? "Saving…" : "Save Results"}
        </button>
      </div>
    </div>
  );
}
