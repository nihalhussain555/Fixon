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
   - A photo is described as attached only when it went into the share sheet as
     a file. Every other route sends the message with the photo's address and
     says plainly that the attachment has to happen by hand, because a link to
     a picture is not the picture.
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
        /* The category label and the listing's own photo are needed by the
           message, and "own photo" means the sheet cell: image is empty when
           the row has no picture, while photo falls back to a category
           illustration - which must never be sent as if it were the item. */
        category: live ? (live.categoryLabel || live.categoryRaw || "") : "",
        image: live ? (live.image || "") : "",
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
    /* Supabase tracks a quantity; 0 means sold out and the list stops it
       here too, not just at the product panel's buttons. */
    if (live.stockCount === 0) {
      if (typeof window.showToast === "function") window.showToast(live.name + " is out of stock, so it cannot go on the order list.", "warn");
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

  function priceLabel(item) {
    if (item.price) return item.price;
    return U.isSet(CFG.priceNote) ? CFG.priceNote : "Price on request";
  }

  /* One item, in the labelled shape a single product's own order message uses:
     the lines this listing can actually answer, in the same order every time.
     Fitment rides on the name line so a sheet carrying a brand or model still
     says so, and an item the shop list has dropped is labelled as one. */
  function itemBlock(item) {
    var lines = [];
    var name = item.name;
    if (item.detail) name += " (" + item.detail + ")";
    if (!item.listed) name += " [no longer on the online list]";
    lines.push("Product Name: " + name);
    lines.push("Price: " + priceLabel(item));
    if (item.category) lines.push("Category: " + item.category);
    lines.push("Quantity: " + item.qty + (item.qty === 1 ? " unit" : " units"));
    return lines.join("\n\n");
  }

  function absoluteAddress(src) {
    try { return new URL(src, location.href).href; } catch (e) { return src; }
  }

  /* The honesty line, and the reason it is a function rather than a sentence
     written at the call site: it must never say more than what actually went
     into the message. Empty when every photo really went with it; otherwise it
     names each item left without one and gives its address, and the closing
     half states either how many did attach or that none did. */
  function noteFor(missing, attached) {
    if (!missing.length) return "";
    var lines = missing.map(function (item) {
      var where = item.image ? absoluteAddress(item.image) : item.why;
      return "No photo for " + item.name + ": " + where;
    });
    var tail = attached
      ? "\n" + attached + (attached === 1 ? " photo is attached with this message" : " photos are attached with this message") +
        "; the ones above need attaching by hand."
      : "\nNo photo could be attached, so this message carries the addresses only -" +
        " each photo above needs attaching by hand.";
    return "\n\n" + lines.join("\n") + tail;
  }

  /* Items that have a picture of their own, so the note can name them all. */
  function photoWanted(list) {
    return list.filter(function (item) { return !!item.image; });
  }

  function photoMissing(list) {
    return list.filter(function (item) { return !item.image; }).map(function (item) {
      return {
        name: item.name,
        image: "",
        why: item.listed ? "this listing has no photo of its own yet"
                         : "this item is no longer on the online list"
      };
    });
  }

  /* The link is what a browser with no file sharing has to work with, so it
     carries the addresses of every photo up front rather than pretending. */
  function linkNote(list) {
    return noteFor(photoMissing(list).concat(
      photoWanted(list).map(function (item) {
        return { name: item.name, image: item.image, why: "" };
      })
    ), 0);
  }

  /* A one-off probe, because canShare is the only claim worth believing and it
     needs a file to be asked about. */
  function fileSharePossible() {
    var S = window.fixonShare;
    if (!S || !S.supported() || typeof File !== "function") return false;
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File([""], "probe.jpg", { type: "image/jpeg" })] }));
    } catch (e) { return false; }
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

  /* The whole message: {items} is one labelled block per item, and a list too
     long for the link is shortened whole item by whole item rather than cut in
     the middle of one. */
  function orderText(list, shown, note) {
    var blocks = list.slice(0, shown).map(itemBlock);
    if (shown < list.length) {
      blocks.push("...and " + (list.length - shown) + " more item" +
        (list.length - shown === 1 ? "" : "s") + " on my list");
    }
    return U.message("order", {
      lead: list.length === 1 ? "this product." : "these products.",
      items: blocks.join("\n\n"),
      priced: priceLine(summary(list)),
      extras: extrasText(),
      photo: note || ""
    });
  }

  /* WhatsApp's link form puts the text in a query parameter, so a very long
     order has to be shortened rather than silently truncated mid-item. */
  function orderHref(list, note) {
    list = list || view();
    if (!list.length) return null;
    var base = U.whatsappUrl("order", {});
    if (!base) return null;
    base = base.split("?text=")[0] + "?text=";

    var keep = list.length;
    var url;
    for (;;) {
      url = base + encodeURIComponent(orderText(list, keep, note));
      if (url.length <= MAX_URL || keep <= 1) return url;
      keep -= 1;
    }
  }

  /* ------------------------------------------------------------------ *
   * Sending the list with its photos
   * ------------------------------------------------------------------ *
   * A wa.me link carries text and addresses, never a picture, so the share
   * sheet is the only route that hands FIXON the real images. It is attempted
   * only when this browser admits files, and every outcome that does not end
   * with photos actually going through falls back to the link with the address
   * of each photo in the text. Nothing here describes a photo as attached
   * unless it went into the sheet as a file.
   * ------------------------------------------------------------------ */
  function release(send, S) {
    setBusy(send, false);
    S.release();
  }

  function setBusy(send, on) {
    if (on) {
      send.dataset.label = send.textContent;
      send.classList.add("is-busy");
      send.setAttribute("aria-disabled", "true");
      send.textContent = "Attaching photos...";
      return;
    }
    send.classList.remove("is-busy");
    send.removeAttribute("aria-disabled");
    if (send.dataset.label) {
      send.textContent = send.dataset.label;
      delete send.dataset.label;
    }
  }

  function toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type);
  }

  /* The link path. A new tab while the browser still counts this as coming from
     the tap, and the same tab when it does not - by this point the activation
     may well have expired, and a plain navigation is the one thing a popup
     blocker leaves alone. */
  function openLink(href) {
    var win = window.open(href, "_blank", "noopener");
    if (!win) location.href = href;
  }

  function fallbackToSend(send, list, reason) {
    var href = orderHref(list, linkNote(list));
    if (!href) {
      toast("FIXON's WhatsApp number is not set in js/config.js, so this order cannot be sent from the site yet.", "error");
      return;
    }
    send.href = href;
    toast(reason + " Your list can still go to FIXON - the message carries the address of" +
      " every photo, and they need attaching by hand.", "warn");
    openLink(href);
  }

  function sendWithPhotos(send) {
    var S = window.fixonShare;
    var list = view();
    if (!S || !list.length) return;

    /* One message cannot hold an arbitrary number of attachments, so the photos
       past the cap are named in the text with their addresses rather than
       silently dropped. */
    var wanted = photoWanted(list);
    var take = wanted.slice(0, S.MAX_PHOTOS);
    var missing = photoMissing(list);
    wanted.slice(S.MAX_PHOTOS).forEach(function (item) {
      missing.push({
        name: item.name, image: item.image,
        why: "one message cannot carry more than " + S.MAX_PHOTOS + " photos"
      });
    });

    if (!S.claim()) return;                     /* a send is already running */
    setBusy(send, true);

    /* Each fetch keeps its own outcome, so one listing with a blocked photo
       does not cost the visitor the pictures of the others. */
    Promise.all(take.map(function (item) {
      return S.fileFor(item).then(
        function (file) { return { item: item, file: file }; },
        function (err) { return { item: item, reason: err && err.reason }; }
      );
    })).then(function (results) {
      var files = [];
      results.forEach(function (r) {
        if (r.file) files.push(r.file);
        else missing.push({ name: r.item.name, image: r.item.image, why: r.reason || "the photo could not be read" });
      });

      if (!files.length) {
        release(send, S);
        fallbackToSend(send, list, "None of these photos could be attached.");
        return;
      }

      return S.share({
        title: CFG.name + " order",
        text: orderText(list, list.length, noteFor(missing, files.length)),
        files: files
      }).then(function () {
        release(send, S);
        /* Only a share that resolved is allowed to be described as carrying
           the photos. */
        toast(files.length + (files.length === 1 ? " photo" : " photos") +
          " and your list handed to the share sheet.", "success");
        /* The plain link the anchor still holds was built before this browser
           proved it takes files, so it is rebuilt now that the two say the
           same thing. */
        paint();
      }, function (err) {
        release(send, S);
        if (err && err.name === "AbortError") return;      /* they dismissed it */
        fallbackToSend(send, list, (err && err.reason) ? err.reason : "The photos could not be attached.");
      });
    }, function () {
      release(send, S);
      fallbackToSend(send, list, "The photos could not be read.");
    });
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
      "Collect what you want here. Nothing is sent or booked until you press Send, which opens " +
      "WhatsApp with this list typed out for FIXON - and, on a browser that allows it, the product " +
      "photos attached as real pictures rather than as links."));

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
    /* The link is the whole feature on a browser that will not take files, and
       the attempt at a real photo send on one that will. Looking the module up
       on the tap rather than at start-up is deliberate: js/app.js, where it
       lives, is the file the page loads after this one. */
    send.addEventListener("click", function (event) {
      var href = send.getAttribute("href");
      if (!href || href === "#") return;
      if (send.getAttribute("aria-disabled") === "true") { event.preventDefault(); return; }
      /* A modified or non-primary click means they want the link itself - a new
         tab, a save - so it is left alone rather than intercepted. */
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (!fileSharePossible()) return;
      event.preventDefault();
      sendWithPhotos(send);
    });
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
      /* A browser that takes files gets the clean message, because the photos
         go with it as real attachments. One that does not gets the addresses
         and the instruction to attach them, which is the honest version of the
         same order rather than a claim. */
      var canAttach = fileSharePossible();
      var href = orderHref(list, canAttach ? "" : linkNote(list));
      if (href) {
        send.href = href;
        send.target = "_blank";
        send.rel = "noopener";
        send.title = canAttach
          ? "Sends this list to FIXON on WhatsApp with these products' photos attached"
          : "Opens WhatsApp with this list and the address of each photo. This browser cannot attach the photos, so they need adding by hand.";
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
