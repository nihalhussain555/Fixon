/* ==========================================================================
   FIXON - catalog loader (Google Sheets or any public CSV)
   --------------------------------------------------------------------------
   One shared source of product data for the whole site. Pages ask this module
   instead of fetching, so a page load costs exactly one request per source and
   an auto-refresh never stacks up duplicates.

   Spreadsheet columns: name, price, description, image, category, active
   (+ optional featured, brand, model, url). See GOOGLE-SHEETS.md.

   Deliberate limits:
   - No secrets here. A browser-side page can never hold a private credential,
     so the sheet has to be published, which also makes it public. Nothing
     customer-related belongs in it.
   - No "real-time" claim. Published CSV can lag a few minutes behind an edit,
     so the status text says when the data was read and nothing more.
   - No invented values. A missing price stays "Price on request"; a missing or
     rejected image falls back to the category picture.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.FIXON;
  var U = window.fixonUtils;

  var CACHE_KEY = "fixon_catalog_v1";
  var SERVICE_CACHE_KEY = "fixon_services_v1";
  var REQUEST_TIMEOUT = 12000;
  var TRUTHY = { "TRUE": 1, "YES": 1, "Y": 1, "1": 1, "ACTIVE": 1, "OK": 1 };
  var IMAGE_TYPES = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"];

  /* name/description/image/category/active are required by the sheet header;
     the rest are read when present and simply ignored when not. */
  var REQUIRED_COLUMNS = ["name", "price", "description", "image", "category", "active"];

  var state = {
    status: "idle",        /* idle | loading | ready | cached | error | unset */
    rows: [],              /* active products only, normalised and safe */
    notes: [],             /* rows skipped or repaired, with the reason */
    source: null,          /* the URL or path that actually served the data */
    fetchedAt: 0,
    fromCache: false,
    error: null,
    services: null,        /* sheet services when configured, otherwise null */
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

  /* A published sheet is untrusted input: it can contain markup or script.
     Nothing here builds HTML from a cell - values stay plain text and the
     renderers assign them with textContent. This guard is the URL layer, the
     only place a sheet value can ever reach a browser API. */
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

  function categoryPhoto(categoryId) {
    var list = CFG.productCategories;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === categoryId) return U.photoSrc("accessories", list[i].photo);
    }
    return U.photoSrc("accessories", "other");
  }

  /* Which configured category does this sheet text belong to? Null means the
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
   * CSV parsing - quoted fields, "" escapes, CRLF, BOM
   * ------------------------------------------------------------------ */
  function parseCsv(text) {
    var rows = [], row = [], field = "", quoted = false, i = 0, ch;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (quoted) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }

    /* Drop fully blank lines; a stray trailing line is normal in exports. */
    return rows.filter(function (r) {
      for (var n = 0; n < r.length; n++) if (trim(r[n]) !== "") return true;
      return false;
    });
  }

  function headerMap(firstRow) {
    var map = {}, missing = [];
    for (var i = 0; i < firstRow.length; i++) {
      var key = trim(firstRow[i]).toLowerCase().replace(/[^a-z]/g, "");
      if (key) map[key] = i;
    }
    for (var r = 0; r < REQUIRED_COLUMNS.length; r++) {
      if (!(REQUIRED_COLUMNS[r] in map)) missing.push(REQUIRED_COLUMNS[r]);
    }
    return { map: map, missing: missing };
  }

  function cell(row, map, key) {
    var index = map[key];
    return index === undefined ? "" : trim(row[index]);
  }

  function isActive(value) {
    return !!TRUTHY[trim(value).toUpperCase()];
  }

  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  /* ------------------------------------------------------------------ *
   * Row normalisation
   * ------------------------------------------------------------------ */
  /* Sheet prices arrive as text: "1499", "₹1,499.00", "Rs. 1,299", "1.299".
     A misread price is worse than no price, because it shows the visitor a
     wrong figure, so only shapes that can be read safely are accepted:
       1499          -> 1499
       1,299 / 1.299 -> 1299   (groups of three after a separator)
       1,299.00      -> 1299   (one or two final digits are the paise)
     "ask in store", "TBD", "12.13.14" and blanks return null, and the card then
     shows "Price on request" instead of a made-up number. */
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

  function toProduct(row, map, line) {
    var name = clip(cell(row, map, "name"), 120);
    if (!name) return { note: "line " + line + ": no product name" };

    var rawCategory = cell(row, map, "category");
    var categoryId = categoryIdFor(rawCategory);
    var rawImage = cell(row, map, "image");
    var image = safeImageUrl(rawImage);
    var priceText = cell(row, map, "price");
    var priceNumber = priceValue(priceText);
    var price = priceNumber === null ? null : U.formatPrice(priceNumber);
    var problems = [];

    /* A price the parser cannot read is a spreadsheet typo: the card still
       shows "Price on request", and the owner is told which line to fix. */
    if (priceText && price === null) problems.push("price \"" + clip(priceText, 24) + "\" is not a number");
    if (rawImage && !image) problems.push("image link was rejected, using the category picture");
    var note = problems.length ? "line " + line + ": " + problems.join("; ") : "";

    return {
      note: note,
      product: {
        name: name,
        description: clip(cell(row, map, "description"), 800),
        priceText: priceText,
        price: price,
        priceNumber: priceNumber,
        category: categoryId,
        categoryLabel: categoryLabel(categoryId) || clip(rawCategory, 40),
        categoryRaw: clip(rawCategory, 40),
        image: image,
        photo: image || categoryPhoto(categoryId),
        brand: clip(cell(row, map, "brand"), 40),
        model: clip(cell(row, map, "model"), 60),
        featured: isActive(cell(row, map, "featured")),
        link: safeUrl(cell(row, map, "url"))
      }
    };
  }

  /* Only https links and same-site pages ever reach an href. */
  function safeUrl(value) {
    var text = trim(value);
    if (!text) return null;
    if (/^https:\/\//i.test(text)) return text;
    if (/^[\w\-./?#&=]+$/.test(text) && text.indexOf("..") === -1 && !/^[a-z]+:/i.test(text)) return text;
    return null;
  }

  /* The order list in js/order.js lives on the visitor's device between visits,
     so a product needs an id that survives the owner editing the sheet. "Row 6"
     would point at a different product the moment a row is inserted or the rows
     are re-sorted, and the order would silently ask for the wrong thing. The
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

  function build(rows, source) {
    var header = rows.length ? rows[0] : null;
    if (!header) return { error: "The file has no rows." };

    var parsed = headerMap(header);
    if (parsed.missing.length) {
      return { error: "Missing column(s): " + parsed.missing.join(", ") + ". The first row must be: " + REQUIRED_COLUMNS.join(", ") + "." };
    }

    var products = [], notes = [], used = {};
    for (var i = 1; i < rows.length; i++) {
      var line = i + 1;
      var result = toProduct(rows[i], parsed.map, line);
      if (!result.product) {
        if (result.note && notes.length < 12) notes.push(result.note);
        continue;
      }
      if (!isActive(cell(rows[i], parsed.map, "active"))) continue;  /* hidden by the owner */
      result.product.id = rowKey(result.product.name, line, used);
      if (result.note && notes.length < 12) notes.push(result.note);
      products.push(result.product);
    }

    if (!products.length) {
      return { error: "The sheet has no active products. Put TRUE in the active column of the rows to show." };
    }
    return { products: products, notes: notes, source: source };
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
   * Fetching
   * ------------------------------------------------------------------ */
  /* Owners paste whatever Google hands them. Accept the edit link, the share
     link and a published CSV link, and turn the first two into a CSV feed. */
  function normalizeUrl(url) {
    var value = trim(url);
    if (!value) return null;
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(value)) return value;
    if (/out:csv|format=csv|\/pub\?/i.test(value)) return value;

    var id = value.replace(/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i, "").split("/")[0].split("?")[0].split("#")[0];
    var gid = (value.match(/[#&?]gid=(\d+)/i) || [])[1];
    return "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:csv" + (gid ? "&gid=" + gid : "");
  }

  /* The other half of the story: a link that cannot work is named here before
     a single request goes out. A OneDrive, Drive or Dropbox share link serves an
     HTML viewer for a binary .xlsx and never answers a cross-site browser read,
     so fetching it wastes a round trip and leaves the owner with a misleading
     "could not reach" error. The message says what to use instead. */
  var UNSUITABLE = [
    { test: /1drv\.ms|onedrive\.live\.com|sharepoint\.com|microsoft\.com\/_layouts/i,
      why: "That is a OneDrive/SharePoint link: it opens an HTML viewer for the .xlsx file and does not answer a cross-site browser read. Save the sheet as CSV, commit it to this repository as data/catalog.csv, and point csvUrl at the raw.githubusercontent.com address of that file - or use a Google Sheet published to the web as CSV." },
    { test: /drive\.google\.com/i,
      why: "That is a Google Drive file link, not a published sheet. In Google Sheets use File > Share > Publish to web > CSV, or the spreadsheet's export?format=csv address." },
    { test: /dropbox\.com/i,
      why: "Dropbox share links do not answer a cross-site browser read. Commit the CSV into this site instead." },
    { test: /\.xlsx?(?:\?|$|#)/i,
      why: "An .xlsx file is a zipped workbook, not CSV. Export or publish the sheet as .csv first." }
  ];

  function sourceProblem(url) {
    for (var i = 0; i < UNSUITABLE.length; i++) {
      if (UNSUITABLE[i].test.test(url)) return UNSUITABLE[i].why;
    }
    return null;
  }

  function candidates() {
    var list = [];
    var remote = normalizeUrl(CFG.catalog.csvUrl);
    if (remote && U.isSet(CFG.catalog.csvUrl)) list.push({ kind: "sheet", url: remote });
    if (CFG.catalog.localFallback) list.push({ kind: "file", url: CFG.catalog.localFallback });
    return list;
  }

  function request(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var options = { cache: "no-store", credentials: "omit" };
    if (controller) {
      options.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    }
    return fetch(url, options).then(function (response) {
      clearTimeout(timer);
      if (!response.ok) throw new Error("The data source answered " + response.status + ".");
      return response.text();
    }, function () {
      clearTimeout(timer);
      throw new Error("Could not reach the data source. Check the address and that it allows cross-site reads.");
    });
  }

  function loadFrom(list, index, previousError) {
    if (index >= list.length) {
      return Promise.reject(new Error(previousError || "No catalog source is configured."));
    }
    var entry = list[index];
    return request(entry.url).then(function (text) {
      var built = build(parseCsv(text), entry);
      if (built.error) throw new Error(built.error + (entry.kind === "file" ? "" : " (reading " + entry.url + ")"));
      return built;
    }).catch(function (error) {
      if (index + 1 < list.length) return loadFrom(list, index + 1, error.message);
      throw error;
    });
  }

  function snapshot() {
    return {
      status: state.status,
      rows: state.rows,
      notes: state.notes,
      source: state.source,
      fetchedAt: state.fetchedAt,
      fromCache: state.fromCache,
      error: state.error,
      services: state.services
    };
  }

  function notify() {
    document.dispatchEvent(new CustomEvent("fixon:catalog", { detail: snapshot() }));
  }

  /* ------------------------------------------------------------------ *
   * Public load - shared, so two callers mean one request, not two
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

  function load() {
    if (inflight) return inflight;

    var list = candidates();
    if (!list.length) {
      state.status = "unset";
      state.error = null;
      notify();
      return Promise.resolve(snapshot());
    }

    var usable = [];
    var blocked = "";
    list.forEach(function (entry) {
      var why = sourceProblem(entry.url);
      if (why) { if (!blocked) blocked = why; } else usable.push(entry);
    });
    if (!usable.length) return Promise.resolve(applyFailure(blocked));

    /* Rows already on screen stay visible while the new read is in flight. */
    if (!state.rows.length) state.status = "loading";
    notify();

    inflight = loadFrom(usable, 0, null).then(function (built) {
      state.rows = built.products;
      state.notes = built.notes;
      state.source = built.source;
      state.fetchedAt = Date.now();
      state.fromCache = false;
      state.error = null;
      state.status = "ready";
      saveCache(CACHE_KEY, { ts: state.fetchedAt, rows: state.rows, notes: built.notes, source: built.source });
      inflight = null;
      notify();
      return snapshot();
    }).catch(function (error) {
      return applyFailure(error.message);
    });

    return inflight;
  }

  /* ------------------------------------------------------------------ *
   * Optional services sheet - same columns, so the owner can manage both
   * from one place. Unset means the configured lists are used instead.
   * ------------------------------------------------------------------ */
  function loadServices() {
    var url = normalizeUrl(CFG.catalog.servicesCsvUrl);
    if (!url || !U.isSet(CFG.catalog.servicesCsvUrl)) return Promise.resolve(null);

    return request(url).then(function (text) {
      var built = build(parseCsv(text), { kind: "sheet", url: url });
      if (built.error) throw new Error(built.error);
      state.services = built.products;
      saveCache(SERVICE_CACHE_KEY, { ts: Date.now(), rows: built.products });
      notify();
      return state.services;
    }).catch(function () {
      var cached = readCache(SERVICE_CACHE_KEY);
      state.services = cached ? cached.rows : null;
      notify();
      return state.services;
    });
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
     the "Featured" strip is empty rather than misleading when the sheet has no
     featured column - the pages hide it in that case. */
  function featured(limit) {
    return state.rows.filter(function (p) { return p.featured; }).slice(0, limit || 3);
  }

  /* Configured categories with live counts, then any other spelling the sheet
     used, so an unusual category value still gets a filter instead of vanishing. */
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
    loadServices();
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
    },
    REQUIRED_COLUMNS: REQUIRED_COLUMNS
  };
})();
