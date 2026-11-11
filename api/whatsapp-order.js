/* ==========================================================================
   FIXON - WhatsApp order endpoint (Vercel Node serverless function)
   --------------------------------------------------------------------------
   POST /api/whatsapp-order   { productId, nonce, category?, customer? }
   GET  /api/whatsapp-order?health=1

   Why this file exists at all: a wa.me link can carry text and the address of a
   picture but never the picture itself, and the WhatsApp Cloud API cannot be
   called from a browser - graph.facebook.com sends no CORS headers, so the
   response never reaches the page, and any token placed in JavaScript is public
   the moment the site is deployed. That leaves exactly one shape that works:
   the page posts a product id here, and this function does what only a server
   can do - read the product from the shop's own sheet, download its real photo,
   upload it to the Graph API media endpoint, and ask Graph to deliver that image
   to the shop's WhatsApp number with the order written as its caption.

   TRUST RULES, and the reason each one is here:
   - The visitor's payload is treated as a question, never as an answer. Name,
     price, photo and fitment are re-read from the catalog sheet on the server,
     so a hand-crafted request cannot put invented wording, an invented price or
     a foreign image in front of the shop.
   - Credentials are read from environment variables and never returned in a
     response, written to a log line, or copied into the WhatsApp message. The
     health check reports which variable names are missing, not their values.
   - Success is reported only after the Graph messages endpoint has answered
     with a message id. Every other outcome is an error carrying a code the
     frontend turns into words the visitor can act on.
   - The reply path is a real limitation, not a detail: a business-initiated
     message from your own number to your own number shows in your own chat and
     carries no click-to-reply contact. That is why the optional customer fields
     below exist, and why WHATSAPP-ORDERS.md tells you to collect them.
   ========================================================================== */

const GRAPH_HOST = "https://graph.facebook.com";

/* The owner's own sheet, the same address js/catalog.js reads. Overridable so
   a fork of this site can point at its own file. */
const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/nihalhussain555/Fixon/main/data/catalog.csv";

const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 8 * 1024;              /* this payload is a few hundred bytes */
const MAX_CAPTION_CHARS = 1024;               /* Cloud API limit for an image caption */
const MAX_TEXT_FIELD = 160;                   /* per visitor-typed line */
const NONCE_TTL_MS = 10 * 60 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_PER_WINDOW = 5;

function env(name) {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : "";
}

