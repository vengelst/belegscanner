"use client";

import { useCallback, useState } from "react";
import {
  resolveSelectionState,
  type PrefillSource,
  type UserDefaults,
  type ValidIds,
} from "@/lib/receipts/form-helpers";

/**
 * Vorbelegung der Zuordnungsfelder. Quelle sind ausschliesslich die
 * Standardwerte aus den Einstellungen - nie der zuletzt erfasste Beleg.
 */
export function useSelectionPrefill(userDefaults: UserDefaults, validIds: ValidIds) {
  const [initial] = useState(() => resolveSelectionState({ userDefaults, validIds }));
  const [purposeId, setPurposeId] = useState(initial.selection.purposeId);
  const [categoryId, setCategoryId] = useState(initial.selection.categoryId);
  const [countryId, setCountryId] = useState(initial.selection.countryId);
  const [vehicleId, setVehicleId] = useState(initial.selection.vehicleId);
  const [prefillSource, setPrefillSource] = useState<PrefillSource>(initial.source);

  const resetSelection = useCallback(() => {
    setPurposeId(initial.selection.purposeId);
    setCategoryId(initial.selection.categoryId);
    setCountryId(initial.selection.countryId);
    setVehicleId(initial.selection.vehicleId);
    setPrefillSource(initial.source);
  }, [initial]);

  return {
    purposeId,
    categoryId,
    countryId,
    vehicleId,
    prefillSource,
    setPurposeId,
    setCategoryId,
    setCountryId,
    setVehicleId,
    setPrefillSource,
    resetSelection,
  };
}
