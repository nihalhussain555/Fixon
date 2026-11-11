/* FIXON - order endpoint test harness
 *
 * Runs api/whatsapp-order.js against a stand-in for WhatsApp and a stand-in for
 * the product sheet, and checks what the shop actually asked to be guaranteed:
 * the picture that leaves is the product's own photo, the caption is the exact
 * wording, and it is addressed to the configured number.
 *
 *   node tools/test-order-endpoint.mjs
 *
 * Nothing here contacts graph.facebook.com. The Graph API calls are intercepted
 * in this process and answered by the mock below, so the run needs no access
 * token, no phone number ID and no WhatsApp account - and cannot send a message
 * to a real customer or the shop by accident. What it does NOT prove is
 * delivery: only the real check in WHATSAPP-ORDERS.md does that.
 *
 * It listens on 127.0.0.1 with an ephemeral port and closes the server on exit.
 */

import http from "node:http";

const TOKEN = "EAHmock-token-never-a-real-credential";
const PHONE_ID = "123456789012345";
const SHOP_NUMBER = "919999999999";
const API_VERSION = "v23.0";

/* ------------------------------------------------------------------ *
 * Fixtures: the shop's sheet, and the files it points at
 * ------------------------------------------------------------------ */

const CATALOG_CSV = [
  "name,price,description,image,category,active,brand,model,stock",
  "Tempered Glass - iPhone 13,349,\"9H hardness, bubble-free fit\",images/products/glass-iphone13.jpg,protectors,TRUE,Apple,iPhone 13,In stock",
  "Pop Socket - Round,199,Snap-on grip,images/products/pop-round.jpg,pop-sockets,TRUE,,,,",
  "Cable - Type C,,Fast charging cable,images/products/cable-c.jpg,accessories,TRUE,,,,",
  "Silicone Cover - Samsung,499,Soft case,images/products/silicone-s23.jpg,cases,TRUE,Samsung,Galaxy S23,",
  "Silicone Cover - Samsung,549,Second row with the same name,images/products/silicone-s23-blue.jpg,cases,TRUE,Samsung,Galaxy S23,",
  "Hidden Item,100,Should never be reachable,images/products/hidden.jpg,cases,FALSE,,,,",
  "No Photo Gift,250,A gift with an empty image cell,,gifts,TRUE,,,,"
].join("\n");

/* Two bytes are enough to prove the upload carries the right picture. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/* ------------------------------------------------------------------ *
 * Mock WhatsApp Cloud API
 * ------------------------------------------------------------------ */

const mock = {
  mode: "ok",           /* ok | media_error | message_error | no_media_id */
  calls: [],            /* every request the endpoint made to Graph */
  reset() { this.mode = "ok"; this.calls = []; }
};

/* fetch hands back a Response, so the mock has to hand back a Response too:
   the endpoint reads res.ok, res.status and awaits res.json(). */