function numberEnv(name, fallback) {
  const n = Number(env(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* The project's REST address, checked the same way js/supabase.js checks it:
   https, host only, no path, no credentials. A half-pasted value falls back
   to the CSV source instead of POSTing product data somewhere unexpected. */
function supabaseBase(raw) {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9.-]+$/i.test(value) && !/@/.test(value) ? value : "";
}

const CONFIG = {
  get token() { return env("WA_ACCESS_TOKEN"); },
  get phoneId() { return env("WA_PHONE_NUMBER_ID"); },
  /* A pinned default so one less variable has to be set. Meta keeps each
     version alive for about two years; override if this site still runs later. */
  get apiVersion() { return env("WA_API_VERSION") || "v23.0"; },
  get shopNumber() { return env("WA_SHOP_NUMBER"); },
  get catalogUrl() { return env("CATALOG_URL") || DEFAULT_CATALOG_URL; },
  /* Supabase, when the shop runs its catalog from the database. The ANON
     key only - the same public value the browser uses - because this read
     is exactly the storefront's: RLS hands back active products, nothing
     more. The service-role key bypasses every policy and appears nowhere
     in this repository. */
  get supabaseUrl() { return supabaseBase(env("SUPABASE_URL")); },
  get supabaseKey() { return env("SUPABASE_ANON_KEY"); },
  get siteUrl() { return env("SITE_URL"); },
  get allowedOrigins() {
    return env("ORDER_ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  },
  get maxImageBytes() { return numberEnv("ORDER_MAX_IMAGE_BYTES", 5 * 1024 * 1024); },
  get perWindow() { return numberEnv("ORDER_RATE_LIMIT", DEFAULT_PER_WINDOW); },
  /* Every variable a working send needs, by name only. */
  required() {
    const missing = [];
    if (!this.token) missing.push("WA_ACCESS_TOKEN");
    if (!this.phoneId) missing.push("WA_PHONE_NUMBER_ID");
    if (!this.shopNumber) missing.push("WA_SHOP_NUMBER");
    return missing;
  }
};

/* ------------------------------------------------------------------ *
 * Errors: a code the frontend can map, plus a sentence for the log.
 * ------------------------------------------------------------------ */
class OrderError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

function fail(status, code, message, extra) {
  throw new OrderError(status, code, message, extra);
}

/* ------------------------------------------------------------------ *
 * Response helpers
 * ------------------------------------------------------------------ */
function applyCors(res, origin) {
  const allowed = CONFIG.allowedOrigins;
  if (!origin || !allowed.length || allowed.indexOf(origin) === -1) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

function send(res, status, body) {
  res.status(status).json(body);
}

/* No token, no phone id, no sheet text, no visitor note ever passes through
   here - the event names and counts are all that is recorded. */
function log(event, fields) {
  const line = Object.assign({ at: new Date().toISOString(), fixon_order: event }, fields || {});
  console.log(JSON.stringify(line));
}

/* ------------------------------------------------------------------ *
 * Request body
 * ------------------------------------------------------------------ */
async function readJson(req) {
  const body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  if (Buffer.isBuffer(body)) return parse(JSON.parse, body.toString("utf8"));
  if (typeof body === "string") return parse(JSON.parse, body);

  /* A raw Node request has no parsed body at all, so it has to be drained. */
  if (req && typeof req[Symbol.asyncIterator] === "function") {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        fail(413, "body_to_large", "The request body is bigger than an order needs.");
      }
      chunks.push(chunk);
    }
    return parse(JSON.parse, Buffer.concat(chunks).toString("utf8"));
  }
  return {};
}

function parse(fn, text) {
  try {
    return fn(text === "" ? "{}" : text);
  } catch (e) {
    fail(400, "invalid_json", "The request body is not JSON.");
  }
}

/* One clean line of visitor text: no control characters, no embedded URL, no
   newlines that would let a note rewrite the shape of the caption. */
function cleanLine(value, label) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") fail(400, "invalid_field", label + " must be text.");
  const one = value.replace(/[\r\n\t]+/g, " ").replace(/[^\S ]{2,}/g, " ").trim().slice(0, MAX_TEXT_FIELD);
  if (/https?:\/\/|wa\.me|\+\d[\d\s().-]{6,}\d/i.test(one)) {
    fail(400, "invalid_field", label + " cannot contain a link or a phone number.");
  }
  return one;
}

function readPayload(body) {
  if (!body || typeof body !== "object") fail(400, "invalid_request", "Expected a JSON object.");

  const productId = String(body.productId || "");
  if (!/^p-[a-z0-9-]{1,80}$/i.test(productId)) {
    fail(400, "invalid_product_id", "productId must be a product id from this site's own listing.");
  }
  const nonce = String(body.nonce || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) {
    fail(400, "invalid_nonce", "nonce must be a 8-64 character token generated for this click.");
  }

  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  return {
    productId,
    nonce,
    /* Display-only strings. The product itself is re-read from the sheet; these
       only say how the site labelled the category, which the sheet stores as a
       short slug. */
    categoryLabel: cleanLine(body.category, "category"),
    customer: {
      name: cleanLine(customer.name, "customer.name"),
      device: cleanLine(customer.device, "customer.device"),
      note: cleanLine(customer.note, "customer.note")
    }
  };
}

/* ------------------------------------------------------------------ *
 * Catalog: the same file the page reads, parsed the same way it is parsed
 * there. js/catalog.js builds a product id from the name column, so the id in
 * the request can only be checked by rebuilding those ids.
 * ------------------------------------------------------------------ */
const REQUIRED_COLUMNS = ["name", "price", "description", "image", "category", "active"];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function headerMap(header) {
  const map = {};
  header.forEach((name, index) => {
    map[String(name).trim().toLowerCase().replace(/\s+/g, "_")] = index;
  });
  return map;
}

function cell(row, map, name) {
  const i = map[name];
  return i === undefined || row[i] === undefined ? "" : String(row[i]).trim();
}

function priceNumber(text) {
  const digits = String(text).replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* rupee and Indian digit grouping, matching how the site writes prices. The
   symbol comes from the environment so a shop selling in another currency does
   not send "Rs" text it never agreed to. */
function formatPrice(value) {
  const symbol = env("PRICE_SYMBOL") || "\u20B9";
  const rounded = Math.round(value * 100) / 100;
  return symbol + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(rounded);
}

function rowKey(name, line, used) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const stem = "p-" + (slug || "row" + line);
  let id = stem;
  let n = 2;
  while (used[id]) { id = stem + "-" + n; n += 1; }
  used[id] = true;
  return id;
}

async function loadCsvCatalog() {
  let text;
  try {
    const res = await fetch(CONFIG.catalogUrl, {
      headers: { accept: "text/csv,text/plain,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) fail(502, "catalog_unreachable", "The product sheet answered " + res.status + ".");
    text = await res.text();
  } catch (e) {
    if (e instanceof OrderError) throw e;
    fail(502, "catalog_unreachable", "The product sheet could not be read from the server.");
  }

  const rows = parseCsv(text);
  const map = headerMap(rows[0] || []);
  const missing = REQUIRED_COLUMNS.filter((col) => map[col] === undefined);
  if (!rows.length || missing.length) {
    fail(502, "catalog_misformatted", "The product sheet is missing column(s): " + missing.join(", ") + ".");
  }

  const used = {};
  const products = new Map();
  rows.slice(1).forEach((row, index) => {
    if (cell(row, map, "active").toUpperCase() !== "TRUE") return;
    const name = cell(row, map, "name");
    if (!name) return;
    const price = priceNumber(cell(row, map, "price"));
    const image = cell(row, map, "image");
    /* Same-brand/model columns the panel already shows, kept for fitment. */
    const fitment = [cell(row, map, "brand"), cell(row, map, "model")].filter(Boolean).join(" - ");
    products.set(rowKey(name, index + 2, used), {
      name,
      priceText: price === null ? "" : formatPrice(price),
      category: cell(row, map, "category"),
      image,
      fitment,
      stock: cell(row, map, "stock")
    });
  });
  return products;
}

/* ------------------------------------------------------------------ *
 * Supabase catalog - what the admin dashboard writes, this re-reads
 * --------------------------------------------------------------------------
 * Identical trust rule as the sheet: every caption value comes from this
 * server-side read, never from the payload. The anon key plus RLS mean the
 * function sees exactly what a customer sees - the active products - so a
 * hand-crafted request cannot order a hidden draft any more than the site
 * can display one. Ids are rebuilt with the same rowKey() the sheet uses
 * (newest first, like js/catalog.js orders Supabase reads), so the ids a
 * page holds match whichever source this function ends up reading.
 * ------------------------------------------------------------------ */
function supabaseStockCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function loadSupabaseCatalog() {
  const res = await fetch(CONFIG.supabaseUrl + "/rest/v1/products?select=*&is_active=eq.true&order=created_at.desc", {
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: "Bearer " + CONFIG.supabaseKey,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) fail(502, "catalog_unreachable", "The product database answered " + res.status + ".");
  const rows = await res.json();
  if (!Array.isArray(rows)) fail(502, "catalog_misformatted", "The product database did not answer a list.");

  const used = {};
  const products = new Map();
  rows.forEach((row, index) => {
    const name = String(row.name || "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const price = typeof row.price === "number" ? row.price : priceNumber(row.price);
    const category = String(row.category || "").trim();
    const image = String(row.image_url || "").trim();
    const fitment = [String(row.brand || "").trim(), String(row.model || "").trim()].filter(Boolean).join(" - ");
    const note = String(row.stock_note || "").trim();
    const count = supabaseStockCount(row.stock);
    products.set(rowKey(name, index + 2, used), {
      name,
      priceText: price === null || price === undefined ? "" : formatPrice(price),
      category,
      image,
      fitment,
      stock: note || (count === null ? "" : count > 0 ? "In stock (" + count + ")" : "Out of stock"),
      stockCount: count,
      description: String(row.description || "").replace(/\s+/g, " ").trim()
    });
  });
  return products;
}

async function loadCatalog() {
  if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
    try {
      return await loadSupabaseCatalog();
    } catch (e) {
      /* The CSV fallback is deliberate: a Supabase outage must not stop
         orders for a shop whose sheet is still current. The two sources
         hold the same names because the dashboard IS the sheet's
         replacement, so a name built id resolves either way. */
      log("supabase_catalog_failed", { message: e instanceof OrderError ? e.code : String(e && e.message || "").slice(0, 120) });
    }
  }
  return loadCsvCatalog();
}

/* ------------------------------------------------------------------ *
 * Image
 * ------------------------------------------------------------------ */
function resolveImage(product, origin) {
  if (!product.image) {
    fail(422, "product_has_no_image", "This product has no photo of its own in the sheet.");
  }
  const base = origin || CONFIG.siteUrl;
  let url;
  try {
    url = new URL(product.image, base || undefined);
  } catch (e) {
    fail(422, "image_address_unreadable", "The photo address in the sheet cannot be turned into a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail(422, "image_address_unreadable", "The photo address is not a web address.");
  }
  if (url.username || url.password) {
    fail(422, "image_address_unreadable", "The photo address carries credentials.");
  }
  return url.href;
}

async function downloadImage(href) {
  let res;
  try {
    res = await fetch(href, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    fail(502, "image_fetch_failed", "The photo could not be downloaded.");
  }
  if (!res.ok) fail(502, "image_fetch_failed", "The photo address answered " + res.status + ".");

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > CONFIG.maxImageBytes) {
    fail(413, "image_too_large", "The photo is bigger than WhatsApp accepts.");
  }
  const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type.indexOf("image/") !== 0 || type.indexOf("svg") !== -1) {
    fail(415, "image_type_rejected", "That address is not a picture WhatsApp can take.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) fail(502, "image_fetch_failed", "The photo came back empty.");
  if (buffer.length > CONFIG.maxImageBytes) {
    fail(413, "image_too_large", "The photo is bigger than WhatsApp accepts.");
  }
  return { buffer, type };
}

function fileNameFor(href, type) {
  const stem = (href.split("?")[0].split("/").pop() || "product").replace(/[^\w.-]+/g, "-").slice(0, 60);
  const ext = String(type).split("/")[1] || "jpg";
  return /\.(png|jpe?g|webp|gif|heic|avif)$/i.test(stem)
    ? stem
    : stem.replace(/\.[^.]*$/, "") + "." + ext.replace("jpeg", "jpg");
}

/* ------------------------------------------------------------------ *
 * Graph API
 * ------------------------------------------------------------------ */
function graphUrl(path) {
  return GRAPH_HOST + "/" + CONFIG.apiVersion + "/" + path;
}

/* The token is added here and nowhere else, so there is one place it could
   ever leak from and it is not a string that gets logged. */
async function graph(path, options) {
  const call = Object.assign({}, options, {
    headers: Object.assign({ authorization: "Bearer " + CONFIG.token }, (options && options.headers) || {}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  const res = await fetch(graphUrl(path), call);
  let json = null;
  try { json = await res.json(); } catch (e) { /* Graph sometimes answers empty */ }
  return { ok: res.ok, status: res.status, json };
}

function describeGraph(result, what) {
  const api = result.json && result.json.error;
  /* Meta's own error message can mention the app or the number but never the
     token, so it is safe to pass along for the log; the visitor only ever gets
     the fixed sentence below. */
  log("graph_failure", {
    step: what,
    status: result.status,
    code: api && api.code,
    subcode: api && api.error_subcode,
    type: api && api.type
  });
  return what + " failed (" + result.status + ")";
}

async function uploadMedia(image, name) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([image.buffer], { type: image.type }), name);

  let result;
  try {
    result = await graph(CONFIG.phoneId + "/media", { method: "POST", body: form });
  } catch (e) {
    fail(502, "media_upload_failed", "The photo could not be uploaded to WhatsApp.");
  }
  if (!result.ok || !result.json || !result.json.id) {
    if (result.json && result.json.error) describeGraph(result, "Photo upload");
    fail(502, "media_upload_failed", "The photo could not be uploaded to WhatsApp.");
  }
  return result.json.id;
}

async function sendImage(mediaId, caption) {
  const payload = {
    messaging_product: "whatsapp",
    to: CONFIG.shopNumber,
    type: "image",
    image: { id: mediaId }
  };
  /* An image message carries its own caption, which is what keeps the picture
     and the order in one delivery instead of two unrelated chats. */
  if (caption) payload.image.caption = caption;

  let result;
  try {
    result = await graph(CONFIG.phoneId + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    fail(502, "message_send_failed", "WhatsApp did not accept the order message.");
  }
  const id = result.json && result.json.messages && result.json.messages[0] && result.json.messages[0].id;
  if (!result.ok || !id) {
    describeGraph(result, "Order message");
    fail(502, "message_send_failed", "WhatsApp did not accept the order message.");
  }
  return id;
}

/* ------------------------------------------------------------------ *
 * The message. This is the wording the shop asked for, and it is built here
 * from values this function read out of the sheet - never from the payload.
 * ------------------------------------------------------------------ */
function buildCaption(product, categoryLabel, customer, productId) {
  const lines = [];
  lines.push("Hello! New Product Order");
  lines.push("");
  let what = "Product: " + product.name;
  const fitment = product.fitment ? " (" + product.fitment + ")" : "";
  what += fitment;
  lines.push(what);
  lines.push("Price: " + (product.priceText || "Price not listed online"));
  const category = categoryLabel || product.category;
  if (category) lines.push("Category: " + category);
  /* Description and the address that opens this exact listing, when both
     are known. The link needs SITE_URL - an id alone would be a path with
     no host to put it on, and the shop must not be sent a dead address. */
  if (product.description) lines.push("Description: " + product.description);
  if (CONFIG.siteUrl && productId) {
    lines.push("Product page: " + CONFIG.siteUrl.replace(/\/+$/, "") +
      "/shop.html?product=" + encodeURIComponent(productId));
  }
  lines.push("");
  lines.push("Please contact me to confirm availability and delivery details.");

  /* The visitor-typed lines come last and only when filled in. Without them the
     shop sees an order it cannot answer, because a business-initiated message
     carries no reply address. */
  const who = [];
  if (customer.name) who.push("From: " + customer.name);
  if (customer.device) who.push("Their phone: " + customer.device);
  if (customer.note) who.push("Note: " + customer.note);
  if (who.length) {
    lines.push("");
    lines.push(who.join("\n"));
  }

  const text = lines.join("\n");
  if (text.length <= MAX_CAPTION_CHARS) return text;
  /* Cut at a line boundary rather than mid-word: a truncated order note should
     still read like an order note. */
  const clipped = text.slice(0, MAX_CAPTION_CHARS);
  const lastBreak = clipped.lastIndexOf("\n");
  return (lastBreak > 200 ? clipped.slice(0, lastBreak) : clipped.slice(0, MAX_CAPTION_CHARS - 1)) + "\u2026";
}

/* ------------------------------------------------------------------ *
 * Duplicate and volume guards. Serverless instances come and go, so this is a
 * deliberate brake on a customer hammering the button, not a firewall. The real
 * limit on abuse is that every accepted request has to name a product that
 * exists on the shop's own sheet.
 * ------------------------------------------------------------------ */
const seenNonces = new Map();
const hits = new Map();

function remember(map, key, now, ttl) {
  for (const [k, value] of map) {
    if (now - value > ttl) map.delete(k);
  }
  map.set(key, now);
}

function guardDuplicates(nonce, ip) {
  const now = Date.now();
  if (seenNonces.has(nonce)) fail(409, "duplicate_request", "This order has already been sent.");
  const window = hits.get(ip) || [];
  const fresh = window.filter((at) => now - at < WINDOW_MS);
  if (fresh.length >= CONFIG.perWindow) fail(429, "rate_limited", "Too many orders from here just now - try again shortly.");
  fresh.push(now);
  hits.set(ip, fresh);
  remember(seenNonces, nonce, now, NONCE_TTL_MS);
  return () => {
    /* A send that failed should not burn the click: free the nonce so the
       visitor can try again without waiting for the window. */
    seenNonces.delete(nonce);
  };
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */
export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const corsAllowed = applyCors(res, origin);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

  if (req.method === "OPTIONS") {
    /* A browser sends Origin on every cross-site call, so an unlisted one is a
       page that has no business posting orders here. A request with no Origin
       at all is not a web page - it is curl, or a same-origin call - and is
       answered without the CORS header rather than refused. */
    res.status(origin && !corsAllowed ? 403 : 204).end();
    return;
  }

  if (req.method === "GET") {
    /* Answers "what have I not configured yet?" without revealing any value. */
    const missing = CONFIG.required();
    send(res, 200, {
      ok: missing.length === 0,
      ready: missing.length === 0,
      missingConfig: missing,
      catalogSource: CONFIG.supabaseUrl && CONFIG.supabaseKey ? "supabase" : "csv",
      catalogConfigured: !!env("CATALOG_URL"),
      siteBaseConfigured: !!CONFIG.siteUrl,
      originsConfigured: CONFIG.allowedOrigins.length,
      note: missing.length
        ? "Set these in the Vercel project's Environment Variables, then redeploy. WHATSAPP-ORDERS.md explains where each value comes from."
        : "Ready. The shop number is only contacted when a real order is posted."
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("allow", "POST, OPTIONS");
    send(res, 405, { ok: false, delivered: false, code: "method_not_allowed", message: "Orders are posted, not fetched." });
    return;
  }

  if (origin && !corsAllowed) {
    log("origin_blocked", { origin });
    send(res, 403, {
      ok: false,
      delivered: false,
      code: "origin_not_allowed",
      message: "This site is not in the endpoint's ORDER_ALLOWED_ORIGINS list."
    });
    return;
  }

  const missing = CONFIG.required();
  if (missing.length) {
    log("not_configured", { missing });
    send(res, 503, {
      ok: false,
      delivered: false,
      code: "not_configured",
      message: "WhatsApp ordering is not configured on the server yet.",
      missingConfig: missing
    });
    return;
  }

  let releaseGuard = null;
  try {
    const payload = readPayload(await readJson(req));
    const products = await loadCatalog();
    const product = products.get(payload.productId);
    if (!product) {
      log("unknown_product", { id: payload.productId });
      fail(422, "unknown_product", "That product is not on the shop's list right now.");
    }
    /* A tracked quantity of zero is the shop's own "sold out" statement;
       the storefront already blocks the button, this blocks the request.
       Only the database carries a number - a sheet row's free-text stock
       column is never guessed at. */
    if (product.stockCount === 0) {
      log("out_of_stock", { id: payload.productId });
      fail(409, "product_out_of_stock", "That product is out of stock, so it cannot be ordered right now.");
    }

    const href = resolveImage(product, origin);
    releaseGuard = guardDuplicates(payload.nonce, ip);

    const image = await downloadImage(href);
    const mediaId = await uploadMedia(image, fileNameFor(href, image.type));
    const caption = buildCaption(product, payload.categoryLabel, payload.customer);
    const messageId = await sendImage(mediaId, caption);

    log("delivered", { id: payload.productId, bytes: image.buffer.length, media: mediaId, message: messageId });
    send(res, 200, {
      ok: true,
      delivered: true,
      product: { name: product.name, price: product.priceText || null, image: href },
      whatsapp: { messageId, mediaId, to: CONFIG.shopNumber },
      captionChars: caption.length
    });
  } catch (err) {
    if (releaseGuard) releaseGuard();
    if (err instanceof OrderError) {
      log("rejected", { code: err.code, status: err.status });
      send(res, err.status, Object.assign({ ok: false, delivered: false, code: err.code, message: err.message },
        err.extra || {}));
      return;
    }
    /* An unexpected throw must not print whatever it happens to carry. */
    log("crashed", { name: err && err.name, message: err && err.message ? String(err.message).slice(0, 160) : "" });
    send(res, 500, {
      ok: false,
      delivered: false,
      code: "order_failed",
      message: "Something went wrong on the server, so the order was not sent."
    });
  }
}
