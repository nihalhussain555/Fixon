/* ==========================================================================
   FIXON - shared behaviour
   Requires js/config.js (loaded first). Nothing here hard-codes a phone
   number, address or message: those all come from window.FIXON.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var CFG = window.FIXON;
  var CART_KEY = "fixon_cart";
  var UNSET_LABEL = "Not set - edit js/config.js";

  /* ------------------------------------------------------------------ *
   * Cart (localStorage) - public API reused by products.js / cart.js
   * ------------------------------------------------------------------ */
  function getCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) { /* storage unavailable: cart simply won't persist */ }
    updateCartCount();
  }

  function updateCartCount() {
    var n = getCart().reduce(function (s, i) { return s + (i.qty || 0); }, 0);
    document.querySelectorAll("#cartCount").forEach(function (el) { el.textContent = n; });
  }

  function addToCart(id) {
    if (typeof products === "undefined") return;
    var p = products.find(function (x) { return x.id === id; });
    if (!p) return;
    var cart = getCart();
    var hit = cart.find(function (x) { return x.id === id; });
    if (hit) hit.qty += 1;
    else cart.push({ id: p.id, name: p.name, brand: p.brand, model: p.model, category: p.category, qty: 1 });
    saveCart(cart);
    showToast(p.name + " added to cart", "success");
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */
  var toastTimer;
  function showToast(msg, type) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (type ? " is-" + type : "");
    t.setAttribute("role", type === "error" || type === "warn" ? "alert" : "status");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  /* ------------------------------------------------------------------ *
   * Config-driven links
   * ------------------------------------------------------------------ */
  function valueAt(path) {
    return path.split(".").reduce(function (obj, key) {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, CFG);
  }

  /* Marks an element that depends on an unconfigured value: it stays visible
     so the owner knows what to fill in, but it cannot navigate anywhere. */
  function disable(el, reason) {
    el.classList.add("is-unconfigured");
    el.setAttribute("aria-disabled", "true");
    el.dataset.unconfigured = reason;
    el.title = reason;
    if (el.tagName === "A") el.setAttribute("href", "#");
    else el.setAttribute("tabindex", "0");
  }

  function link(el, href) {
    el.classList.remove("is-unconfigured", "is-disabled");
    el.removeAttribute("aria-disabled");
    el.removeAttribute("title");
    delete el.dataset.unconfigured;
    el.href = href;
    if (/^https?:/.test(href)) {
      el.target = "_blank";
      el.rel = "noopener";
    }
  }

  function wireDisabled() {
    document.addEventListener("click", function (e) {
      var el = e.target.closest(".is-unconfigured");
      if (!el) return;
      e.preventDefault();
      showToast(UNSET_LABEL, "warn");
    });
  }

  function hydrate() {
    /* Plain values */
    document.querySelectorAll("[data-fixon-text]").forEach(function (el) {
      var raw = valueAt(el.dataset.fixonText);
      var label = raw;
      if (Array.isArray(raw)) label = raw.join(", ");
      if (!U.isSet(typeof raw === "string" ? raw : "")) label = el.dataset.fixonFallbackText || UNSET_LABEL;
      el.textContent = label;
    });

    /* Call */
    document.querySelectorAll("[data-fixon-tel]").forEach(function (el) {
      var href = U.telUrl();
      if (href) link(el, href);
      else disable(el, "FIXON.phoneDial is not set in js/config.js");
    });

    /* WhatsApp (message key + optional data-fixon-token-* placeholders) */
    document.querySelectorAll("[data-fixon-wa]").forEach(function (el) {
      var tokens = {};
      Object.keys(el.dataset).forEach(function (key) {
        if (key.indexOf("fixonToken") !== 0 || key === "fixonToken") return;
        var name = key.slice("fixonToken".length);
        tokens[name.charAt(0).toLowerCase() + name.slice(1)] = el.dataset[key];
      });
      var href = U.whatsappUrl(el.dataset.fixonWa, tokens);
      if (href) link(el, href);
      else disable(el, "FIXON.whatsappNumber is not set in js/config.js");
    });

    /* Mail */
    document.querySelectorAll("[data-fixon-email]").forEach(function (el) {
      if (U.isSet(CFG.email)) link(el, "mailto:" + CFG.email);
      else disable(el, "FIXON.email is not set in js/config.js");
    });

    /* Maps */
    document.querySelectorAll("[data-fixon-maps]").forEach(function (el) {
      var href = U.mapsSearchUrl();
      if (href) link(el, href);
      else disable(el, "FIXON.mapsQuery is not set in js/config.js");
    });

    /* Multi-line blocks */
    var addr = document.querySelectorAll("[data-fixon-address]");
    if (addr.length) {
      var lines = U.addressLines();
      addr.forEach(function (el) {
        el.textContent = lines.length ? lines.join(", ") : "Add FIXON.addressLine in js/config.js to show the shop address.";
      });
    }

    var hours = document.querySelectorAll("[data-fixon-hours]");
    if (hours.length) {
      var rows = U.hoursText();
      hours.forEach(function (el) {
        el.innerHTML = rows
          ? rows.map(function (r) {
              return "<p><span>" + r.days + "</span><b>" + r.time + "</b></p>";
            }).join("")
          : "<p>Opening hours not set - edit js/config.js</p>";
      });
    }

    document.querySelectorAll("[data-fixon-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ------------------------------------------------------------------ *
   * Theme toggle (theme.js already set the initial value)
   * ------------------------------------------------------------------ */
  function initThemeButton() {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    var sync = function () {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      btn.textContent = light ? "☾" : "☼";
      btn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("title", btn.getAttribute("aria-label"));
    };
    sync();
    btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next;
      try { localStorage.setItem("fixon_theme", next); } catch (e) {}
      sync();
    });
  }

  /* ------------------------------------------------------------------ *
   * Mobile drawer navigation
   * ------------------------------------------------------------------ */
  function initNav() {
    var btn = document.getElementById("menuBtn");
    var nav = document.querySelector(".nav");
    var scrim = document.querySelector(".nav-scrim");
    if (!btn || !nav) return;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (scrim) scrim.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    }

    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    if (scrim) scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        btn.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 720 && nav.classList.contains("is-open")) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------ *
   * Scroll: header state + back to top (single rAF-throttled listener)
   * ------------------------------------------------------------------ */
  function initScrollUI() {
    var header = document.querySelector(".header");
    var top = document.querySelector(".back-top");
    var ticking = false;

    function apply() {
      var y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle("is-scrolled", y > 8);
      if (top) {
        top.classList.toggle("is-visible", y > 600);
        top.setAttribute("aria-hidden", String(y <= 600));
      }
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();

    if (top) {
      top.addEventListener("click", function () {
        var reduce = document.documentElement.getAttribute("data-motion") === "reduced";
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        var first = document.querySelector("main a, main button");
        if (first) first.focus({ preventScroll: true });
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Reveal on scroll + fill-in animations
   * ------------------------------------------------------------------ */
  function initReveal() {
    var items = document.querySelectorAll(".reveal, .timeline-step");
    if (!items.length) return;
    if (document.documentElement.getAttribute("data-motion") === "reduced" || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ *
   * FAQ accordion
   * ------------------------------------------------------------------ */
  function initFaq() {
    var faqs = document.querySelectorAll(".faq-item");
    if (!faqs.length) return;
    faqs.forEach(function (item) {
      var q = item.querySelector(".faq-q");
      var a = item.querySelector(".faq-a");
      if (!q || !a) return;
      if (!a.id) a.id = "faq-" + Math.random().toString(36).slice(2, 8);
      q.setAttribute("aria-expanded", "false");
      q.setAttribute("aria-controls", a.id);
      a.setAttribute("role", "region");
      q.addEventListener("click", function () {
        var open = q.getAttribute("aria-expanded") === "true";
        faqs.forEach(function (other) {
          var oq = other.querySelector(".faq-q");
          if (oq) { oq.setAttribute("aria-expanded", "false"); other.classList.remove("is-open"); }
        });
        if (!open) { q.setAttribute("aria-expanded", "true"); item.classList.add("is-open"); }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Google Maps: keyless embed, loaded only when scrolled into view
   * ------------------------------------------------------------------ */
  function initMap() {
    var wrap = document.querySelector("[data-map]");
    if (!wrap) return;
    var url = U.mapsEmbedUrl();
    var frame = wrap.querySelector("iframe");
    var fallback = wrap.querySelector("[data-map-fallback]");

    if (!url) {
      if (frame) frame.closest(".map-frame").classList.add("is-hidden");
      if (fallback) fallback.hidden = false;
      return;
    }
    if (fallback) fallback.hidden = true;
    if (!frame) return;

    var reveal = function () {
      frame.src = url;
      frame.addEventListener("load", function () { frame.classList.add("is-loaded"); });
    };
    if (!("IntersectionObserver" in window)) { reveal(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { reveal(); io.disconnect(); }
    }, { rootMargin: "240px" });
    io.observe(wrap);
  }

  /* ------------------------------------------------------------------ *
   * Before/after comparison slider
   * Real FIXON work photos only: a card keeps its labelled "photo pending"
   * slot until BOTH files load, so a missing photo can never appear as a
   * broken image and no repair result is ever invented.
   * ------------------------------------------------------------------ */
  var BA_DIR = "images/before-after/";

  function buildSlider(view, card, files) {
    /* data-ba-alt names the work in plain phrase form, so the two alts read
       naturally instead of pasting the card headline into both. */
    var subject = card.getAttribute("data-ba-alt") ||
      (card.querySelector(".ba-title") || {}).textContent || "this repair";
    view.setAttribute("aria-label", subject + ": before and after comparison");
    view.innerHTML =
      '<img class="ba-shot" src="' + files[1] + '" width="1200" height="900" loading="lazy" decoding="async" alt="' + subject + ', after the work">' +
      '<img class="ba-shot ba-shot-before" src="' + files[0] + '" width="1200" height="900" loading="lazy" decoding="async" alt="' + subject + ', before the work">' +
      '<span class="ba-tag ba-tag-before" aria-hidden="true">Before</span>' +
      '<span class="ba-tag ba-tag-after" aria-hidden="true">After</span>' +
      '<div class="ba-handle" role="slider" tabindex="0" aria-label="Reveal before or after" ' +
        'aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">' +
        '<span class="ba-knob" aria-hidden="true">&#8596;</span></div>';
    view.classList.add("is-live");

    var handle = view.querySelector(".ba-handle");
    function setPos(pct) {
      pct = Math.max(0, Math.min(100, pct));
      view.style.setProperty("--ba-pos", pct + "%");
      handle.setAttribute("aria-valuenow", String(Math.round(pct)));
    }

    var dragging = false;
    function fromEvent(e) {
      var r = view.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    }
    view.addEventListener("pointerdown", function (e) {
      dragging = true;
      view.setPointerCapture(e.pointerId);
      setPos(fromEvent(e));
      e.preventDefault();
    });
    view.addEventListener("pointermove", function (e) { if (dragging) setPos(fromEvent(e)); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (evt) {
      view.addEventListener(evt, function () { dragging = false; });
    });

    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 20 : 5;
      var cur = parseFloat(handle.getAttribute("aria-valuenow"));
      var moves = { ArrowLeft: cur - step, ArrowDown: cur - step, ArrowRight: cur + step, ArrowUp: cur + step, Home: 0, End: 100 };
      if (moves[e.key] === undefined) return;
      e.preventDefault();
      setPos(moves[e.key]);
    });
  }

  function initBeforeAfter() {
    document.querySelectorAll("[data-ba]").forEach(function (card) {
      var view = card.querySelector(".ba-view");
      if (!view || view.querySelector(".ba-shot")) return;
      var files = [BA_DIR + card.getAttribute("data-ba") + "-before.jpg",
                   BA_DIR + card.getAttribute("data-ba") + "-after.jpg"];
      var ready = 0;
      files.forEach(function (src) {
        var probe = new Image();
        probe.onload = function () {
          ready += 1;
          if (ready === files.length) buildSlider(view, card, files);
        };
        probe.onerror = function () { /* the labelled slot already says what is needed */ };
        probe.src = src;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Structured data - built from configured values only, never invented
   * ------------------------------------------------------------------ */
  function injectStructuredData() {
    var ld = document.querySelector("script[data-structured-data]");
    if (!ld) return;
    var data = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: CFG.name,
      description: CFG.heroSupport,
      "@id": "https://" + location.hostname + "/#fixon",
      url: location.origin + location.pathname
    };
    if (U.isSet(CFG.phoneDial)) data.telephone = "+" + CFG.phoneDial.replace(/[^\d]/g, "");
    if (U.isSet(CFG.email)) data.email = CFG.email;
    if (U.addressLines().length) {
      data.address = {
        "@type": "PostalAddress",
        streetAddress: U.isSet(CFG.addressLine) ? CFG.addressLine : undefined,
        addressLocality: U.isSet(CFG.addressCity) ? CFG.addressCity : undefined,
        addressRegion: U.isSet(CFG.addressRegion) ? CFG.addressRegion : undefined,
        postalCode: U.isSet(CFG.addressPostalCode) ? CFG.addressPostalCode : undefined,
        addressCountry: U.isSet(CFG.addressCountry) ? CFG.addressCountry : undefined
      };
      Object.keys(data.address).forEach(function (k) { if (data.address[k] === undefined) delete data.address[k]; });
    }
    /* Human-readable opening-hour rows are not valid schema OpeningHours, so
       they stay in the contact card. Emitting a guessed 09:00-20:00 range
       would be inventing business data. */
    var map = U.mapsSearchUrl();
    if (map) data.hasMap = map;
    if (U.isSet(CFG.addressCity)) data.areaServed = { "@type": "City", name: CFG.addressCity };
    ld.textContent = JSON.stringify(data, null, 2);
  }

  /* ------------------------------------------------------------------ *
   * Shop grid: search / brand filter / sort
   * ------------------------------------------------------------------ */
  function initShop() {
    var grid = document.getElementById("productGrid");
    if (!grid || typeof products === "undefined") return;
    var current = "All";

    function render() {
      var q = (document.getElementById("searchInput") || {}).value || "";
      q = q.toLowerCase().trim();
      var list = products.filter(function (p) {
        var matchCat = current === "All" || p.category === current || p.brand === current;
        var haystack = (p.name + " " + p.brand + " " + p.model + " " + p.category + " " + (p.tags || []).join(" ")).toLowerCase();
        return matchCat && (!q || haystack.indexOf(q) !== -1);
      });
      var sort = (document.getElementById("sortSelect") || {}).value;
      if (sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      var count = document.getElementById("resultCount");
      if (count) count.textContent = list.length + (list.length === 1 ? " item" : " items");
      renderProducts(list, "productGrid");
    }

    document.querySelectorAll(".filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".filter").forEach(function (x) { x.classList.remove("active"); });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        document.querySelectorAll(".filter").forEach(function (x) { if (x !== btn) x.setAttribute("aria-pressed", "false"); });
        current = btn.dataset.filter;
        render();
      });
    });
    var search = document.getElementById("searchInput");
    if (search) search.addEventListener("input", render);
    var select = document.getElementById("sortSelect");
    if (select) select.addEventListener("change", render);
    render();
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".mobile-bar")) document.body.classList.add("has-bar");
    updateCartCount();
    hydrate();
    initThemeButton();
    initNav();
    initScrollUI();
    initFaq();
    initMap();
    initShop();
    initBeforeAfter();
    injectStructuredData();
    initReveal();
    wireDisabled();

    if (document.getElementById("featuredProducts") && typeof renderProducts === "function") {
      renderProducts(products.slice(0, 3), "featuredProducts");
    }
    /* Quick-service shortcuts + wizard chips are generated from config */
    document.dispatchEvent(new CustomEvent("fixon:ready"));
  });

  window.fixonHydrate = hydrate;
  window.fixonUtils.hydrate = hydrate;
  window.fixonCart = {
    get: getCart, save: saveCart, add: addToCart, count: updateCartCount,
    /* Order text for the WhatsApp handoff - no fake totals, just the list */
    describe: function () {
      return getCart().map(function (i) {
        return "- " + i.name + " (" + i.model + ") x" + i.qty;
      }).join("\n");
    },
    clear: function () { saveCart([]); }
  };
  window.showToast = showToast;
  window.addToCart = addToCart; /* used by the product cards rendered in products.js */
})();
