/* ==========================================================================
   FIXON - enquiry cart
   This project has no payment gateway, no delivery fees and no price list,
   so the cart is an enquiry list: quantities are tracked locally and the
   order is handed to WhatsApp for a real quote. Nothing pretends to check out.
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("fixon:ready", function () {
    var box = document.getElementById("cartItems");
    if (!box) return;

    render();
    document.getElementById("clearCartBtn")?.addEventListener("click", function () {
      window.fixonCart.clear();
      render();
      window.showToast("Enquiry list cleared");
    });
  });

  function render() {
    var box = document.getElementById("cartItems");
    var items = window.fixonCart.get();

    if (!items.length) {
      box.innerHTML = '<div class="empty-cart"><i>🛍</i><h2>Your enquiry list is empty</h2>' +
        "<p>Add the covers you want to ask about, then send the list to FIXON.</p>" +
        '<a class="btn btn-primary" href="accessories.html">Browse accessories</a></div>';
    } else {
      box.innerHTML = items.map(function (i) {
        return '<div class="cart-item">' +
          '<img class="cart-thumb" src="' + coverPhoto(i.category) + '" width="760" height="1013" loading="lazy" decoding="async" alt="' + i.name + '">' +
          '<div class="cart-details"><small>' + i.brand + " · " + i.model + "</small>" +
          "<h3>" + i.name + "</h3>" +
          '<p class="price-on-request">Price on request</p></div>' +
          '<div class="qty">' +
          '<button type="button" data-dec="' + i.id + '" aria-label="Decrease quantity of ' + i.name + '">−</button>' +
          "<span>" + i.qty + "</span>" +
          '<button type="button" data-inc="' + i.id + '" aria-label="Increase quantity of ' + i.name + '">+</button>' +
          "</div>" +
          '<button type="button" class="remove" data-del="' + i.id + '" aria-label="Remove ' + i.name + " from the enquiry list\">×</button>" +
          "</div>";
      }).join("");
      box.querySelectorAll("[data-inc]").forEach(function (b) { b.addEventListener("click", function () { changeQty(Number(b.dataset.inc), 1); }); });
      box.querySelectorAll("[data-dec]").forEach(function (b) { b.addEventListener("click", function () { changeQty(Number(b.dataset.dec), -1); }); });
      box.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { removeItem(Number(b.dataset.del)); }); });
    }

    var count = items.reduce(function (s, i) { return s + i.qty; }, 0);
    var qtyOut = document.getElementById("itemCount");
    if (qtyOut) qtyOut.textContent = count + (count === 1 ? " item" : " items");
    var priceOut = document.getElementById("priceNote");
    if (priceOut) priceOut.textContent = count ? "Quoted by FIXON" : "Add an item to ask";

    var wa = document.getElementById("cartWhatsBtn");
    if (wa) {
      if (!count) {
        wa.classList.add("is-disabled");
        wa.setAttribute("aria-disabled", "true");
        wa.setAttribute("href", "#");
      } else {
        wa.classList.remove("is-disabled");
        wa.removeAttribute("aria-disabled");
        var url = window.fixonUtils.whatsappUrl("cart", { items: window.fixonCart.describe() });
        if (url) {
          wa.href = url;
          wa.target = "_blank";
          wa.rel = "noopener";
        } else {
          wa.setAttribute("href", "#");
          wa.classList.add("is-unconfigured");
          wa.title = "FIXON.whatsappNumber is not set in js/config.js";
        }
      }
    }
  }

  function changeQty(id, delta) {
    var items = window.fixonCart.get();
    var hit = items.find(function (x) { return x.id === id; });
    if (!hit) return;
    hit.qty += delta;
    if (hit.qty <= 0) items.splice(items.indexOf(hit), 1);
    window.fixonCart.save(items);
    render();
  }

  function removeItem(id) {
    window.fixonCart.save(window.fixonCart.get().filter(function (x) { return x.id !== id; }));
    render();
    window.showToast("Item removed from your enquiry list");
  }
})();
