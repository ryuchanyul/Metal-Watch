import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPricesFromSources } from "./lib/prices.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json"
};

const CACHE_TTL_MS = 60 * 60 * 1000;
let priceCache = { fetchedAt: 0, data: null };

async function getCachedPrices({ forceRefresh = false } = {}) {
  const now = Date.now();
  const ageMs = now - priceCache.fetchedAt;

  if (!forceRefresh && priceCache.data && ageMs < CACHE_TTL_MS) {
    return { ...priceCache.data, cached: true, stale: false, ageMs };
  }

  try {
    const data = await fetchPricesFromSources();
    priceCache = { fetchedAt: now, data };
    return { ...data, cached: false, stale: false, ageMs: 0 };
  } catch (error) {
    console.error("[prices] fetch 실패:", error.message);
    if (priceCache.data) {
      return {
        ...priceCache.data,
        cached: true,
        stale: true,
        error: error.message,
        ageMs
      };
    }
    throw error;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/api/prices") {
    try {
      const forceRefresh = url.searchParams.get("refresh") === "1";
      const data = await getCachedPrices({ forceRefresh });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "data source unavailable",
          message: error.message
        })
      );
    }
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = normalize(join(publicDir, pathname));

  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(resolved);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(resolved)] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Metal Watch running at http://localhost:${port}`);
});
