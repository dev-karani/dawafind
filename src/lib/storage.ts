import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile, open } from "node:fs/promises";
import path from "node:path";
import { badRequest } from "./http";

/**
 * Private, encrypted-at-rest prescription storage.
 *  - Files live outside /public and are only reachable through authorised API routes.
 *  - Each file is AES-256-GCM encrypted. The DB stores only an opaque reference.
 *  - Deletion overwrites the file before unlinking.
 */
const DIR = path.resolve(process.env.PRESCRIPTION_STORAGE_DIR || "./storage/prescriptions");
const KEY = createHash("sha256")
  .update(process.env.FILE_ENCRYPTION_KEY || process.env.SESSION_SECRET || "dev-only-insecure-key")
  .digest();

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Detect the real type from magic bytes (never trust client-supplied type or extension). */
export function sniffMime(buf: Buffer): (typeof ALLOWED_MIME)[number] | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

/**
 * Lightweight active-content screen. This is NOT a substitute for antivirus:
 * in production, plug a real scanner (e.g. ClamAV) in here.
 */
export function screenForActiveContent(buf: Buffer, mime: string) {
  if (mime !== "application/pdf") return;
  const text = buf.toString("latin1");
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/.test(text)) {
    throw badRequest("This PDF contains active content and cannot be accepted. Please upload a plain scan or photo.");
  }
}

function safePath(ref: string) {
  if (!/^[a-f0-9]{32}$/.test(ref)) throw new Error("Invalid file reference");
  return path.join(DIR, ref);
}

export async function saveEncrypted(plain: Buffer): Promise<string> {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  const ref = randomBytes(16).toString("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  await writeFile(safePath(ref), Buffer.concat([iv, cipher.getAuthTag(), enc]), { mode: 0o600 });
  return ref;
}

export async function readDecrypted(ref: string): Promise<Buffer> {
  const raw = await readFile(safePath(ref));
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
}

/** Overwrite with random bytes, then unlink. Missing files are ignored. */
export async function secureDelete(ref: string) {
  const p = safePath(ref);
  try {
    const { size } = await stat(p);
    const fh = await open(p, "r+");
    await fh.write(randomBytes(size), 0, size, 0);
    await fh.sync();
    await fh.close();
    await unlink(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
