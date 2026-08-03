"use client";

import type { DuplicateCandidate } from "@/lib/receipts/duplicate-check";

type Props = {
  candidates: DuplicateCandidate[];
  onDismiss: () => void;
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

function formatAmount(value: number, currency: string): string {
  return `${value.toFixed(2).replace(".", ",")} ${currency}`;
}

export function DuplicateWarning({ candidates, onDismiss }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50/80 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Moeglicher Duplikat-Beleg
          </h3>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {candidates.length === 1
              ? "Ein bestehender Beleg stimmt mit den eingegebenen Daten ueberein:"
              : `${candidates.length} bestehende Belege stimmen mit den eingegebenen Daten ueberein:`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2 text-xs">
                <a
                  href={`/receipts/${candidate.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 font-medium text-amber-900 underline-offset-2 transition hover:bg-amber-200 hover:underline dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
                >
                  <span>{formatDate(candidate.date)}</span>
                  <span className="text-amber-600 dark:text-amber-400">|</span>
                  <span>{formatAmount(candidate.amount, candidate.currency)}</span>
                  {candidate.supplier ? (
                    <>
                      <span className="text-amber-600 dark:text-amber-400">|</span>
                      <span className="max-w-[150px] truncate">{candidate.supplier}</span>
                    </>
                  ) : null}
                  {candidate.invoiceNumber ? (
                    <>
                      <span className="text-amber-600 dark:text-amber-400">|</span>
                      <span className="max-w-[100px] truncate">#{candidate.invoiceNumber}</span>
                    </>
                  ) : null}
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Trotzdem speichern
          </button>
        </div>
      </div>
    </div>
  );
}