function graphAnswer(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function answerGraph(url, options) {
  /* What is left after the host and the API version: <phone id>/media or
     <phone id>/messages - the same shape Meta answers. */
  const path = url.replace("https://graph.facebook.com/", "").replace(/^v\d+\.\d+\//, "");
  const call = { path, method: options.method, auth: (options.headers || {}).authorization, body: null, kind: null };

  if (path === PHONE_ID + "/media") {
    call.kind = "media";
    const form = options.body;
    const file = form.get("file");
    call.messagingProduct = form.get("messaging_product");
    call.fileName = file && file.name;
    call.fileType = file && file.type;
    call.fileBytes = file ? Buffer.from(await file.arrayBuffer()) : null;
    mock.calls.push(call);

    if (mock.mode === "media_error") return graphAnswer(400, { error: { message: "Unsupported image type", code: 368, error_subcode: 131510, type: "OAuthException" } });
    if (mock.mode === "no_media_id") return graphAnswer(200, {});
    return graphAnswer(200, { id: "MEDIA-ID-FROM-MOCK", media_type: "image/jpeg", file_size: String(call.fileBytes.length) });
  }

  if (path === PHONE_ID + "/messages") {
    call.kind = "message";
    call.body = JSON.parse(options.body);
    mock.calls.push(call);

    if (mock.mode === "message_error") return graphAnswer(400, { error: { message: "Re-verified user", code: 131026, error_subcode: 0, type: "OAuthException" } });
    return graphAnswer(200, { messaging_product: "whatsapp", contacts: [{ wa_id: SHOP_NUMBER }], messages: [{ id: "WHATSAPP-MESSAGE-ID-FROM-MOCK" }] });
  }

  mock.calls.push(call);
  return graphAnswer(404, { error: { message: "Mock does not handle " + path, code: 0 } });
}

/* ------------------------------------------------------------------ *
 * Asset + sheet server
 * ------------------------------------------------------------------ */

const routes = {
  "/data/catalog.csv": () => ({ type: "text/csv; charset=utf-8", body: Buffer.from(CATALOG_CSV) }),
  "/images/products/glass-iphone13.jpg": () => ({ type: "image/jpeg", body: JPEG }),
  "/images/products/cable-c.jpg": () => ({ type: "image/jpeg", body: JPEG }),
  "/images/products/pop-round.jpg": () => ({ type: "image/jpeg", body: JPEG }),
  "/images/products/silicone-s23.jpg": () => ({ type: "image/jpeg", body: JPEG }),
  "/images/products/silicone-s23-blue.jpg": () => ({ type: "image/jpeg", body: JPEG }),
  "/images/products/big.jpg": () => ({ type: "image/jpeg", body: Buffer.alloc(4096, 7) }),
  "/images/products/not-an-image.css": () => ({ type: "text/css", body: Buffer.from("body{color:red}") }),
  "/images/products/missing.jpg": () => ({ status: 404, type: "text/plain", body: Buffer.from("gone") }),
  "/broken/catalog.csv": () => ({ status: 500, type: "text/plain", body: Buffer.from("nope") })
};

const server = http.createServer((req, res) => {
  const hit = routes[req.url];
  if (!hit) { res.writeHead(404, { "content-type": "text/plain" }); res.end("no route"); return; }
  const out = hit();
  const headers = { "content-type": out.type };
  if (out.type.indexOf("text/csv") === 0) headers["access-control-allow-origin"] = "*";
  res.writeHead(out.status || 200, headers);
  res.end(out.body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:" + server.address().port;

/* The endpoint's own Graph calls go through fetch, so the mock is installed
   where it will be found. Everything that is not graph.facebook.com - the
   sheet, the photo - is fetched for real from the server above. */
const realFetch = globalThis.fetch;
globalThis.fetch = function (url, options) {
  if (String(url).indexOf("https://graph.facebook.com/") === 0) return answerGraph(String(url), options || {});
  return realFetch(url, options);
};

/* ------------------------------------------------------------------ *
 * Environment, exactly as Vercel would hand it over
 * ------------------------------------------------------------------ */

process.env.WA_ACCESS_TOKEN = TOKEN;
process.env.WA_PHONE_NUMBER_ID = PHONE_ID;
process.env.WA_SHOP_NUMBER = SHOP_NUMBER;
process.env.WA_API_VERSION = API_VERSION;
process.env.CATALOG_URL = BASE + "/data/catalog.csv";
process.env.SITE_URL = BASE;
process.env.ORDER_ALLOWED_ORIGINS = BASE + ",https://fixon.example";
delete process.env.PRICE_SYMBOL;
delete process.env.ORDER_MAX_IMAGE_BYTES;
/* Generous here so the scenarios below can each send what they need; the rate
   limiting block sets a real limit and restores this afterwards. */
process.env.ORDER_RATE_LIMIT = "500";

const { default: handler } = await import("../api/whatsapp-order.js");

/* ------------------------------------------------------------------ *
 * Fake Vercel request / response
 * ------------------------------------------------------------------ */

function makeRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    ended: false,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader(key, value) { res.headers[String(key).toLowerCase()] = value; return res; },
    end() { res.ended = true; }
  };
  return res;
}

/* stream:true exercises the raw-body path; a Vercel request hands over an
   already parsed body, so both shapes have to work. */
function makeRequest({ method = "POST", origin = BASE, ip = "203.0.113.9", body, stream = false, raw = null }) {
  const headers = { origin, "x-forwarded-for": ip };
  const req = { method, headers };
  if (raw !== null) {
    if (stream) {
      req[Symbol.asyncIterator] = async function* () { yield Buffer.from(raw); };
    } else {
      req.body = raw;
    }
  } else if (body !== undefined) {
    req.body = body;
  }
  return req;
}

async function call(request) {
  const res = makeRes();
  await handler(request, res);
  return res;
}

let nonceSeed = 0;
function nonce() { nonceSeed += 1; return "testnonce" + String(nonceSeed).padStart(24, "0"); }

/* ------------------------------------------------------------------ *
 * Assertions
 * ------------------------------------------------------------------ */

const failures = [];
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  if (condition) return true;
  failures.push(label + (detail ? " - got: " + detail : ""));
  return false;
}

function show(value) {
  return JSON.stringify(value === undefined ? "(none)" : value);
}

/* ------------------------------------------------------------------ *
 * 1. Health check: names only, never values
 * ------------------------------------------------------------------ */

{
  const res = await call(makeRequest({ method: "GET" }));
  check("health answers 200", res.statusCode === 200, show(res.statusCode));
  check("health says ready", res.body && res.body.ok === true && res.body.ready === true, show(res.body));
  check("health lists nothing missing", res.body && res.body.missingConfig.length === 0, show(res.body && res.body.missingConfig));
  check("health never echoes the token", !JSON.stringify(res.body).includes(TOKEN), "token present");
}

/* The same route with the credentials taken away has to name them, because
   that is the answer the owner sees before WhatsApp ordering can work. */
{
  const saved = process.env.WA_SHOP_NUMBER;
  const savedToken = process.env.WA_ACCESS_TOKEN;
  delete process.env.WA_SHOP_NUMBER;
  process.env.WA_ACCESS_TOKEN = "";
  const health = await call(makeRequest({ method: "GET" }));
  check("health names the missing variables",
    health.body.missingConfig.join(",") === "WA_ACCESS_TOKEN,WA_SHOP_NUMBER", show(health.body.missingConfig));
  const post = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("a send without credentials is refused", post.statusCode === 503 && post.body.code === "not_configured", show(post.body));
  check("refusal reports the gap, not a delivery", post.body.delivered === false && post.body.missingConfig.includes("WA_SHOP_NUMBER"), show(post.body));
  process.env.WA_SHOP_NUMBER = saved;
  process.env.WA_ACCESS_TOKEN = savedToken;
}

/* ------------------------------------------------------------------ *
 * 2. Transport rules
 * ------------------------------------------------------------------ */

{
  const res = await call(makeRequest({ method: "PUT" }));
  check("PUT is refused", res.statusCode === 405 && res.body.code === "method_not_allowed", show(res.body));
  check("405 advertises the allowed verbs", res.headers.allow === "POST, OPTIONS", show(res.headers.allow));
}

{
  const res = await call(makeRequest({ method: "OPTIONS", origin: "https://evil.example" }));
  check("preflight from a stranger gets 403", res.statusCode === 403 && res.ended, show(res.statusCode));

  const post = await call(makeRequest({ origin: "https://evil.example", body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("post from a stranger is refused", post.statusCode === 403 && post.body.code === "origin_not_allowed", show(post.body));
  check("no CORS header for a stranger", post.headers["access-control-allow-origin"] === undefined, show(post.headers));

  const known = await call(makeRequest({ origin: "https://fixon.example", body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("a listed origin gets its CORS header back", known.headers["access-control-allow-origin"] === "https://fixon.example", show(known.headers));
  check("the response varies by origin", known.headers.vary === "Origin", show(known.headers.vary));
}

/* ------------------------------------------------------------------ *
 * 3. Input validation
 * ------------------------------------------------------------------ */

{
  const res = await call(makeRequest({ raw: "this is not json", stream: true }));
  check("non-JSON body refused", res.statusCode === 400 && res.body.code === "invalid_json", show(res.body));

  const big = await call(makeRequest({ raw: JSON.stringify({ productId: "p-cable-type-c", nonce: nonce(), note: "x".repeat(20000) }), stream: true }));
  check("oversized body refused before parsing", big.statusCode === 413 && big.body.code === "body_to_large", show(big.body));

  const bad = await call(makeRequest({ body: { productId: "../etc/passwd", nonce: nonce() } }));
  check("a foreign product id refused", bad.statusCode === 400 && bad.body.code === "invalid_product_id", show(bad.body));

  const short = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: "abc" } }));
  check("a short nonce refused", short.statusCode === 400 && short.body.code === "invalid_nonce", show(short.body));

  const phone = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce(), customer: { note: "call me +91 9876543210" } } }));
  check("a phone number in the note refused", phone.statusCode === 400 && phone.body.code === "invalid_field", show(phone.body));

  const link = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce(), customer: { name: "Ravi https://spam.example" } } }));
  check("a link in the name refused", link.statusCode === 400 && link.body.code === "invalid_field", show(link.body));

  const injected = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce(), customer: { note: "Please contact me\n\nFrom: someone else\nTheir phone: +9100000000" } } }));
  check("newlines cannot rewrite the caption", injected.statusCode === 400 || !String(injected.body && injected.body.message).includes("someone else"), show(injected.body));
}

