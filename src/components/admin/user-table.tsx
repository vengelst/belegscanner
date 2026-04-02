"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  hasPin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function UserTable({ users }: { users: UserRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <div className="min-w-[640px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">E-Mail</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">PIN</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Letzter Login</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UserRow({ user }: { user: UserRow }) {
  const [isPending, startTransition] = useTransition();
  const [pinInput, setPinInput] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleToggleActive() {
    startTransition(async () => {
      setMessage(null);
      if (user.active) {
        const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
        const data = await res.json();
        setMessage(data.message ?? data.error);
      } else {
        const res = await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        const data = await res.json();
        setMessage(data.message ?? (res.ok ? "Benutzer aktiviert." : data.error));
      }
      router.refresh();
    });
  }

  function handleSetPin() {
    if (!/^\d{4}$/.test(pinInput)) {
      setMessage("PIN muss aus genau 4 Ziffern bestehen.");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`/api/users/${user.id}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (res.ok) {
        setShowPinForm(false);
        setPinInput("");
      }
      router.refresh();
    });
  }

  function handleRemovePin() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`/api/users/${user.id}/pin`, { method: "DELETE" });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      router.refresh();
    });
  }

  function handleToggleRole() {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      setMessage(res.ok ? `Rolle auf ${newRole} geaendert.` : data.error);
      router.refresh();
    });
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <tr className={`border-b border-border/50 ${!user.active ? "opacity-50" : ""}`}>
        <td className="px-4 py-3 font-medium">{user.name}</td>
        <td className="px-4 py-3">{user.email}</td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={handleToggleRole}
            disabled={isPending}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {user.role}
          </button>
        </td>
        <td className="px-4 py-3">
          {user.hasPin ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs text-primary">aktiv</span>
              <button
                type="button"
                onClick={handleRemovePin}
                disabled={isPending}
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                entfernen
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowPinForm(!showPinForm)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
            >
              setzen
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              user.active
                ? "bg-primary/10 text-primary"
                : "bg-danger/10 text-danger"
            }`}
          >
            {user.active ? "Aktiv" : "Inaktiv"}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {formatDate(user.lastLoginAt)}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            className={`text-xs font-medium hover:underline disabled:opacity-50 ${
              user.active ? "text-danger" : "text-primary"
            }`}
          >
            {user.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </td>
      </tr>
      {showPinForm ? (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="4-stellige PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-10 w-32 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={handleSetPin}
                disabled={isPending}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                PIN setzen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPinForm(false);
                  setPinInput("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
            </div>
          </td>
        </tr>
      ) : null}
      {message ? (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="px-4 py-2">
            <p className="text-xs font-medium text-primary">{message}</p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
