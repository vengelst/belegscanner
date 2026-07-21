import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://user:pass@db:5432/belegbox",
    AUTH_SECRET: "a".repeat(48),
    AUTH_URL: "https://beleg.example.com",
    STORAGE_PATH: "/app/storage",
    OPENAI_API_KEY: "sk-real-key",
    SMTP_ENCRYPTION_KEY: "f".repeat(64),
    ADMIN_EMAIL: "ops@example.com",
    ADMIN_PASSWORD: "S3cure-Passphrase!",
    ADMIN_NAME: "Administrator",
    EXCHANGE_RATE_API_URL: "https://api.frankfurter.app",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("parseEnv – Fail-Fast bei unsicheren Secrets (P1-7)", () => {
  it("akzeptiert eine sichere Konfiguration im Prod-Enforcement", () => {
    const env = parseEnv(baseEnv(), { enforceSecureSecrets: true });
    expect(env.AUTH_SECRET.length).toBe(48);
    expect(env.ADMIN_EMAIL).toBe("ops@example.com");
  });

  it("lehnt den bekannten AUTH_SECRET-Platzhalter ab", () => {
    expect(() =>
      parseEnv(
        baseEnv({ AUTH_SECRET: "change-me-generate-with-openssl-rand-base64-48" }),
        { enforceSecureSecrets: true },
      ),
    ).toThrow(/AUTH_SECRET/);
  });

  it("lehnt den bekannten SMTP_ENCRYPTION_KEY-Platzhalter ab", () => {
    expect(() =>
      parseEnv(
        baseEnv({
          SMTP_ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        }),
        { enforceSecureSecrets: true },
      ),
    ).toThrow(/SMTP_ENCRYPTION_KEY/);
  });

  it("lehnt schwaches ADMIN_PASSWORD (admin1234) ab", () => {
    expect(() =>
      parseEnv(baseEnv({ ADMIN_PASSWORD: "admin1234" }), {
        enforceSecureSecrets: true,
      }),
    ).toThrow(/ADMIN_PASSWORD/);
  });

  it("lehnt zu kurzes AUTH_SECRET im Prod-Betrieb ab", () => {
    expect(() =>
      parseEnv(baseEnv({ AUTH_SECRET: "short" }), { enforceSecureSecrets: true }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("erlaubt Platzhalter ausserhalb des Prod-Enforcements (Dev)", () => {
    const env = parseEnv(
      baseEnv({
        AUTH_SECRET: "change-me-generate-with-openssl-rand-base64-48",
        ADMIN_PASSWORD: "admin1234",
      }),
      { enforceSecureSecrets: false },
    );
    expect(env.ADMIN_PASSWORD).toBe("admin1234");
  });

  it("leitet Enforcement aus NODE_ENV=production ab (kein Build-Phase)", () => {
    expect(() =>
      parseEnv(
        baseEnv({
          NODE_ENV: "production",
          AUTH_SECRET: "change-me-generate-with-openssl-rand-base64-48",
        }),
      ),
    ).toThrow(/AUTH_SECRET/);
  });

  it("erzwingt waehrend next build NICHT (kein Build-Bruch)", () => {
    const env = parseEnv(
      baseEnv({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
        AUTH_SECRET: "change-me-generate-with-openssl-rand-base64-48",
      }),
    );
    expect(env.AUTH_SECRET).toBe("change-me-generate-with-openssl-rand-base64-48");
  });
});
