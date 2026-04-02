import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { compareSecret } from "@/lib/auth/hash";
import { loginSchema, pinLoginSchema } from "@/lib/validation";
import {
  isLoginLocked,
  recordFailedLogin,
  resetLoginAttempts,
} from "@/lib/auth/login-rate-limit";

const DUMMY_PASSWORD_HASH = "$2b$12$7iKh4Q6v8f4V5s9o8k6MXugWkFG95Cq1R8h5r7x5mQ7bK4f71b9Ya";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      id: "email-password",
      name: "E-Mail und Passwort",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.active) {
          await compareSecret(parsed.data.password, DUMMY_PASSWORD_HASH);
          return null;
        }

        // Brute-force protection
        if (await isLoginLocked(user)) return null;

        const isValid = await compareSecret(parsed.data.password, user.passwordHash);
        if (!isValid) {
          await recordFailedLogin(user.id);
          return null;
        }

        await resetLoginAttempts(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    Credentials({
      id: "pin-login",
      name: "PIN-Login",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = pinLoginSchema
          .extend({ email: loginSchema.shape.email })
          .safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.active || !user.pinHash) {
          await compareSecret(parsed.data.pin, DUMMY_PASSWORD_HASH);
          return null;
        }

        // Brute-force protection (shared counter with password login)
        if (await isLoginLocked(user)) return null;

        const isValid = await compareSecret(parsed.data.pin, user.pinHash);
        if (!isValid) {
          await recordFailedLogin(user.id);
          return null;
        }

        await resetLoginAttempts(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  trustHost: true,
  secret: process.env.AUTH_SECRET,
});