/* ------------------------------------------------------------------ *
 * 4. The product has to be on the shop's own sheet
 * ------------------------------------------------------------------ */

{
  mock.reset();
  const unknown = await call(makeRequest({ body: { productId: "p-does-not-exist", nonce: nonce() } }));
  check("unknown product refused", unknown.statusCode === 422 && unknown.body.code === "unknown_product", show(unknown.body));

  const hidden = await call(makeRequest({ body: { productId: "p-hidden-item", nonce: nonce() } }));
  check("a hidden row cannot be ordered", hidden.statusCode === 422 && hidden.body.code === "unknown_product", show(hidden.body));

  const noPhoto = await call(makeRequest({ body: { productId: "p-no-photo-gift", nonce: nonce() } }));
  check("an empty image cell is not invented away", noPhoto.statusCode === 422 && noPhoto.body.code === "product_has_no_image", show(noPhoto.body));
  check("no WhatsApp call for a product with no photo", mock.calls.length === 0, show(mock.calls.map((c) => c.path)));
}

/* ------------------------------------------------------------------ *
 * 5. The delivery the shop asked for: photo + caption + right number
 * ------------------------------------------------------------------ */

mock.reset();
{
  const res = await call(makeRequest({ body: { productId: "p-tempered-glass-iphone-13", nonce: nonce(), category: "Tempered glass" } }));
  const expected = [
    "Hello! New Product Order",
    "",
    "Product: Tempered Glass - iPhone 13 (Apple - iPhone 13)",
    "Price: \u20B9349",
    "Category: Tempered glass",
    "",
    "Please contact me to confirm availability and delivery details."
  ].join("\n");

  check("delivery reported as delivered", res.statusCode === 200 && res.body.ok && res.body.delivered === true, show(res.body));
  check("two Graph calls, upload then message", mock.calls.length === 2 && mock.calls[0].kind === "media" && mock.calls[1].kind === "message", show(mock.calls.map((c) => c.kind)));
  check("both calls address the API version and phone id",
    mock.calls[0].path === PHONE_ID + "/media" && mock.calls[1].path === PHONE_ID + "/messages",
    show(mock.calls.map((c) => c.path)));
  check("both calls carry the bearer token",
    mock.calls.every((c) => c.auth === "Bearer " + TOKEN), show(mock.calls.map((c) => c.auth)));
  check("upload declares the whatsapp product", mock.calls[0].messagingProduct === "whatsapp", show(mock.calls[0].messagingProduct));
  check("upload sends the product's own file name", mock.calls[0].fileName === "glass-iphone13.jpg", show(mock.calls[0].fileName));
  check("upload keeps the image type", mock.calls[0].fileType === "image/jpeg", show(mock.calls[0].fileType));
  check("upload sends the exact bytes of that photo",
    mock.calls[0].fileBytes && mock.calls[0].fileBytes.equals(JPEG), show(mock.calls[0].fileBytes && mock.calls[0].fileBytes.length));
  check("the message is an image type", mock.calls[1].body.type === "image", show(mock.calls[1].body.type));
  check("the image is the uploaded media id", mock.calls[1].body.image.id === "MEDIA-ID-FROM-MOCK", show(mock.calls[1].body.image));
  check("the caption rides on the image", mock.calls[1].body.image.caption === expected, JSON.stringify(mock.calls[1].body.image.caption));
  check("caption is the wording the shop asked for",
    mock.calls[1].body.image.caption.startsWith("Hello! New Product Order") &&
      /Product: /.test(mock.calls[1].body.image.caption) &&
      /Price: \u20B9349/.test(mock.calls[1].body.image.caption) &&
      /Category: Tempered glass/.test(mock.calls[1].body.image.caption) &&
      /Please contact me to confirm availability and delivery details\./.test(mock.calls[1].body.image.caption),
    JSON.stringify(mock.calls[1].body.image.caption));
  check("addressed to the configured shop number", mock.calls[1].body.to === SHOP_NUMBER, show(mock.calls[1].body.to));
  check("messaging_product on the send", mock.calls[1].body.messaging_product === "whatsapp", show(mock.calls[1].body));
  check("success hands back the WhatsApp message id",
    res.body.whatsapp.messageId === "WHATSAPP-MESSAGE-ID-FROM-MOCK" && res.body.whatsapp.to === SHOP_NUMBER, show(res.body.whatsapp));
  check("the reply never contains the token", !JSON.stringify(res.body).includes(TOKEN), "token present");
  check("caption reported under the 1024 limit", res.body.captionChars <= 1024, show(res.body.captionChars));
}

