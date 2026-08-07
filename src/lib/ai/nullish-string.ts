/**
 * Modelle liefern fehlende Werte oft als Text "null"/"undefined" statt JSON-null.
 * Das landet dann in der UI als "null (KI sicher)" und sprengt countryCode.max(3).
 */

const NULLISH = /^(null|undefined|none|n\/a|na|nil|-)$/i;

export function nullishToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || NULLISH.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeCountryCode(value: string | null | undefined): string | null {
  const cleaned = nullishToNull(value);
  if (!cleaned) return null;
  const code = cleaned.toUpperCase();
  // ISO 3166-1 alpha-2/alpha-3
  if (!/^[A-Z]{2,3}$/.test(code)) return null;
  return code;
}
