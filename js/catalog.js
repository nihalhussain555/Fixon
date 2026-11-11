/* ==========================================================================
   FIXON - catalog loader (Supabase only)
   --------------------------------------------------------------------------
   One shared source of product data for the whole site: the shop's Supabase
   project, managed from the /admin dashboard. Pages ask this module instead
   of fetching, so a page load costs exactly one request and an auto-refresh
   never stacks up duplicates. The old CSV / Google-Sheets source is removed
   - a product shows on the site only when the products table holds it with
   is_active = true.

   Deliberate limits:
   - No secrets here. Only the public anon key from js/config.js is used;
     the Row Level Security policies in supabase/SETUP.sql are what keep a
     visitor's read to active rows.
   - No "real-time" claim. The list is re-read on the refresh cycle below,
     so the status text says when the data was read and nothing more.
   - No invented values. A missing price stays "Price on request"; a missing
     or rejected image falls back to the category picture.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.FIXON;
  var U = window.fixonUtils;

  /* js/supabase.js must load before this file (script order in the pages). */
  function supabaseOn() {
    return !!(window.fixonSupabase && window.fixonSupabase.configured());
  }

  var CACHE_KEY = "fixon_catalog_v1";
  var IMAGE_TYPES = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"];

  var state = {
    status: "idle",        /* idle | loading | ready | cached | error | unset */
    rows: [],              /* active products only, normalised and safe */
    notes: [],             /* reserved: per-row repairs, empty for Supabase reads */
    source: null,          /* the project the data actually came from */
    fetchedAt: 0,
    fromCache: false,
    error: null,
    timer: null
  };

  var inflight = null;
  var bootstrapped = false;

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function trim(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function clip(value, max) {
    var text = trim(value);
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  /* A database cell is still untrusted input: it can be hand-typed or come
     from a compromised write. Nothing here builds HTML from a value - the
     renderers assign text with textContent. This guard is the URL layer, the
     only place a stored value can ever reach a browser API. */
  function safeImageUrl(raw) {
    var value = trim(raw);
    if (!value) return null;
    if (/^(javascript|data|vbscript):/i.test(value)) return null;

    var absolute = /^[a-z][a-z0-9+.-]*:/i.test(value);
    if (absolute) {
      /* Only https: an http image is blocked as mixed content on a secure
         deployment, so it would show as a broken tile anyway. */
      if (!/^https:\/\//i.test(value)) return null;
    } else if (value.indexOf("//") === 0 || value.indexOf("..") !== -1) {
      /* A leading // would leave the site, and ../ would read outside images/. */
      return null;
    } else if (!/^[\w\-./~%?#=&+]+$/.test(value)) {
      return null;
    }

    var clean = value.split("?")[0].split("#")[0];
    var dot = clean.lastIndexOf(".");
    var ext = dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
    if (ext && IMAGE_TYPES.indexOf(ext) === -1) return null;
    /* A relative path with no image extension is a misfiled cell (a stray
       number, a word), not a picture, so it never becomes a broken tile. */
    if (!absolute && !ext) return null;
    return value;
  }

  /* One image value, three ways to write it, all ending as a plain <img src>:
       https://<project>.supabase.co/storage/v1/object/public/...  the dashboard upload
       images/products/a.jpg   a path inside this site
       a.jpg                   a bare file name
     A bare name is looked for in catalog.imageFolder, so the shop can upload
     a photo into one folder and type only its file name in the dashboard. */
  function resolveImage(raw) {
    var value = safeImageUrl(raw);
    if (!value) return null;
    var folder = trim(CFG.catalog.imageFolder || "").replace(/\/+$/, "");
    if (!folder) return value;
    var alreadyPlaced = /^[a-z][a-z0-9+.-]*:/i.test(value) || value.indexOf("/") === 0 || value.indexOf("/") !== -1;
    return alreadyPlaced ? value : folder + "/" + value;
  }

  function categoryPhoto(categoryId) {
    var list = CFG.productCategories;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === categoryId) return U.photoSrc("accessories", list[i].photo);
    }
    return U.photoSrc("accessories", "other");
  }

  /* Which configured category does this stored text belong to? Null means the
     value is kept and listed under its own spelling rather than dropped. */
  function categoryIdFor(text) {
    var value = trim(text).toLowerCase();
    if (!value) return null;
    var list = CFG.productCategories;
    for (var i = 0; i < list.length; i++) {
      if (value === list[i].id) return list[i].id;
    }
    for (var j = 0; j < list.length; j++) {
      var words = list[j].match;
      for (var k = 0; k < words.length; k++) {
        if (value.indexOf(words[k]) !== -1) return list[j].id;
      }
    }
    return null;
  }

  function categoryLabel(id) {
    var list = CFG.productCategories;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label;
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Prices
   * --------------------------------------------------------------------------
   * The database stores a number, but a hand-typed or imported cell can still
   * arrive as text: "1499", "₹1,499.00", "Rs. 1,299". A misread price is worse
   * than no price, because it shows the visitor a wrong figure, so only shapes
   * that can be read safely are accepted:
   *   1499          -> 1499
   *   1,299 / 1.299 -> 1299   (groups of three after a separator)
   *   1,299.00      -> 1299   (one or two final digits are the paise)
   * "ask in store", "TBD", "12.13.14" and blanks return null, and the card
   * then shows "Price on request" instead of a made-up number. */
  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  function priceValue(text) {
    /* Keep digits, and keep a , or . only when it sits between digits. That
       drops the stray dot in "Rs." while keeping the grouping in "1,299". */
    var source = trim(text);
    var raw = "", i, ch;
    for (i = 0; i < source.length; i++) {
      ch = source.charAt(i);
      if (ch >= "0" && ch <= "9") { raw += ch; continue; }
      if ((ch === "." || ch === ",") && isDigit(raw.charAt(raw.length - 1)) && isDigit(source.charAt(i + 1))) raw += ch;
    }
    if (!/\d/.test(raw)) return null;

    var value = null;
    if (/^\d+$/.test(raw)) {
      value = Number(raw);
    } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) {
      value = Number(raw.replace(/[.,]/g, ""));
    } else {
      var split = raw.match(/^(\d+(?:[.,]\d{3})*)[.,](\d{1,2})$/);
      if (split) value = Number(split[1].replace(/[.,]/g, "") + "." + split[2]);
    }
    if (value === null || !isFinite(value) || value <= 0) return null;
    return Math.round(value * 100) / 100;
  }

  /* ------------------------------------------------------------------ *
   * Supabase row -> product
   * --------------------------------------------------------------------------
   * The dashboard's row becomes exactly the shape every renderer already
   * consumes, so the storefront code never cares where a row came from.
   * Values pass through the same guards a sheet used: a stored value is
   * treated as untrusted input, never as HTML or as a script-capable URL.
   * Ids are a slug of the name, so order trays saved on a
   * visitor's device keep matching across edits; the database uuid rides
   * along as dbId for nothing but the dashboard's own addresses.
   * ------------------------------------------------------------------ */
  function supabaseStock(row) {
    if (row.stock_note) return clip(row.stock_note, 60);
    if (row.stock === null || row.stock === undefined || row.stock === "") return "";
    var n = Number(row.stock);
    if (!isFinite(n) || n < 0) return "";
    return n > 0 ? "In stock (" + n + ")" : "Out of stock";
  }

  function stockCountOf(row) {
    if (row.stock === null || row.stock === undefined || row.stock === "") return null;
    var n = Number(row.stock);
    return !isFinite(n) || n < 0 ? null : Math.floor(n);
  }

  function toSupabaseProduct(row, used) {
    var name = clip(row.name, 120);
    if (!name) return null;
    var priceNumber = row.price === null || row.price === undefined || row.price === ""
      ? null : priceValue(row.price);
    var image = resolveImage(row.image_url);
    var categoryId = categoryIdFor(row.category);
    var p = {
      name: name,
      description: clip(row.description, 800),
      /* The DB stores a number; the card re-reads it as text the same way a
         sheet cell used to, keeping one price pipeline. */
      priceText: priceNumber === null ? "" : String(row.price),
      price: priceNumber === null ? null : U.formatPrice(priceNumber),
      priceNumber: priceNumber,
      wasPrice: null,
      wasLabel: "",
      discount: null,
      category: categoryId,
      categoryLabel: categoryLabel(categoryId) || clip(row.category, 40),
      categoryRaw: clip(row.category, 40),
      image: image,
      photo: image || categoryPhoto(categoryId),
      gallery: image ? [image] : [categoryPhoto(categoryId)],
      colors: [],
      sizes: [],
      features: [],
      specs: [],
      stock: supabaseStock(row),
      /* null means "the shop does not track this item"; 0 is a real sold
         out, which is what order.js and the details panel check. */
      stockCount: stockCountOf(row),
      brand: "",
      model: "",
      featured: !!row.featured,
      link: null,
      /* Not a browsing id - the edit page's address and the dashboard's
         row actions use this; the order payload keeps using p.id. */
      dbId: String(row.id || "")
    };
    p.id = rowKey(name, 0, used);
    return p;
  }

  function buildFromSupabase(rows) {
    var products = [], used = {};
    for (var i = 0; i < rows.length; i++) {
      var p = toSupabaseProduct(rows[i], used);
      if (p) products.push(p);
    }
    return products;
  }

  /* The order list in js/order.js lives on the visitor's device between visits,
     so a product needs an id that survives the owner editing the row. "Row 6"
     would point at a different product the moment a row is inserted or the
     order changes, and the order would silently ask for the wrong thing. The
     name is the column the owner expects to be meaningful, so it is the key;
     two rows with the same name get -2, -3 on the second and third. */
  function rowKey(name, line, used) {
    var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    var stem = "p-" + (slug || "row" + line);
    var id = stem;
    var n = 2;
    while (used[id]) { id = stem + "-" + n; n += 1; }
    used[id] = true;
    return id;
  }

  /* ------------------------------------------------------------------ *
   * Cache of the last good read (per tab, cleared when the tab closes)
   * ------------------------------------------------------------------ */
  function saveCache(key, payload) {
    try { sessionStorage.setItem(key, JSON.stringify(payload)); } catch (e) { /* private mode: nothing to keep */ }
  }

  function readCache(key) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ *
   * Snapshot / notify
   * ------------------------------------------------------------------ */
  function snapshot() {
    return {
      status: state.status,
      rows: state.rows,
      notes: state.notes,
      source: state.source,
      fetchedAt: state.fetchedAt,
      fromCache: state.fromCache,
      error: state.error
    };
  }

  function notify() {
    document.dispatchEvent(new CustomEvent("fixon:catalog", { detail: snapshot() }));
  }

  /* ------------------------------------------------------------------ *
   * Loading
   * ------------------------------------------------------------------ */

  /* A failed read never blanks a page that already has rows: the last good
     list stays on screen and the status says it is held over. */
  function applyFailure(message) {
    inflight = null;
    state.error = message;
    var cached = readCache(CACHE_KEY);
    if (cached && cached.rows && cached.rows.length) {
      /* Keep showing the last good list rather than blanking the page. */
      state.rows = cached.rows;
      state.notes = cached.notes || [];
      state.source = cached.source;
      state.fetchedAt = cached.ts;
      state.fromCache = true;
      state.status = "cached";
    } else {
      state.rows = [];
      state.status = "error";
    }
    notify();
    return snapshot();
  }

  /* The one source: Supabase. "Not configured" is its own honest state (the
     shop has no product list online yet), and so is an empty project - the
     dashboard, not this read, is where products get activated. */
  function load() {
    if (inflight) return inflight;

    if (!supabaseOn()) {
      state.status = "unset";
      state.error = "Supabase is not configured. Set FIXON.supabase.url and FIXON.supabase.key in js/config.js; products from the admin dashboard then show here.";
      notify();
      return Promise.resolve(snapshot());
    }

    /* Rows already on screen stay visible while the new read is in flight. */
    if (!state.rows.length) state.status = "loading";
    notify();

    inflight = Promise.resolve().then(function () {
      return window.fixonSupabase.activeProducts();
    }).then(function (rows) {
      var products = buildFromSupabase(rows);
      if (!products.length) {
        return applyFailure("The shop's Supabase project has no active products yet - switch Active on in the admin dashboard for the items to show here.");
      }
      inflight = null;
      state.rows = products;
      state.notes = [];
      state.source = { kind: "supabase", url: String(CFG.supabase.url).replace(/\/+$/, "") };
      state.fetchedAt = Date.now();
      state.fromCache = false;
      state.error = null;
      state.status = "ready";
      saveCache(CACHE_KEY, { ts: state.fetchedAt, rows: products, notes: [], source: state.source });
      notify();
      return snapshot();
    }, function (error) {
      return applyFailure(error && error.message ? error.message : "Supabase could not be reached.");
    });
    return inflight;
  }

  /* ------------------------------------------------------------------ *
   * Auto refresh. Never stacks: one timer, one in-flight request, and a
   * hidden tab is skipped then caught up when it is seen again.
   * ------------------------------------------------------------------ */
  function staleEnough() {
    var minutes = Number(CFG.catalog.refreshMinutes) || 30;
    return !state.fetchedAt || Date.now() - state.fetchedAt > minutes * 60000;
  }

  function startAutoRefresh() {
    if (state.timer) return;
    var minutes = Number(CFG.catalog.refreshMinutes) || 30;
    state.timer = setInterval(function () {
      if (document.hidden) return;
      load();
    }, Math.max(1, minutes) * 60000);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && staleEnough()) load();
    });
  }

  /* ------------------------------------------------------------------ *
   * Queries the pages use
   * ------------------------------------------------------------------ */
  function rows() { return state.rows; }

  function get(id) {
    for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return state.rows[i];
    return null;
  }

  /* Only rows the owner marked featured. Nothing is promoted by default, so
     the "Featured" strip is empty rather than misleading when no product is
     flagged - the pages hide it in that case. */
  function featured(limit) {
    return state.rows.filter(function (p) { return p.featured; }).slice(0, limit || 3);
  }

  /* Configured categories with live counts, then any other spelling the
     dashboard used, so an unusual category value still gets a filter instead
     of vanishing. */
  function categories() {
    var counts = {}, out = [], i;
    for (i = 0; i < state.rows.length; i++) {
      var p = state.rows[i];
      var key = p.category || "raw:" + p.categoryRaw;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (i = 0; i < CFG.productCategories.length; i++) {
      var c = CFG.productCategories[i];
      out.push({ id: c.id, label: c.label, photo: c.photo, blurb: c.blurb, count: counts[c.id] || 0 });
    }
    for (i = 0; i < state.rows.length; i++) {
      var row = state.rows[i];
      if (row.category || !row.categoryRaw) continue;
      var rawKey = "raw:" + row.categoryRaw;
      if (out.some(function (entry) { return entry.id === rawKey; })) continue;
      out.push({ id: rawKey, label: row.categoryRaw, photo: null, blurb: "", count: counts[rawKey] || 1 });
    }
    return out;
  }

  function matchCategory(product, id) {
    if (id === "All") return true;
    if (id.indexOf("raw:") === 0) return !product.category && product.categoryRaw === id.slice(4);
    return product.category === id;
  }

  function status() { return snapshot(); }

  /* Boot once per page, however many scripts ask for the catalog. */
  function ensureStarted() {
    if (bootstrapped) return load();
    bootstrapped = true;
    startAutoRefresh();
    return load();
  }

  window.fixonCatalog = {
    load: ensureStarted,
    refresh: function () { return load(); },
    rows: rows,
    get: get,
    featured: featured,
    categories: categories,
    matchCategory: matchCategory,
    status: status,
    onReady: function (callback) {
      document.addEventListener("fixon:catalog", function (event) { callback(event.detail); });
      ensureStarted();
    }
  };
})();
