/* ==========================================================================
   FIXON - category grids
   --------------------------------------------------------------------------
   accessories.html (#categoryGrid) gets one full tile per configured category
   in FIXON.productCategories, with the count of live listings beside it.
   index.html (#homeCategories) gets a compact strip of the categories that
   have something listed. Counts come from js/catalog.js, so a category with
   nothing tagged says so instead of pretending to be stocked.

   Tiles are built with createElement/textContent: a category the sheet invents
   is spreadsheet text, and spreadsheet text never becomes markup.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var C = window.fixonCatalog;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function tile(cat, index) {
    var card = el("article", "service-card accessory-tile reveal");
    if (index % 3 === 1) card.setAttribute("data-delay", "1");
    if (index % 3 === 2) card.setAttribute("data-delay", "2");
    if (cat.id.indexOf("raw:") !== 0) card.id = "cat-" + cat.id;

    var visual = el("span", "service-visual");
    var img = el("img", "service-photo");
    img.src = cat.photo ? U.photoSrc("accessories", cat.photo) : U.photoSrc("accessories", "other");
    img.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
    img.width = 560; img.height = 280;
    img.loading = "lazy"; img.decoding = "async";
    img.alt = cat.label + ", illustrated";
    visual.appendChild(img);
    card.appendChild(visual);

    card.appendChild(el("h3", null, cat.label));
    if (cat.blurb) card.appendChild(el("p", null, cat.blurb));

    var actions = el("div", "card-actions");
    var link = el("a", "service-cta", cat.count
      ? "View " + cat.count + " item" + (cat.count === 1 ? "" : "s") + " →"
      : "Nothing tagged yet - ask us →");
    link.href = "shop.html?cat=" + encodeURIComponent(cat.id);
    actions.appendChild(link);

    var ask = el("a", "wa-mini", "Ask on WhatsApp");
    var href = U.whatsappUrl("accessory", { category: cat.label.toLowerCase() });
    if (href) { ask.href = href; ask.target = "_blank"; ask.rel = "noopener"; }
    else {
      ask.href = "#";
      ask.classList.add("is-unconfigured");
      ask.setAttribute("aria-disabled", "true");
      ask.title = "FIXON.whatsappNumber is not set in js/config.js";
    }
    actions.appendChild(ask);
    card.appendChild(actions);

    return card;
  }

  /* ------------------------------------------------------------------ *
   * The home-page strip. Unlike the full grid above, it only ever offers a
   * category the shop's own list actually backs up: a tile for something with
   * no live listing would lead to an empty filter and a broken promise.
   * ------------------------------------------------------------------ */
  function homeTile(cat, index) {
    var card = el("a", "accessory-card reveal");
    card.href = "shop.html?cat=" + encodeURIComponent(cat.id);
    if (index % 3 === 1) card.setAttribute("data-delay", "1");
    if (index % 3 === 2) card.setAttribute("data-delay", "2");

    var img = el("img", "accessory-thumb");
    img.src = U.photoSrc("accessories", cat.photo || "other");
    img.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
    img.width = 46; img.height = 46;
    img.loading = "lazy"; img.decoding = "async";
    img.alt = cat.label + ", illustrated";
    card.appendChild(img);
    card.appendChild(el("span", "accessory-name", cat.label));
    card.appendChild(el("em", null, cat.count + (cat.count === 1 ? " item" : " items")));
    return card;
  }

  function renderHome() {
    var grid = document.getElementById("homeCategories");
    if (!grid || !C) return;
    var stocked = C.categories().filter(function (cat) { return cat.count > 0; });
    var note = document.getElementById("homeCategoryNote");
    grid.hidden = !stocked.length;
    if (note) note.hidden = stocked.length > 0;
    if (!stocked.length) { grid.textContent = ""; return; }

    var fragment = document.createDocumentFragment();
    stocked.forEach(function (cat, i) { fragment.appendChild(homeTile(cat, i)); });
    grid.textContent = "";
    grid.appendChild(fragment);
    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
    grid.querySelectorAll(".reveal").forEach(function (node) { node.classList.add("is-in"); });
  }

  function render() {
    var grid = document.getElementById("categoryGrid");
    if (!grid || !C) return;
    var cats = C.categories();
    var fragment = document.createDocumentFragment();
    cats.forEach(function (cat, i) { fragment.appendChild(tile(cat, i)); });
    grid.textContent = "";
    grid.appendChild(fragment);

    var total = C.rows().length;
    var note = document.getElementById("categoryTally");
    if (note) {
      note.textContent = total
        ? "Counts are live: they come from the shop's own list of " + total +
          " item" + (total === 1 ? "" : "s") + ". A category with nothing tagged is still something FIXON can source - ask."
        : "The shop list is still loading, so no counts are shown yet.";
    }

    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
    grid.querySelectorAll(".reveal").forEach(function (node) { node.classList.add("is-in"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!C) return;
    var grid = document.getElementById("categoryGrid");
    var home = document.getElementById("homeCategories");
    if (!grid && !home) return;
    C.onReady(grid ? render : renderHome);
  });
})();
