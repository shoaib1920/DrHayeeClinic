"use client";

import { AlertTriangle, Droplet, FileText, MapPin, Phone, Printer, User } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { QueryError } from "@/components/layout/query-error";
import { getBillsForPatient } from "@/lib/firestore/bills";
import { getLabOrdersForPatient } from "@/lib/firestore/lab-orders";
import {
  findDuplicatesByPhone,
  getMergedPatientIds,
  getPatient,
  mergePatients,
  updatePatient,
} from "@/lib/firestore/patients";
import { getPatientVisits } from "@/lib/firestore/visits";
import {
  printLabReport,
  printPatientCard,
  printPrescriptionSlip,
  printReceipt,
} from "@/lib/share";
import type { Bill } from "@/types/bill";
import type { LabOrder } from "@/types/lab-order";
import type { Patient } from "@/types/patient";
import type { Visit } from "@/types/visit";

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [duplicates, setDuplicates] = useState<Patient[]>([]);
  const [merging, setMerging] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const p = await getPatient(params.id);
      if (cancelled) return;
      if (!p) {
        setLoading(false);
        return;
      }
      setPatient(p);
      setBloodGroup(p.bloodGroup ?? "");
      setAllergies((p.allergies ?? []).join(", "));
      setChronicConditions((p.chronicConditions ?? []).join(", "));

      // History spans this record plus any duplicates merged into it, since a
      // merge deliberately leaves old visits pointing at their original ID.
      const ids = await getMergedPatientIds(params.id);
      const [visitLists, labLists, billLists, possibleDuplicates] = await Promise.all([
        Promise.all(ids.map((id) => getPatientVisits(id))),
        Promise.all(ids.map((id) => getLabOrdersForPatient(id))),
        Promise.all(ids.map((id) => getBillsForPatient(id))),
        findDuplicatesByPhone(p),
      ]);
      if (cancelled) return;

      setVisits(visitLists.flat().sort((a, b) => b.date.localeCompare(a.date)));
      setLabOrders(labLists.flat());
      setBills(billLists.flat());
      setDuplicates(possibleDuplicates);
      setLoading(false);
    }
    // Without this catch a failed query becomes an unhandled rejection and the
    // page just sits on "Loading patient…" with no explanation.
    load().catch((error: Error) => {
      console.error(error);
      if (cancelled) return;
      setLoadError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleMerge(duplicate: Patient) {
    setMerging(duplicate.id);
    try {
      await mergePatients(params.id, duplicate.id);
      setDuplicates((prev) => prev.filter((d) => d.id !== duplicate.id));
      toast.success(`Merged ${duplicate.name}. Reload to see their past visits here.`);
    } catch (error) {
      console.error(error);
      toast.error("Could not merge. Only reception or the doctor may merge records.");
    } finally {
      setMerging(null);
    }
  }

  async function handleSaveProfile() {
    if (!patient) return;
    setSavingProfile(true);
    try {
      await updatePatient(patient.id, {
        bloodGroup: bloodGroup.trim() || undefined,
        allergies: allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        chronicConditions: chronicConditions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success("Patient profile updated.");
    } catch (error) {
      console.error(error);
      toast.error("Could not save. Check your connection and try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Patient Record">
        <p className="p-lg text-center text-on-surface-variant">Loading patient…</p>
      </AppShell>
    );
  }
  if (!patient) {
    return (
      <AppShell title="Patient Record">
        <div className="mx-auto max-w-[40rem] p-lg">
          {loadError ? (
            <QueryError error={loadError} />
          ) : (
            <p className="text-center text-on-surface-variant">Patient not found.</p>
          )}
        </div>
      </AppShell>
    );
  }

  const initials = patient.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title="Patient Record">
      <div className="mx-auto max-w-6xl space-y-lg p-margin-mobile md:p-margin-desktop">
        <button
          onClick={() => router.back()}
          className="self-start text-label-md font-bold text-primary hover:underline"
        >
          ← Back
        </button>

        <section className="flex flex-col items-start justify-between gap-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm md:flex-row md:items-center">
          <div className="flex items-center gap-lg">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-surface-container-highest bg-primary-fixed-dim">
              <span className="text-3xl font-bold text-primary">{initials}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-sm">
                <h3 className="font-headline-lg text-headline-lg text-on-surface" dir="auto">
                  {patient.name}
                </h3>
                <span className="rounded bg-primary-container px-sm py-xs text-[10px] font-bold tracking-wider text-on-primary-container uppercase">
                  {patient.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-md font-label-md text-on-surface-variant">
                <span className="flex items-center gap-xs">
                  <Phone className="h-4 w-4" /> {patient.phone}
                </span>
                {(patient.age || patient.gender) && (
                  <span className="flex items-center gap-xs">
                    <User className="h-4 w-4" />
                    {[patient.age ? `${patient.age} Years` : null, patient.gender]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                )}
                {patient.address && (
                  <span className="flex items-center gap-xs" dir="auto">
                    <MapPin className="h-4 w-4" /> {patient.address}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              printPatientCard({
                mrNo: patient.mrNo,
                patientName: patient.name,
                phone: patient.phone,
                age: patient.age,
                gender: patient.gender,
              })
            }
            className="flex items-center gap-sm rounded-xl bg-primary px-lg py-md font-bold text-on-primary transition-all hover:opacity-90"
          >
            <Printer className="h-4 w-4" /> Patient Card
          </button>
        </section>

        {duplicates.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-lg text-amber-900">
            <div className="mb-md flex items-center gap-sm">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-headline-md">
                {duplicates.length} other record(s) share this phone number
              </h2>
            </div>
            <p className="mb-md text-label-md">
              If this is the same person, merge them so their history stays in one place. Merging
              keeps this record and hides the other from search — nothing is deleted.
            </p>
            <div className="space-y-sm">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-white p-md"
                >
                  <div>
                    <p className="font-bold text-on-surface" dir="auto">
                      {dup.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {dup.mrNo ? `MR ${dup.mrNo} · ` : ""}
                      {dup.phone}
                      {dup.age ? ` · ${dup.age} yrs` : ""}
                    </p>
                  </div>
                  <div className="flex gap-sm">
                    <Link
                      href={`/patients/${dup.id}`}
                      className="rounded-lg border border-outline px-md py-sm text-sm font-bold text-on-surface-variant hover:bg-surface-container"
                    >
                      View
                    </Link>
                    <button
                      disabled={merging === dup.id}
                      onClick={() => handleMerge(dup)}
                      className="rounded-lg bg-primary px-md py-sm text-sm font-bold text-on-primary transition-all hover:opacity-90 disabled:opacity-60"
                    >
                      {merging === dup.id ? "Merging…" : "Merge into this record"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-lg md:grid-cols-3">
          <div className="flex flex-col gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
            <span className="flex items-center gap-xs font-label-md text-on-surface-variant">
              <Droplet className="h-4 w-4 text-primary" /> Blood Group
            </span>
            <input
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              placeholder="e.g. O Positive"
              className="rounded-lg border border-outline-variant bg-transparent px-sm py-1 text-headline-md font-bold text-error outline-none focus:border-secondary"
            />
          </div>
          <div className="flex flex-col gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
            <span className="font-label-md text-on-surface-variant">Allergies</span>
            <input
              dir="auto"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Comma separated"
              className="rounded-lg border border-outline-variant bg-transparent px-sm py-1 text-sm font-bold text-on-error-container outline-none focus:border-secondary"
            />
          </div>
          <div className="flex flex-col gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
            <span className="font-label-md text-on-surface-variant">Chronic Conditions</span>
            <input
              dir="auto"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              placeholder="Comma separated"
              className="rounded-lg border border-outline-variant bg-transparent px-sm py-1 text-sm font-bold text-on-secondary-container outline-none focus:border-secondary"
            />
          </div>
        </section>
        <button
          disabled={savingProfile}
          onClick={handleSaveProfile}
          className="self-start rounded-xl bg-secondary px-lg py-sm font-bold text-on-secondary transition-all hover:opacity-90 disabled:opacity-60"
        >
          {savingProfile ? "Saving…" : "Save Profile"}
        </button>

        <div className="flex items-end justify-between border-b border-outline-variant pb-md">
          <h4 className="font-headline-md text-headline-md text-on-surface">Visit History</h4>
          <p className="text-xs text-on-surface-variant">
            Prescriptions are written by hand and are not stored here.
          </p>
        </div>

        {visits.length === 0 && (
          <p className="py-lg text-center text-on-surface-variant">No past visits yet.</p>
        )}

        <div className="space-y-lg">
          {visits.map((visit) => {
            const visitLabOrders = labOrders.filter((o) => o.visitId === visit.id);
            const visitBills = bills.filter((b) => b.visitId === visit.id);
            const [monthDay, year] = formatVisitDate(visit.date);

            return (
              <div
                key={visit.id}
                className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="flex flex-col items-center justify-center border-r border-outline-variant bg-surface-container-low p-lg text-center md:w-48">
                    <span className="text-sm font-bold text-on-surface-variant">{monthDay}</span>
                    <span className="font-headline-md text-headline-md font-extrabold text-primary">
                      {year}
                    </span>
                    <span className="mt-sm rounded-full bg-primary px-lg py-1 text-xs font-bold text-on-primary">
                      {visit.status === "done"
                        ? "DONE"
                        : visit.status === "in_consultation"
                          ? "IN CABIN"
                          : "WAITING"}
                    </span>
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-lg p-lg md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-md">
                      {visit.complaint && (
                        <div>
                          <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                            Complaint
                          </label>
                          <p className="font-bold text-on-surface" dir="auto">
                            {visit.complaint}
                          </p>
                        </div>
                      )}
                      {visit.diagnosis && (
                        <div>
                          <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                            Diagnosis
                          </label>
                          <p className="text-on-surface-variant" dir="auto">
                            {visit.diagnosis}
                          </p>
                        </div>
                      )}
                      {visit.vitals &&
                        (visit.vitals.bp || visit.vitals.temperature || visit.vitals.weight) && (
                          <div className="flex gap-md">
                            {visit.vitals.bp && (
                              <div>
                                <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                                  BP
                                </label>
                                <p className="font-bold text-on-surface">{visit.vitals.bp}</p>
                              </div>
                            )}
                            {visit.vitals.temperature && (
                              <div>
                                <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                                  Temp
                                </label>
                                <p className="font-bold text-on-surface">
                                  {visit.vitals.temperature}°F
                                </p>
                              </div>
                            )}
                            {visit.vitals.weight && (
                              <div>
                                <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                                  Weight
                                </label>
                                <p className="font-bold text-on-surface">{visit.vitals.weight}kg</p>
                              </div>
                            )}
                          </div>
                        )}
                      {!visit.complaint && !visit.diagnosis && (
                        <p className="text-sm text-on-surface-variant">No clinical notes recorded.</p>
                      )}
                    </div>

                    <div className="space-y-md rounded-lg border border-surface-variant bg-surface-container-lowest p-md">
                      {visitLabOrders.length > 0 ? (
                        visitLabOrders.map((order) => (
                          <div key={order.id}>
                            <label className="text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                              Lab Tests
                            </label>
                            <ul className="mt-xs space-y-1 text-sm">
                              {order.tests.map((t, i) => (
                                <li key={i} className="flex items-center gap-xs">
                                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                                  <span>
                                    {t.name}
                                    {t.status === "completed" && t.result
                                      ? `: ${t.result} ${t.unit ?? ""}`
                                      : " — pending"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-on-surface-variant">No lab tests ordered.</p>
                      )}
                    </div>

                    <div className="space-y-sm text-right">
                      <label className="block text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                        Payments
                      </label>
                      {visitBills.length === 0 && (
                        <span className="text-sm text-on-surface-variant">—</span>
                      )}
                      {visitBills.map((bill) => (
                        <div key={bill.id}>
                          <span className="text-xs text-on-surface-variant capitalize">
                            {bill.type}
                          </span>
                          <p className="font-headline-md font-bold text-on-surface">
                            Rs. {bill.total}
                          </p>
                          <span
                            className={`text-xs font-bold ${
                              bill.paid ? "text-primary" : "text-error"
                            }`}
                          >
                            {bill.paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      ))}

                      {/* Reprints for a patient who lost their slip. */}
                      <div className="flex flex-col items-end gap-xs pt-md">
                        <label className="block text-[10px] font-bold tracking-wider text-outline-variant uppercase">
                          Reprint
                        </label>
                        <button
                          onClick={() =>
                            printPrescriptionSlip({
                              patientName: patient.name,
                              tokenNumber: visit.tokenNumber,
                              age: patient.age,
                              gender: patient.gender,
                              mrNo: patient.id.slice(0, 8).toUpperCase(),
                              diagnosis: visit.diagnosis,
                              vitals: visit.vitals,
                            })
                          }
                          className="inline-flex items-center gap-xs rounded-lg border border-outline px-md py-1.5 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container"
                        >
                          <Printer className="h-3.5 w-3.5" /> Prescription Form
                        </button>
                        {visitLabOrders.some((o) =>
                          o.tests.some((t) => t.status === "completed"),
                        ) && (
                          <button
                            onClick={() =>
                              printLabReport({
                                patientName: patient.name,
                                tokenNumber: visit.tokenNumber,
                                tests: visitLabOrders.flatMap((o) => o.tests),
                              })
                            }
                            className="inline-flex items-center gap-xs rounded-lg border border-outline px-md py-1.5 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container"
                          >
                            <Printer className="h-3.5 w-3.5" /> Lab Report
                          </button>
                        )}
                        {visitBills.map((bill) => (
                          <button
                            key={`receipt-${bill.id}`}
                            onClick={() =>
                              printReceipt({
                                title: bill.type === "lab" ? "Lab Receipt" : "Consultation Receipt",
                                patientName: patient.name,
                                tokenNumber: bill.tokenNumber,
                                items: bill.items,
                                total: bill.total,
                                paid: bill.paid,
                              })
                            }
                            className="inline-flex items-center gap-xs rounded-lg border border-outline px-md py-1.5 text-xs font-bold text-on-surface-variant capitalize transition-all hover:bg-surface-container"
                          >
                            <Printer className="h-3.5 w-3.5" /> {bill.type} Receipt
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-10" />
      </div>
    </AppShell>
  );
}

function formatVisitDate(dateStr: string): [string, string] {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  const monthDay = date
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .toUpperCase();
  return [monthDay, String(year)];
}
