import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md text-center">
        <div className="mb-4 text-4xl">404</div>
        <h1 className="text-xl font-semibold tracking-tight">
          Seite nicht gefunden
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die angeforderte Seite existiert nicht.
        </p>
        <div className="mt-6">
          <Link
            href="/receipts"
            className="inline-block rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Zur Startseite
          </Link>
        </div>
      </Card>
    </div>
  );
}
