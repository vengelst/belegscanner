import bcrypt from "bcryptjs";

export async function hashSecret(value: string) {
  return bcrypt.hash(value, 12);
}

export async function compareSecret(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}
