"use client";

import { CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import {
  LabTestChecklist,
  type SelectedLabTest,
} from "@/components/consultation/lab-test-checklist";
import { createLabOrder } from "@/lib/firestore/lab-orders";
import { getPatient } from "@/lib/firestore/patients";
import {
  finalizeConsultation,
  getPatientVisits,
  subscribeToInConsultation,
} from "@/lib/firestore/visits";
import { getTodayDateString } from "@/lib/firestore/visits";
import { printPrescriptionSlip } from "@/lib/share";
import { useSettings } from "@/lib/use-settings";
import type { Patient } from "@/types/patient";
import type { Visit } from "@/types/visit";

/** YYYY-MM-DD n days from today, for follow-up scheduling. */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getTodayDateString(d);
}

export default function ConsultationPage() {
  const [inConsultation, setInConsultation] = useState<Visit[]>([]);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToInConsultation((visits) => {
      setInConsultation(visits);
      setActiveVisitId((current) => {
        if (current && visits.some((v) => v.id === current)) return current;
        return visits[0]?.id ?? null;
      });
    });
  }, []);

  const activeVisit = inConsultation.find((v) => v.id === activeVisitId) ?? null;

  return (
    <AppShell title="Consultation">
      <div className="mx-auto max-w-7xl space-y-lg p-margin-mobile md:p-margin-desktop">
        {inConsultation.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {inConsultation.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVisitId(v.id)}
                className={`rounded-xl px-md py-sm font-bold transition-all ${
                  v.id === activeVisitId
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                Token #{v.tokenNumber} — {v.patientName}
              </button>
            ))}
          </div>
        )}

        {!activeVisit ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest py-16 text-center text-on-surface-variant shadow-sm">
            No patient in the cabin right now.
            <br />
            The token attendant will send the next patient in.
          </div>
        ) : (
          <ConsultationForm key={activeVisit.id} visit={activeVisit} />
        )}
      </div>
    </AppShell>
  );
}

function ConsultationForm({ visit }: { visit: Visit }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [pastVisits, setPastVisits] = useState<Visit[]>([]);

  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [bp, setBp] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedLabTest[]>([]);
  const [followUpDays, setFollowUpDays] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const settings = useSettings();

  useEffect(() => {
    let cancelled = false;
    // The history sidebar is supporting information — if it fails to load the
    // doctor must still be able to see and finish the consultation, so the
    // error is surfaced in place rather than thrown.
    Promise.all([getPatient(visit.patientId), getPatientVisits(visit.patientId)])
      .then(([p, visits]) => {
        if (cancelled) return;
        setPatient(p);
        setPastVisits(visits.filter((v) => v.id !== visit.id));
        setHistoryError(null);
      })
      .catch((error: Error) => {
        console.error(error);
        if (!cancelled) setHistoryError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [visit.patientId, visit.id]);

  const vitals = {
    bp: bp || undefined,
    temperature: temperature ? Number(temperature) : undefined,
    weight: weight ? Number(weight) : undefined,
  };

  function handlePrintSlip() {
    printPrescriptionSlip({
      patientName: visit.patientName,
      tokenNumber: visit.tokenNumber,
      age: patient?.age ?? visit.patientAge,
      gender: patient?.gender ?? visit.patientGender,
      mrNo: visit.patientId.slice(0, 8).toUpperCase(),
      diagnosis,
      vitals,
    });
  }

  /** Saves the visit record and sends any ordered tests to the lab. */
  async function handleFinish() {
    setSubmitting(true);
    try {
      let labOrderId: string | undefined;
      if (selectedTests.length > 0) {
        const order = await createLabOrder(
          visit.id,
          visit.patientId,
          visit.patientName,
          selectedTests.map((t) => t.name),
          visit.tokenNumber,
        );
        labOrderId = order.id;
      }

      await finalizeConsultation(visit.id, {
        complaint,
        diagnosis,
        vitals,
        labOrderId,
        followUpDate: followUpDays > 0 ? addDays(followUpDays) : undefined,
      });

      toast.success(
        selectedTests.length > 0
          ? `${visit.patientName} — sent to the lab for ${selectedTests.length} test(s).`
          : `Consultation saved for ${visit.patientName}.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not save. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const initials = visit.patientName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="grid grid-cols-1 gap-lg xl:grid-cols-12">
      <div className="space-y-lg xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary" dir="auto">
              Token #{visit.tokenNumber} — {visit.patientName}
            </h1>
            <p className="mt-xs text-on-surface-variant">
              {[
                visit.patientAge ? `${visit.patientAge} years` : null,
                visit.patientGender,
                new Date().toLocaleDateString(),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="rounded-full bg-secondary-container px-md py-xs font-label-md text-on-secondary-container">
            In Cabin
          </span>
        </div>

        {/* The main action: hand the patient a slip and write on it. */}
        <button
          onClick={handlePrintSlip}
          className="flex w-full items-center justify-center gap-md rounded-xl bg-primary py-lg font-headline-md text-on-primary shadow-lg transition-all hover:brightness-110 active:scale-[0.99]"
        >
          <Printer className="h-6 w-6" />
          Print Prescription Slip
        </button>
        <p className="-mt-sm text-center text-sm text-on-surface-variant">
          Prints the clinic form with the patient&apos;s details already filled in. Write the
          medicines on it by hand.
        </p>

        <div className="grid grid-cols-3 gap-md">
          <VitalInput label="Blood Pressure" unit="mmHg" value={bp} placeholder="120/80" onChange={setBp} />
          <VitalInput
            label="Temperature"
            unit="°F"
            value={temperature}
            placeholder="98.6"
            onChange={setTemperature}
          />
          <VitalInput label="Weight" unit="kg" value={weight} placeholder="65" onChange={setWeight} />
        </div>

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <div className="space-y-sm">
            <label className="flex justify-between font-label-md text-on-surface-variant">
              <span>Complaint (optional)</span>
              <span className="font-urdu text-xs">شکایات</span>
            </label>
            <textarea
              dir="auto"
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Short note — Urdu supported"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-md font-urdu text-urdu-body outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-sm">
            <label className="flex justify-between font-label-md text-on-surface-variant">
              <span>Diagnosis (optional)</span>
              <span className="font-urdu text-xs">تشخیص</span>
            </label>
            <textarea
              dir="auto"
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Appears on the printed slip and the weekly report"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-md font-urdu text-urdu-body outline-none focus:border-primary"
            />
            {/* One tap instead of typing — this is what actually keeps the
                weekly diagnosis report populated. */}
            <div className="flex flex-wrap gap-xs">
              {settings.commonDiagnoses.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDiagnosis(option)}
                  className="rounded-full border border-outline-variant px-md py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                  dir="auto"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-md rounded-xl border border-outline-variant bg-surface-container-low p-lg">
          <div>
            <p className="font-label-md font-bold text-on-surface">Ask patient to return</p>
            <p className="text-xs text-on-surface-variant">
              Reception sees who is due back and can message them.
            </p>
          </div>
          <div className="flex flex-wrap gap-xs">
            {[0, 3, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setFollowUpDays(days)}
                className={`rounded-full px-md py-sm text-sm font-bold transition-all ${
                  followUpDays === days
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {days === 0 ? "No follow-up" : `${days} days`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant bg-surface-container-high px-lg py-md">
            <h3 className="font-label-md font-bold text-on-surface">Send to Lab</h3>
            <p className="text-xs text-on-surface-variant">
              Tick the tests needed — the lab collects its own fee from the patient.
            </p>
          </div>
          <div className="p-lg">
            <LabTestChecklist selected={selectedTests} onChange={setSelectedTests} />
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-md rounded-xl bg-inverse-surface py-lg font-headline-md text-inverse-on-surface shadow-lg transition-all hover:brightness-125 active:scale-[0.99] disabled:opacity-70"
        >
          <CheckCircle2 className="h-6 w-6" />
          {submitting ? "Saving…" : "Finish Consultation"}
        </button>
      </div>

      <div className="space-y-lg xl:col-span-4">
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="flex items-center gap-md border-b border-outline-variant p-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-surface-container-highest">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
            <div>
              <h3 className="font-headline-md text-on-surface" dir="auto">
                {visit.patientName}
              </h3>
              <p className="font-label-md text-on-surface-variant">
                {visit.patientAge ? `${visit.patientAge} Years` : ""}
                {visit.patientGender ? ` · ${visit.patientGender}` : ""}
              </p>
            </div>
          </div>
          <div className="space-y-lg p-lg">
            <div className="grid grid-cols-2 gap-md">
              <div>
                <span className="text-xs font-bold text-on-surface-variant uppercase">Blood Group</span>
                <p className="font-label-md font-bold text-primary">{patient?.bloodGroup || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-on-surface-variant uppercase">Chronic</span>
                <p className="font-label-md font-bold text-on-surface">
                  {patient?.chronicConditions?.join(", ") || "—"}
                </p>
              </div>
            </div>
            {patient?.allergies && patient.allergies.length > 0 && (
              <div>
                <span className="text-xs font-bold text-on-surface-variant uppercase">Allergies</span>
                <div className="mt-xs flex flex-wrap gap-xs">
                  {patient.allergies.map((a) => (
                    <span
                      key={a}
                      className="rounded bg-error-container px-sm py-1 text-xs font-bold text-on-error-container"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-outline-variant pt-md">
              <h4 className="mb-sm text-xs font-bold text-on-surface-variant uppercase">
                Recent Visits
              </h4>
              <div className="space-y-md">
                {historyError && <QueryError error={historyError} />}
                {!historyError && pastVisits.length === 0 && (
                  <p className="text-sm text-on-surface-variant">No past visits.</p>
                )}
                {pastVisits.slice(0, 4).map((v, i) => (
                  <div key={v.id} className="flex gap-md">
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        i === 0 ? "bg-primary" : "bg-outline-variant"
                      }`}
                    />
                    <div>
                      <p className="font-label-md font-bold">{v.date}</p>
                      {v.diagnosis && (
                        <p className="text-sm text-on-surface-variant italic" dir="auto">
                          {v.diagnosis}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Link
              href={`/patients/${visit.patientId}`}
              className="block rounded-xl bg-primary/5 py-md text-center font-bold text-primary hover:underline"
            >
              Full Profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalInput({
  label,
  unit,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-md">
      <label className="mb-xs block text-xs font-bold tracking-wider text-on-surface-variant uppercase">
        {label}
      </label>
      <div className="flex items-center gap-xs">
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-none bg-transparent p-0 font-headline-md text-primary outline-none"
        />
        <span className="text-on-surface-variant">{unit}</span>
      </div>
    </div>
  );
}