/* A price the sheet does not carry is reported as missing, not invented. */
mock.reset();
{
  const res = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("an unpriced product still delivers", res.statusCode === 200, show(res.body));
  const caption = mock.calls[1].body.image.caption;
  check("no price becomes an honest line", caption.includes("Price: Price not listed online"), JSON.stringify(caption));
  check("category falls back to the sheet slug", caption.includes("Category: accessories"), JSON.stringify(caption));
  check("a product with no fitment gets no empty brackets", !/\(\s*\)/.test(caption), JSON.stringify(caption));
}

/* Two rows, one name: the second has to be the -2 id, and its own photo. */
mock.reset();
{
  const res = await call(makeRequest({ body: { productId: "p-silicone-cover-samsung-2", nonce: nonce() } }));
  check("the duplicate name's own id works", res.statusCode === 200, show(res.body));
  check("the duplicate row's own photo is uploaded",
    mock.calls[0].fileName === "silicone-s23-blue.jpg", show(mock.calls[0].fileName));
  check("the duplicate row's own price is quoted", mock.calls[1].body.image.caption.includes("Price: \u20B9549"), JSON.stringify(mock.calls[1].body.image.caption));
}

/* What the visitor typed is appended, and stays on its own lines. */
mock.reset();
{
  const res = await call(makeRequest({
    body: {
      productId: "p-pop-socket-round",
      nonce: nonce(),
      customer: { name: "Fathima", device: "Pixel 8", note: "two pieces, blue if possible" }
    }
  }));
  const caption = mock.calls[1].body.image.caption;
  check("order with typed details delivers", res.statusCode === 200, show(res.body));
  check("the name reaches the shop", caption.includes("From: Fathima"), JSON.stringify(caption));
  check("the device reaches the shop", caption.includes("Their phone: Pixel 8"), JSON.stringify(caption));
  check("the note reaches the shop", caption.includes("Note: two pieces, blue if possible"), JSON.stringify(caption));
  check("details sit below the closing line",
    caption.indexOf("Please contact me") < caption.indexOf("From: Fathima"), JSON.stringify(caption));
}

