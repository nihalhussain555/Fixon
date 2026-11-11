/* ==========================================================================
   FIXON - product card renderer
   --------------------------------------------------------------------------
   The data itself comes from js/catalog.js (the shop's spreadsheet). This file
   only turns a row into a card. It holds no products and no prices.

   SAFETY: a spreadsheet is untrusted input, so nothing here builds HTML out of
   a cell. Every value is assigned with textContent, which cannot start a tag,
   run a script or break out of an attribute. That is why this file creates
   elements instead of returning markup strings.

   PHOTOS: a row that supplies an image URL uses it as-is. A row without one
   falls back to the category picture in images/accessories/ and is labelled
   "Category illustration", so a stand-in never looks like a real stock photo.

   BUYING: the primary action is "Add to order", which puts the row into the
   order list js/order.js turns into a WhatsApp message. Nothing on a card ever
   says bought, booked or in stock - the shop confirms all of that.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var CFG = window.FIXON;

  var CARD_DESCRIPTION = 150;

  function truncate(text, max) {
    var value = String(text || "");
    if (value.length <= max) return value;
    var cut = value.slice(0, max);
    var lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max - 40 ? cut.slice(0, lastSpace) : cut) + "…";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* brand + model only ever say what the sheet says about the row. */
  function fitmentText(p) {
    if (p.brand && p.model) return p.brand + " · " + p.model;
    return p.brand || p.model || "";
  }

  function buildCard(p) {
    var card = el("article", "product-card reveal");
    card.setAttribute("data-product-id", p.id);

    /* The whole picture is the details button: clicking a product opens the
       dialog built by js/shop.js, which is loaded on every page that shows
       product cards. */
    var visual = el("button", "product-visual");
    visual.type = "button";
    visual.setAttribute("data-details", p.id);
    visual.setAttribute("aria-label", "View details for " + p.name);
    if (p.categoryLabel) visual.appendChild(el("span", "product-tag", p.categoryLabel));

    var img = el("img", "product-photo");
    img.src = p.photo;
    img.width = 760;
    img.height = 760;
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = p.image ? p.name : p.name + " - category illustration";
    /* If the product's own photo will not load, swap once to this item's
       category illustration. Falling back to a generic shelf picture would
       show the customer something from another product line instead. */
    if (p.image) img.setAttribute("data-fallback", p.fallbackPhoto || U.photoSrc("accessories", "other"));
    visual.appendChild(img);

    /* Offer badges come straight off the shop's own sheet columns and only
       after js/catalog.js has checked them against the selling price. */
    if (p.discount) visual.appendChild(el("span", "discount-badge", p.discount + "% OFF"));

    if (!p.image) visual.appendChild(el("span", "photo-note", "Category illustration"));
    visual.appendChild(el("span", "view-hint", "View details"));
    card.appendChild(visual);

    var info = el("div", "product-info");
    card.appendChild(info);
    var fitment = fitmentText(p);
    if (fitment) info.appendChild(el("small", null, fitment));
    var title = el("h3", null, p.name);
    title.setAttribute("data-details", p.id);
    info.appendChild(title);

    if (p.price) {
      var price = el("p", "product-price", p.price);
      if (p.wasLabel) price.appendChild(el("span", "was", p.wasLabel));
      price.appendChild(el("small", null, "confirm at counter"));
      info.appendChild(price);
    } else {
      info.appendChild(el("p", "price-on-request", CFG.priceNote));
    }

    if (p.description) info.appendChild(el("p", "product-excerpt", truncate(p.description, CARD_DESCRIPTION)));

    var actions = el("div", "card-actions");

    /* Buying on this site means adding to an order list that is sent to FIXON
       on WhatsApp, so that is the primary action. A card also carries its own
       details button: the picture and title are click targets too, but neither
       of those says so on a touch screen. */
    var details = el("button", "btn btn-sm btn-outline", "View Details");
    details.type = "button";
    details.setAttribute("data-details", p.id);
    actions.appendChild(details);

    var add = el("button", "btn btn-sm btn-primary", "Add to order");
    add.type = "button";
    add.setAttribute("data-add", p.id);
    actions.appendChild(add);

    if (p.link) {
      var more = el("a", "text-link", "More details");
      more.href = p.link;
      more.target = "_blank";
      more.rel = "noopener";
      actions.appendChild(more);
    }
    info.appendChild(actions);

    return card;
  }

  /* ------------------------------------------------------------------ *
   * The order button reflects the tray: "Add to order" until the item is on
   * the list, then the quantity already there. js/order.js fires
   * fixon:order whenever the list changes.
   * ------------------------------------------------------------------ */
  function syncAddButtons(root) {
    var host = root || document;
    var order = window.fixonOrder;
    host.querySelectorAll("[data-add]").forEach(function (button) {
      var qty = order ? order.countFor(button.getAttribute("data-add")) : 0;
      button.classList.toggle("in-order", qty > 0);
      button.textContent = qty > 0 ? "On your list (" + qty + ")" : "Add to order";
      if (!order) {
        button.classList.add("is-unconfigured");
        button.title = "js/order.js is not loaded on this page";
      } else if (qty === 0) {
        button.title = "Adds one to your order list. Nothing is sent or booked until you press Send.";
      } else {
        button.title = "Adds one more. Change the quantity in your order list.";
      }
    });
  }

  /* targetId kept for the call sites in app.js and shop.js. */
  function renderProducts(list, targetId) {
    var container = document.getElementById(targetId);
    if (!container) return;
    var fragment = document.createDocumentFragment();
    (list || []).forEach(function (p) { fragment.appendChild(buildCard(p)); });
    container.textContent = "";           /* cheap, safe clear */
    container.appendChild(fragment);
    fixonBindProducts(list || [], container);
  }

  function fixonBindProducts(list, container) {
    var byId = {};
    list.forEach(function (p) { byId[p.id] = p; });

    container.querySelectorAll("[data-add]").forEach(function (button) {
      var id = button.getAttribute("data-add");
      if (!byId[id]) return;
      button.addEventListener("click", function () {
        if (window.fixonOrder) window.fixonOrder.add(id);
      });
    });
    syncAddButtons(container);

    container.querySelectorAll("[data-details]").forEach(function (opener) {
      var product = byId[opener.getAttribute("data-details")];
      if (!product) return;
      opener.addEventListener("click", function () {
        if (typeof window.fixonProductModal === "function") window.fixonProductModal(product, list);
      });
    });

    /* Freshly rendered cards animate in like the rest of the page. */
    if (document.documentElement.getAttribute("data-motion") !== "reduced" && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
        });
      }, { threshold: .1 });
      container.querySelectorAll(".reveal").forEach(function (node) { io.observe(node); });
    } else {
      container.querySelectorAll(".reveal").forEach(function (node) { node.classList.add("is-in"); });
    }
  }

  /* This file is loaded once per page, so one listener covers every grid. */
  document.addEventListener("fixon:order", function () { syncAddButtons(document); });

  window.renderProducts = renderProducts;
  window.fixonBindProducts = fixonBindProducts;
  window.fixonProductCard = buildCard;
  window.fixonSyncOrderButtons = syncAddButtons;
})();
