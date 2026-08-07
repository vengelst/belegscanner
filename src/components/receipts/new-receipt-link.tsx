"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

/**
 * Link auf „Neuer Beleg“, der immer einen frischen Formular-Mount erzwingt
 * (`?t=<timestamp>`). Sonst bleibt bei Soft-Navigation auf dieselbe Route der
 * React-State (inkl. Zuordnung) des vorherigen Formulars stehen.
 */
export function NewReceiptLink({
  children,
  className,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { children: ReactNode }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.push(`/receipts/new?t=${Date.now()}`);
  }

  return (
    <Link href="/receipts/new" className={className} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