/* A very long note must not break the message or overflow WhatsApp's cap. */
mock.reset();
{
  const long = "colour please and quantity plus gift wrap ".repeat(40);
  const res = await call(makeRequest({ body: { productId: "p-pop-socket-round", nonce: nonce(), customer: { note: long } } }));
  const caption = mock.calls[1].body.image.caption;
  check("an enormous note still delivers", res.statusCode === 200, show(res.body));
  check("the caption stays inside WhatsApp's 1024 characters", caption.length <= 1024, show(caption.length));
  check("a clipped caption reads as clipped", caption.endsWith("\u2026") || caption.includes("Note:"), JSON.stringify(caption.slice(-40)));
}

/* ------------------------------------------------------------------ *
 * 6. Duplicate clicks and volume
 * ------------------------------------------------------------------ */

{
  mock.reset();
  const shared = nonce();
  const first = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: shared } }));
  const second = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: shared } }));
  check("the first click of a pair goes through", first.statusCode === 200, show(first.body));
  check("the repeat click is refused", second.statusCode === 409 && second.body.code === "duplicate_request", show(second.body));
  check("the repeat click sent nothing to WhatsApp", mock.calls.filter((c) => c.kind === "message").length === 1,
    show(mock.calls.filter((c) => c.kind === "message").length));
}

