"use client";

import { Plus, Search, User, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/auth-provider";
import { createBill } from "@/lib/firestore/bills";
import { createPatient, searchPatients } from "@/lib/firestore/patients";
import { checkInPatient } from "@/lib/firestore/visits";
import { useSettings } from "@/lib/use-settings";
import type { Gender, Patient } from "@/types/patient";
import type { Visit } from "@/types/visit";

interface PatientCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckedIn: (visit: Visit, fee: number) => void;
}

type Mode = "search" | "add";

const inputClass =
  "w-full rounded-xl border-2 border-outline-variant bg-surface-container-low px-md py-md font-body-md text-on-surface outline-none transition-all focus:border-secondary focus:ring-0";

// Rendered only while the dialog is open, so every open is a fresh mount with
// clean form state — no reset-on-open effect needed.
function CheckInDialogBody({
  onOpenChange,
  onCheckedIn,
}: Omit<PatientCheckInDialogProps, "open">) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("search");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [address, setAddress] = useState("");
  const [showMore, setShowMore] = useState(false);
  const settings = useSettings();
  const [fee, setFee] = useState<string | null>(null);
  // Falls back to the clinic-configured fee until reception types over it.
  const feeValue = fee ?? String(settings.consultationFee);

  useEffect(() => {
    if (mode !== "search" || !searchText.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setSearching(true);
      searchPatients(searchText)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch((error: unknown) => console.error(error))
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchText, mode]);

  const displayedResults = mode === "search" && searchText.trim() ? results : [];
  const feeAmount = Number(feeValue) || 0;

  /** Issues the token and records the consultation fee as taken at the desk. */
  async function issueTokenAndTakeFee(patient: {
    id: string;
    name: string;
    age?: number;
    gender?: Gender;
  }) {
    const visit = await checkInPatient(patient);
    await createBill({
      type: "consultation",
      visitId: visit.id,
      patientId: patient.id,
      patientName: patient.name,
      tokenNumber: visit.tokenNumber,
      items: [{ label: "Consultation Fee", amount: feeAmount }],
      paid: true,
      collectedByUid: user?.uid,
    });
    onCheckedIn(visit, feeAmount);
    onOpenChange(false);
  }

  async function handleCheckInExisting(patient: Patient) {
    setBusy(patient.id);
    try {
      await issueTokenAndTakeFee({
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not issue the token. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function goToAddForm() {
    const trimmed = searchText.trim();
    const looksLikePhone = /^[\d+]+$/.test(trimmed);
    setName(looksLikePhone ? "" : trimmed);
    setPhone(looksLikePhone ? trimmed : "");
    setMode("add");
  }

  async function handleAddAndCheckIn(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setBusy("new");
    try {
      const patient = await createPatient({
        name: name.trim(),
        phone: phone.trim(),
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
      });
      await issueTokenAndTakeFee({
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
      });
    } catch (error) {
      console.error(error);
      toast.error("Could not add the patient. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const feeField = (
    <div className="flex items-center justify-between gap-md rounded-2xl border border-primary/20 bg-primary/5 p-md">
      <div>
        <p className="font-label-md font-bold text-on-surface">Consultation Fee</p>
        <p className="text-xs text-on-surface-variant">Taken now, at the desk</p>
      </div>
      <div className="flex items-center gap-xs">
        <span className="font-headline-md text-on-surface-variant">Rs.</span>
        <input
          type="number"
          min={0}
          value={feeValue}
          onChange={(e) => setFee(e.target.value)}
          className="w-28 rounded-lg border-2 border-outline-variant bg-white px-sm py-1 text-right font-headline-md text-primary outline-none focus:border-secondary"
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between bg-primary p-lg text-on-primary">
        <h2 className="font-headline-md text-headline-md">
          {mode === "search" ? "New Patient Check-in" : "Add New Patient"}
        </h2>
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-full p-2 transition-all hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-lg p-lg">
        {mode === "search" ? (
          <>
            <div>
              <label className="mb-xs block font-label-md text-label-md font-bold text-on-surface">
                Search Existing Patient
              </label>
              <div className="relative">
                <Search className="absolute top-1/2 left-md h-4 w-4 -translate-y-1/2 text-outline" />
                <input
                  autoFocus
                  dir="auto"
                  placeholder="Phone number or name"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={`${inputClass} pl-xl`}
                />
              </div>
            </div>

            {feeField}

            <div className="border-t border-outline-variant pt-lg">
              <p className="mb-md font-label-md text-label-md text-on-surface-variant">
                Search Results
              </p>
              <div className="max-h-56 space-y-sm overflow-y-auto">
                {searching && (
                  <p className="py-2 text-center text-sm text-on-surface-variant">Searching…</p>
                )}
                {!searching &&
                  displayedResults.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-md transition-all hover:bg-surface-container"
                    >
                      <div className="flex items-center gap-md">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold" dir="auto">
                            {patient.name}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {patient.phone}
                            {patient.age ? ` | ${patient.age} yrs` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={busy !== null}
                        onClick={() => handleCheckInExisting(patient)}
                        className="rounded-lg bg-primary px-md py-sm text-xs font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-50"
                      >
                        {busy === patient.id ? "Issuing…" : `Token + Rs. ${feeAmount}`}
                      </button>
                    </div>
                  ))}
                {!searching && searchText.trim() && displayedResults.length === 0 && (
                  <p className="py-2 text-center text-sm text-on-surface-variant">
                    No matching patient found.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-md rounded-2xl border border-secondary/20 bg-secondary-container/20 p-lg text-center">
              <p className="font-body-md text-on-surface-variant">
                Can&apos;t find the patient? Register them as a new visitor.
              </p>
              <button
                onClick={goToAddForm}
                className="w-full rounded-xl bg-secondary py-md font-bold text-on-secondary shadow-md transition-all hover:bg-on-secondary-fixed-variant"
              >
                Add New Patient Registration
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleAddAndCheckIn} className="flex flex-col gap-md">
            <div>
              <label
                className="mb-xs block font-label-md text-label-md font-bold text-on-surface"
                htmlFor="new-name"
              >
                Name
              </label>
              <input
                id="new-name"
                dir="auto"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label
                className="mb-xs block font-label-md text-label-md font-bold text-on-surface"
                htmlFor="new-phone"
              >
                Phone Number
              </label>
              <input
                id="new-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>

            {!showMore && (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="flex items-center gap-xs self-start text-sm text-on-surface-variant hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Add age, gender, address (optional)
              </button>
            )}

            {showMore && (
              <div className="flex flex-col gap-md rounded-xl border-2 border-dashed border-outline-variant p-md">
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="mb-xs block font-label-md text-label-md text-on-surface-variant">
                      Age
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-xs block font-label-md text-label-md text-on-surface-variant">
                      Gender
                    </label>
                    <Select
                      value={gender}
                      onValueChange={(v: string | null) => setGender((v as Gender) ?? "")}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-outline-variant bg-surface-container-low text-base">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-xs block font-label-md text-label-md text-on-surface-variant">
                    Address
                  </label>
                  <textarea
                    dir="auto"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {feeField}

            <div className="flex gap-sm pt-sm">
              <button
                type="button"
                onClick={() => setMode("search")}
                className="rounded-xl border border-outline-variant px-lg py-md font-bold text-on-surface-variant transition-all hover:bg-surface-container-low"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy !== null}
                className="flex-1 rounded-xl bg-primary py-md font-bold text-on-primary shadow-md transition-all hover:bg-primary-container disabled:opacity-70"
              >
                {busy ? "Issuing…" : `Issue Token & Take Rs. ${feeAmount}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export function PatientCheckInDialog({
  open,
  onOpenChange,
  onCheckedIn,
}: PatientCheckInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // sm: variant must be restated, otherwise the base component's
        // sm:max-w-[24rem] wins at desktop widths.
        className="w-full max-w-[36rem] overflow-hidden rounded-3xl border-none bg-surface-container-lowest p-0 shadow-2xl sm:max-w-[36rem]"
      >
        {open && <CheckInDialogBody onOpenChange={onOpenChange} onCheckedIn={onCheckedIn} />}
      </DialogContent>
    </Dialog>
  );
}
