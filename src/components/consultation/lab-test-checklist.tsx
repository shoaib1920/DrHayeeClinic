"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettings } from "@/lib/use-settings";

/** The doctor only chooses tests — the lab counter handles the money. */
export interface SelectedLabTest {
  name: string;
}

interface LabTestChecklistProps {
  selected: SelectedLabTest[];
  onChange: (selected: SelectedLabTest[]) => void;
}

export function LabTestChecklist({ selected, onChange }: LabTestChecklistProps) {
  const settings = useSettings();
  const [customTest, setCustomTest] = useState("");
  const [extraTests, setExtraTests] = useState<string[]>([]);
  // Clinic price list plus anything typed in during this consultation.
  const availableTests = [...settings.labTests.map((t) => t.name), ...extraTests];

  function isSelected(name: string) {
    return selected.some((t) => t.name === name);
  }

  function toggle(name: string) {
    if (isSelected(name)) {
      onChange(selected.filter((t) => t.name !== name));
    } else {
      onChange([...selected, { name }]);
    }
  }

  function addCustomTest() {
    const trimmed = customTest.trim();
    if (!trimmed) return;
    if (!availableTests.includes(trimmed)) setExtraTests((prev) => [...prev, trimmed]);
    if (!isSelected(trimmed)) onChange([...selected, { name: trimmed }]);
    setCustomTest("");
  }

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 md:grid-cols-3">
      {availableTests.map((test) => (
        <label
          key={test}
          className="flex cursor-pointer items-center gap-md rounded-xl border border-outline-variant p-md transition-colors hover:bg-surface-container-low"
        >
          <Checkbox checked={isSelected(test)} onCheckedChange={() => toggle(test)} />
          <span className="font-label-md text-label-md">{test}</span>
        </label>
      ))}
      <div className="flex items-center gap-sm rounded-xl border-2 border-dashed border-outline-variant p-md">
        <input
          placeholder="Other test"
          value={customTest}
          onChange={(e) => setCustomTest(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTest();
            }
          }}
          className="w-full border-none bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        />
        <button
          type="button"
          onClick={addCustomTest}
          className="text-on-surface-variant hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
