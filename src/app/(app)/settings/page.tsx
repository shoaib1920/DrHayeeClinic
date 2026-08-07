"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { saveSettings, subscribeToSettings } from "@/lib/firestore/settings";
import type { LabTestOption } from "@/lib/lab-tests";
import type { ClinicSettings } from "@/types/settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTest, setNewTest] = useState("");
  const [newDiagnosis, setNewDiagnosis] = useState("");

  useEffect(() => subscribeToSettings((s) => setSettings((prev) => prev ?? s)), []);

  if (!settings) {
    return (
      <AppShell title="Settings">
        <p className="p-lg text-center text-on-surface-variant">Loading settings…</p>
      </AppShell>
    );
  }

  function update(patch: Partial<ClinicSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateTest(index: number, patch: Partial<LabTestOption>) {
    if (!settings) return;
    update({
      labTests: settings.labTests.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings({
        ...settings,
        labTests: settings.labTests.filter((t) => t.name.trim()),
        commonDiagnoses: settings.commonDiagnoses.filter((d) => d.trim()),
      });
      toast.success("Settings saved. All screens update immediately.");
    } catch (error) {
      console.error(error);
      toast.error("Could not save. Only the doctor's login may change settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Settings"
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-sm rounded-full bg-primary px-lg py-sm font-label-md font-bold text-on-primary shadow-md transition-all hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-lg p-margin-mobile md:p-margin-desktop">
        <p className="text-on-surface-variant">
          Prices and shortcuts used across the clinic. Changes apply everywhere as soon as you save.
        </p>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-md font-headline-md text-headline-md text-on-surface">
            Consultation Fee
          </h2>
          <div className="flex items-center gap-md">
            <span className="font-headline-md text-on-surface-variant">Rs.</span>
            <input
              type="number"
              min={0}
              value={settings.consultationFee}
              onChange={(e) => update({ consultationFee: Number(e.target.value) || 0 })}
              className="w-40 rounded-xl border-2 border-outline-variant bg-surface-container-low px-md py-sm text-right font-headline-md text-primary outline-none focus:border-secondary"
            />
            <span className="text-sm text-on-surface-variant">
              Pre-filled at the token desk; reception can still override per patient.
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-md font-headline-md text-headline-md text-on-surface">
            Lab Test Prices
          </h2>
          <div className="space-y-sm">
            {settings.labTests.map((test, index) => (
              <div key={index} className="flex items-center gap-md">
                <input
                  value={test.name}
                  onChange={(e) => updateTest(index, { name: e.target.value })}
                  className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm outline-none focus:border-secondary"
                />
                <div className="flex items-center gap-xs">
                  <span className="text-sm text-on-surface-variant">Rs.</span>
                  <input
                    type="number"
                    min={0}
                    value={test.fee}
                    onChange={(e) => updateTest(index, { fee: Number(e.target.value) || 0 })}
                    className="w-28 rounded-lg border border-outline-variant bg-surface-container-low px-sm py-sm text-right font-bold text-primary outline-none focus:border-secondary"
                  />
                </div>
                <button
                  onClick={() =>
                    update({ labTests: settings.labTests.filter((_, i) => i !== index) })
                  }
                  className="rounded-lg p-2 text-error transition-colors hover:bg-error-container"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-md flex gap-sm">
            <input
              placeholder="New test name"
              value={newTest}
              onChange={(e) => setNewTest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTest.trim()) {
                  e.preventDefault();
                  update({ labTests: [...settings.labTests, { name: newTest.trim(), fee: 0 }] });
                  setNewTest("");
                }
              }}
              className="flex-1 rounded-lg border-2 border-dashed border-outline-variant bg-transparent px-md py-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (!newTest.trim()) return;
                update({ labTests: [...settings.labTests, { name: newTest.trim(), fee: 0 }] });
                setNewTest("");
              }}
              className="flex items-center gap-xs rounded-lg border border-outline px-lg py-sm font-bold text-on-surface-variant hover:bg-surface-container"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">
            Common Diagnoses
          </h2>
          <p className="mb-md text-sm text-on-surface-variant">
            Shown as one-tap buttons on the doctor&apos;s screen, so the weekly report fills in
            without typing.
          </p>
          <div className="flex flex-wrap gap-sm">
            {settings.commonDiagnoses.map((diagnosis, index) => (
              <span
                key={index}
                className="flex items-center gap-xs rounded-full bg-surface-container px-md py-sm text-label-md"
                dir="auto"
              >
                {diagnosis}
                <button
                  onClick={() =>
                    update({
                      commonDiagnoses: settings.commonDiagnoses.filter((_, i) => i !== index),
                    })
                  }
                  className="text-error hover:opacity-70"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-md flex gap-sm">
            <input
              dir="auto"
              placeholder="New diagnosis"
              value={newDiagnosis}
              onChange={(e) => setNewDiagnosis(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDiagnosis.trim()) {
                  e.preventDefault();
                  update({
                    commonDiagnoses: [...settings.commonDiagnoses, newDiagnosis.trim()],
                  });
                  setNewDiagnosis("");
                }
              }}
              className="flex-1 rounded-lg border-2 border-dashed border-outline-variant bg-transparent px-md py-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (!newDiagnosis.trim()) return;
                update({ commonDiagnoses: [...settings.commonDiagnoses, newDiagnosis.trim()] });
                setNewDiagnosis("");
              }}
              className="flex items-center gap-xs rounded-lg border border-outline px-lg py-sm font-bold text-on-surface-variant hover:bg-surface-container"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-md rounded-xl bg-primary py-lg font-headline-md text-on-primary shadow-lg transition-all hover:brightness-110 disabled:opacity-70"
        >
          <Save className="h-5 w-5" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </AppShell>
  );
}
