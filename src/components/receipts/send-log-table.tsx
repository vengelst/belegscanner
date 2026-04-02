"use client";

type LogEntry = {
  id: string;
  sentAt: string;
  toAddress: string;
  success: boolean;
  errorMessage: string | null;
  messageId: string | null;
};

export function SendLogTable({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Versandversuche.</p>;
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Zeitpunkt</th>
            <th className="px-3 py-2 font-medium">Zieladresse</th>
            <th className="px-3 py-2 font-medium">Ergebnis</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border/50">
              <td className="px-3 py-2 text-xs">{formatDate(log.sentAt)}</td>
              <td className="px-3 py-2 text-xs">{log.toAddress}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    log.success
                      ? "bg-primary/10 text-primary"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {log.success ? "Erfolg" : "Fehler"}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {log.success
                  ? (log.messageId ? `ID: ${log.messageId}` : "—")
                  : (log.errorMessage ?? "Unbekannter Fehler")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
