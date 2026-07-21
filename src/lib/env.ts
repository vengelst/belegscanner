import { z } from "zod";

/**
 * Bekannte unsichere Platzhalter-Werte (u.a. aus docker-compose.yml Defaults).
 * Im produktiven Betrieb fuehren diese zu einem harten Startup-Fehler (P1-7),
 * damit die App nicht "still" mit unsicherer Konfiguration hochlaeuft.
 */
const KNOWN_INSECURE_VALUES: Record<string, string[]> = {
  AUTH_SECRET: [
    "change-me-generate-with-openssl-rand-base64-48",
    "changeme",
    "change-me",
    "secret",
    "please-change-me",
  ],
  SMTP_ENCRYPTION_KEY: [
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "0123456789abcdef0123456789abcdef",
  ],
  ADMIN_PASSWORD: ["admin1234", "admin", "password", "changeme", "admin123", "12345678"],
  ADMIN_EMAIL: ["admin@belegbox.local", "admin@example.com"],
};

const MIN_SECRET_LENGTH: Record<string, number> = {
  AUTH_SECRET: 32,
  SMTP_ENCRYPTION_KEY: 32,
  ADMIN_PASSWORD: 8,
};

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url(),
  STORAGE_PATH: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).optional(),
  SMTP_ENCRYPTION_KEY: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),
  EXCHANGE_RATE_API_URL: z.string().url(),
  OCR_SERVICE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof baseEnvSchema>;

export type ParseEnvOptions = {
  /** Wenn true, werden unsichere Platzhalter-Secrets hart abgelehnt. */
  enforceSecureSecrets: boolean;
};

type EnvSource = Record<string, string | undefined>;

function isInsecureProductionRuntime(source: EnvSource): boolean {
  const isProduction = source.NODE_ENV === "production";
  // Waehrend `next build` liegen echte Secrets oft noch nicht vor – hier NICHT
  // fail-fast, sonst bricht der Build. Erzwungen wird zur Laufzeit.
  const isBuildPhase = source.NEXT_PHASE === "phase-production-build";
  return isProduction && !isBuildPhase;
}

function addInsecureSecretIssues(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  for (const [key, insecureValues] of Object.entries(KNOWN_INSECURE_VALUES)) {
    const value = data[key];
    if (typeof value !== "string") continue;

    if (insecureValues.includes(value.trim().toLowerCase()) || insecureValues.includes(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message:
          `${key} verwendet einen bekannten unsicheren Platzhalter-Wert. ` +
          `Bitte in der produktiven Umgebung ein echtes, zufaelliges Secret setzen.`,
      });
    }
  }

  for (const [key, minLength] of Object.entries(MIN_SECRET_LENGTH)) {
    const value = data[key];
    if (typeof value === "string" && value.length < minLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message:
          `${key} ist mit ${value.length} Zeichen zu kurz fuer den Produktivbetrieb ` +
          `(mindestens ${minLength} Zeichen erforderlich).`,
      });
    }
  }
}

export function buildEnvSchema(options: ParseEnvOptions) {
  if (!options.enforceSecureSecrets) return baseEnvSchema;
  return baseEnvSchema.superRefine((data, ctx) => {
    addInsecureSecretIssues(data as Record<string, unknown>, ctx);
  });
}

export function parseEnv(source: EnvSource, options?: Partial<ParseEnvOptions>): Env {
  const enforceSecureSecrets =
    options?.enforceSecureSecrets ?? isInsecureProductionRuntime(source);

  const schema = buildEnvSchema({ enforceSecureSecrets });

  const result = schema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    AUTH_SECRET: source.AUTH_SECRET,
    AUTH_URL: source.AUTH_URL,
    STORAGE_PATH: source.STORAGE_PATH,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_MODEL: source.OPENAI_MODEL || undefined,
    SMTP_ENCRYPTION_KEY: source.SMTP_ENCRYPTION_KEY,
    ADMIN_EMAIL: source.ADMIN_EMAIL,
    ADMIN_PASSWORD: source.ADMIN_PASSWORD,
    ADMIN_NAME: source.ADMIN_NAME,
    EXCHANGE_RATE_API_URL: source.EXCHANGE_RATE_API_URL,
    OCR_SERVICE_URL: source.OCR_SERVICE_URL || undefined,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Ungueltige oder unsichere Umgebungskonfiguration:\n${details}`,
    );
  }

  return result.data;
}

export const env = parseEnv(process.env);
