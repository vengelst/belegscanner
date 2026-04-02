import { prisma } from "@/lib/prisma";
import { UserTable } from "@/components/admin/user-table";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { connection } from "next/server";

export default async function UsersAdminPage() {
  await connection();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      pinHash: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    hasPin: !!u.pinHash,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Benutzerverwaltung</h1>
        <p className="text-sm text-muted-foreground">
          Benutzer anlegen, Rollen zuweisen, PINs verwalten.
        </p>
      </div>
      <CreateUserForm />
      <UserTable users={mapped} />
    </div>
  );
}
