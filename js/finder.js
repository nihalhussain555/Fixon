/* ==========================================================================
   FIXON - device finder (brands.html + models.html)
   --------------------------------------------------------------------------
   Brand and series names come from FIXON.deviceBrands in js/config.js; the
   item counts next to them come from the shop's live catalog (js/catalog.js),
   so this page can never show a number the spreadsheet does not back up.
   Selections hand the visitor to shop.html with ?brand= / ?model=.

   No account, no cart, no stock claim. A series appearing here means listings
   are tagged with it - it does not mean a part or cover is on the shelf, so
   every step says to ask.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var esc = encodeURIComponent;

  function query(name) {
    var raw = new URLSearchParams(location.search).get(name) || "";
    return raw.trim();
  }

  /* Rows that actually carry this brand/series tag. The catalog loads
     asynchronously, so an absent loader simply means nothing to count yet. */
  function countFor(match, model) {
    var C = window.fixonCatalog;
    if (!C) return 0;
    var brand = match.toLowerCase();
    var series = String(model || "").toLowerCase();
    return C.rows().filter(function (p) {
      var owns = (p.brand || "").toLowerCase() === brand ||
                 (p.model || "").toLowerCase().indexOf(brand) !== -1;
      return owns && (!series || (p.model || "").toLowerCase().indexOf(series) !== -1);
    }).length;
  }

  /* While the first read is still in flight a zero would be a lie, so tiles
     say "check the listings" instead of "nothing listed". */
  function pending() {
    var C = window.fixonCatalog;
    if (!C) return false;
    var s = C.status();
    return (s.status === "loading" || s.status === "idle") && !s.rows.length;
  }

  function plural(n) { return n + " listed item" + (n === 1 ? "" : "s"); }

  /* ------------------------------------------------------------------ *
   * brands.html - one photo tile per supported brand
   * ------------------------------------------------------------------ *
   * Markup is built from config values only; no spreadsheet text reaches
   * innerHTML here (counts are numbers). */
  function initBrands() {
    var grid = document.getElementById("brandGrid");
    if (!grid) return;
    var list = window.FIXON.deviceBrands;
    var wait = pending();

    grid.innerHTML = list.map(function (b) {
      var n = countFor(b.match, "");
      return '<a class="brand-tile reveal" href="models.html?brand=' + esc(b.id) + '">' +
        '<span class="brand-visual">' +
          '<img class="brand-photo" src="' + U.photoSrc("brands", b.id) + '"' +
            ' data-fallback="' + U.photoSrc("brands", "device") + '"' +
            ' width="760" height="560" loading="lazy" decoding="async" alt="">' +
        "</span>" +
        '<span class="brand-label"><b>' + b.label + "</b>" +
          "<small>" + (wait ? "Loading listings" : n ? plural(n) : "Ask us about this brand") + "</small>" +
        "</span>" +
      "</a>";
    }).join("");

    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
  }

  /* ------------------------------------------------------------------ *
   * models.html - series for the brand picked above
   * ------------------------------------------------------------------ */
  function initModels() {
    var grid = document.getElementById("modelGrid");
    if (!grid) return;

    var id = query("brand");
    var brand = U.brandById(id);
    var heading = document.getElementById("modelTitle");
    var support = document.getElementById("modelSupport");
    var crumbs = document.getElementById("modelCrumb");
    var note = document.getElementById("modelNote");

    if (!brand) {
      /* Arriving with no ?brand= at all is a fresh start, not a missing brand. */
      var unknown = !!id;
      grid.innerHTML = '<div class="empty-state"><h3>' +
        (unknown ? "We do not have that brand yet" : "Choose a brand first") + "</h3>" +
        "<p>Pick from the full brand list, or tell FIXON the device you need parts for.</p>" +
        '<a class="btn btn-secondary" href="brands.html">All brands</a></div>';
      if (typeof window.fixonHydrate === "function") window.fixonHydrate();
      return;
    }

    var wait = pending();

    if (heading) heading.innerHTML = brand.label + "<br><em>Which series?</em>";
    if (support) support.textContent = "Choose the series closest to your device, then see the covers and accessories tagged for it.";
    if (crumbs) crumbs.innerHTML = '<a href="brands.html">Brands</a><span aria-hidden="true">/</span><b>' + brand.label + "</b>";

    grid.innerHTML = brand.models.map(function (m) {
      var n = countFor(brand.match, m);
      return '<a class="model-item reveal" href="shop.html?brand=' + esc(brand.match) + "&model=" + esc(m) + '"' +
        (n ? "" : ' data-weak="1"') + ">" +
        "<b>" + m + "</b>" +
        '<small>' + (wait ? "Loading listings" : n ? "View " + plural(n) : "Nothing listed yet - ask us") + "</small>" +
        '<span class="model-arrow" aria-hidden="true">→</span>' +
      "</a>";
    }).join("");

    /* Ask-about-my-model keeps the exact-model gap honest. */
    if (note) {
      note.textContent = "Series names are only how listings are tagged. If your exact model is not here, send it to FIXON on WhatsApp and we will confirm fit before you travel.";
    }
    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
  }

  /* The catalog can land after DOMContentLoaded, so render once now for the
     config-driven parts and again when the loader reports. Subscribing
     through fixonCatalog also starts the single shared request. */
  function boot() {
    initBrands();
    initModels();
    var C = window.fixonCatalog;
    if (C && typeof C.onReady === "function") C.onReady(function () {
      initBrands();
      initModels();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
