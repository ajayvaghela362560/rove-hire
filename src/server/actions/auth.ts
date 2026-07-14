"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { verifyPassword, DUMMY_HASH } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { logger } from "@/lib/logger";
import { ActionResult, fail, ok, zodFail } from "./result";

export async function loginAction(
  input: unknown,
  next?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.hrUser.findUnique({ where: { email } });

  // Always run a verification (against a dummy hash for unknown emails) so response
  // timing does not reveal whether the account exists.
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    logger.warn("login.failed", { email });
    return fail("Invalid email or password.");
  }

  await createSession(user.id);
  logger.info("login.success", { userId: user.id });
  // Only allow same-site relative paths. Reject protocol-relative ("//evil.com")
  // and backslash-normalised ("/\evil.com") targets, which browsers treat as
  // absolute URLs — otherwise `next` is an open redirect.
  const dest =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/";
  redirect(dest);
  return ok();
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
