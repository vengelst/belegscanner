import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReportingDashboard } from "@/components/admin/reporting-dashboard";
import { connection } from "next/server";

export default async function DashboardPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/receipts");

  return <ReportingDashboard />;
}
