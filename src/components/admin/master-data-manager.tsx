"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

// ============================================================
// Types
// ============================================================

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "checkbox" | "number";
  required?: boolean;
  placeholder?: string;
};

export type MasterDataItem = {
  id: string;
  active: boolean;
  sortOrder: number;
  [key: string]: unknown;
};

type Props = {
  title: string;
  description: string;
  apiPath: string;
  fields: FieldDef[];
  items: MasterDataItem[];
};

// ============================================================
// Component
// ============================================================

export function MasterDataManager({ title, description, apiPath, fields, items }: Props) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <CreateForm apiPath={apiPath} fields={fields} />
      <ItemTable apiPath={apiPath} fields={fields} items={items} />
    </div>
  );
}

// ============================================================
// Create Form
// ============================================================

function CreateForm({ apiPath, fields }: { apiPath: string; fields: FieldDef[] }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const body: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "checkbox") {
        body[field.key] = formData.get(field.key) === "on";
      } else if (field.type === "number") {
        const val = formData.get(field.key) as string;
        body[field.key] = val ? Number(val) : undefined;
      } else {
        const val = formData.get(field.key) as string;
        body[field.key] = val || undefined;
      }
    }

    startTransition(async () => {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }
      setSuccess("Eintrag wurde angelegt.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Neuen Eintrag anlegen</h2>
      <form action={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        {fields.map((field) => (
          <FormField key={field.key} field={field} />
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "..." : "Anlegen"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-sm font-medium text-primary">{success}</p> : null}
    </Card>
  );
}

function FormField({ field, defaultValue }: { field: FieldDef; defaultValue?: unknown }) {
  if (field.type === "checkbox") {
    return (
      <label className="flex h-12 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name={field.key}
          defaultChecked={defaultValue === true}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        {field.label}
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{field.label}</span>
      <input
        name={field.key}
        type={field.type}
        required={field.required}
        placeholder={field.placeholder}
        defaultValue={defaultValue != null ? String(defaultValue) : ""}
        className="h-12 w-40 rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </label>
  );
}

// ============================================================
// Item Table
// ============================================================

function ItemTable({ apiPath, fields, items }: { apiPath: string; fields: FieldDef[]; items: MasterDataItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Noch keine Eintraege vorhanden.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <div className="min-w-[480px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">#</th>
              {fields.map((f) => (
                <th key={f.key} className="px-4 py-3 font-medium">{f.label}</th>
              ))}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} apiPath={apiPath} fields={fields} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ItemRow({ item, apiPath, fields }: { item: MasterDataItem; apiPath: string; fields: FieldDef[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleToggleActive() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = await res.json();
      setMessage(res.ok ? (item.active ? "Deaktiviert." : "Aktiviert.") : data.error);
      router.refresh();
    });
  }

  function handleSave(formData: FormData) {
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "checkbox") {
        body[field.key] = formData.get(field.key) === "on";
      } else if (field.type === "number") {
        const val = formData.get(field.key) as string;
        body[field.key] = val ? Number(val) : undefined;
      } else {
        const val = formData.get(field.key) as string;
        body[field.key] = val || null;
      }
    }
    body.sortOrder = Number(formData.get("_sortOrder") ?? item.sortOrder);

    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setMessage("Gespeichert.");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border/50 bg-muted/30">
        <td className="px-4 py-2">
          <input
            form={`edit-${item.id}`}
            name="_sortOrder"
            type="number"
            defaultValue={item.sortOrder}
            className="h-9 w-14 rounded-xl border border-border bg-background px-2 text-center text-sm outline-none focus:border-primary"
          />
        </td>
        {fields.map((f) => (
          <td key={f.key} className="px-4 py-2">
            <form id={`edit-${item.id}`} action={handleSave}>
              {/* Hidden form container */}
            </form>
            <FormField field={f} defaultValue={item[f.key]} />
          </td>
        ))}
        <td className="px-4 py-2" />
        <td className="px-4 py-2">
          <div className="flex gap-2">
            <button
              type="submit"
              form={`edit-${item.id}`}
              disabled={isPending}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              onClick={(e) => {
                e.preventDefault();
                const form = document.getElementById(`edit-${item.id}`) as HTMLFormElement;
                // Collect all named inputs within the row
                const fd = new FormData();
                const row = (e.target as HTMLElement).closest("tr");
                if (row) {
                  row.querySelectorAll<HTMLInputElement>("input,select,textarea").forEach((el) => {
                    if (el.name) {
                      if (el.type === "checkbox") {
                        fd.set(el.name, el.checked ? "on" : "");
                      } else {
                        fd.set(el.name, el.value);
                      }
                    }
                  });
                }
                handleSave(fd);
              }}
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Abbrechen
            </button>
          </div>
          {message ? <p className="mt-1 text-xs text-danger">{message}</p> : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-border/50 ${!item.active ? "opacity-40" : ""}`}>
      <td className="px-4 py-3 text-muted-foreground">{item.sortOrder}</td>
      {fields.map((f) => (
        <td key={f.key} className="px-4 py-3">
          {f.type === "checkbox" ? (item[f.key] ? "Ja" : "Nein") : String(item[f.key] ?? "—")}
        </td>
      ))}
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${item.active ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
          {item.active ? "Aktiv" : "Inaktiv"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
          <button type="button" onClick={() => setEditing(true)} disabled={isPending} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
            Bearbeiten
          </button>
          <button type="button" onClick={handleToggleActive} disabled={isPending} className={`text-xs font-medium hover:underline disabled:opacity-50 ${item.active ? "text-danger" : "text-primary"}`}>
            {item.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </div>
        {message ? <p className="mt-1 text-xs text-primary">{message}</p> : null}
      </td>
    </tr>
  );
}
