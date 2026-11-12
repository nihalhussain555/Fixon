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

   Everything the shell is made of lives here: icons, the sidebar, toasts,
   the confirmation dialog, skeleton loaders and the money/date formatters,
   so the individual pages stay about their own data.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var THEME_KEY = "fixon_admin_theme";
  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Icons
   * --------------------------------------------------------------------------
   * A small built-in set instead of an icon font or a CDN: every glyph is a
   * path element created with createElementNS, so nothing here is ever parsed
   * as HTML and the dashboard stays dependency-free.
   * ------------------------------------------------------------------ */
  var ICONS = {
    grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M14 14h6v6h-6z", "M4 14h6v6H4z"],
    "plus-square": ["M5 9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", "M12 9.5v5", "M9.5 12h5"],
    plus: ["M12 5v14", "M5 12h14"],
    box: ["M21 8.5 12 3 3 8.5V16l9 5.5 9-5.5z", "M3 8.5 12 14l9-5.5", "M12 14v7.5"],
    layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5"],
    user: ["M4 21a8 8 0 0 1 16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
    logout: ["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "M10 17l5-5-5-5", "M15 12H3"],
    sun: ["M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M12 2.5v2", "M12 19.5v2", "M2.5 12h2", "M19.5 12h2", "M5.5 5.5 7 7", "M17 17l1.5 1.5", "M18.5 5.5 17 7", "M7 17l-1.5 1.5"],
    moon: ["M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z"],
    menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
    x: ["M6 6l12 12", "M18 6 6 18"],
    search: ["M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z", "M20 20l-4.4-4.4"],
    trash: ["M4 7h16", "M9 7V4.5h6V7", "M6 7l1 13h10l1-13", "M10 11v6", "M14 11v6"],
    pencil: ["M4 20h4L20 8l-4-4L4 16z", "M14 6l4 4"],
    eye: ["M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z", "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
    "eye-off": ["M3 3l18 18", "M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 4M6.4 8.2A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 3.1-.5", "M9.9 9.9a3 3 0 0 0 4.2 4.2"],
    upload: ["M12 15.5V4", "M8 7.5 12 3.5l4 4", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"],
    image: ["M4.5 5h15v14h-15z", "M5 17l4.5-4.5 3 3L16 12l4 4", "M9.5 9.5a1.4 1.4 0 1 0 0 .01"],
    file: ["M6 3h8l4 4v14H6z", "M14 3v4h4"],
    check: ["M20 7 10 17l-5-5"],
    "check-circle": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M8 12.4l2.6 2.6L16 9.5"],
    alert: ["M12 4 3 20h18z", "M12 10v4.5", "M12 17.2h.01"],
    info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v6", "M12 7.8h.01"],
    "x-circle": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9.2 9.2l5.6 5.6", "M14.8 9.2l-5.6 5.6"],
    "chevron-left": ["M14.5 5.5 8 12l6.5 6.5"],
    "chevron-right": ["M9.5 5.5 16 12l-6.5 6.5"],
    external: ["M14 4h6v6", "M20 4l-9 9", "M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"],
    clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5.2l4 2.3"],
    tag: ["M4 4h7.5L20 12.5 12.5 20 4 11.5z", "M8 8h.01"],
    lock: ["M6 11h12v9H6z", "M9 11V8.2a3 3 0 0 1 6 0V11"],
    mail: ["M3 6h18v12H3z", "M3.5 6.5 12 12.5l8.5-6"],
    key: ["M15.5 4.5a4 4 0 1 1-4.9 5.6L4 17v3.5h3.5L9 21v-2.5h2L12 17l.6-.6a4 4 0 0 0 2.9-11.9z"],
    calendar: ["M4 6h16v14H4z", "M4 10.5h16", "M9 3.5V7", "M15 3.5V7"],
    refresh: ["M20 11.5a8 8 0 1 1-2.6-5.9", "M20 4v4h-4"],
    sort: ["M7 4.5V19", "M4 8l3-3.5L10 8", "M17 19.5V5", "M14 16l3 3.5L20 16"],
    shield: ["M12 3l8 3v6c0 4.8-3.4 7.8-8 9-4.6-1.2-8-4.2-8-9V6z", "M9 12l2.2 2.2L15.5 10"],
    "trend-down": ["M3 7l6 6 4-4 8 8", "M21 13v4h-4"],
    "arrow-right": ["M5 12h13", "M13 6.5l6 5.5-6 5.5"]
  };

  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "icon" + (cls ? " " + cls : ""));
    (ICONS[name] || ICONS.info).forEach(function (d) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }

  function initialsFor(text) {
    var clean = String(text || "").trim();
    if (!clean) return "FX";
    var parts = clean.replace(/[^\w@.]+/g, " ").split(" ").filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function avatarNode(user, cls) {
    var url = user && user.user_metadata && user.user_metadata.avatar_url;
    var name = displayNameOf(user);
    var a = el("span", "avatar" + (cls ? " " + cls : ""));
    if (url && /^https:\/\//i.test(url)) {
      var img = el("img");
      img.src = url;
      img.alt = "";
      img.addEventListener("error", function () { img.remove(); a.textContent = initialsFor(name || url); });
      a.appendChild(img);
      a.setAttribute("title", name || "");
      return a;
    }
    a.textContent = initialsFor(name || (user && user.email));
    return a;
  }

  function displayNameOf(user) {
    var m = (user && user.user_metadata) || {};
    return String(m.display_name || m.name || "").trim();
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function applyTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = "";
      btns[i].appendChild(icon(name === "dark" ? "sun" : "moon"));
      btns[i].setAttribute("aria-label", name === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btns[i].setAttribute("title", name === "dark" ? "Light mode" : "Dark mode");
    }
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
   * Toasts
   * ------------------------------------------------------------------ */
  var TOAST_ICON = { success: "check-circle", error: "x-circle", warn: "alert" };

  function toast(message, kind) {
    var host = document.getElementById("toasts");
    if (!host) {
      host = el("div");
      host.id = "toasts";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var key = kind === "success" || kind === "error" || kind === "warn" ? kind : "info";
    var t = el("div", "toast" + (key === "info" ? "" : " " + (key === "success" ? "ok" : key === "error" ? "err" : "warn")));
    t.appendChild(icon(TOAST_ICON[key] || "info"));
    t.appendChild(el("span", null, message));
    var x = el("button", null);
    x.type = "button";
    x.appendChild(icon("x"));
    x.setAttribute("aria-label", "Dismiss this message");
    t.appendChild(x);
    host.appendChild(t);

    var timer = setTimeout(dismiss, key === "error" ? 7000 : 4200);
    x.addEventListener("click", function () { clearTimeout(timer); dismiss(); });

    function dismiss() {
      if (!t.parentNode) return;
      t.classList.add("out");
      setTimeout(function () { if (t.parentNode) t.remove(); }, 180);
    }
  }

  /* ------------------------------------------------------------------ *
   * Confirmation dialog
   * --------------------------------------------------------------------------
   * Replaces window.confirm with a dialog that can be read on a phone: same
   * contract (a promise for yes/no), but the destructive verb and the thing
   * about to be destroyed are both on screen before anyone presses anything.
   * ------------------------------------------------------------------ */
  function confirmAction(options) {
    var o = typeof options === "string" ? { message: options } : (options || {});
    return new Promise(function (resolve) {
      var previous = document.activeElement;
      var veil = el("div", "modal-veil");
      var box = el("div", "modal");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-labelledby", "modalTitle");

      var top = el("div", "modal-top");
      var chip = el("span", "stat-chip");
      chip.style.setProperty("--tone", o.danger === false ? "var(--accent)" : "var(--danger)");
      chip.style.setProperty("--tone-soft", o.danger === false ? "var(--accent-soft)" : "var(--danger-soft)");
      chip.appendChild(icon(o.icon || (o.danger === false ? "info" : "alert")));
      top.appendChild(chip);
      var words = el("div");
      var titleText = o.title || "Please confirm";
      var h = el("h2", null, titleText);
      h.id = "modalTitle";
      words.appendChild(h);
      if (o.message) words.appendChild(el("p", null, o.message));
      if (o.detail) {
        var d = el("p", "muted small", o.detail);
        d.style.marginTop = "4px";
        words.appendChild(d);
      }
      top.appendChild(words);
      box.appendChild(top);

      var foot = el("div", "modal-foot");
      var cancel = el("button", "btn btn-ghost", o.cancelLabel || "Cancel");
      cancel.type = "button";
      var ok = el("button", "btn " + (o.danger === false ? "btn-primary" : "btn-danger"), o.confirmLabel || "Confirm");
      ok.type = "button";
      foot.appendChild(cancel);
      foot.appendChild(ok);
      box.appendChild(foot);
      veil.appendChild(box);
      document.body.appendChild(veil);

      function close(answer) {
        document.removeEventListener("keydown", onKey, true);
        veil.remove();
        if (previous && previous.focus) previous.focus();
        resolve(answer);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); close(false); }
        else if (e.key === "Tab") {
          /* Two buttons is the whole tab ring - keep focus inside the box. */
          e.preventDefault();
          (document.activeElement === ok ? cancel : ok).focus();
        }
      }
      ok.addEventListener("click", function () { close(true); });
      cancel.addEventListener("click", function () { close(false); });
      veil.addEventListener("mousedown", function (e) { if (e.target === veil) close(false); });
      document.addEventListener("keydown", onKey, true);
      ok.focus();
    });
  }

  /* ------------------------------------------------------------------ *
   * Busy buttons
   * --------------------------------------------------------------------------
   * One place for "no double clicks while the request is in flight": the
   * label swaps for a spinner so the press is visibly acknowledged.
   * ------------------------------------------------------------------ */
  function busy(node, on) {
    if (!node) return;
    node.disabled = !!on;
    node.classList.toggle("is-busy", !!on);
  }

  function busyRow(nodes, on) {
    (nodes || []).forEach(function (n) { busy(n, on); });
  }

  /* ------------------------------------------------------------------ *
   * Loading and empty states
   * ------------------------------------------------------------------ */
  function loadingLine(text) {
    var line = el("div", "loading-line");
    line.appendChild(el("div", "spinner"));
    line.appendChild(el("span", null, text || "Loading..."));
    return line;
  }

  function skeletonStats(count) {
    var grid = el("div", "stat-grid");
    for (var i = 0; i < (count || 4); i++) {
      var c = el("div", "skel skel-card");
      grid.appendChild(c);
    }
    return grid;
  }

  function skeletonRows(count, widths) {
    var box = el("div", "panel flush");
    box.setAttribute("aria-hidden", "true");
    for (var i = 0; i < (count || 5); i++) {
      var row = el("div", "row");
      row.style.cssText = "padding:14px 16px;border-bottom:1px solid var(--line);gap:14px;";
      var t = el("div", "skel skel-thumb");
      row.appendChild(t);
      var w = widths || [0.5, 0.22, 0.14];
      w.forEach(function (share) {
        var s = el("div", "skel skel-line");
        s.style.cssText = "flex:" + share + " 0 auto;height:13px;margin:0;min-width:44px;";
        row.appendChild(s);
      });
      box.appendChild(row);
    }
    return box;
  }

  function emptyState(cfg) {
    var o = cfg || {};
    var box = el("div", "empty");
    var chip = el("span", "stat-chip");
    chip.appendChild(icon(o.icon || "box"));
    box.appendChild(chip);
    box.appendChild(el("b", null, o.title || "Nothing here yet"));
    if (o.message) box.appendChild(el("p", null, o.message));
    var row = el("div", "row");
    (o.actions || []).forEach(function (a) {
      var node;
      if (a.href) {
        node = el("a", "btn " + (a.kind || "btn-primary"), a.label);
        node.href = a.href;
        if (a.external) { node.target = "_blank"; node.rel = "noopener"; }
      } else {
        node = el("button", "btn " + (a.kind || "btn-primary"), a.label);
        node.type = "button";
        node.addEventListener("click", a.onClick);
      }
      row.appendChild(node);
    });
    if (row.childNodes.length) box.appendChild(row);
    return box;
  }

  /* ------------------------------------------------------------------ *
   * Shell
   * --------------------------------------------------------------------------
   * The edit page is reached per product, so it is not a navigation entry -
   * it just keeps Manage products highlighted.
   * ------------------------------------------------------------------ */
  var NAV = [
    { href: "dashboard.html", label: "Dashboard", key: "dashboard", icon: "grid" },
    { href: "add-product.html", label: "Add product", key: "add", icon: "plus-square" },
    { href: "products.html", label: "Manage products", key: "products", icon: "box" },
    { href: "profile.html", label: "Profile", key: "profile", icon: "user" }
  ];
  var TAB_OF = { edit: "products" };

  /* The sidebar's picture, name and email, so the profile page can refresh
     them after a save instead of waiting for the next page load. */
  var shellRefs = null;

  function setShellUser(user) {
    if (!shellRefs || !user) return;
    shellRefs.name.textContent = displayNameOf(user) || "Administrator";
    shellRefs.email.textContent = user.email || "signed in";
    var fresh = avatarNode(user);
    if (shellRefs.avatar && shellRefs.avatar.parentNode) {
      shellRefs.avatar.parentNode.replaceChild(fresh, shellRefs.avatar);
    }
    shellRefs.avatar = fresh;
  }

  function buildShell(activeKey, title, user) {
    var tab = TAB_OF[activeKey] || activeKey;
    var shell = el("div", "admin-shell");

    /* ---------------------------------------------------- sidebar */
    var side = el("aside", "admin-side");
    side.id = "adminSide";
    side.setAttribute("aria-label", "Admin navigation");

    var close = el("button", "icon-btn side-close");
    close.type = "button";
    close.appendChild(icon("x"));
    close.setAttribute("aria-label", "Close menu");
    close.addEventListener("click", function () { setNav(false); });
    side.appendChild(close);

    var brand = el("div", "admin-brand");
    var mark = el("img");
    mark.src = "../favicon.svg";
    mark.alt = "";
    brand.appendChild(mark);
    var brandTxt = el("div");
    brandTxt.appendChild(el("b", null, "FIXON"));
    brandTxt.appendChild(el("small", null, "Admin dashboard"));
    brand.appendChild(brandTxt);
    side.appendChild(brand);

    var nav = el("nav", "admin-nav");
    nav.appendChild(el("div", "admin-nav-label", "Shop"));
    NAV.forEach(function (item) {
      var a = el("a", item.key === tab ? "active" : "", item.label);
      a.href = item.href;
      a.insertBefore(icon(item.icon), a.firstChild);
      if (item.key === tab) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    var out = el("button", "admin-nav-logout");
    out.type = "button";
    out.appendChild(icon("logout"));
    out.appendChild(el("span", null, "Log out"));
    out.addEventListener("click", function () {
      confirmAction({
        title: "Log out of the dashboard?",
        message: "You will need the admin password to sign back in. Products already saved stay exactly as they are.",
        confirmLabel: "Log out",
        danger: false,
        icon: "logout"
      }).then(function (yes) {
        if (!yes) return;
        out.disabled = true;
        window.fixonSupabase.signOut().then(function () {
          window.location.replace("login.html");
        });
      });
    });
    nav.appendChild(out);
    side.appendChild(nav);

    var foot = el("div", "admin-side-foot");
    if (user) {
      var whoCard = el("div", "who-card");
      var whoAvatar = avatarNode(user);
      whoCard.appendChild(whoAvatar);
      var whoTxt = el("div", "who-txt");
      whoTxt.appendChild(el("b", null, displayNameOf(user) || "Administrator"));
      whoTxt.appendChild(el("span", null, user.email || "signed in"));
      whoCard.appendChild(whoTxt);
      foot.appendChild(whoCard);
      shellRefs = {
        avatar: whoAvatar,
        name: whoTxt.firstChild,
        email: whoTxt.childNodes[1]
      };
    }
    side.appendChild(foot);

    /* ---------------------------------------------------- main + top bar */
    var main = el("div", "admin-main");
    var top = el("header", "admin-top");

    var menu = el("button", "icon-btn menu-btn");
    menu.type = "button";
    menu.appendChild(icon("menu"));
    menu.setAttribute("aria-label", "Open menu");
    menu.setAttribute("aria-controls", "adminSide");
    menu.setAttribute("aria-expanded", "false");
    menu.addEventListener("click", function () {
      var open = !document.body.classList.contains("nav-open");
      setNav(open);
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
    top.appendChild(menu);

    var heading = el("div");
    heading.appendChild(el("div", "crumb", "FIXON admin"));
    var h = el("h1", null, title);
    heading.appendChild(h);
    top.appendChild(heading);

    var tools = el("div", "admin-top-tools");
    var themeBtn = el("button", "icon-btn");
    themeBtn.type = "button";
    themeBtn.setAttribute("data-theme-toggle", "");
    themeBtn.addEventListener("click", toggleTheme);
    tools.appendChild(themeBtn);
    applyTheme(document.documentElement.getAttribute("data-theme") || "light");
    var view = el("a", "btn btn-ghost");
    view.href = window.fixonAdmin ? window.fixonAdmin.shopUrl() : "../";
    view.target = "_blank";
    view.rel = "noopener";
    view.appendChild(icon("external"));
    view.appendChild(el("span", null, "View shop"));
    tools.appendChild(view);
    top.appendChild(tools);

    main.appendChild(top);
    var body = el("main", "admin-body");
    body.id = "adminBody";
    main.appendChild(body);

    shell.appendChild(side);
    shell.appendChild(main);
    document.body.appendChild(shell);

    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("nav-open")) return;
      if (side.contains(e.target) || menu.contains(e.target)) return;
      setNav(false);
      menu.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        setNav(false);
        menu.setAttribute("aria-expanded", "false");
        menu.focus();
      }
    });

    return body;
  }

  function setNav(open) {
    document.body.classList.toggle("nav-open", !!open);
  }

  /* ------------------------------------------------------------------ *
   * Boot states
   * ------------------------------------------------------------------ */
  function fullPageNotice(heading, lines) {
    initTheme();
    var wrap = el("div", "auth-wrap");
    var card = el("div", "auth-card");
    var b = el("div", "brand", "FIXON");
    b.appendChild(el("small", null, "Admin dashboard"));
    card.appendChild(b);
    var head = el("div", "notice warn");
    head.appendChild(icon("alert"));
    head.appendChild(el("span", null, heading));
    card.appendChild(head);
    lines.forEach(function (text) {
      var p = el("p", "muted small", text);
      p.style.margin = "0";
      card.appendChild(p);
    });
    var back = el("a", "btn btn-ghost btn-block", "Back to the shop");
    back.href = "../";
    card.appendChild(back);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  function notConfigured() {
    fullPageNotice("Supabase is not configured yet", [
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

  /* Every admin page's sign-out in one place, so the sidebar and the profile
     card cannot drift apart. */
  function logOut(node) {
    busy(node, true);
    window.fixonSupabase.signOut().then(function () {
      window.location.replace("login.html");
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

  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return "";
    var mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + " hr ago";
    var days = Math.round(hours / 24);
    if (days < 31) return days + (days === 1 ? " day ago" : " days ago");
    return fmtDate(iso);
  }

  /* The one status pill the whole dashboard uses: live, hidden, or live but
     with nothing to sell.
     An untracked (empty) stock is NOT an empty shelf - js/catalog.js treats
     null as "no quantity to claim", so the dashboard counts it the same way. */
  function isOutOfStock(row) {
    var v = row ? row.stock : null;
    if (v === null || v === undefined || v === "") return false;
    return Number(v) === 0;
  }

  function statusPill(row) {
    var box = el("div", "pill-stack");
    if (!row.is_active) box.appendChild(el("span", "pill off", "Hidden"));
    else box.appendChild(el("span", "pill on", "Active"));
    if (isOutOfStock(row)) box.appendChild(el("span", "pill out", "Out of stock"));
    if (row.featured) box.appendChild(el("span", "pill info", "Featured"));
    return box;
  }

  function shopUrl() {
    /* The storefront lives at the site root; admin pages are one folder deep
       and may be served with or without a trailing slash. */
    return "../";
  }

  window.fixonAdmin = {
    guard: guard,
    el: el,
    icon: icon,
    toast: toast,
    confirmAction: confirmAction,
    busy: busy,
    busyRow: busyRow,
    loadingLine: loadingLine,
    skeletonStats: skeletonStats,
    skeletonRows: skeletonRows,
    emptyState: emptyState,
    avatar: avatarNode,
    displayName: displayNameOf,
    initials: initialsFor,
    setShellUser: setShellUser,
    logOut: logOut,
    categoryLabel: categoryLabel,
    money: money,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    timeAgo: timeAgo,
    statusPill: statusPill,
    isOutOfStock: isOutOfStock,
    shopUrl: shopUrl,
    initTheme: initTheme,
    toggleTheme: toggleTheme
  };
})();
