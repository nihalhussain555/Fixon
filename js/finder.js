/* ==========================================================================
   FIXON - device finder (brands.html + models.html)
   --------------------------------------------------------------------------
   Both pages render from FIXON.deviceBrands in js/config.js and hand the
   visitor to shop.html with ?brand= / ?model=, where the existing filter
   does the narrowing. Static only: no account, no cart backend, no stock
   claim. A series appearing here means listings are tagged with it - it does
   not mean a part or cover is on the shelf, so every step says to ask.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var esc = encodeURIComponent;

  function query(name) {
    var raw = new URLSearchParams(location.search).get(name) || "";
    return raw.trim();
  }

  /* Series that actually have listings, used to keep a dead-end selection
     honest instead of showing an empty grid. */
  function countFor(match, model) {
    if (typeof products === "undefined") return 0;
    return products.filter(function (p) {
      var brand = p.brand === match || p.model.indexOf(match) !== -1;
      return brand && (!model || p.model.indexOf(model) !== -1);
    }).length;
  }

  /* ------------------------------------------------------------------ *
   * brands.html - one photo tile per supported brand
   * ------------------------------------------------------------------ */
  function initBrands() {
    var grid = document.getElementById("brandGrid");
    if (!grid) return;
    var list = window.FIXON.deviceBrands;

    grid.innerHTML = list.map(function (b) {
      var n = countFor(b.match, "");
      return '<a class="brand-tile reveal" href="models.html?brand=' + esc(b.id) + '">' +
        '<span class="brand-visual">' +
          '<img class="brand-photo" src="' + U.photoSrc("brands", b.id) + '"' +
            ' data-fallback="' + U.photoSrc("brands", "device") + '"' +
            ' width="760" height="560" loading="lazy" decoding="async" alt="">' +
        "</span>" +
        '<span class="brand-label"><b>' + b.label + "</b>" +
          "<small>" + (n ? n + " listed item" + (n === 1 ? "" : "s") : "Ask us about this brand") + "</small>" +
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

    if (heading) heading.innerHTML = brand.label + "<br><em>Which series?</em>";
    if (support) support.textContent = "Choose the series closest to your device, then see the covers and accessories tagged for it.";
    if (crumbs) crumbs.innerHTML = '<a href="brands.html">Brands</a><span aria-hidden="true">/</span><b>' + brand.label + "</b>";

    grid.innerHTML = brand.models.map(function (m) {
      var n = countFor(brand.match, m);
      return '<a class="model-item reveal" href="shop.html?brand=' + esc(brand.match) + "&model=" + esc(m) + '"' +
        (n ? "" : ' data-weak="1"') + ">" +
        "<b>" + m + "</b>" +
        '<small>' + (n ? "View " + n + " item" + (n === 1 ? "" : "s") : "Nothing listed yet - ask us") + "</small>" +
        '<span class="model-arrow" aria-hidden="true">→</span>' +
      "</a>";
    }).join("");

    /* Ask-about-my-model keeps the exact-model gap honest. */
    if (note) {
      note.innerHTML = "Series names are only how listings are tagged. If your exact model is not here, send it to FIXON on WhatsApp and we will confirm fit before you travel.";
    }
    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initBrands();
    initModels();
  });
})();