{
  const saved = process.env.ORDER_RATE_LIMIT;
  process.env.ORDER_RATE_LIMIT = "2";
  const ip = "198.51.100.7";
  const a = await call(makeRequest({ ip, body: { productId: "p-cable-type-c", nonce: nonce() } }));
  const b = await call(makeRequest({ ip, body: { productId: "p-tempered-glass-iphone-13", nonce: nonce() } }));
  const c = await call(makeRequest({ ip, body: { productId: "p-pop-socket-round", nonce: nonce() } }));
  check("two orders from one visitor are fine", a.statusCode === 200 && b.statusCode === 200, show([a.statusCode, b.statusCode]));
  check("the third in the window is held back", c.statusCode === 429 && c.body.code === "rate_limited", show(c.body));
  const other = await call(makeRequest({ ip: "198.51.100.8", body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("another visitor is not punished", other.statusCode === 200, show(other.body));
  process.env.ORDER_RATE_LIMIT = saved;
}

/* ------------------------------------------------------------------ *
 * 7. Failure paths, and the click that gets to try again
 * ------------------------------------------------------------------ */

{
  mock.mode = "media_error";
  const n = nonce();
  const failed = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: n } }));
  check("a refused upload is an error, never a success",
    failed.statusCode === 502 && failed.body.code === "media_upload_failed" && failed.body.delivered === false, show(failed.body));
  check("the failed upload sent no message", mock.calls[mock.calls.length - 1].kind === "media", show(mock.calls[mock.calls.length - 1].kind));
  check("a failed sentence never repeats the token", !JSON.stringify(failed.body).includes(TOKEN), "token present");

  mock.mode = "ok";
  const retry = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: n } }));
  check("the same click can be retried after a failure", retry.statusCode === 200, show(retry.body));
}

{
  mock.mode = "no_media_id";
  const odd = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("an upload with no media id is not treated as sent",
    odd.statusCode === 502 && odd.body.code === "media_upload_failed", show(odd.body));
  mock.mode = "message_error";
  const bad = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("a refused message reports message_send_failed",
    bad.statusCode === 502 && bad.body.code === "message_send_failed" && bad.body.delivered === false, show(bad.body));
  check("no message id claimed on failure", !(bad.body.whatsapp && bad.body.whatsapp.messageId), show(bad.body.whatsapp));
  mock.mode = "ok";
}

