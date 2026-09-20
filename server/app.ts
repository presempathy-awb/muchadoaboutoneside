import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Elysia } from "elysia";
import { WORKSHEET_FONT_CATALOG } from "../shared/worksheet-font-catalog";
import { createCollab } from "./collab";
import type { WebModule } from "./modules";
import { assetNames, project } from "./project";

export interface AppOptions {
  staticDir?: string;
  assetDir?: string;
  /** Where live poem drafts are stored; live sync stays off without it. */
  collabDir?: string;
  /** Sites served for other hosts, each with its own ephemeral rooms. */
  modules?: readonly WebModule[];
}

const defaultAssetDir = resolve(import.meta.dir, "../source/assets");
const stableCache = "no-store";
const immutableCache = "public, max-age=31536000, immutable";
const viteAssetPattern = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/;
const worksheetFontDigests = new Map<string, string>(
  WORKSHEET_FONT_CATALOG.map((font) => [font.path, font.sha256]),
);

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".obj": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".stl": "model/stl",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
};

function notFound(message = "Not found") {
  return Response.json(
    { error: message },
    { status: 404, headers: { "cache-control": stableCache } },
  );
}

function safeStaticPath(root: string, pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`)
    ? candidate
    : undefined;
}

function fileResponse(
  path: string,
  headers?: HeadersInit,
  cacheControl = stableCache,
) {
  const file = Bun.file(path);
  const type =
    contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream";
  return new Response(file, {
    headers: {
      "cache-control": cacheControl,
      "content-length": String(file.size),
      "content-type": type,
      ...headers,
    },
  });
}

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export function createApp(options: AppOptions = {}) {
  const assetDir = resolve(options.assetDir ?? defaultAssetDir);
  const configuredStaticDir =
    options.staticDir ??
    (process.env.NODE_ENV === "production"
      ? resolve(import.meta.dir, "../dist")
      : undefined);
  const staticDir = configuredStaticDir
    ? resolve(configuredStaticDir)
    : undefined;
  const collab = createCollab(
    options.collabDir ?? (process.env.COLLAB_DIR?.trim() || undefined),
  );

  const modules = options.modules ?? [];
  const app = new Elysia()
    .use(collab.plugin)
    .use(new Elysia({ name: "modules" }).use(modules.map((m) => m.plugin)))
    .get("/api/health", () =>
      Response.json(
        { status: "ok" as const },
        { headers: { "cache-control": stableCache } },
      ),
    )
    .get("/api/project", () =>
      Response.json(project, { headers: { "cache-control": stableCache } }),
    )
    .get("/api/assets/:name", async ({ params: { name } }) => {
      if (!assetNames.has(name)) return notFound("Unknown asset");

      const path = resolve(assetDir, name);
      if (!(await isFile(path))) return notFound("Asset is unavailable");

      const headers: HeadersInit = name.endsWith(".html")
        ? { "content-disposition": `attachment; filename="${name}"` }
        : {};
      return fileResponse(path, headers);
    })
    .get("*", async ({ request }) => {
      const { pathname, searchParams } = new URL(request.url);
      if (pathname === "/api" || pathname.startsWith("/api/"))
        return notFound();
      const host = request.headers.get("host")?.split(":")[0];
      const root = modules.find((m) => m.host === host)?.staticDir ?? staticDir;
      if (!root) return notFound();
      const requestedPath = safeStaticPath(root, pathname);
      if (!requestedPath) return notFound("Invalid static path");
      if (await isFile(requestedPath)) {
        const expectedFontDigest = worksheetFontDigests.get(pathname);
        const isVersionedFont =
          expectedFontDigest !== undefined &&
          searchParams.get("sha256") === expectedFontDigest;
        const cacheControl =
          viteAssetPattern.test(pathname) || isVersionedFont
            ? immutableCache
            : stableCache;
        return fileResponse(requestedPath, undefined, cacheControl);
      }

      if (extname(pathname)) return notFound("Static asset is unavailable");

      const indexPath = resolve(root, "index.html");
      return (await isFile(indexPath))
        ? fileResponse(indexPath)
        : notFound("Site build is unavailable");
    });
  // Elysia does not await stop hooks; drafts must be written before we return.
  const stop = app.stop;
  app.stop = async (closeActiveConnections?: boolean) => {
    await stop(closeActiveConnections);
    await collab.close();
    await Promise.all(modules.map((m) => m.close()));
    return app;
  };
  return app;
}
