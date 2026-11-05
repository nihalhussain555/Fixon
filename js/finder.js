/* ==========================================================================
   FIXON - device finder (brands.html)
   --------------------------------------------------------------------------
   Cover fitment is the reason this page exists: brand names come from
   FIXON.deviceBrands in js/config.js and the item counts beside them come
   from the shop's live catalog (js/catalog.js), so this page can never show
   a number the spreadsheet does not back up. Picking a brand hands the
   visitor straight to shop.html filtered by that brand.

   No account, no cart, no stock claim. A brand appearing here means listings
   are tagged with it - it does not mean a cover is on the shelf, so every
   step says to ask.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;

  /* Rows that actually carry this brand tag. The catalog loads
     asynchronously, so an absent loader simply means nothing to count yet. */
  function countFor(match) {
    var C = window.fixonCatalog;
    if (!C) return 0;
    var brand = match.toLowerCase();
    return C.rows().filter(function (p) {
      return (p.brand || "").toLowerCase() === brand ||
             (p.model || "").toLowerCase().indexOf(brand) !== -1;
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
      var n = countFor(b.match);
      return '<a class="brand-tile reveal" href="shop.html?brand=' + encodeURIComponent(b.match) + '">' +
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

  /* The catalog can land after DOMContentLoaded, so render once now for the
     config-driven parts and again when the loader reports. Subscribing
     through fixonCatalog also starts the single shared request. */
  function boot() {
    initBrands();
    var C = window.fixonCatalog;
    if (C && typeof C.onReady === "function") C.onReady(initBrands);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
