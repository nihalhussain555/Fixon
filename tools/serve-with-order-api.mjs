/* FIXON - try the order endpoint on your own machine
 *
 *   node tools/serve-with-order-api.mjs [port]
 *
 * Serves the site the way a plain static server would AND answers
 * /api/whatsapp-order with the real api/whatsapp-order.js function, so the
 * "Order on WhatsApp" button can be clicked in a browser before anything is
 * deployed. Nothing is invented here: the function reads its WhatsApp settings
 * from the environment exactly as Vercel would hand them over, so with no
 * WA_ACCESS_TOKEN etc. set the health route simply lists which names are
 * missing, and a real order is only ever sent once those are genuinely filled
 * in.
 *
 * The WhatsApp Cloud API address is whatever the real code calls. This script
 * does not intercept it, so a run with a token you pasted in CAN reach Meta.
 * Keep a test token out of it if you only want to watch the button behave.
 */

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2]) || 8123;
const ORDER_PATH = "/api/whatsapp-order";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

const { default: orderHandler } = await import(
  new URL("../api/whatsapp-order.js", import.meta.url).href
);

/* Two defaults, so the button can be clicked without any setup at all: this
   machine's own origin is allowed, and relative photo addresses resolve to it.
   Neither is used by Vercel - the deployed function reads the real values from
   the project's environment variables. */
if (!process.env.ORDER_ALLOWED_ORIGINS) {
  process.env.ORDER_ALLOWED_ORIGINS = "http://localhost:" + PORT;
}
if (!process.env.SITE_URL) {
  process.env.SITE_URL = "http://localhost:" + PORT;
}
/* The Vercel shape, in as few lines as the real one needs: status(), json(),
   setHeader(), end(). */
function makeResult(res) {
  const out = {
    status(code) { out.statusCode = code; return out; },
    statusCode: 200,
    setHeader(key, value) { res.setHeader(key, value); return out; },
    json(payload) {
      const text = JSON.stringify(payload);
      res.writeHead(out.statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(text)
      });
      res.end(text);
    },
    end() { res.writeHead(out.statusCode); res.end(); }
  };
  return out;
}

async function fileOnDisk(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? path : null;
  } catch (e) {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0].split("#")[0];

  if (url === ORDER_PATH || url === ORDER_PATH + "/") {
    const handlerRes = makeResult(res);
    try {
      await orderHandler(req, handlerRes);
    } catch (err) {
      console.error("order endpoint threw:", err && err.code);
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, delivered: false, code: "order_failed", message: "The order endpoint crashed." }));
    }
    return;
  }

  /* A path that walks out of the site directory is refused, not served. */
  const target = normalize(join(ROOT, decodeURIComponent(url)));
  if (!target.startsWith(ROOT + normalize("/")) && target !== ROOT) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("outside the site folder");
    return;
  }

  const file = await fileOnDisk(target) || await fileOnDisk(target + ".html") ||
    (url.endsWith("/") ? await fileOnDisk(join(target, "index.html")) : null);

  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }

  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store"
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log("FIXON with the order endpoint:");
  console.log("  site     http://localhost:" + PORT + "/index.html");
  console.log("  endpoint " + ORDER_PATH + "  (GET shows which variables are missing)");
  console.log("Set FIXON.orderApi.endpoint in js/config.js to http://localhost:" + PORT + ORDER_PATH);
});
