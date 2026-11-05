/* ==========================================================================
   FIXON - order tray (every page)
   --------------------------------------------------------------------------
   What "buying" means on a site with no server: the visitor collects the items
   they want, and one button opens WhatsApp with the whole order typed out. FIXON
   confirms availability and the total, then payment happens at the counter or as
   agreed. There is no account, no card details and no checkout page, because
   there is nothing on the other end to receive them.

   HONESTY RULES, and why each one is here:
   - Nothing is submitted, reserved or stored on a server. The list lives in
     localStorage on this device only, and the panel says so in plain words,
     because a "cart" that implies a backend would be a lie.
   - No stock is claimed and no delivery is promised: the message asks.
   - A total never includes an item without a price. Unpriced items are counted
     and named separately so nobody reads a half-invented figure as a bill.
   - Names and prices come from the shop's own product list through
     js/catalog.js. Every one of those values is assigned with textContent, and
     no sheet text or visitor text is ever concatenated into innerHTML.
   - The visitor's own name, phone model and notes are NOT saved to the device:
     they exist only inside the message they are about to send.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var CFG = window.FIXON;
  var C = window.fixonCatalog;

  var KEY = "fixon_order_v1";
  var MAX_QTY = 99;
  var MAX_URL = 2400; /* WhatsApp takes more; some browsers and relayers do not */

  var built = false;

  /* ------------------------------------------------------------------ *
   * Storage. A blocked localStorage is normal in private modes, so the
   * tray keeps working in memory for this page view and says nothing.
   * ------------------------------------------------------------------ */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (row) {
        return row && typeof row.id === "string" && row.id;
      }).map(function (row) {
        return {
          id: row.id,
          name: String(row.name || ""),
          price: row.price ? String(row.price) : null,
          priceNumber: typeof row.priceNumber === "number" ? row.priceNumber : null,
          qty: clamp(Number(row.qty) || 1),
          detail: String(row.detail || "")
        };
      });
    } catch (e) { return []; }
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* in memory only */ }
  }

  var rows = read();

  function clamp(n) {
    n = Math.floor(Number(n) || 1);
    return n < 1 ? 1 : (n > MAX_QTY ? MAX_QTY : n);
  }

  function find(id) {
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Live view: a stored row keeps its quantity, but its name and price are
   * re-read from the shop list on every paint, so an edit in the sheet shows
   * up in the tray instead of a stale copy. A row the shop list is known to
   * have dropped is still listed - the visitor can see and clear it - but it
   * is labelled. While the list is still loading or a read failed, nothing is
   * claimed either way: an item is not "gone", it is simply unchecked.
   * ------------------------------------------------------------------ */
  function view() {
    var snap = C && typeof C.status === "function" ? C.status() : null;
    var checkable = !!snap && (snap.status === "ready" || snap.status === "cached");
    return rows.map(function (row) {
      var live = C && typeof C.get === "function" ? C.get(row.id) : null;
      return {
        id: row.id,
        name: live ? live.name : (row.name || "An item from the list"),
        price: live ? live.price : row.price,
        priceNumber: live ? live.priceNumber : row.priceNumber,
        detail: live ? [live.brand, live.model].filter(Boolean).join(" - ") : row.detail,
        qty: row.qty,
        listed: !!live || !checkable
      };
    });
  }

  function summary(list) {
    var priced = 0, unpriced = 0, total = 0, units = 0;
    list.forEach(function (item) {
      units += item.qty;
      if (item.priceNumber !== null && item.priceNumber !== undefined) {
        priced += 1;
        total += item.priceNumber * item.qty;
      } else unpriced += 1;
    });
    return {
      units: units,
      lines: list.length,
      priced: priced,
      unpriced: unpriced,
      total: priced ? Math.round(total * 100) / 100 : null
    };
  }

  /* ------------------------------------------------------------------ *
   * Mutations
   * ------------------------------------------------------------------ */
  function add(id, qty) {
    if (!id) return;
    var live = C ? C.get(id) : null;
    if (!live) {
      if (typeof window.showToast === "function") window.showToast("That item is not on the list right now - ask FIXON.", "warn");
      return;
    }
    var row = find(id);
    if (row) row.qty = clamp(row.qty + (qty || 1));
    else rows.push({
      id: id,
      name: live.name,
      price: live.price,
      priceNumber: live.priceNumber,
      qty: clamp(qty || 1),
      detail: [live.brand, live.model].filter(Boolean).join(" - ")
    });
    write(rows);
    paint();
    if (typeof window.showToast === "function") {
      var t = summary(view());
      window.showToast(t.units + (t.units === 1 ? " item on your order list" : " items on your order list"), "success");
    }
  }

  function setQty(id, qty) {
    var row = find(id);
    if (!row) return;
    var next = clamp(qty);
    if (qty <= 0) return remove(id);
    row.qty = next;
    write(rows);
    paint();
  }

  function remove(id) {
    rows = rows.filter(function (row) { return row.id !== id; });
    write(rows);
    paint();
  }

  function clearAll() {
    rows = [];
    write(rows);
    paint();
  }

  function countFor(id) {
    var row = find(id);
    return row ? row.qty : 0;
  }

  /* ------------------------------------------------------------------ *
   * The message. Built from the live list plus the three optional fields the
   * visitor types; nothing here is sent anywhere until they press the link.
   * ------------------------------------------------------------------ */
  function money(value) {
    return U.formatPrice(value);
  }

  function itemLines(list) {
    return list.map(function (item, i) {
      var line = (i + 1) + ". " + item.qty + " x " + item.name;
      if (item.price) line += " - " + money(item.priceNumber) + " each";
      else line += " - price not listed yet";
      if (item.detail) line += " (" + item.detail + ")";
      if (!item.listed) line += " [no longer on the online list]";
      return line;
    });
  }

  function priceLine(tally) {
    if (tally.total !== null && !tally.unpriced) {
      return "The listed prices add up to " + money(tally.total) +
        ". Please confirm the final total and how I should pay.";
    }
    if (tally.total !== null) {
      return "The listed prices add up to " + money(tally.total) + " for " + tally.priced +
        " item" + (tally.priced === 1 ? "" : "s") + ". " + tally.unpriced +
        " more item" + (tally.unpriced === 1 ? " has" : "s have") +
        " no price listed online, so please quote those with the total.";
    }
    return "None of these items show a price online yet, so please quote the total for me.";
  }

  function extrasText() {
    var out = [];
    var name = field("orderName");
    var device = field("orderDevice");
    var notes = field("orderNotes");
    if (name) out.push("Name: " + name);
    if (device) out.push("My phone: " + device);
    if (notes) out.push("Notes: " + notes);
    /* The trailing break belongs to the extras, so the closing sentence always
       starts on its own line whether they are filled in or not. */
    return out.length ? out.join("\n") + "\n" : "";
  }

  function field(id) {
    var node = document.getElementById(id);
    return node ? String(node.value || "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
  }

  /* WhatsApp's link form puts the text in a query parameter, so a very long
     order has to be shortened rather than silently truncated mid-item. */
  function orderHref() {
    var list = view();
    if (!list.length) return null;
    var href = U.whatsappUrl("order", {});
    if (!href) return null;

    var base = href.split("?text=")[0] + "?text=";
    var keep = list.length;
    var url;
    for (;;) {
      var shown = list.slice(0, keep);
      var lines = itemLines(shown);
      if (keep < list.length) lines.push("...and " + (list.length - keep) + " more item" + (list.length - keep === 1 ? "" : "s") + " on my list");
      var text = U.fill(CFG.messages.order, {
        shop: CFG.name,
        items: lines.join("\n"),
        priced: priceLine(summary(list)),
        extras: extrasText()
      });
      url = base + encodeURIComponent(text);
      if (url.length <= MAX_URL || keep <= 1) return url;
      keep -= 1;
    }
  }

  /* ------------------------------------------------------------------ *
   * Panel
   * ------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function panel() { return document.getElementById("orderDrawer"); }
  function button() { return document.getElementById("orderBtn"); }

  function buildPanel() {
    var host = panel();
    if (!host || built) return host;

    var head = el("div", "order-head");
    var title = el("h2", null, "Your order list");
    title.id = "orderTitle";
    head.appendChild(title);
    var close = el("button", "order-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close order list");
    close.addEventListener("click", closeDrawer);
    head.appendChild(close);
    host.appendChild(head);

    host.appendChild(el("p", "order-how",
      "Collect what you want here. Nothing is sent or booked until you press Send, which opens WhatsApp with this list typed out for FIXON."));

    var list = el("ul", "order-list");
    list.id = "orderLines";
    host.appendChild(list);

    var empty = el("p", "order-none", "Nothing on the list yet. Use Add to order on any product.");
    empty.id = "orderNone";
    host.appendChild(empty);

    var total = el("p", "order-total");
    total.id = "orderTotal";
    host.appendChild(total);

    var fields = el("div", "order-fields");
    [["orderName", "Your name (optional)", "text"],
     ["orderDevice", "Your phone model (optional)", "text"],
     ["orderNotes", "Anything else, e.g. colour or quantity (optional)", "text"]].forEach(function (spec) {
      var wrap = el("label", "order-field", spec[1]);
      var input = el("input");
      input.type = spec[2];
      input.id = spec[0];
      input.maxLength = 200;
      input.autocomplete = "off";
      wrap.appendChild(input);
      fields.appendChild(wrap);
    });
    host.appendChild(fields);

    var actions = el("div", "order-actions");
    var send = el("a", "btn btn-whatsapp", "Send order on WhatsApp");
    send.id = "orderSend";
    send.href = "#";
    actions.appendChild(send);
    var clear = el("button", "btn btn-sm btn-ghost", "Clear list");
    clear.type = "button";
    clear.id = "orderClear";
    actions.appendChild(clear);
    host.appendChild(actions);

    host.addEventListener("click", function (event) {
      var target = event.target.closest("[data-qty],[data-remove]");
      if (!target || !host.contains(target)) return;
      var id = target.getAttribute("data-id");
      if (target.hasAttribute("data-remove")) remove(id);
      else setQty(id, countFor(id) + Number(target.getAttribute("data-qty")));
    });

    var clearBtn = document.getElementById("orderClear");
    if (clearBtn) clearBtn.addEventListener("click", function () {
      clearAll();
      if (typeof window.showToast === "function") window.showToast("Order list cleared.", "success");
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !host.hidden) closeDrawer();
    });

    /* The three optional fields are visitor text, so they are only ever read
       into the message and never written back into the page. */
    built = true;
    return host;
  }

  function paint() {
    var host = buildPanel();
    if (!host) return;
    var list = view();
    var tally = summary(list);

    var btn = button();
    if (btn) {
      var badge = btn.querySelector(".order-count");
      if (badge) badge.textContent = tally.units;
      btn.classList.toggle("has-items", tally.units > 0);
      btn.setAttribute("aria-label", tally.units
        ? "Order list, " + tally.units + (tally.units === 1 ? " item" : " items")
        : "Order list, empty");
    }

    var lines = document.getElementById("orderLines");
    var none = document.getElementById("orderNone");
    if (lines) {
      lines.textContent = "";
      list.forEach(function (item) {
        var row = el("li", "order-row" + (item.listed ? "" : " is-stale"));

        var photo = el("img", "order-thumb");
        var live = C ? C.get(item.id) : null;
        photo.src = live ? live.photo : U.photoSrc("accessories", "other");
        photo.alt = "";
        photo.width = 96; photo.height = 96; photo.loading = "lazy"; photo.decoding = "async";
        row.appendChild(photo);

        var copy = el("div", "order-copy");
        copy.appendChild(el("b", null, item.name));
        var meta = [];
        if (item.price) meta.push(money(item.priceNumber) + " each");
        else meta.push("price not listed online");
        if (item.detail) meta.push(item.detail);
        copy.appendChild(el("small", null, meta.join(" - ")));
        if (!item.listed) copy.appendChild(el("small", "order-warn", "This one is no longer on the online list - ask FIXON about it."));
        row.appendChild(copy);

        var qty = el("div", "order-qty");
        qty.setAttribute("aria-label", "Quantity for " + item.name);
        var minus = el("button", "qty-btn", "-");
        minus.type = "button";
        minus.setAttribute("data-id", item.id);
        minus.setAttribute("data-qty", "-1");
        minus.setAttribute("aria-label", "One fewer " + item.name);
        var value = el("span", "qty-value", item.qty);
        var plus = el("button", "qty-btn", "+");
        plus.type = "button";
        plus.setAttribute("data-id", item.id);
        plus.setAttribute("data-qty", "1");
        plus.setAttribute("aria-label", "One more " + item.name);
        qty.appendChild(minus);
        qty.appendChild(value);
        qty.appendChild(plus);
        row.appendChild(qty);

        var drop = el("button", "qty-drop", "Remove");
        drop.type = "button";
        drop.setAttribute("data-id", item.id);
        drop.setAttribute("data-remove", "1");
        row.appendChild(drop);

        lines.appendChild(row);
      });
      if (none) none.hidden = list.length > 0;
      if (lines.hidden !== !list.length) lines.hidden = !list.length;
    }

    var total = document.getElementById("orderTotal");
    if (total) {
      total.textContent = "";
      if (!list.length) total.appendChild(el("span", null, "The list is empty."));
      else {
        total.appendChild(el("span", null, tally.lines + (tally.lines === 1 ? " item type" : " item types") +
          ", " + tally.units + " unit" + (tally.units === 1 ? "" : "s") + " - "));
        total.appendChild(el("b", null, tally.total !== null
          ? money(tally.total) + " at listed prices"
          : "prices to be quoted"));
        if (tally.unpriced) total.appendChild(el("small", null,
          tally.unpriced + " of these " + (tally.unpriced === 1 ? "item has" : "items have") +
          " no price online, so they are not in that figure."));
      }
    }

    var send = document.getElementById("orderSend");
    if (send) {
      var href = orderHref();
      if (href) {
        send.href = href;
        send.target = "_blank";
        send.rel = "noopener";
        send.classList.remove("is-unconfigured", "is-disabled");
        send.setAttribute("aria-disabled", "false");
      } else {
        send.href = "#";
        send.setAttribute("aria-disabled", "true");
        send.classList.add("is-unconfigured");
        send.title = list.length
          ? "FIXON.whatsappNumber is not set in js/config.js"
          : "Add something to the list first";
      }
    }
    var clearBtn = document.getElementById("orderClear");
    if (clearBtn) clearBtn.disabled = !list.length;

    document.dispatchEvent(new CustomEvent("fixon:order", { detail: tally }));
  }

  /* ------------------------------------------------------------------ *
   * Disclosure
   * ------------------------------------------------------------------ */
  function openDrawer() {
    var host = buildPanel();
    if (!host) return;
    host.hidden = false;
    host.classList.add("is-open");
    var btn = button();
    if (btn) btn.setAttribute("aria-expanded", "true");
    var first = host.querySelector(".order-close");
    if (first && typeof first.focus === "function") first.focus();
  }

  function closeDrawer() {
    var host = panel();
    if (!host) return;
    host.hidden = true;
    host.classList.remove("is-open");
    var btn = button();
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      if (typeof btn.focus === "function") btn.focus();
    }
  }

  function toggle() {
    var host = panel();
    if (!host) return;
    if (host.hidden) openDrawer(); else closeDrawer();
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function boot() {
    if (!button()) return;              /* page has no tray markup */
    buildPanel();
    button().addEventListener("click", toggle);
    paint();
    if (C && typeof C.onReady === "function") C.onReady(paint);
  }

  window.fixonOrder = {
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clearAll,
    countFor: countFor,
    units: function () { return summary(view()).units; },
    rows: view,
    summary: function () { return summary(view()); },
    href: orderHref,
    open: openDrawer,
    close: closeDrawer,
    toggle: toggle,
    paint: paint
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
