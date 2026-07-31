import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UiTemplate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { uiTemplate: true },
  });

  const uiTemplate = (user?.uiTemplate ?? "classic") as UiTemplate;

  return (
    <AppShell
      userName={session.user.name ?? ""}
      userRole={session.user.role === "ADMIN" ? "ADMIN" : "USER"}
      uiTemplate={uiTemplate}
    >
      {children}
    </AppShell>
  );
}