{
  const missing = await call(makeRequest({ body: { productId: "p-hidden-item", nonce: nonce() } }));
  check("hidden rows stay unreachable", missing.statusCode === 422, show(missing.body));
}

/* Photo trouble has to be named before WhatsApp is ever contacted. */
{
  mock.reset();
  const savedCatalog = process.env.CATALOG_URL;
  /* A sheet whose photo 404s: build one that points at the 404 route. */
  routes["/data/broken-photo.csv"] = () => ({
    type: "text/csv",
    body: Buffer.from([
      "name,price,description,image,category,active",
      "Broken Photo Item,100,no picture down there,images/products/missing.jpg,cases,TRUE"
    ].join("\n"))
  });
  process.env.CATALOG_URL = BASE + "/data/broken-photo.csv";
  const broken = await call(makeRequest({ body: { productId: "p-broken-photo-item", nonce: nonce() } }));
  check("a photo that will not download is named",
    broken.statusCode === 502 && broken.body.code === "image_fetch_failed", show(broken.body));
  check("nothing was uploaded for an unreadable photo", mock.calls.length === 0, show(mock.calls.map((c) => c.kind)));

  routes["/data/bad-type.csv"] = () => ({
    type: "text/csv",
    body: Buffer.from([
      "name,price,description,image,category,active",
      "Stylesheet Item,100,not a picture,images/products/not-an-image.css,cases,TRUE"
    ].join("\n"))
  });
  process.env.CATALOG_URL = BASE + "/data/bad-type.csv";
  const wrongType = await call(makeRequest({ body: { productId: "p-stylesheet-item", nonce: nonce() } }));
  check("a non-image address is refused",
    wrongType.statusCode === 415 && wrongType.body.code === "image_type_rejected", show(wrongType.body));

  routes["/data/big.csv"] = () => ({
    type: "text/csv",
    body: Buffer.from([
      "name,price,description,image,category,active",
      "Heavy Photo,100,too big for WhatsApp,images/products/big.jpg,cases,TRUE"
    ].join("\n"))
  });
  process.env.CATALOG_URL = BASE + "/data/big.csv";
  process.env.ORDER_MAX_IMAGE_BYTES = "1024";
  const heavy = await call(makeRequest({ body: { productId: "p-heavy-photo", nonce: nonce() } }));
  check("an over-limit photo is refused before upload",
    heavy.statusCode === 413 && heavy.body.code === "image_too_large", show(heavy.body));
  delete process.env.ORDER_MAX_IMAGE_BYTES;

  process.env.CATALOG_URL = BASE + "/broken/catalog.csv";
  const sheetDown = await call(makeRequest({ body: { productId: "p-cable-type-c", nonce: nonce() } }));
  check("an unreachable sheet is an error, not an empty list",
    sheetDown.statusCode === 502 && sheetDown.body.code === "catalog_unreachable", show(sheetDown.body));

  routes["/data/short-columns.csv"] = () => ({ type: "text/csv", body: Buffer.from("name,price\nThing,10\n") });
  process.env.CATALOG_URL = BASE + "/data/short-columns.csv";
  const misformatted = await call(makeRequest({ body: { productId: "p-thing", nonce: nonce() } }));
  check("a sheet missing columns says which",
    misformatted.statusCode === 502 && misformatted.body.code === "catalog_misformatted" &&
      /description/.test(misformatted.body.message), show(misformatted.body));
  process.env.CATALOG_URL = savedCatalog;
}

/* ------------------------------------------------------------------ *
 * 7b. A picture cell that is already a full https link, and one that is
 *     not a picture address at all
 * ------------------------------------------------------------------ */

