"use server";

import { revalidatePath } from "next/cache";
import { jobSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { requireSession } from "@/server/auth/require-session";
import { ActionResult, fail, ok, zodFail } from "./result";

export async function createJobAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireSession();
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const job = await prisma.job.create({ data: parsed.data });
  revalidatePath("/jobs");
  revalidatePath("/candidates/new");
  return ok({ id: job.id });
}

export async function updateJobAction(id: string, input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  await prisma.job.update({ where: { id }, data: parsed.data });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/candidates/new");
  return ok();
}

export async function setJobStatusAction(
  id: string,
  status: "OPEN" | "CLOSED",
): Promise<ActionResult> {
  await requireSession();
  if (status !== "OPEN" && status !== "CLOSED") return fail("Invalid status.");
  await prisma.job.update({ where: { id }, data: { status } });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/candidates/new");
  return ok();
}
