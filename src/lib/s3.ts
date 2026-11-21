import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";

export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export function s3PublicBaseUrl(): string {
  if (env.S3_PUBLIC_BASE_URL) {
    return env.S3_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  return `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
}

/** Browser URL for an object key: {base}/{key} */
export function s3ObjectUrl(key: string): string {
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${s3PublicBaseUrl()}/${encoded}`;
}

export async function s3PutObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export async function s3DeleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}

export async function s3ObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      }),
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number }; name?: string })?.$metadata
      ?.httpStatusCode;
    const name = (err as { name?: string })?.name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    throw err;
  }
}

/** Low-level get (stream/body) — useful if you ever proxy instead of public URLs. */
export async function s3GetObject(key: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