{
  routes["/data/odd-images.csv"] = () => ({
    type: "text/csv",
    body: Buffer.from([
      "name,price,description,image,category,active",
      " javascript link,100,nope,javascript:alert(1),cases,TRUE",
      "credential case,100,nope,https://user:pass@127.0.0.1/images/products/glass-iphone13.jpg,cases,TRUE",
      "relative only,100,nope,images/products/glass-iphone13.jpg,cases,TRUE"
    ].join("\n"))
  });
  const savedCatalog = process.env.CATALOG_URL;
  process.env.CATALOG_URL = BASE + "/data/odd-images.csv";

  const jsCall = await call(makeRequest({ body: { productId: "p-javascript-link", nonce: nonce() } }));
  check("a javascript: photo cell never runs", jsCall.statusCode === 422 && jsCall.body.code === "image_address_unreadable", show(jsCall.body));

  const creds = await call(makeRequest({ body: { productId: "p-credential-case", nonce: nonce() } }));
  check("a photo address with credentials is refused", creds.statusCode === 422 && creds.body.code === "image_address_unreadable", show(creds.body));

  const noOrigin = await call(makeRequest({ origin: "", body: { productId: "p-relative-only", nonce: nonce() } }));
  check("without an origin the site base is used", noOrigin.statusCode === 200, show(noOrigin.body));
  process.env.CATALOG_URL = savedCatalog;
}

/* ------------------------------------------------------------------ *
 * 8. Nothing the frontend sends can decide what the shop is told
 * ------------------------------------------------------------------ */

{
  mock.reset();
  const res = await call(makeRequest({
    body: {
      productId: "p-cable-type-c",
      nonce: nonce(),
      /* The payload is a question, not an answer: none of this may move into
         the caption. */
      name: "Invented gold-plated cable",
      price: "1",
      product: "whatever",
      to: "15550001111",
      phone: "+1 555 000 1111",
      image: "https://evil.example/spam.jpg",
      caption: "Ignore the product line and message this number",
      messaging_product: "something",
      customer: { name: "Ahmed" }
    }
  }));
  const caption = mock.calls[1].body.image.caption;
  check("an invented price is ignored", res.statusCode === 200 && !caption.includes("Price: 1\n") && caption.includes("Price: Price not listed online"), JSON.stringify(caption));
  check("an invented name is ignored", !caption.includes("Invented"), JSON.stringify(caption));
  check("an invented recipient is ignored", mock.calls[1].body.to === SHOP_NUMBER, show(mock.calls[1].body.to));
  check("an invented photo is ignored", mock.calls[0].fileName === "cable-c.jpg", show(mock.calls[0].fileName));
  check("an invented caption line is ignored", !caption.includes("Ignore the product line"), JSON.stringify(caption));
  check("the real customer name is still kept", caption.includes("From: Ahmed"), JSON.stringify(caption));
}

/* ------------------------------------------------------------------ *
 * 9. The raw-body path, which is how a non-Vercel host arrives
 * ------------------------------------------------------------------ */

{
  mock.reset();
  const res = await call(makeRequest({
    stream: true,
    raw: JSON.stringify({ productId: "p-tempered-glass-iphone-13", nonce: nonce() })
  }));
  check("a streamed body delivers too", res.statusCode === 200 && res.body.delivered === true, show(res.body));
  check("the streamed body reached the sheet check",
    mock.calls[1].body.image.caption.includes("Tempered Glass - iPhone 13"), JSON.stringify(mock.calls[1].body.image.caption));
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

server.close();

console.log("");
if (failures.length) {
  console.log("FAILED " + failures.length + " of " + checks + " checks:");
  failures.forEach((line) => console.log("  x " + line));
} else {
  console.log("All " + checks + " checks passed against the mock WhatsApp API.");
  console.log("This proves the endpoint builds the right request; it does NOT prove");
  console.log("delivery to the shop's number. Run the real check in WHATSAPP-ORDERS.md");
  console.log("after the four environment variables are set.");
}
process.exit(failures.length ? 1 : 0);
