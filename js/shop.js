/* ==========================================================================
   FIXON - products page (shop.html)
   --------------------------------------------------------------------------
   Everything on this page comes from the shop's spreadsheet through
   js/catalog.js. Nothing is invented: a blank price cell shows "Price on
   request", a missing image shows the category picture, and a row the owner
   marked inactive never reaches the screen.

   Trust rules, because the data is user-editable text:
   - Spreadsheet values are only ever assigned with textContent. No cell is
     concatenated into innerHTML anywhere on this page.
   - Query-string values (?brand=, ?model=, ?cat=) go through the same rule,
     so a crafted link cannot inject markup.
   - Links from the sheet are filtered by js/catalog.js to https or a
     same-site path.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var C = window.fixonCatalog;

  var state = { category: "All", query: "", sort: "featured", brand: "", model: "" };
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

  function sorted(list) {
    var out = list.slice();
    if (state.sort === "name") {
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (state.sort === "price-asc" || state.sort === "price-desc") {
      var dir = state.sort === "price-asc" ? 1 : -1;
      out.sort(function (a, b) {
        /* Items with no price stay at the bottom whichever way the list runs:
           they are not cheaper or dearer, they are simply unpriced. */
        if (a.priceNumber === null && b.priceNumber === null) return a.name.localeCompare(b.name);
        if (a.priceNumber === null) return 1;
        if (b.priceNumber === null) return -1;
        return (a.priceNumber - b.priceNumber) * dir;
      });
    } else {
      out.sort(function (a, b) {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Category chips - built from the sheet, never written as HTML
   * ------------------------------------------------------------------ */
  function buildFilters() {
    var host = byId("filters");
    if (!host) return;
    var cats = C.categories();
    host.textContent = "";

    var all = el("button", "filter", "All items");
    all.type = "button";
    all.setAttribute("data-filter", "All");
    host.appendChild(all);

    cats.forEach(function (c) {
      var label = c.count ? c.label + " (" + c.count + ")" : c.label;
      var btn = el("button", "filter", label);
      btn.type = "button";
      btn.setAttribute("data-filter", c.id);
      if (!c.count) btn.title = "Nothing tagged " + c.label + " right now";
      host.appendChild(btn);
    });

    syncFilterActive();
  }

  function syncFilterActive() {
    document.querySelectorAll("#filters .filter").forEach(function (btn) {
      var on = btn.getAttribute("data-filter") === state.category;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /* One delegated listener for a bar that re-renders whenever the sheet
     changes - that is what keeps listeners from stacking up. */
  function wireFilters() {
    var host = byId("filters");
    if (!host || host.dataset.wired) return;
    host.dataset.wired = "1";
    host.addEventListener("click", function (event) {
      var btn = event.target.closest(".filter");
      if (!btn || !host.contains(btn)) return;
      state.category = btn.getAttribute("data-filter") || "All";
      syncFilterActive();
      render();
    });
  }

  /* ------------------------------------------------------------------ *
   * Deep-link chips
   * ------------------------------------------------------------------ */
  function renderActiveFilters() {
    var bar = byId("activeFilters");
    if (!bar) return;
    bar.textContent = "";
    if (!state.brand && !state.model) return;

    [["Brand", state.brand], ["Series", state.model]].forEach(function (pair) {
      if (!pair[1]) return;
      var chip = el("span", "af-chip");
      chip.appendChild(el("span", null, pair[0] + " "));
      chip.appendChild(el("b", null, pair[1]));
      bar.appendChild(chip);
    });

    var clear = el("a", "af-clear", "Clear filters ×");
    clear.href = "shop.html";
    bar.appendChild(clear);
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
    if (snapshot.fromCache) node.appendChild(el("span", "st-note", "The sheet could not be reached just now."));
  }

  /* A sheet problem is a shop-side detail, so visitors get plain, useful copy
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
      : "The shop list is fine - the connection to it is not. Try again in a moment, or send the enquiry to FIXON and we will answer from the counter."));

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
    /* Sheet diagnostics are for whoever edits the sheet: open the page with
       ?debug=1 to see them, so a visitor never reads a shop-side note. */
    var want = new URLSearchParams(location.search).get("debug") === "1";
    var lines = (snapshot.notes || []).slice();
    if (want && snapshot.error) lines.unshift("Read failure: " + snapshot.error);
    if (want && snapshot.status === "unset") lines.unshift("No source set: fill catalog.csvUrl (or catalog.localFallback) in js/config.js.");
    if (want && snapshot.source) lines.push("Served by: " + snapshot.source.url + " (" + snapshot.source.kind + ")");
    if (!want || !lines.length) { box.hidden = true; box.textContent = ""; return; }
    box.hidden = false;
    box.textContent = "";
    box.appendChild(el("b", null, "Sheet notes for the owner (" + lines.length + ")"));
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
    var list = sorted(all.filter(matches));

    var count = byId("resultCount");
    if (count) count.textContent = list.length
      ? list.length + (list.length === 1 ? " item" : " items")
      : "0 items";

    var empty = byId("catalogEmpty");
    if (all.length && !list.length) {
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
    }

    var sort = byId("sortSelect");
    if (sort && !sort.dataset.wired) {
      sort.dataset.wired = "1";
      sort.addEventListener("change", function () {
        state.sort = sort.value || "featured";
        render();
      });
    }

    var refresh = byId("refreshBtn");
    if (refresh && !refresh.dataset.wired) {
      refresh.dataset.wired = "1";
      refresh.addEventListener("click", function () {
        refresh.disabled = true;
        refresh.textContent = "Refreshing…";
        C.refresh().then(function (snapshot) {
          refresh.disabled = false;
          refresh.textContent = "Refresh list";
          var ok = snapshot.status === "ready";
          if (typeof window.showToast === "function") {
            window.showToast(ok
              ? "List refreshed from the sheet."
              : "Could not refresh: " + (snapshot.error || "no answer from the sheet"), ok ? "success" : "error");
          }
        });
      });
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
   * Detail dialog - built with DOM calls, focus managed by hand
   * ------------------------------------------------------------------ */
  var FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";
  var lastFocused = null;

  function closeDialog() {
    var box = byId("productDialog");
    if (!box) return;
    box.hidden = true;
    box.textContent = "";
    document.body.classList.remove("dialog-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  }

  function dialogKeydown(event) {
    var box = byId("productDialog");
    if (!box || box.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
    if (event.key !== "Tab") return;
    var items = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function openDialog(product, list) {
    var box = byId("productDialog");
    if (!box || !product) return;
    lastFocused = document.activeElement;
    box.textContent = "";

    var panel = el("div", "dialog-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "dialogTitle");
    panel.setAttribute("tabindex", "-1");

    var head = el("div", "dialog-head");
    head.appendChild(el("span", "dialog-cat", product.categoryLabel || "Accessory"));
    var close = el("button", "dialog-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close details");
    close.addEventListener("click", closeDialog);
    head.appendChild(close);
    panel.appendChild(head);

    var body = el("div", "dialog-body");
    var figure = el("figure", "dialog-figure");
    var img = el("img", "dialog-photo");
    img.src = product.photo;
    img.alt = product.image ? product.name : product.name + " - category illustration";
    img.width = 760; img.height = 760; img.decoding = "async";
    if (product.image) img.setAttribute("data-fallback", U.photoSrc("accessories", "other"));
    figure.appendChild(img);
    if (!product.image) figure.appendChild(el("figcaption", null, "Category illustration - not a photo of this exact item"));
    body.appendChild(figure);

    var text = el("div", "dialog-text");
    var h = el("h2", null, product.name);
    h.id = "dialogTitle";
    text.appendChild(h);

    var fitment = [];
    if (product.brand) fitment.push(product.brand);
    if (product.model) fitment.push(product.model);
    if (fitment.length) text.appendChild(el("p", "dialog-fit", "Tagged for " + fitment.join(" · ")));

    text.appendChild(product.price
      ? el("p", "dialog-price", product.price + "  - confirm at the counter")
      : el("p", "dialog-price is-request", U.isSet(window.FIXON.priceNote) ? window.FIXON.priceNote : "Price on request"));

    if (product.description) text.appendChild(el("p", "dialog-desc", product.description));
    text.appendChild(el("p", "dialog-note",
      "This description comes from the shop's own list. Fit and stock are confirmed on WhatsApp or at the counter before any payment."));

    var actions = el("div", "dialog-actions");
    var waHref = U.whatsappUrl("product", {
      product: product.name + (fitment.length ? " (" + fitment.join(" · ") + ")" : "")
    });
    var wa = el("a", "btn btn-sm btn-whatsapp", "Ask on WhatsApp");
    if (waHref) { wa.href = waHref; wa.target = "_blank"; wa.rel = "noopener"; }
    else { wa.href = "#"; wa.classList.add("is-unconfigured"); wa.setAttribute("aria-disabled", "true"); }
    actions.appendChild(wa);
    if (product.link) {
      var more = el("a", "btn btn-sm btn-secondary", "Open the shop's page for it");
      more.href = product.link; more.target = "_blank"; more.rel = "noopener";
      actions.appendChild(more);
    }
    text.appendChild(actions);

    if (list && list.length > 1) {
      var nav = el("div", "dialog-pager");
      var index = list.findIndex(function (p) { return p.id === product.id; });
      var prev = el("button", "btn btn-sm btn-ghost", "Previous");
      prev.type = "button";
      prev.disabled = index <= 0;
      if (!prev.disabled) prev.addEventListener("click", function () { openDialog(list[index - 1], list); });
      var next = el("button", "btn btn-sm btn-ghost", "Next");
      next.type = "button";
      next.disabled = index === -1 || index >= list.length - 1;
      if (!next.disabled) next.addEventListener("click", function () { openDialog(list[index + 1], list); });
      nav.appendChild(prev);
      nav.appendChild(el("span", "dialog-count", (index + 1) + " of " + list.length));
      nav.appendChild(next);
      text.appendChild(nav);
    }

    body.appendChild(text);
    panel.appendChild(body);
    box.appendChild(panel);
    box.hidden = false;
    document.body.classList.add("dialog-open");
    panel.focus();
  }

  window.fixonProductModal = openDialog;

  function wireDialog() {
    var box = byId("productDialog");
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
      wireFilters();
      wireDialog();
    }
    buildFilters();
    paintState(snapshot);
    renderOwnerNotes(snapshot);
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
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

    var search = byId("searchInput");
    if (search && state.model) { search.value = state.model; state.query = state.model.toLowerCase(); }

    C.onReady(boot);
  });
})();
