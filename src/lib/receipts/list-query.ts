/** Session-Key: zuletzt genutzte Query der Belegliste (Filter/Sortierung/Seite). */
export const RECEIPT_LIST_QUERY_KEY = "belegscanner.receiptListQuery";

export function persistReceiptListQuery(query: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RECEIPT_LIST_QUERY_KEY, query);
  } catch {
    // private mode / blocked storage
  }
}

export function readReceiptListQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(RECEIPT_LIST_QUERY_KEY) ?? "";
  } catch {
    return "";
  }
}
