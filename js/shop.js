/* ==========================================================================
   FIXON - products page (shop.html)
   --------------------------------------------------------------------------
   Everything on this page comes from the shop's Supabase products table
   through js/catalog.js. Nothing is invented: a blank price shows "Price on
   request", a missing image shows the category picture, and a row the owner
   marked inactive never reaches the screen.

   Trust rules, because the data is user-editable text:
   - Database values are only ever assigned with textContent. No field is
     concatenated into innerHTML anywhere on this page.
   - Query-string values (?brand=, ?model=, ?cat=) go through the same rule,
     so a crafted link cannot inject markup.
   - Image links coming from a row are filtered by js/catalog.js to https or
     a same-site path.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var C = window.fixonCatalog;

  var state = { category: "All", query: "", brand: "", model: "", deeplink: "" };
  var started = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function byId(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------ *
   * Filtering
   * ------------------------------------------------------------------ */
  function textOf(p) {
    return [p.name, p.brand, p.model, p.categoryLabel, p.categoryRaw, p.description]
      .join(" ").toLowerCase();
  }

  function contains(haystack, needle) {
    return String(haystack || "").toLowerCase().indexOf(needle) !== -1;
  }

  /* The finder links here with a brand token and a series label. They narrow
     the same way the search box does, so no separate code path is needed. */
  function matches(p) {
    if (!C.matchCategory(p, state.category)) return false;
    if (state.brand) {
      var token = state.brand.toLowerCase();
      if (!(contains(p.brand, token) || contains(p.model, token) || contains(p.name, token))) return false;
    }
    if (state.model && !contains(p.model, state.model.toLowerCase()) && !contains(p.name, state.model.toLowerCase())) return false;
    if (state.query) {
      var words = state.query.split(/\s+/).filter(Boolean);
      var hay = textOf(p);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  /* Search is the only control on this page, so the list has one ordering:
     rows the shop marked featured lead, then the order Supabase returns. */
  function ordered(list) {
    return list.slice().sort(function (a, b) {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }

  /* ------------------------------------------------------------------ *
   * Deep-link pills
   * ------------------------------------------------------------------ *
   * The page has no category buttons any more, but links into it still carry
   * ?cat=, ?brand= and ?model= (the category tiles, the brand finder). A
   * visitor who arrives that way is filtered, so the filter has to be visible
   * and one click has to undo it. Labels come from the configured categories;
   * anything unknown is shown as written, through textContent only.
   * ------------------------------------------------------------------ */
  function categoryLabel(id) {
    var list = C.categories();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].label;
    }
    return id.indexOf("raw:") === 0 ? id.slice(4) : id;
  }

  function renderActiveFilters() {
    var bar = byId("activeFilters");
    if (!bar) return;
    bar.textContent = "";

    var pills = [];
    if (state.category !== "All") pills.push(["Category", categoryLabel(state.category)]);
    if (state.brand) pills.push(["Brand", state.brand]);
    if (state.model) pills.push(["Series", state.model]);
    if (!pills.length) return;

    pills.forEach(function (pair) {
      var chip = el("span", "af-chip");
      chip.appendChild(el("span", null, pair[0] + " "));
      chip.appendChild(el("b", null, clip(pair[1], 40)));
      bar.appendChild(chip);
    });

    var clear = el("a", "af-clear", "Show all items ×");
    clear.href = "shop.html";
    bar.appendChild(clear);
  }

  function clip(value, max) {
    var text = String(value || "");
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  /* ------------------------------------------------------------------ *
   * Status line, loading and error states
   * ------------------------------------------------------------------ */
  function clockText(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  function setStatus(snapshot, total) {
    var node = byId("catalogStatus");
    if (!node) return;
    node.textContent = "";

    if (snapshot.status === "loading" || snapshot.status === "idle") {
      node.appendChild(el("span", "st-dot is-wait", ""));
      node.appendChild(el("span", null, "Loading the shop list…"));
      return;
    }
    if (snapshot.status === "error" || snapshot.status === "unset") return;

    var bits = [];
    bits.push(total + (total === 1 ? " listed item" : " listed items"));
    var time = clockText(snapshot.fetchedAt);
    if (snapshot.fromCache) {
      bits.push("showing the last list that loaded" + (time ? ", read " + time : ""));
    } else if (time) {
      bits.push("list read at " + time);
    }
    node.appendChild(el("span", null, bits.join(" · ")));
    if (snapshot.fromCache) node.appendChild(el("span", "st-note", "Supabase could not be reached just now."));
  }

  /* A read problem is a shop-side detail, so visitors get plain, useful copy
     and a way to enquire. The technical reason only appears with ?debug=1. */
  function paintState(snapshot) {
    var panel = byId("catalogProblem");
    var loading = byId("catalogLoading");
    if (loading) loading.hidden = !(snapshot.status === "loading" || snapshot.status === "idle") || snapshot.rows.length > 0;
    if (!panel) return;
    var broken = snapshot.status === "error" || snapshot.status === "unset";
    if (!broken) { panel.hidden = true; panel.textContent = ""; return; }

    panel.hidden = false;
    panel.textContent = "";
    panel.appendChild(el("h3", null, snapshot.status === "unset"
      ? "The online catalogue is not up yet"
      : "The catalogue could not be read just now"));
    panel.appendChild(el("p", null, snapshot.status === "unset"
      ? "FIXON still answers directly: tell us the device and what you need, and we will confirm fit, stock and price before you travel."
      : "The shop list itself is fine - the connection to Supabase is not. Try again in a moment, or send the enquiry to FIXON and we will answer from the counter."));

    var row = el("div", "state-actions");
    var retry = el("button", "btn btn-sm btn-secondary", "Try again");
    retry.type = "button";
    retry.setAttribute("data-retry", "1");
    row.appendChild(retry);
    row.appendChild(whatsappButton("Ask on WhatsApp", "an accessory"));
    panel.appendChild(row);
  }

  /* One helper so every WhatsApp link behaves the same when the number is
     not configured: marked disabled with a reason instead of a dead link. */
  function whatsappButton(label, category) {
    var link = el("a", "btn btn-sm btn-whatsapp", label);
    var href = U.whatsappUrl("accessory", { category: category });
    if (href) { link.href = href; link.target = "_blank"; link.rel = "noopener"; return link; }
    link.href = "#";
    link.classList.add("is-unconfigured");
    link.setAttribute("aria-disabled", "true");
    link.title = "FIXON.whatsappNumber is not set in js/config.js";
    return link;
  }

  function renderOwnerNotes(snapshot) {
    var box = byId("catalogNotes");
    if (!box) return;
    /* Read diagnostics are for whoever manages the data: open the page with
       ?debug=1 to see them, so a visitor never reads a shop-side note. */
    var want = new URLSearchParams(location.search).get("debug") === "1";
    var lines = (snapshot.notes || []).slice();
    if (want && snapshot.error) lines.unshift("Read failure: " + snapshot.error);
    if (want && snapshot.status === "unset") lines.unshift("No product source: fill FIXON.supabase.url and FIXON.supabase.key in js/config.js.");
    if (want && snapshot.source) lines.push("Served by: " + snapshot.source.url + " (" + snapshot.source.kind + ")");
    if (!want || !lines.length) { box.hidden = true; box.textContent = ""; return; }
    box.hidden = false;
    box.textContent = "";
    box.appendChild(el("b", null, "Catalogue notes for the owner (" + lines.length + ")"));
    var ul = el("ul");
    lines.forEach(function (n) { ul.appendChild(el("li", null, n)); });
    box.appendChild(ul);
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  function render() {
    var grid = byId("productGrid");
    if (!grid) return;
    var snapshot = C.status();
    var all = snapshot.rows || [];
    var list = ordered(all.filter(matches));

    var count = byId("resultCount");
    if (count) count.textContent = list.length
      ? list.length + (list.length === 1 ? " item" : " items")
      : "0 items";

    var empty = byId("catalogEmpty");
    if (all.length && !list.length) {
      /* Nothing is visible, so nothing is left in the grid either: the cards
         from the previous term are removed instead of merely hidden. */
      grid.textContent = "";
      grid.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = "";
        empty.appendChild(el("h3", null, "No listing matches that yet"));
        empty.appendChild(el("p", null,
          "FIXON keeps more than this page shows. Send the exact device and what you need, and we will confirm fit and price before you travel."));
        empty.appendChild(whatsappButton("Ask on WhatsApp",
          (state.model || state.brand || "my phone") + " accessory"));
      }
    } else {
      grid.hidden = false;
      if (empty) { empty.hidden = true; empty.textContent = ""; }
      if (all.length) window.renderProducts(list, "productGrid");
      else grid.textContent = "";
    }

    setStatus(snapshot, all.length);
    renderActiveFilters();
  }

  /* ------------------------------------------------------------------ *
   * Controls
   * ------------------------------------------------------------------ */
  function wireControls() {
    var search = byId("searchInput");
    var clear = byId("searchClear");
    if (search && !search.dataset.wired) {
      search.dataset.wired = "1";
      var timer = null;
      search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.query = search.value.toLowerCase().trim();
          render();
        }, 140);
      });
      if (clear) {
        clear.addEventListener("click", function () {
          search.value = "";
          state.query = "";
          render();
          search.focus();
        });
      }
      /* The header's search icon points at shop.html#search: the browser has
         already jumped to the box, so hand over a focused field. */
      if (location.hash === "#search") search.focus({ preventScroll: true });
    }

    /* The retry button is re-created on every paint, so the click is caught
       once on its container instead of on the button. */
    var problem = byId("catalogProblem");
    if (problem && !problem.dataset.wired) {
      problem.dataset.wired = "1";
      problem.addEventListener("click", function (event) {
        if (!event.target.closest("[data-retry]")) return;
        C.refresh();
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Detail dialog - the product view
   * ------------------------------------------------------------------ *
   * One entry point (window.fixonProductModal) is shared by every page that
   * shows cards, so shop, accessories and home all open the same view.
   *
   * Layout: media left (one large photo, thumbnails when the row carries
   * more than one), information right. Below 900px it becomes one column with
   * the photo first and the buttons pinned above the keyboard-friendly edge.
   *
   * Built with createElement + textContent only: a product row is owner-edited
   * text, so nothing from it is ever concatenated into markup. Colours, sizes,
   * features, specs and the availability line come from the row's optional
   * fields and a section is only built when that row actually has values.
   * ------------------------------------------------------------------ */
  var FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";
  var CLOSE_MS = 190;              /* the fade-out length in css/style.css */
  var lastFocused = null;
  var closeTimer = null;
  var current = { list: null, index: -1 };

  function dialogBox() { return byId("productDialog"); }

  function reducedMotion() {
    return document.documentElement.getAttribute("data-motion") === "reduced";
  }

  function finishClose(box) {
    box.classList.remove("is-closing");
    box.hidden = true;
    box.textContent = "";
    document.body.classList.remove("dialog-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
    current = { list: null, index: -1 };
  }

  function closeDialog() {
    var box = dialogBox();
    if (!box || box.hidden) return;
    dropZoom(box);
    if (reducedMotion() || !box.firstElementChild) { finishClose(box); return; }
    box.classList.add("is-closing");
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { finishClose(box); }, CLOSE_MS);
  }

  function step(delta) {
    if (!current.list) return;
    var next = current.list[current.index + delta];
    if (next) openDialog(next, current.list, { swap: true });
  }

  function dialogKeydown(event) {
    var box = dialogBox();
    if (!box || box.hidden) return;
    var zoom = box.querySelector(".pd-zoom");
    if (event.key === "Escape") {
      event.preventDefault();
      if (zoom) closeZoom(box); else closeDialog();
      return;
    }
    if (zoom) return;                      /* arrows belong to the photo viewer */
    if (event.key === "ArrowRight") { event.preventDefault(); step(1); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); return; }
    if (event.key !== "Tab") return;
    var items = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ *
   * Photo viewer: click or tap the picture, then pinch, scroll or drag
   * ------------------------------------------------------------------ */
  var ZOOM_MIN = 1, ZOOM_MAX = 4;

  function dropZoom(box) {
    var layer = box.querySelector(".pd-zoom");
    if (!layer) return;
    if (typeof layer._teardown === "function") layer._teardown();
    box.removeChild(layer);
  }

  function closeZoom(box) {
    var layer = box.querySelector(".pd-zoom");
    if (!layer) return;
    var opener = layer._opener;
    dropZoom(box);
    if (opener && typeof opener.focus === "function") opener.focus();
  }

  function openZoom(box, opener, src, alt, canFallback) {
    dropZoom(box);

    var layer = el("div", "pd-zoom");
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Zoomed photo of " + alt);
    layer._opener = opener;

    var img = el("img", "pd-zoom-img");
    img.src = src;
    img.alt = alt;
    img.decoding = "async";
    if (canFallback) img.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
    layer.appendChild(img);

    var bar = el("div", "pd-zoom-bar");
    bar.appendChild(el("span", "pd-zoom-hint", "Pinch, scroll or drag - Esc closes"));
    var tools = el("div", "pd-zoom-tools");
    [["–", "Zoom out", -1], ["Fit", "Fit to screen", 0], ["+", "Zoom in", 1]].forEach(function (spec) {
      var b = el("button", "pd-zoom-btn", spec[0]);
      b.type = "button";
      b.setAttribute("aria-label", spec[1]);
      b.addEventListener("click", function () { if (spec[2]) nudge(spec[2]); else reset(); });
      tools.appendChild(b);
    });
    var x = el("button", "pd-zoom-btn is-close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Close zoomed photo");
    x.addEventListener("click", function () { closeZoom(box); });
    tools.appendChild(x);
    bar.appendChild(tools);
    layer.appendChild(bar);

    var scale = 1, xOff = 0, yOff = 0;
    var pointers = [], pinch = null, dragged = false;

    function apply() {
      img.style.transform = "translate3d(" + xOff + "px," + yOff + "px,0) scale(" + scale + ")";
      layer.classList.toggle("is-zoomed", scale > 1.02);
    }
    function clamp(value) { return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)); }
    function reset() { scale = 1; xOff = 0; yOff = 0; apply(); }
    function nudge(direction) {
      scale = clamp(scale + direction * 0.6);
      if (scale === 1) { xOff = 0; yOff = 0; }
      apply();
    }
    function distance() {
      var dx = pointers[0].x - pointers[1].x, dy = pointers[0].y - pointers[1].y;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    function spot(id) {
      for (var i = 0; i < pointers.length; i++) if (pointers[i].id === id) return pointers[i];
      return null;
    }

    function onDown(event) {
      event.preventDefault();
      pointers.push({ id: event.pointerId, x: event.clientX, y: event.clientY });
      dragged = false;
      if (pointers.length === 2) pinch = { dist: distance(), scale: scale };
      if (img.setPointerCapture) { try { img.setPointerCapture(event.pointerId); } catch (e) { /* older browsers */ } }
    }
    function onMove(event) {
      var p = spot(event.pointerId);
      if (!p) return;
      var dx = event.clientX - p.x, dy = event.clientY - p.y;
      p.x = event.clientX; p.y = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
      if (pointers.length === 2 && pinch) {
        scale = clamp(pinch.scale * (distance() / pinch.dist));
      } else if (scale > 1) {
        xOff += dx; yOff += dy;
      } else if (pointers.length === 1) {
        dragged = false;
      }
      if (scale === 1 && pointers.length < 2) { xOff = 0; yOff = 0; }
      apply();
    }
    function onUp(event) {
      pointers = pointers.filter(function (entry) { return entry.id !== event.pointerId; });
      if (pointers.length < 2) pinch = null;
      if (!pointers.length && scale <= 1) reset();
    }

    img.addEventListener("pointerdown", onDown);
    img.addEventListener("pointermove", onMove);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
      img.addEventListener(name, onUp);
    });
    /* Tapping the dark surround closes the viewer; a drag does not count.
       The reset listens on the layer because a press that starts on the
       surround never reaches the image's own handlers. */
    layer.addEventListener("pointerdown", function () { dragged = false; });
    layer.addEventListener("click", function (event) {
      if (event.target === layer && !dragged) closeZoom(box);
    });
    /* Double tap or double click flips between fit and a close look. */
    img.addEventListener("dblclick", function () { if (scale > 1) reset(); else { scale = 2.5; apply(); } });
    function onWheel(event) {
      event.preventDefault();
      nudge(event.deltaY < 0 ? 1 : -1);
    }
    layer.addEventListener("wheel", onWheel, { passive: false });

    layer._teardown = function () {
      layer.removeEventListener("wheel", onWheel);
    };

    box.appendChild(layer);
    x.focus();
  }

  /* ------------------------------------------------------------------ *
   * Media column
   * ------------------------------------------------------------------ */
  function buildMedia(product) {
    var gallery = (product.gallery && product.gallery.length) ? product.gallery : [product.photo];
    var media = el("div", "pd-media");

    var stage = el("button", "pd-stage");
    stage.type = "button";
    stage.setAttribute("aria-label", "Enlarge the photo of " + product.name);
    var main = el("img", "pd-main");
    main.src = gallery[0];
    main.alt = product.image ? product.name : product.name + " - category illustration";
    main.decoding = "async";
    main.loading = "eager";
    /* The photo keeps its own shape: the stage adopts the loaded image's
       ratio within sane limits, so nothing is cropped and a very tall photo
       cannot push the buttons off screen. */
    main.addEventListener("load", function () {
      var w = main.naturalWidth || 1, h = main.naturalHeight || 1;
      stage.style.setProperty("--pd-ratio", String(Math.min(1.5, Math.max(0.7, w / h))));
    });
    if (product.image) {
      main.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
      /* js/app.js quietly swaps in the stand-in when the file is missing, so
         say so here rather than letting a borrowed picture look like the item. */
      main.addEventListener("error", function () {
        if (media.querySelector(".pd-caption")) return;
        main.alt = product.name + " - category illustration";
        media.appendChild(el("p", "pd-caption",
          "This photo could not be loaded, so the category illustration is shown."));
      });
    }
    stage.appendChild(main);
    stage.appendChild(el("span", "pd-cue", "⤢ Tap to zoom"));
    media.appendChild(stage);

    var shown = { src: gallery[0] };
    stage.addEventListener("click", function () {
      openZoom(dialogBox(), stage, shown.src, main.alt, !!product.image);
    });

    if (gallery.length > 1) {
      var strip = el("div", "pd-thumbs");
      strip.setAttribute("role", "group");
      strip.setAttribute("aria-label", "Photos of " + product.name);
      gallery.forEach(function (src, i) {
        var thumb = el("button", "pd-thumb");
        thumb.type = "button";
        if (i === 0) thumb.setAttribute("aria-current", "true");
        thumb.setAttribute("aria-label", "Photo " + (i + 1) + " of " + gallery.length);
        var pic = el("img");
        pic.src = src; pic.alt = ""; pic.loading = "lazy"; pic.decoding = "async";
        if (product.image) pic.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
        thumb.appendChild(pic);
        thumb.addEventListener("click", function () {
          shown.src = src;
          main.src = src;
          strip.querySelectorAll(".pd-thumb").forEach(function (t) { t.removeAttribute("aria-current"); });
          thumb.setAttribute("aria-current", "true");
          dropZoom(dialogBox());
        });
        strip.appendChild(thumb);
      });
      media.appendChild(strip);
    }

    if (!product.image) {
      media.appendChild(el("p", "pd-caption", "Category illustration - not a photo of this exact item."));
    }
    return media;
  }

  /* ------------------------------------------------------------------ *
   * Information column
   * ------------------------------------------------------------------ */
  function optionRow(label, values) {
    if (!values || !values.length) return null;
    var row = el("div", "pd-opt");
    row.appendChild(el("span", "pd-opt-label", label));
    var chips = el("div", "pd-chips");
    values.forEach(function (value) { chips.appendChild(el("span", "pd-chip", value)); });
    row.appendChild(chips);
    return row;
  }

  function featureList(values) {
    if (!values || !values.length) return null;
    var block = el("div", "pd-block");
    block.appendChild(el("h3", null, "Features"));
    var ul = el("ul", "pd-ticks");
    values.forEach(function (value) { ul.appendChild(el("li", null, value)); });
    block.appendChild(ul);
    return block;
  }

  function specTable(specs) {
    if (!specs || !specs.length) return null;
    var block = el("div", "pd-block");
    block.appendChild(el("h3", null, "Specifications"));
    var dl = el("dl", "pd-specs");
    specs.forEach(function (row) {
      if (row.label) {
        dl.appendChild(el("dt", null, row.label));
        dl.appendChild(el("dd", null, row.value));
      } else {
        dl.appendChild(el("dt", null, "Detail"));
        dl.appendChild(el("dd", null, row.value));
      }
    });
    block.appendChild(dl);
    return block;
  }

  /* ------------------------------------------------------------------ *
   * ORDER ON WHATSAPP - a direct chat with the shop's number
   * ------------------------------------------------------------------ *
   * One click builds the order text from this listing's own row and opens
   * the official direct-chat address, https://wa.me/<number>?text=..., in a
   * new tab: FIXON's chat appears with the message already typed out, and
   * the visitor only has to press send. No device share sheet, no contact
   * picking, no photo APIs - a wa.me link carries text, which is exactly
   * what an order needs, and js/config.js has verified the number shape.
   * ------------------------------------------------------------------ */

  /* The quantity the visitor is actually asking for: the order list's count
     for this product when it is on the list, one otherwise. */
  function orderQuantity(product) {
    var inList = window.fixonOrder ? window.fixonOrder.countFor(product.id) : 0;
    return Math.max(1, Math.min(99, Math.floor(inList) || 1));
  }

  /* Fields this listing can actually answer: no line is printed for a field
     the database left blank. Product, price and quantity
     always appear; the line total only when the listing carries a number,
     because an invented price is worse than a missing one. Fitment rides on
     the name line, and the listed colour/size cells act as the variant. */
  function orderTokens(product, qty) {
    var units = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
    var fitment = [product.brand, product.model].filter(Boolean).join(" - ");
    var lines = ["Product: " + product.name + (fitment ? " (" + fitment + ")" : "")];
    var priceText = product.price
      || (U.isSet(window.FIXON.priceNote) ? window.FIXON.priceNote : "Price on request");
    lines.push("Price: " + priceText);
    var category = product.categoryLabel || product.categoryRaw;
    if (category) lines.push("Category: " + category);
    if (product.colors && product.colors.length) lines.push("Colours listed: " + product.colors.join(", "));
    if (product.sizes && product.sizes.length) lines.push("Sizes listed: " + product.sizes.join(", "));
    lines.push("Quantity: " + units);
    if (product.priceNumber) {
      lines.push("Total: " + U.formatPrice(Math.round(product.priceNumber * units * 100) / 100));
    }
    if (product.stock) lines.push("Availability: " + product.stock);
    var pageUrl = U.productPageUrl(product.id);
    if (pageUrl) lines.push("Product page: " + pageUrl);
    return { details: lines.join("\n"), extras: typedExtras(), date: U.orderDateText() };
  }

  /* Whatever the visitor typed in the order panel, if this page has one.
     Empty boxes are left out rather than sent as blank lines. */
  function typedExtras() {
    var out = [];
    [["Name", "orderName"], ["My phone", "orderDevice"],
     ["Delivery address", "orderAddress"], ["Notes", "orderNotes"]].forEach(function (pair) {
      var node = document.getElementById(pair[1]);
      var text = node ? String(node.value || "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
      if (text) out.push(pair[0] + ": " + text);
    });
    /* The trailing break belongs to the extras, so the closing sentence
       always starts on its own line whether they are filled in or not. */
    return out.length ? out.join("\n") + "\n" : "";
  }

  /* The click itself. The tap is the user activation, so window.open is
     still allowed at this moment; a browser that blocks the new tab gets
     the same address as a plain navigation, which a blocker leaves alone.
     The button wears a short loading label so the click always visibly
     does something, and nothing is claimed about delivery - WhatsApp
     shows the message and the visitor sends it. */
  function orderNow(product, button) {
    if (button.getAttribute("data-sending") === "1") return;   /* already in flight */
    var href = U.whatsappUrl("orderProduct", orderTokens(product, orderQuantity(product)));
    if (!href) {
      if (window.showToast) window.showToast("FIXON's WhatsApp number is not set in js/config.js, so this order cannot be sent from the site yet.", "error");
      return;
    }
    var label = button.textContent;
    button.setAttribute("data-sending", "1");
    button.disabled = true;
    button.classList.add("is-busy");
    button.textContent = "Opening WhatsApp...";
    function ready() {
      button.removeAttribute("data-sending");
      button.disabled = false;
      button.classList.remove("is-busy");
      button.textContent = label;
    }
    var win = window.open(href, "_blank", "noopener");
    if (!win) { location.href = href; return; }
    setTimeout(ready, 500);
  }

  function buildInfo(product) {
    var info = el("div", "pd-info");
    var fitment = [];
    if (product.brand) fitment.push(product.brand);
    if (product.model) fitment.push(product.model);

    info.appendChild(el("p", "pd-cat", product.categoryLabel || "Accessory"));

    var title = el("h2", "pd-title", product.name);
    title.id = "dialogTitle";
    info.appendChild(title);

    if (fitment.length) {
      var fits = el("div", "pd-fits");
      fits.appendChild(el("span", null, "Fits"));
      fitment.forEach(function (value) { fits.appendChild(el("b", null, value)); });
      info.appendChild(fits);
    }

    var priceRow = el("div", "pd-price-row");
    if (product.price) {
      priceRow.appendChild(el("span", "pd-price", product.price));
      if (product.wasLabel) priceRow.appendChild(el("span", "was", product.wasLabel));
      if (product.discount) priceRow.appendChild(el("span", "pd-discount", product.discount + "% off"));
      priceRow.appendChild(el("span", "pd-price-note", "confirm at the counter"));
    } else {
      priceRow.appendChild(el("span", "pd-price is-request",
        U.isSet(window.FIXON.priceNote) ? window.FIXON.priceNote : "Price on request"));
      priceRow.appendChild(el("span", "pd-price-note", "quoted on WhatsApp or at the counter"));
    }
    info.appendChild(priceRow);

    /* Supabase tracks a real quantity; 0 means the shop says it is gone, so
       ordering stops here instead of asking for something already sold out.
       An untracked quantity (null) never sets this flag. */
    var soldOut = product.stockCount === 0;

    if (product.stock) {
      var status = el("p", "pd-status" + (soldOut ? " is-out" : ""));
      status.appendChild(el("span", "pd-dot", ""));
      status.appendChild(el("span", null, product.stock));
      info.appendChild(status);
    }

    if (product.description) info.appendChild(el("p", "pd-desc", product.description));

    var colors = optionRow("Colours", product.colors);
    if (colors) info.appendChild(colors);
    var sizes = optionRow("Sizes", product.sizes);
    if (sizes) info.appendChild(sizes);
    var features = featureList(product.features);
    if (features) info.appendChild(features);
    var specs = specTable(product.specs);
    if (specs) info.appendChild(specs);

    var actions = el("div", "pd-actions");

    /* Order on WhatsApp opens FIXON's direct chat with this product's
       details filled in - the visitor only presses send. "Add to order"
       stays the order-list path. */
    var order = el("button", "btn btn-accent", "Order on WhatsApp");
    order.type = "button";
    if (soldOut) {
      order.disabled = true;
      order.classList.add("is-unconfigured");
      order.title = "FIXON lists this product as out of stock, so it cannot be ordered right now.";
    } else if (U.whatsappDigits()) {
      order.title = "Opens a WhatsApp chat with FIXON with this product's details filled in - press send there to submit the order";
      order.addEventListener("click", function () { orderNow(product, order); });
    } else {
      order.classList.add("is-unconfigured");
      order.setAttribute("aria-disabled", "true");
      order.title = "FIXON.whatsappNumber is not set in js/config.js";
    }
    actions.appendChild(order);

    var add = el("button", "btn btn-primary", "Add to order");
    add.type = "button";
    add.setAttribute("data-add", product.id);
    if (soldOut) {
      add.disabled = true;
      add.classList.add("is-unconfigured");
      add.title = "This product is out of stock, so it cannot go on the order list.";
    } else {
      add.addEventListener("click", function () {
        if (window.fixonOrder) window.fixonOrder.add(product.id);
      });
    }
    actions.appendChild(add);

    var wa = el("a", "btn btn-whatsapp", "Ask on WhatsApp");
    var waHref = U.whatsappUrl("product", {
      product: product.name + (fitment.length ? " (" + fitment.join(" · ") + ")" : "")
    });
    if (waHref) { wa.href = waHref; wa.target = "_blank"; wa.rel = "noopener"; }
    else { wa.href = "#"; wa.classList.add("is-unconfigured"); wa.setAttribute("aria-disabled", "true"); }
    actions.appendChild(wa);
    info.appendChild(actions);

    if (product.link) {
      var more = el("a", "pd-shoplink", "Open the shop's own page for this item ↗");
      more.href = product.link; more.target = "_blank"; more.rel = "noopener";
      info.appendChild(more);
    }

    info.appendChild(el("p", "pd-note",
      "Everything above comes from the shop's own list. Fit, colour and stock are confirmed on WhatsApp or at the counter before any payment."));
    return info;
  }

  /* ------------------------------------------------------------------ *
   * Assembly
   * ------------------------------------------------------------------ */
  function openDialog(product, list, options) {
    var box = dialogBox();
    if (!box || !product) return;
    var swap = !!(options && options.swap);
    if (box.hidden) lastFocused = document.activeElement;
    clearTimeout(closeTimer);
    box.classList.remove("is-closing");
    box.textContent = "";
    current = {
      list: list || null,
      index: list ? list.findIndex(function (p) { return p.id === product.id; }) : -1
    };

    var panel = el("div", "dialog-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "dialogTitle");
    panel.setAttribute("tabindex", "-1");
    if (swap || reducedMotion()) panel.classList.add("is-swap");

    var head = el("div", "dialog-head");
    head.appendChild(el("span", "dialog-cat", product.categoryLabel || "Product details"));

    var tools = el("div", "pd-head-tools");
    if (list && list.length > 1) {
      [["‹", "Previous product", -1], ["›", "Next product", 1]].forEach(function (spec) {
        var b = el("button", "pd-arrow", spec[0]);
        b.type = "button";
        b.setAttribute("aria-label", spec[1]);
        var index = current.index;
        b.disabled = spec[2] < 0 ? index <= 0 : index >= list.length - 1;
        b.addEventListener("click", function () { step(spec[2]); });
        tools.appendChild(b);
      });
      tools.appendChild(el("span", "dialog-count",
        (current.index + 1) + " / " + (list ? list.length : 1)));
    }
    var close = el("button", "dialog-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close product details");
    close.addEventListener("click", closeDialog);
    tools.appendChild(close);
    head.appendChild(tools);
    panel.appendChild(head);

    var body = el("div", "dialog-body");
    body.appendChild(buildMedia(product));
    body.appendChild(buildInfo(product));
    panel.appendChild(body);

    box.appendChild(panel);
    /* The dialog's own Add button needs the same "On your list (n)" label the
       cards use, and it is in the document by now. */
    if (typeof window.fixonSyncOrderButtons === "function") window.fixonSyncOrderButtons(box);
    box.hidden = false;
    document.body.classList.add("dialog-open");
    panel.focus();
  }

  window.fixonProductModal = openDialog;

  function wireDialog() {
    var box = dialogBox();
    if (!box || box.dataset.wired) return;
    box.dataset.wired = "1";
    box.addEventListener("click", function (event) {
      if (event.target === box) closeDialog();      /* backdrop click */
    });
    document.addEventListener("keydown", dialogKeydown);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function boot(snapshot) {
    if (!started) {
      started = true;
      wireControls();
      wireDialog();
    }
    paintState(snapshot);
    renderOwnerNotes(snapshot);
    render();

    /* ?product=<id> opens one listing straight away. This is the address the
       WhatsApp order message carries, so the shop can open exactly what the
       customer is pointing at. Consumed on the first ready read and never
       again - an auto-refresh must not reopen a dialog the visitor closed.
       An id that is not on the list is ignored: the grid shows, no dialog
       over nothing. */
    if (state.deeplink && (snapshot.status === "ready" || snapshot.status === "cached")) {
      var product = C.get(state.deeplink);
      state.deeplink = null;   /* opened, or not on the list: either way, once */
      if (product) openDialog(product, C.rows(), { swap: false });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* The Details dialog is used by product cards on every shop page, not
       just shop.html, so it is wired whenever #productDialog exists. */
    wireDialog();

    var grid = byId("productGrid");
    if (!grid) return;
    if (!C) {
      grid.textContent = "";
      grid.appendChild(el("p", "note", "The catalog loader (js/catalog.js) is not loaded on this page."));
      return;
    }

    var params = new URLSearchParams(location.search);
    state.brand = (params.get("brand") || "").trim();
    state.model = (params.get("model") || "").trim();
    var cat = (params.get("cat") || "").trim();
    if (cat) state.category = cat;
    /* One listing to open as soon as the list is readable. The id arrives
       from the shop's own WhatsApp message, and C.get() only ever matches a
       product that exists, so an edited-away link just shows the grid. */
    state.deeplink = (params.get("product") || "").trim().slice(0, 80);

    var search = byId("searchInput");
    if (search && state.model) { search.value = state.model; state.query = state.model.toLowerCase(); }

    C.onReady(boot);
  });
})();
