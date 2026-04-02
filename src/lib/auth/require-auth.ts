import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type AuthSession = {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
};

export async function requireAuth(): Promise<
  { session: AuthSession; error?: never } | { session?: never; error: NextResponse }
> {
  const authSession = await auth();

  if (!authSession?.user?.id) {
    return {
      error: NextResponse.json(
        { error: "Nicht authentifiziert." },
        { status: 401 },
      ),
    };
  }

  return {
    session: {
      userId: authSession.user.id,
      email: authSession.user.email ?? "",
      name: authSession.user.name ?? "",
      role: authSession.user.role === "ADMIN" ? "ADMIN" : "USER",
    },
  };
}

export async function requireAdmin(): Promise<
  { session: AuthSession; error?: never } | { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.session.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung. Admin-Rolle erforderlich." },
        { status: 403 },
      ),
    };
  }

  return result;
}
