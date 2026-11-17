/* ==========================================================================
   FIXON - saved items
   --------------------------------------------------------------------------
   The heart on a product card keeps an item on THIS device so a visitor can
   come back to it. There is no account and no reservation: a saved item is a
   shortlist, and the shop is only told about it when something is sent on
   WhatsApp.

   Storage is a { productId: name } map rather than a snapshot of the row, so
   editing a price never leaves a stale figure in someone's list - the card
   re-reads everything live from js/catalog.js. Ids are the stable name slugs
   js/catalog.js builds, so a saved item keeps matching across edits and only
   stops matching when the shop deletes or hides the product.

   SAFETY: values are written with textContent and read back through the same
   map, so nothing a product name contains can ever become markup.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "fixon_wishlist_v1";
  var saved = load();

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      var out = {};
      Object.keys(data).forEach(function (id) {
        /* Only strings earn a place: a hand-edited entry must not smuggle an
           object into the cards that read this map back. */
        if (typeof id === "string" && id && typeof data[id] === "string") out[id] = data[id];
      });
      return out;
    } catch (e) { return {}; }
  }

  function write() {
    try { window.localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private mode: the list lives for this page view only */ }
  }

  function has(id) { return Object.prototype.hasOwnProperty.call(saved, id); }

  function count() { return Object.keys(saved).length; }

  function ids() { return Object.keys(saved); }

  function nameOf(id) { return saved[id] || ""; }

  function emit(id, nowSaved) {
    document.dispatchEvent(new CustomEvent("fixon:wishlist", {
      detail: { id: id, saved: nowSaved, count: count() }
    }));
  }

  function add(id, name) {
    if (!id || has(id)) return;
    saved[id] = String(name || "");
    write();
    paintHeader();
    emit(id, true);
  }

  function remove(id) {
    if (!has(id)) return;
    delete saved[id];
    write();
    paintHeader();
    emit(id, false);
  }

  function toggle(id, name) {
    if (has(id)) { remove(id); return false; }
    add(id, name);
    return true;
  }

  function clear() {
    saved = {};
    write();
    paintHeader();
    emit("", false);
  }

  /* ------------------------------------------------------------------ *
   * The header control: a link to the shop filtered to saved items, so
   * the list is readable with the drawer closed and shareable.
   * ------------------------------------------------------------------ */
  function headerBtn() { return document.getElementById("wishBtn"); }

  function paintHeader() {
    var btn = headerBtn();
    if (!btn) return;
    var badge = btn.querySelector(".wish-count");
    if (badge) badge.textContent = count();
    btn.classList.toggle("has-items", count() > 0);
    btn.setAttribute("aria-label", count()
      ? "Saved items, " + count() + (count() === 1 ? " item" : " items")
      : "Saved items, none saved yet");
  }

  /* ------------------------------------------------------------------ *
   * Hearts on cards. js/products.js calls this after every render, the
   * same way it calls the order-button sync.
   * ------------------------------------------------------------------ */
  function syncButtons(root) {
    var host = root || document;
    host.querySelectorAll("[data-wish]").forEach(function (button) {
      var id = button.getAttribute("data-wish");
      var on = has(id);
      button.classList.toggle("is-saved", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.textContent = on ? "♥" : "♡";
      var name = on ? nameOf(id) : button.getAttribute("data-name");
      button.setAttribute("aria-label", (on ? "Remove " : "Save ") + (name || "this item") +
        (on ? " from your saved list" : " to your saved list"));
      button.title = on ? "Saved on this device. Press to remove." : "Keep this on your device so you can find it again.";
    });
  }

  function bind(root) {
    var host = root || document;
    host.querySelectorAll("[data-wish]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-wish");
        var name = button.getAttribute("data-name");
        var nowSaved = toggle(id, name);
        if (typeof window.showToast === "function") {
          window.showToast(nowSaved
            ? "Saved " + (name || "item") + " on this device."
            : "Removed from your saved list.", "success");
        }
      });
    });
    syncButtons(host);
  }

  document.addEventListener("fixon:wishlist", function () { syncButtons(document); });

  paintHeader();

  window.fixonWishlist = {
    has: has, count: count, ids: ids, nameOf: nameOf,
    add: add, remove: remove, toggle: toggle, clear: clear,
    bind: bind, syncButtons: syncButtons, paintHeader: paintHeader
  };
})();
