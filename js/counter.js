/* ==========================================================================
   FIXON - counter services (services.html)
   --------------------------------------------------------------------------
   Fitting and help services, kept visibly apart from the repair jobs above
   them. The list is FIXON.counterServices in js/config.js - the shop's own
   words, edited there and nowhere else. If the owner also publishes a service
   sheet (FIXON.catalog.servicesCsvUrl) those rows replace the config list,
   because a sheet is the fresher source.

   Prices stay hidden unless a row carries a number: a price is the shop's to
   state, and an invented one is the fastest way to lose a customer's trust.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var CFG = window.FIXON;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /* Sheet rows and config entries are normalised to the same shape, so one
     renderer covers both. A sheet row already carries a resolved image
     address; a config entry carries a slug into images/services/. */
  function normalise(item) {
    if (item.categoryLabel || item.priceText !== undefined) {
      return {
        id: item.name,
        label: item.name,
        blurb: item.description || "",
        price: item.price,
        src: item.photo
      };
    }
    return {
      id: item.id,
      label: item.id,
      blurb: item.blurb || "",
      price: U.formatPrice(item.price),
      src: U.photoSrc("services", item.photo || "generic")
    };
  }

  function card(item, index) {
    var node = el("article", "service-card counter-card reveal");
    if (index % 3 === 1) node.setAttribute("data-delay", "1");
    if (index % 3 === 2) node.setAttribute("data-delay", "2");

    var visual = el("span", "service-visual");
    var img = el("img", "service-photo");
    img.src = item.src;
    img.setAttribute("data-fallback", U.photoSrc("services", "generic"));
    img.width = 560; img.height = 280;
    img.loading = "lazy"; img.decoding = "async";
    img.alt = "";
    visual.appendChild(img);
    node.appendChild(visual);

    node.appendChild(el("h3", null, item.label));
    if (item.blurb) node.appendChild(el("p", null, item.blurb));
    node.appendChild(item.price
      ? el("p", "service-price", item.price + " - confirm at the counter")
      : el("p", "price-on-request", CFG.priceNote));

    var actions = el("div", "card-actions");
    var ask = el("a", "service-cta", "Ask about this →");
    var href = U.whatsappUrl("service", { service: item.label });
    if (href) { ask.href = href; ask.target = "_blank"; ask.rel = "noopener"; }
    else {
      ask.href = "#";
      ask.classList.add("is-unconfigured");
      ask.setAttribute("aria-disabled", "true");
      ask.title = "FIXON.whatsappNumber is not set in js/config.js";
    }
    actions.appendChild(ask);
    actions.appendChild(el("span", "wa-mini", "Or call the shop"));
    node.appendChild(actions);

    return node;
  }

  function render() {
    var grid = document.getElementById("counterGrid");
    if (!grid) return;
    var sheet = window.fixonCatalog ? window.fixonCatalog.status().services : null;
    var list = (sheet && sheet.length ? sheet : CFG.counterServices).map(normalise);

    var fragment = document.createDocumentFragment();
    list.forEach(function (item, i) { fragment.appendChild(card(item, i)); });
    grid.textContent = "";
    grid.appendChild(fragment);

    var note = document.getElementById("counterSource");
    if (note) {
      note.textContent = sheet && sheet.length
        ? "These come from the shop's own service list. Availability is confirmed when you call or message."
        : "Edit this list in js/config.js under counterServices, or publish a service sheet - see GOOGLE-SHEETS.md.";
    }
    if (typeof window.fixonHydrate === "function") window.fixonHydrate();
    grid.querySelectorAll(".reveal").forEach(function (node) { node.classList.add("is-in"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("counterGrid")) return;
    if (window.fixonCatalog) window.fixonCatalog.onReady(render); else render();
  });
})();
