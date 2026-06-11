import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");

  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, stored] = storedHash.split("$");

  if (algorithm !== "pbkdf2" || !iterations || !salt || !stored) {
    return false;
  }

  const hash = pbkdf2Sync(password, salt, Number(iterations), Buffer.from(stored, "hex").length, DIGEST);
  return timingSafeEqual(hash, Buffer.from(stored, "hex"));
}