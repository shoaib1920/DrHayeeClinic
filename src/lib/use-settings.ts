"use client";

import { useEffect, useState } from "react";
import { FALLBACK_SETTINGS, subscribeToSettings } from "@/lib/firestore/settings";
import type { ClinicSettings } from "@/types/settings";

/** Live clinic settings, with built-in defaults until the doc is saved. */
export function useSettings(): ClinicSettings {
  const [settings, setSettings] = useState<ClinicSettings>(FALLBACK_SETTINGS);

  useEffect(() => subscribeToSettings(setSettings), []);

  return settings;
}
