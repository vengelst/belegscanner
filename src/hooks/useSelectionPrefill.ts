"use client";

import { useEffect, useState } from "react";
import {
  readLastSelections,
  resolveSelectionState,
  type PrefillSource,
  type UserDefaults,
  type ValidIds,
} from "@/lib/receipts/form-helpers";

export function useSelectionPrefill(userDefaults: UserDefaults, validIds: ValidIds) {
  const [purposeId, setPurposeId] = useState(userDefaults.defaultPurposeId ?? "");
  const [categoryId, setCategoryId] = useState(userDefaults.defaultCategoryId ?? "");
  const [countryId, setCountryId] = useState(userDefaults.defaultCountryId ?? "");
  const [vehicleId, setVehicleId] = useState(userDefaults.defaultVehicleId ?? "");
  const [prefillSource, setPrefillSource] = useState<PrefillSource>("none");

  useEffect(() => {
    const sessionSelections = readLastSelections();
    const resolved = resolveSelectionState({
      sessionSelections,
      userDefaults,
      validIds,
    });

    setPurposeId(resolved.selection.purposeId);
    setCategoryId(resolved.selection.categoryId);
    setCountryId(resolved.selection.countryId);
    setVehicleId(resolved.selection.vehicleId);
    setPrefillSource(resolved.source);
  }, [userDefaults, validIds]);

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
  };
}
