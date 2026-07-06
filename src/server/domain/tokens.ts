import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Tx } from "./state-machine";

export const TOKEN_TTL_DAYS = 14;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** 256-bit CSPRNG token. Only the hash is ever persisted; the raw value is a bearer credential. */
export function generateRawToken(): { raw: string; tokenHash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("base64url");
  return {
    raw,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export type TokenState = "valid" | "expired" | "used" | "revoked" | "invalid";

export interface TokenLookup {
  state: TokenState;
  candidateId?: string;
}

/** Non-consuming classification for rendering the public /apply page (GET). */
export async function inspectToken(raw: string): Promise<TokenLookup> {
  const token = await prisma.applicationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!token) return { state: "invalid" };
  if (token.revokedAt) return { state: "revoked" };
  if (token.usedAt) return { state: "used" };
  if (token.expiresAt.getTime() < Date.now()) return { state: "expired" };
  return { state: "valid", candidateId: token.candidateId };
}

/**
 * Atomically consume a token. The single conditional UPDATE is the linearization
 * point: Postgres row-locking guarantees exactly one of two concurrent submits
 * (double-click / two tabs) matches a row; the loser gets null. Expiry is inside
 * the predicate, so there is no check-then-use TOCTOU window.
 */
export async function claimToken(tx: Tx, raw: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ candidate_id: string }[]>(
    Prisma.sql`
      UPDATE "application_tokens"
      SET "used_at" = now()
      WHERE "token_hash" = ${hashToken(raw)}
        AND "used_at" IS NULL
        AND "revoked_at" IS NULL
        AND "expires_at" > now()
      RETURNING "candidate_id"`,
  );
  return rows[0]?.candidate_id ?? null;
}

/** Revoke all live tokens for a candidate (on regenerate and on rejection). */
export async function revokeLiveTokens(tx: Tx, candidateId: string): Promise<void> {
  await tx.applicationToken.updateMany({
    where: { candidateId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Build the public apply URL from APP_URL (never from the request). */
export function buildApplyUrl(appUrl: string, raw: string): string {
  return `${appUrl.replace(/\/$/, "")}/apply/${raw}`;
}
