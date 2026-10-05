/* ==========================================================================
   FIXON - product catalogue (SAMPLE DATA)
   --------------------------------------------------------------------------
   These entries are placeholders that describe the *shape* of a real listing.
   Nothing here is a confirmed stock item, price, review score or discount -
   replace this array with real data, or feed it from a backend/API later.
   Cards therefore show "Price on request" and route the enquiry to WhatsApp.

   PHOTOS: each card shows images/covers/<category slug>.jpg. Those files are
   illustrative renders, not your stock. Drop a real photo over any of them
   using the same filename and it appears everywhere with no code change.
   ========================================================================== */
var products = [
  { id: 1, name: "Clear Armor Case", brand: "iPhone", model: "iPhone 15 / 16 series", category: "Clear" },
  { id: 2, name: "Shockproof Dual-Layer Case", brand: "Samsung", model: "Galaxy S24 / S25 series", category: "Shockproof" },
  { id: 3, name: "Silicone Soft-Touch Case", brand: "OnePlus", model: "OnePlus 12 / 13", category: "Silicone" },
  { id: 4, name: "MagSafe-Compatible Case", brand: "iPhone", model: "iPhone 13 / 14 series", category: "MagSafe" },
  { id: 5, name: "Matte Minimal Case", brand: "Pixel", model: "Pixel 8 / 9", category: "Minimal" },
  { id: 6, name: "Printed Everyday Case", brand: "Xiaomi", model: "Redmi / Note series", category: "Printed" }
];

/* images/covers/ is keyed by style name so one photo serves the shop card,
   the showcase tile and the enquiry list. */
function coverPhoto(style) {
  return "images/covers/" + String(style).toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".jpg";
}

function productCard(p) {
  return '<article class="product-card reveal">' +
    '<div class="product-visual">' +
      '<span class="product-tag">' + p.category + "</span>" +
      '<img class="product-photo" src="' + coverPhoto(p.category) + '" width="760" height="1013" loading="lazy" decoding="async" alt="' + p.category + ' phone cover, illustrative product render">' +
      '<span class="photo-note">Illustrative render</span>' +
    "</div>" +
    '<div class="product-info">' +
      "<small>" + p.brand + " · " + p.model + "</small>" +
      "<h3>" + p.name + "</h3>" +
      '<p class="price-on-request">Price on request</p>' +
      '<button class="add-btn" data-add="' + p.id + '">Add to enquiry <span>+</span></button>' +
      '<a class="btn btn-sm btn-whatsapp" data-product-wa="' + p.id + '" href="#">Ask on WhatsApp</a>' +
    "</div>" +
  "</article>";
}

function renderProducts(list, targetId) {
  var el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(productCard).join("")
    : '<div class="empty-state"><i>⌕</i><h3>Nothing matches yet</h3><p>Try another search or category.</p></div>';
  /* Re-bind after render: observers + dynamic links */
  if (typeof fixonBindProducts === "function") fixonBindProducts(list, el);
}

/* Wiring for the cards just rendered above. Kept here so the markup and its
   behaviour stay together. */
function fixonBindProducts(list, container) {
  var U = window.fixonUtils, CFG = window.FIXON;
  container.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () { addToCart(Number(btn.dataset.add)); });
  });
  container.querySelectorAll("[data-product-wa]").forEach(function (link) {
    var p = list.find(function (x) { return x.id === Number(link.dataset.productWa); });
    var href = U.whatsappUrl("cover", { product: p.name, model: p.model, category: p.category });
    if (href) {
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
    } else {
      link.classList.add("is-unconfigured");
      link.setAttribute("aria-disabled", "true");
      link.title = "FIXON.whatsappNumber is not set in js/config.js";
      link.setAttribute("href", "#");
    }
  });
  /* Newly added cards should animate in like the rest of the page */
  if (document.documentElement.getAttribute("data-motion") !== "reduced" && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: .1 });
    container.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    container.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }
}
