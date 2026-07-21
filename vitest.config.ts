import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // Sichere Test-Defaults, damit der eager-validierte env-Singleton importierbar ist.
    // NODE_ENV bleibt "test" => kein Prod-Secret-Enforcement (P1-7 wird gezielt getestet).
    env: {
      DATABASE_URL: "postgresql://belegbox:belegbox@localhost:5432/belegbox",
      AUTH_SECRET: "test-secret-value-that-is-long-enough-1234567890",
      AUTH_URL: "http://localhost:3000",
      STORAGE_PATH: "./storage",
      OPENAI_API_KEY: "sk-test",
      SMTP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ADMIN_EMAIL: "admin@belegbox.local",
      ADMIN_PASSWORD: "test-admin-password",
      ADMIN_NAME: "Test Admin",
      EXCHANGE_RATE_API_URL: "https://api.frankfurter.app",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
