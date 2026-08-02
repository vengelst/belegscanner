"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

type BackupConfig = {
  storageType: "local" | "s3";
  localPath: string;
  s3Endpoint: string | null;
  s3Bucket: string | null;
  s3AccessKey: string | null;
  s3SecretKey: string | null;
  s3Region: string | null;
};

export function BackupConfigForm({ config }: { config: BackupConfig }) {
  const [storageType, setStorageType] = useState<"local" | "s3">(config.storageType);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const s3SecretKey = formData.get("s3SecretKey") as string;

    startTransition(async () => {
      const res = await fetch("/api/admin/backup/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageType: formData.get("storageType"),
          localPath: formData.get("localPath"),
          s3Endpoint: formData.get("s3Endpoint") || null,
          s3Bucket: formData.get("s3Bucket") || null,
          s3AccessKey: formData.get("s3AccessKey") || null,
          s3SecretKey: s3SecretKey || null,
          s3Region: formData.get("s3Region") || null,
          scheduleEnabled: false,
          scheduleCron: "0 2 * * *",
          retentionDays: 30,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern der Konfiguration.");
        return;
      }
      setSuccess("Backup-Konfiguration wurde gespeichert.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Backup-Speicher</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Wo sollen die Backups gespeichert werden?
      </p>

      <form action={handleSubmit} className="mt-4 space-y-4">
        <SelectField
          label="Storage-Typ"
          name="storageType"
          value={storageType}
          onChange={(value) => setStorageType(value as "local" | "s3")}
        >
          <option value="local">Lokal (Server-Dateisystem)</option>
          <option value="s3">S3-kompatibler Storage</option>
        </SelectField>

        {storageType === "local" ? (
          <Input
            label="Lokaler Pfad"
            name="localPath"
            required
            placeholder="/backups"
            defaultValue={config.localPath}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="S3 Endpoint"
              name="s3Endpoint"
              required
              placeholder="https://s3.eu-central-1.amazonaws.com"
              defaultValue={config.s3Endpoint ?? ""}
            />
            <Input
              label="Bucket"
              name="s3Bucket"
              required
              placeholder="my-backup-bucket"
              defaultValue={config.s3Bucket ?? ""}
            />
            <Input
              label="Access Key"
              name="s3AccessKey"
              required
              placeholder="AKIAIOSFODNN7EXAMPLE"
              defaultValue={config.s3AccessKey ?? ""}
            />
            <PasswordInput
              label={config.s3SecretKey ? "Secret Key (leer = beibehalten)" : "Secret Key"}
              name="s3SecretKey"
              required={!config.s3SecretKey}
              placeholder={config.s3SecretKey ?? "wJalrXUtnFEMI/K7MDENG/bPxRfiCY"}
            />
            <Input
              label="Region (optional)"
              name="s3Region"
              placeholder="eu-central-1"
              defaultValue={config.s3Region ?? ""}
            />
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" loading={isPending}>
            Speichern
          </Button>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          {success && <p className="text-sm font-medium text-primary">{success}</p>}
        </div>
      </form>
    </Card>
  );
}
