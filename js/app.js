/* ==========================================================================
   FIXON - shared behaviour
   Requires js/config.js (loaded first). Nothing here hard-codes a phone
   number, address or message: those all come from window.FIXON.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;
  var CFG = window.FIXON;
  var UNSET_LABEL = "Not set - edit js/config.js";

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
      /* The glyph names the theme you are looking at, not the one you are
       * about to get: sun in the light storefront, moon in the dark one. */
      btn.textContent = light ? "☼" : "☾";
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
   * Home banner slider - slides come from FIXON.banners. Autoplay stops for
   * reduced motion, while the tab is hidden, and while a visitor is reading
   * or tabbing through a slide, so nothing moves out from under them.
   * ------------------------------------------------------------------ */
  function initBanners() {
    var root = document.getElementById("bannerSlider");
    if (!root || !CFG.banners || !CFG.banners.length) return;

    root.innerHTML =
      '<div class="banner-track">' +
        CFG.banners.map(function (b, i) {
          return '<div class="banner" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + " of " + CFG.banners.length + ': ' + b.title + '">' +
            '<img class="banner-photo" src="' + U.photoSrc("banners", b.id) + '"' +
              ' data-fallback="' + U.photoSrc("banners", "generic") + '"' +
              ' width="1600" height="700" loading="' + (i ? "lazy" : "eager") + '" decoding="async" alt="">' +
            '<div class="banner-copy"><span class="eyebrow">' + b.kicker + "</span>" +
              "<h3>" + b.title + "</h3><p>" + b.text + "</p>" +
              '<a class="btn btn-primary" href="' + b.href + '">' + b.cta + "</a></div>" +
          "</div>";
        }).join("") +
      "</div>" +
      '<button class="banner-nav prev" type="button" aria-label="Previous banner">‹</button>' +
      '<button class="banner-nav next" type="button" aria-label="Next banner">›</button>' +
      '<div class="banner-dots" role="tablist" aria-label="Choose a banner">' +
        CFG.banners.map(function (b, i) {
          return '<button type="button" role="tab" aria-label="' + b.title + '" aria-selected="' + (i === 0) + '"></button>';
        }).join("") +
      "</div>";

    var slides = root.querySelectorAll(".banner");
    var dots = root.querySelectorAll(".banner-dots button");
    var index = 0;
    var timer = null;
    var reduced = document.documentElement.getAttribute("data-motion") === "reduced";
    var live = root.querySelector(".banner-track");

    function show(n) {
      index = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === index); });
      dots.forEach(function (d, i) { d.setAttribute("aria-selected", String(i === index)); });
    }

    function stop() { clearInterval(timer); timer = null; live.setAttribute("aria-live", "polite"); }
    function start() {
      if (reduced || timer || slides.length < 2) return;
      timer = setInterval(function () {
        if (document.hidden) return;
        show(index + 1);
      }, 6000);
      live.setAttribute("aria-live", "off");
    }

    root.querySelector(".prev").addEventListener("click", function () { stop(); show(index - 1); });
    root.querySelector(".next").addEventListener("click", function () { stop(); show(index + 1); });
    dots.forEach(function (d, i) { d.addEventListener("click", function () { stop(); show(i); }); });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { stop(); show(index - 1); }
      else if (e.key === "ArrowRight") { stop(); show(index + 1); }
    });
    root.addEventListener("pointerenter", stop);
    root.addEventListener("pointerleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

    show(0);
    start();
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
   * Share metadata (og:url, og:image, canonical)
   * ------------------------------------------------------------------ *
   * These stay empty until FIXON.share carries a real value, because a wrong
   * canonical or share image is worse than none: crawlers cache it and the
   * owner only finds out weeks later. Fill FIXON.share in js/config.js once
   * the site has a domain, and the tags write themselves on every page.
   * ------------------------------------------------------------------ */
  function initShareMeta() {
    var share = CFG.share || {};

    document.querySelectorAll("[data-fixon-og]").forEach(function (meta) {
      var which = meta.getAttribute("data-fixon-og");
      var value = which === "url" ? share.url : which === "image" ? share.image : "";
      if (U.isSet(value)) meta.setAttribute("content", value);
      else if (meta.parentNode) meta.parentNode.removeChild(meta);
    });

    if (U.isSet(share.url)) {
      var canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = share.url + location.pathname.replace(/index\.html$/, "");
    }
  }

  /* ------------------------------------------------------------------ *
   * Shop strip (index.html + accessories.html)
   * ------------------------------------------------------------------ *
   * Rows the owner marked "featured" lead, then the rest of the shop's own
   * list in the order the sheet holds them, up to STRIP_LIMIT cards. Every
   * card is still a real row from the owner's file: nothing here invents a
   * listing, calls one popular or promotes a made-up price. An empty file
   * gets the plain note below instead of a filler product.
   * ------------------------------------------------------------------ */
  var STRIP_LIMIT = 6;

  function stripPicks(C) {
    var out = C.featured(STRIP_LIMIT);
    var seen = {};
    out.forEach(function (p) { seen[p.id] = true; });
    var rows = typeof C.rows === "function" ? C.rows() : [];
    for (var i = 0; i < rows.length && out.length < STRIP_LIMIT; i++) {
      if (seen[rows[i].id]) continue;
      seen[rows[i].id] = true;
      out.push(rows[i]);
    }
    return out;
  }

  function initFeatured() {
    var host = document.getElementById("featuredProducts");
    if (!host || typeof window.renderProducts !== "function") return;
    var C = window.fixonCatalog;
    if (!C) return;

    function paint(snapshot) {
      var list = stripPicks(C);
      if (!list.length && (snapshot.status === "loading" || snapshot.status === "idle")) {
        if (!host.childElementCount) host.appendChild(elFromText("p", "note featured-empty", "Loading listings…"));
        return;
      }
      host.innerHTML = "";
      if (list.length) { renderProducts(list, "featuredProducts"); return; }
      var failed = snapshot.status === "error" || snapshot.status === "unset";
      host.appendChild(elFromText(
        "p", "note featured-empty",
        failed ? "The shop's listing file is unavailable right now, so there is nothing to show."
               : "FIXON has not published any listings yet. Rows added to the shop list appear here."
      ));
    }

    if (typeof C.onReady === "function") C.onReady(paint); else paint(C.status());
  }

  function elFromText(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  /* Photo slots degrade to the neutral render instead of a broken icon. The
     error event does not bubble, so this listens in the capture phase. */
  function initPhotoFallback() {
    document.addEventListener("error", function (e) {
      var img = e.target;
      if (!img || img.tagName !== "IMG" || !img.dataset.fallback) return;
      if (img.dataset.fallbackTried) return;
      img.dataset.fallbackTried = "1";
      img.src = img.dataset.fallback;
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".mobile-bar")) document.body.classList.add("has-bar");
    hydrate();
    initShareMeta();
    initPhotoFallback();
    initThemeButton();
    initNav();
    initScrollUI();
    initFaq();
    initMap();
    initFeatured();
    initBanners();
    injectStructuredData();
    initReveal();
    wireDisabled();

    /* Pages that build controls from config (contact form selects) wait for
       this event; js/config.js is already loaded by then. */
    document.dispatchEvent(new CustomEvent("fixon:ready"));
  });

  window.fixonHydrate = hydrate;
  window.fixonUtils.hydrate = hydrate;
  window.showToast = showToast;
})();
