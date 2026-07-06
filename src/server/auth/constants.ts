// Dependency-free so the Edge middleware can import it without pulling in
// node:crypto / Prisma (which are not available in the Edge runtime).
export const SESSION_COOKIE = "rove_session";
