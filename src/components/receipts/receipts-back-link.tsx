"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RECEIPT_LIST_QUERY_KEY } from "@/lib/receipts/list-query";

/** Zurück-Link zur Belegliste inkl. zuletzt gesetzter Filter. */
export function ReceiptsBackLink() {
  const [href, setHref] = useState("/receipts");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(RECEIPT_LIST_QUERY_KEY);
      setHref(stored ? `/receipts?${stored}` : "/receipts");
    } catch {
      setHref("/receipts");
    }
  }, []);

  return (
    <Link
      href={href as "/receipts"}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
    >
      &larr; Zurueck zur Liste
    </Link>
  );
}
