/**
 * Prueft, ob ein Benutzer einen Beleg an DATEV senden darf
 * bezogen auf den Pruef-/Freigabestatus (Vier-Augen-Prinzip).
 *
 * Ownership und technische Versandvoraussetzungen werden separat geprueft.
 */
export function canUserSendReceipt(params: {
  role: "ADMIN" | "USER";
  canSendWithoutApproval: boolean;
  reviewStatus: string;
}): boolean {
  if (params.role === "ADMIN") return true;
  if (params.reviewStatus === "APPROVED") return true;
  if (params.canSendWithoutApproval) return true;
  return false;
}
