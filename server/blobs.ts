/**
 * Heavy assets for a web module, served from the lakeFS content tier.
 *
 * A module directory may carry `asset-manifest.toml` (the generated projection
 * from the module's repo: [[asset]] entries with path, content_sha256, bytes,
 * lakefs_repo, lakefs_commit, lakefs_path). This route resolves a sha256 to its
 * object, fetches it from lakeFS at the pinned commit, verifies the bytes
 * against the manifest hash, and serves them immutable — the URL is the hash,
 * so nothing here can go stale. A mismatch is a 502, never a corrupt model.
 *
 * Objects up to VERIFY_IN_MEMORY_BYTES are hashed before the response starts.
 * Larger ones stream and are hashed as they pass; a mismatch there aborts the
 * response so the client sees a failed transfer, not a wrong file.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { Elysia } from "elysia";

export interface BlobEntry {
  path: string;
  sha256: string;
  bytes: number;
  repo: string;
  commit: string;
  lakefsPath: string;
}

export interface LakefsConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const VERIFY_IN_MEMORY_BYTES = 64 * 1024 * 1024;
const noStore = { "cache-control": "no-store" };
const types: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".stl": "model/stl",
  ".step": "application/step",
  ".stp": "application/step",
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".dxf": "application/dxf",
  ".svg": "image/svg+xml",
};

/** The manifest is flat generated TOML: [[asset]] blocks of `key = value`. */
export function parseManifest(text: string): Map<string, BlobEntry> {
  const entries = new Map<string, BlobEntry>();
  let current: Record<string, string> = {};
  const flush = () => {
    const sha = current.content_sha256;
    if (sha && current.path)
      entries.set(sha, {
        path: current.path,
        sha256: sha,
        bytes: Number(current.bytes ?? 0),
        repo: current.lakefs_repo ?? "",
        commit: current.lakefs_commit ?? "",
        lakefsPath: current.lakefs_path ?? current.path,
      });
    current = {};
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "[[asset]]") {
      flush();
      continue;
    }
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    current[key] =
      value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  }
  flush();
  return entries;
}

export async function loadManifest(dir: string) {
  try {
    return parseManifest(
      await readFile(resolve(dir, "asset-manifest.toml"), "utf8"),
    );
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return new Map();
    throw error;
  }
}

export function lakefsFromEnv(env = process.env): LakefsConfig | undefined {
  const accessKeyId = env.LAKEFS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.LAKEFS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return undefined;
  return {
    endpoint: (env.LAKEFS_ENDPOINT?.trim() || "http://127.0.0.1:18000").replace(
      /\/$/,
      "",
    ),
    accessKeyId,
    secretAccessKey,
  };
}

function objectUrl(config: LakefsConfig, entry: BlobEntry) {
  const repo = encodeURIComponent(entry.repo);
  const ref = encodeURIComponent(entry.commit);
  const path = encodeURIComponent(entry.lakefsPath);
  return `${config.endpoint}/api/v1/repositories/${repo}/refs/${ref}/objects?path=${path}`;
}

function authorization(config: LakefsConfig) {
  return `Basic ${Buffer.from(`${config.accessKeyId}:${config.secretAccessKey}`).toString("base64")}`;
}

/** Streams the object, hashing as it passes; a mismatch at the end aborts. */
function verifiedStream(body: ReadableStream<Uint8Array>, expected: string) {
  const hash = createHash("sha256");
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        hash.update(chunk);
        controller.enqueue(chunk);
      },
      flush(controller) {
        if (hash.digest("hex") !== expected)
          controller.error(new Error("content hash mismatch"));
      },
    }),
  );
}

export function createBlobRoutes(options: {
  name: string;
  entries: Map<string, BlobEntry>;
  lakefs?: LakefsConfig;
  fetch?: typeof fetch;
}) {
  const doFetch = options.fetch ?? fetch;
  return new Elysia({ name: `module-${options.name}-blobs` }).get(
    `/api/modules/${options.name}/blob/:sha`,
    async ({ params: { sha } }) => {
      const entry = options.entries.get(sha.toLowerCase());
      if (!entry)
        return Response.json(
          { error: "Unknown blob" },
          { status: 404, headers: noStore },
        );
      if (!options.lakefs)
        return Response.json(
          { error: "Content tier is not configured" },
          { status: 503, headers: noStore },
        );
      const upstream = await doFetch(objectUrl(options.lakefs, entry), {
        headers: { authorization: authorization(options.lakefs) },
      });
      if (!upstream.ok || !upstream.body)
        return Response.json(
          { error: `Content tier returned ${upstream.status}` },
          { status: 502, headers: noStore },
        );
      const headers = {
        "content-type":
          types[extname(entry.path).toLowerCase()] ??
          "application/octet-stream",
        "content-length": String(entry.bytes),
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${entry.sha256}"`,
        "content-disposition": `inline; filename="${entry.path.split("/").pop()}"`,
      };
      if (entry.bytes <= VERIFY_IN_MEMORY_BYTES) {
        const bytes = new Uint8Array(await upstream.arrayBuffer());
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (digest !== entry.sha256 || bytes.byteLength !== entry.bytes)
          return Response.json(
            { error: "Content tier object does not match its manifest hash" },
            { status: 502, headers: noStore },
          );
        return new Response(bytes, { headers });
      }
      return new Response(verifiedStream(upstream.body, entry.sha256), {
        headers,
      });
    },
  );
}
