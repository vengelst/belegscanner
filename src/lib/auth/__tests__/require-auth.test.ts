import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { auth } from "@/auth";

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireAuth", () => {
  it("gibt 401 zurück wenn keine Session vorhanden ist", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const result = await requireAuth();
    expect(result.error).toBeDefined();
    expect(result.session).toBeUndefined();
    expect(result.error!.status).toBe(401);
  });

  it("gibt 401 zurück wenn Session kein user-Objekt hat", async () => {
    mockedAuth.mockResolvedValue({ user: undefined } as never);

    const result = await requireAuth();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });

  it("gibt 401 zurück wenn user.id fehlt", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: undefined, email: "test@test.de", name: "Test" },
    } as never);

    const result = await requireAuth();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });

  it("gibt AuthSession zurück bei gültiger Session", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
    } as never);

    const result = await requireAuth();
    expect(result.session).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.session).toEqual({
      userId: "user-1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    });
  });

  it("setzt leere Strings für fehlende email/name", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-2", email: null, name: null, role: "USER" },
    } as never);

    const result = await requireAuth();
    expect(result.session).toBeDefined();
    expect(result.session!.email).toBe("");
    expect(result.session!.name).toBe("");
  });

  it('normalisiert unbekannte Rolle zu "USER"', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-3", email: "test@test.de", name: "Test", role: "UNKNOWN" },
    } as never);

    const result = await requireAuth();
    expect(result.session).toBeDefined();
    expect(result.session!.role).toBe("USER");
  });
});

describe("requireAdmin", () => {
  it("gibt 401 zurück wenn keine Session vorhanden ist", async () => {
    mockedAuth.mockResolvedValue(null as never);

    const result = await requireAdmin();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });

  it("gibt 403 zurück wenn Rolle USER ist", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User", role: "USER" },
    } as never);

    const result = await requireAdmin();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("gibt AuthSession zurück wenn Rolle ADMIN ist", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
    } as never);

    const result = await requireAdmin();
    expect(result.session).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.session!.role).toBe("ADMIN");
    expect(result.session!.userId).toBe("admin-1");
  });
});
