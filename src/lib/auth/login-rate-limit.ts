import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

/**
 * Check if a user is currently locked out from login attempts.
 * Uses the same DB fields as PIN rate-limiting (failedPinAttempts / pinLockedUntil)
 * since they serve the same purpose: protecting against brute-force on any credential.
 */
export async function isLoginLocked(user: {
  failedPinAttempts: number;
  pinLockedUntil: Date | null;
}): Promise<boolean> {
  return !!user.pinLockedUntil && user.pinLockedUntil > new Date();
}

export async function recordFailedLogin(userId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedPinAttempts: true, pinLockedUntil: true },
  });

  if (!currentUser) {
    return;
  }

  if (currentUser.pinLockedUntil && currentUser.pinLockedUntil > new Date()) {
    return;
  }

  const nextAttempts = currentUser.failedPinAttempts + 1;
  const isLocked = nextAttempts >= MAX_ATTEMPTS;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedPinAttempts: isLocked ? 0 : nextAttempts,
      pinLockedUntil: isLocked
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : undefined,
    },
  });
}

export async function resetLoginAttempts(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedPinAttempts: 0,
      pinLockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
}
