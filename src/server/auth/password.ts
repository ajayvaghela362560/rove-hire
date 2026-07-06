import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// scrypt from node:crypto — memory-hard, zero native dependencies (so it can never
// fail to build/load on a serverless runtime the way argon2's native binding can).
const KEYLEN = 64;
const COST = 16384; // N — CPU/memory cost factor (2^14)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${COST}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, , salt, hashHex] = parts as [string, string, string, string];
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

// A throwaway hash verified when the email is unknown, so login response timing
// does not reveal whether an account exists (user-enumeration defense).
export const DUMMY_HASH =
  "scrypt$16384$0000000000000000000000000000000000000000000000000000000000000000$" +
  "0".repeat(128);
