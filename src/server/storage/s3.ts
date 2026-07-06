import { randomBytes } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, type PresignedPost } from "@aws-sdk/s3-presigned-post";
import { getEnv } from "@/lib/config/env";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB
const DOWNLOAD_URL_TTL = 60; // seconds

let client: S3Client | null = null;
function s3(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    ...(env.AWS_ENDPOINT
      ? { endpoint: env.AWS_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE }
      : {}),
  });
  return client;
}

function bucket(): string {
  return getEnv().S3_BUCKET;
}

// Resumes are uploaded before the candidate row exists, so the key is not
// candidate-scoped; the candidate simply references this key once created.
export function newResumeKey(): string {
  return `resumes/${randomBytes(12).toString("hex")}.pdf`;
}

export function offerDocKey(
  candidateId: string,
  offerId: string,
  kind: "offer-letter" | "nda",
): string {
  return `candidates/${candidateId}/offers/${offerId}/${kind}.pdf`;
}

/**
 * Presigned POST for a browser->S3 direct upload. The policy makes S3 itself
 * enforce the 10 MB cap and the application/pdf content type even if the client
 * lies, and keeps the file bytes off our serverless function entirely.
 */
export async function presignResumeUpload(key: string): Promise<PresignedPost> {
  return createPresignedPost(s3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ["content-length-range", 0, MAX_RESUME_BYTES],
      ["eq", "$Content-Type", "application/pdf"],
    ],
    Fields: { "Content-Type": "application/pdf" },
    Expires: 300,
  });
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Short-lived presigned GET that forces a download with a friendly filename. */
export async function presignDownload(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL },
  );
}

export interface HeadResult {
  contentType?: string;
  contentLength?: number;
}

export async function headObject(key: string): Promise<HeadResult | null> {
  try {
    const out = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { contentType: out.ContentType, contentLength: out.ContentLength };
  } catch {
    return null;
  }
}

/** Read the first bytes of an object to sniff the %PDF- magic number. */
export async function sniffPdfMagic(key: string): Promise<boolean> {
  try {
    const out = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key, Range: "bytes=0-4" }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) return false;
    return Buffer.from(bytes).toString("latin1").startsWith("%PDF-");
  } catch {
    return false;
  }
}
