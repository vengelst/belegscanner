"use client";

import { useCallback, useMemo, useState } from "react";
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
  const resolved = useMemo(
    () => resolveSelectionState({ userDefaults, validIds }),
    [userDefaults, validIds],
  );

  const [purposeId, setPurposeId] = useState(resolved.selection.purposeId);
  const [countryId, setCountryId] = useState(resolved.selection.countryId);
  const [vehicleId, setVehicleId] = useState(resolved.selection.vehicleId);
  const [prefillSource, setPrefillSource] = useState<PrefillSource>(resolved.source);

  const applyResolvedDefaults = useCallback(() => {
    const next = resolveSelectionState({ userDefaults, validIds });
    setPurposeId(next.selection.purposeId);
    setCountryId(next.selection.countryId);
    setVehicleId(next.selection.vehicleId);
    setPrefillSource(next.source);
  }, [userDefaults, validIds]);

  const resetSelection = useCallback(() => {
    applyResolvedDefaults();
  }, [applyResolvedDefaults]);

  return {
    purposeId,
    countryId,
    vehicleId,
    prefillSource,
    setPurposeId,
    setCountryId,
    setVehicleId,
    setPrefillSource,
    resetSelection,
  };
}
