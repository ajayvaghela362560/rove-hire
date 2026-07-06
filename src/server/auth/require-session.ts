import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

/**
 * The real authorization boundary. Called at the top of every protected page,
 * server action, and route handler — middleware only does a cheap cookie-presence
 * redirect for UX and is never trusted for security (see CVE-2025-29927).
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Same check for route handlers, where we want a thrown error rather than a redirect. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireSessionApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
