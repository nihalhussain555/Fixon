/* ==========================================================================
   FIXON admin - shared page machinery
   --------------------------------------------------------------------------
   Every authenticated page calls fixonAdmin.guard(callback):
     - not configured  -> a plain "wire me up" notice, no forms to fake with
     - signed out      -> login.html (returning address kept)
     - session dead    -> session cleared, login.html
     - admin confirmed -> the shell is painted and callback(session) runs.
   The verdict is the CLIENT's copy of the truth; the server's copy is RLS -
   every read and write js/supabase.js performs is checked again by the
   database, so a tampered page still achieves nothing.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var THEME_KEY = "fixon_admin_theme";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function applyTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = name === "dark" ? "Light mode" : "Dark mode";
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    if (saved !== "dark" && saved !== "light") {
      saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    applyTheme(saved);
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* not kept */ }
    applyTheme(next);
  }

  /* ------------------------------------------------------------------ *
   * Toasts + confirm
   * ------------------------------------------------------------------ */
  function toast(message, kind) {
    var host = document.getElementById("toasts");
    if (!host) { host = el("div"); host.id = "toasts"; document.body.appendChild(host); }
    var t = el("div", "toast" + (kind === "error" ? " err" : kind === "success" ? " ok" : ""), message);
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === "error" ? 6000 : 3800);
  }

  /* The dashboard has no modal library; window.confirm is the honest tool
     for "are you sure you want to delete this" - it cannot be dismissed by
     a stray keystroke the way a custom dialog often can. */
  function confirmAction(message) {
    return window.confirm(message);
  }

  /* ------------------------------------------------------------------ *
   * Shell
   * ------------------------------------------------------------------ */
  /* The edit page is reached per product, so it is not a navigation entry -
     it just keeps the Manage tab highlighted. */
  var NAV = [
    { href: "dashboard.html", label: "Dashboard", key: "dashboard" },
    { href: "products.html", label: "Manage products", key: "products" },
    { href: "add-product.html", label: "Add product", key: "add" }
  ];
  var TAB_OF = { edit: "products" };

  function buildShell(activeKey, title, user) {
    var tab = TAB_OF[activeKey] || activeKey;
    var shell = el("div", "admin-shell");

    var side = el("aside", "admin-side");
    var brand = el("div", "admin-brand", "FIXON");
    brand.appendChild(el("small", null, "Admin dashboard"));
    side.appendChild(brand);

    var nav = el("nav", "admin-nav");
    NAV.forEach(function (item) {
      var a = el("a", item.key === tab ? "active" : "", item.label);
      a.href = item.href;
      nav.appendChild(a);
    });
    side.appendChild(nav);

    var foot = el("div", "admin-side-foot");
    if (user && user.email) {
      var who = el("div", "who", "Signed in as");
      who.appendChild(el("br"));
      who.appendChild(el("span", null, user.email));
      foot.appendChild(who);
    }
    var themeBtn = el("button", "btn btn-ghost btn-sm", "Dark mode");
    themeBtn.id = "themeToggle";
    themeBtn.type = "button";
    themeBtn.addEventListener("click", toggleTheme);
    foot.appendChild(themeBtn);
    var out = el("button", "btn btn-ghost btn-sm", "Log out");
    out.type = "button";
    out.addEventListener("click", function () {
      window.fixonSupabase.signOut().then(function () {
        window.location.replace("login.html");
      });
    });
    foot.appendChild(out);
    side.appendChild(foot);

    var main = el("div", "admin-main");
    var top = el("header", "admin-top");
    var menu = el("button", "btn btn-ghost btn-sm menu-btn", "Menu");
    menu.type = "button";
    menu.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    var h = el("h1", null, title);
    top.appendChild(menu);
    top.appendChild(h);
    var tools = el("div", "admin-top-tools");
    var view = el("a", "btn btn-ghost btn-sm", "View shop");
    view.href = window.fixonAdmin ? window.fixonAdmin.shopUrl() : "../";
    view.target = "_blank";
    view.rel = "noopener";
    tools.appendChild(view);
    top.appendChild(tools);
    main.appendChild(top);

    var body = el("main", "admin-body");
    main.appendChild(body);

    shell.appendChild(side);
    shell.appendChild(main);
    document.body.appendChild(shell);

    document.addEventListener("click", function (e) {
      if (document.body.classList.contains("nav-open") && !side.contains(e.target) && !menu.contains(e.target)) {
        document.body.classList.remove("nav-open");
      }
    });

    return body;
  }

  /* ------------------------------------------------------------------ *
   * Boot states
   * ------------------------------------------------------------------ */
  function fullPageNotice(cls, heading, lines) {
    initTheme();
    var wrap = el("div", "auth-wrap");
    var card = el("div", "auth-card");
    var b = el("div", "brand", "FIXON");
    b.appendChild(el("small", null, "Admin dashboard"));
    card.appendChild(b);
    card.appendChild(el("h2", null, heading));
    lines.forEach(function (text) {
      var p = el("p", null, text);
      p.style.cssText = "margin:0;color:var(--text-soft);font-size:.9rem;";
      card.appendChild(p);
    });
    var back = el("a", "btn btn-ghost btn-block", "Back to the shop");
    back.href = "../";
    card.appendChild(back);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    var n = el("div", "notice " + cls);
    n.style.cssText = "max-width:400px;margin:0 auto;";
    wrap.insertBefore(n, card);
  }

  function notConfigured() {
    fullPageNotice("warn", "Supabase is not configured yet", [
      "The dashboard stores products in your Supabase project, so it needs the project address and the public anon key.",
      "Open js/config.js, replace the two SET_ME_SUPABASE_* values, run supabase/SETUP.sql in the Supabase SQL editor, then reload this page.",
      "Until then the customer site keeps serving its existing catalog exactly as before."
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Public guard
   * ------------------------------------------------------------------ */
  function guard(activeKey, title, callback) {
    initTheme();
    if (!window.fixonSupabase || !window.fixonSupabase.configured()) {
      notConfigured();
      return;
    }
    window.fixonSupabase.currentSession().then(function (session) {
      if (!session) {
        var back = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace("login.html?next=" + back);
        return;
      }
      var body = buildShell(activeKey, title, session.user);
      try {
        callback(session, body);
      } catch (e) {
        toast("Something on this page failed to start: " + e.message, "error");
        throw e;
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Shared catalog helpers (labels live in the storefront config)
   * ------------------------------------------------------------------ */
  function categoryLabel(raw) {
    var list = (window.FIXON && window.FIXON.productCategories) || [];
    var value = String(raw || "").trim().toLowerCase();
    if (!value) return "";
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === value || list[i].label.toLowerCase() === value) return list[i].label;
    }
    for (var j = 0; j < list.length; j++) {
      for (var k = 0; k < list[j].match.length; k++) {
        if (value.indexOf(list[j].match[k]) !== -1) return list[j].label;
      }
    }
    return String(raw).trim();
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "Price on request";
    var symbol = (window.FIXON && window.FIXON.currencySymbol) || "₹";
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return "Price on request";
    return symbol + n.toLocaleString("en-IN");
  }

  /* Products arrive newest-first from Supabase; the dashboard wants both a
     date and a stable id, so the display helpers sit here once. */
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function shopUrl() {
    /* The storefront lives at the site root; admin pages are one folder deep
       and may be served with or without a trailing slash. */
    return "../";
  }

  window.fixonAdmin = {
    guard: guard,
    el: el,
    toast: toast,
    confirmAction: confirmAction,
    categoryLabel: categoryLabel,
    money: money,
    fmtDate: fmtDate,
    shopUrl: shopUrl,
    initTheme: initTheme
  };
})();
