import { Card } from "@/components/ui/card";

const STATUSES = [
  { key: "OPEN", label: "offen", description: "Beleg erfasst, noch nicht vollstaendig.", trigger: "Automatisch bei Erstellung" },
  { key: "READY", label: "bereit zum Versand", description: "Alle Pflichtfelder gefuellt, Beleg freigegeben.", trigger: "Benutzer gibt Beleg frei" },
  { key: "SENT", label: "gesendet", description: "E-Mail erfolgreich an DATEV zugestellt.", trigger: "System nach erfolgreichem Versand" },
  { key: "FAILED", label: "fehlgeschlagen", description: "SMTP-Fehler beim Versand.", trigger: "System nach fehlgeschlagenem Versand" },
  { key: "RETRY", label: "erneut senden", description: "Zum erneuten Versand markiert.", trigger: "Benutzer markiert zum erneuten Senden" },
];

export default function SendStatusPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Versandstatus</h1>
        <p className="text-sm text-muted-foreground">
          Der Versandstatus ist systemgefuehrt und wird als Enum im Schema verwaltet.
          Die Werte sind fest definiert und koennen nicht frei bearbeitet werden.
        </p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Schluessel</th>
              <th className="px-4 py-3 font-medium">Anzeige</th>
              <th className="px-4 py-3 font-medium">Beschreibung</th>
              <th className="px-4 py-3 font-medium">Ausloeser</th>
            </tr>
          </thead>
          <tbody>
            {STATUSES.map((s) => (
              <tr key={s.key} className="border-b border-border/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{s.key}</td>
                <td className="px-4 py-3">{s.label}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.trigger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Statusuebergaenge</h2>
        <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <p>OPEN → READY → SENT (Erfolg) oder FAILED (Fehler)</p>
          <p>FAILED → RETRY → SENT oder FAILED</p>
          <p>SENT → RETRY (erneut senden bei Korrektur)</p>
          <p>READY → OPEN (Beleg nochmals bearbeiten)</p>
          <p className="mt-2 font-medium text-foreground">
            Nur das System setzt SENT oder FAILED. Benutzer koennen nur OPEN→READY, FAILED→RETRY und SENT→RETRY ausloesen.
          </p>
        </div>
      </Card>
    </div>
  );
}
