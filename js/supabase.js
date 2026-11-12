/* ==========================================================================
   FIXON - Supabase access (REST + Auth via fetch, no SDK)
   --------------------------------------------------------------------------
   The whole site talks to Supabase through this one module:
     - the storefront's catalog read (js/catalog.js calls activeProducts())
     - the admin dashboard's login, product CRUD and image upload (admin/*)

   Why the REST endpoints instead of supabase-js: the site is dependency-free
   vanilla JavaScript, the five operations needed here are five small HTTP
   calls, and a pinned CDN script is one more thing that can break or go
   missing. Nothing is lost by this choice - the API is the same.

   Keys: only the ANON key is ever used. It ships in the page source on
   purpose; every guarantee about who may read or write comes from the Row
   Level Security policies in supabase/SETUP.sql, evaluated against the
   signer's JWT. The service-role key would bypass all of that and therefore
   appears nowhere in this repository.

   Configuration: js/config.js -> FIXON.supabase. url or key left as a
   SET_ME_* sentinel means "not wired up". Supabase is the only product
   source, so every caller must then show its honest "not online yet"
   state instead of an empty or invented shop.
   ========================================================================== */
(function () {
  "use strict";

  var U = window.fixonUtils;

  var STORAGE_BUCKET = "product-images";
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;      /* same ceiling the WhatsApp upload uses */
  var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var REQUEST_TIMEOUT = 15000;

  /* ------------------------------------------------------------------ *
   * Configuration
   * ------------------------------------------------------------------ */
  function cfg() { return (window.FIXON && window.FIXON.supabase) || {}; }

  /* HTTPS only, no path, no credentials in the URL: a mis-typed address must
     fail closed here rather than send the anon key somewhere unexpected. */
  function baseUrl() {
    var raw = String(cfg().url || "").trim().replace(/\/+$/, "");
    if (!U.isSet(raw)) return null;
    var m = raw.match(/^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i);
    if (!m || /[^a-z0-9.-]/i.test(m[1])) return null;
    return raw;
  }

  function anonKey() {
    var raw = String(cfg().key || "").trim();
    return U.isSet(raw) ? raw : null;
  }

  function configured() {
    return !!(baseUrl() && anonKey());
  }

  /* ------------------------------------------------------------------ *
   * Fetch core
   * ------------------------------------------------------------------ */
  function request(url, options) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT) : null;
    var call = Object.assign({}, options || {}, controller ? { signal: controller.signal } : {});
    return fetch(url, call).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
        return { ok: res.ok, status: res.status, data: data };
      });
    }, function () {
      if (timer) clearTimeout(timer);
      var err = new Error("Could not reach Supabase. Check the project URL and your connection.");
      err.code = "network";
      throw err;
    });
  }

  function restHeaders(extra) {
    var h = Object.assign({
      apikey: anonKey(),
      Authorization: "Bearer " + (accessToken() || anonKey()),
      "Content-Type": "application/json"
    }, extra || {});
    return h;
  }

  /* Supabase's PostgREST wraps select() results; single-object reads use
     Accept: application/vnd.pgrst.object+json so "no row" answers 406
     instead of silently returning an empty array. */
  function acceptOne(h) {
    h.Accept = "application/vnd.pgrst.object+json";
    return h;
  }

  function apiError(res, fallback) {
    var msg = fallback;
    if (res.data) {
      if (res.data.message) msg = res.data.message;
      else if (res.data.error_description) msg = res.data.error_description;
      else if (res.data.error) msg = String(res.data.error);
    }
    var err = new Error(msg);
    err.status = res.status;
    err.code = res.data && res.data.code ? res.data.code : "rest";
    return err;
  }

  /* ------------------------------------------------------------------ *
   * Session storage
   * --------------------------------------------------------------------------
   * The JWT lives in the browser between page loads so the dashboard does not
   * ask for a password on every page. Two rules:
   *   - The session is written ONLY after admins-select confirms the signer
   *     is an admin, so a non-admin browser holds no token that scripts could
   *     mistake for a granted one. (RLS enforces it server-side regardless;
   *     this just keeps the client honest about what it has.)
   *   - The token is refreshed when the stored one is older than an hour; if
   *     the refresh fails the session is dropped and the admin signs in again.
   *
   * Two stores share one key, because "remember me" has to mean something:
   * localStorage keeps the dashboard open past a closed tab, sessionStorage
   * is thrown away by the browser when the tab closes. A refresh writes back
   * into whichever one actually holds the session.
   * ------------------------------------------------------------------ */
  var SESSION_KEY = "fixon_admin_session_v1";
  var STORES = ["localStorage", "sessionStorage"];

  function store(name) {
    try {
      var s = window[name];
      return s && typeof s.getItem === "function" ? s : null;
    } catch (e) { return null; }
  }

  /* { json, name } for whichever store holds a usable session, else null. */
  function readRaw() {
    for (var i = 0; i < STORES.length; i++) {
      var s = store(STORES[i]);
      if (!s) continue;
      var raw = null;
      try { raw = s.getItem(SESSION_KEY); } catch (e) { continue; }
      if (!raw) continue;
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.access_token === "string" && parsed.access_token) {
          return { json: parsed, name: STORES[i] };
        }
      } catch (e) { /* unreadable: treat it as signed out */ }
    }
    return null;
  }

  function readSession() {
    var found = readRaw();
    return found ? found.json : null;
  }

  /* persistent === false is the only way in to sessionStorage; anything else
     (including undefined) is the remembered, cross-tab choice. */
  function writeSession(s, persistent) {
    var pick = persistent === false ? "sessionStorage" : "localStorage";
    var other = persistent === false ? "localStorage" : "sessionStorage";
    var t = store(pick);
    if (t) { try { t.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
    var o = store(other);
    if (o) { try { o.removeItem(SESSION_KEY); } catch (e) { /* nothing to clear */ } }
  }

  function clearSession() {
    STORES.forEach(function (name) {
      var s = store(name);
      if (!s) return;
      try { s.removeItem(SESSION_KEY); } catch (e) { /* nothing to clear */ }
    });
  }

  function accessToken() {
    var s = readSession();
    return s ? s.access_token : null;
  }

  /* A JWT's expiry is its own claim; decoding it locally only decides whether
     to attempt a refresh - the server still checks everything. */
  function sessionExpiry(s) {
    try {
      var payload = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      var json = JSON.parse(decodeURIComponent(escape(atob(payload))));
      return json.exp ? json.exp * 1000 : 0;
    } catch (e) { return 0; }
  }

  function needsRefresh(s) {
    var exp = sessionExpiry(s);
    return !exp || exp - Date.now() < 10 * 60 * 1000;
  }

  var refreshing = null;

  function refreshSession() {
    if (refreshing) return refreshing;
    var found = readRaw();
    var s = found ? found.json : null;
    if (!s || !s.refresh_token) return Promise.resolve(s);
    if (!needsRefresh(s)) return Promise.resolve(s);

    refreshing = request(baseUrl() + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: anonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (res) {
      refreshing = null;
      if (!res.ok || !res.data || !res.data.access_token) {
        /* The session is dead (password changed, user removed, token revoked)
           or Supabase was unreachable mid-refresh. Either way the dashboard
           must show a login form, not half-trust a stale token. */
        clearSession();
        return null;
      }
      var next = {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token || s.refresh_token,
        user: res.data.user || s.user
      };
      /* Re-confirm membership: an admin removed from the admins table must
         not glide through on a freshly minted token. */
      return verifyAdmin(next).then(function (ok) {
        if (!ok) { clearSession(); return null; }
        writeSession(next, found.name !== "sessionStorage");
        return next;
      }, function () { clearSession(); return null; });
    }, function () {
      refreshing = null;
      /* Network trouble is not expiry: keep the session and let the caller's
         own request fail with its honest message. */
      return s;
    });
    return refreshing;
  }

  /* ------------------------------------------------------------------ *
   * Auth
   * ------------------------------------------------------------------ */
  /* remember === false keeps the token in sessionStorage only, so closing the
     tab ends the admin session. Anything else is the remembered choice. */
  function signIn(email, password, remember) {
    if (!configured()) return Promise.reject(configError());
    return request(baseUrl() + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: anonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password: String(password) })
    }).then(function (res) {
      if (!res.ok || !res.data || !res.data.access_token) {
        var code = res.data && res.data.code;
        /* Gotrue answers invalid credentials with 400 and "invalid_credentials"
           - same sentence for a wrong email and a wrong password, on purpose. */
        var err = (code === "email_not_confirmed")
          ? new Error("This address has not confirmed its email yet.")
          : (res.status === 400 || res.status === 401 || res.status === 422)
            ? new Error("Email or password is incorrect.")
            : apiError(res, "Sign-in failed.");
        throw err;
      }
      var session = {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        user: res.data.user
      };
      return verifyAdmin(session).then(function (ok) {
        if (!ok) {
          /* Signed in, but not on the admins list. Drop the tokens and say
             plainly that this account cannot manage products. */
          return request(baseUrl() + "/auth/v1/logout", {
            method: "POST", headers: { apikey: anonKey(), Authorization: "Bearer " + session.access_token }
          }).catch(function () { return null; }).then(function () {
            var err = new Error("That account is signed in but is not a FIXON admin, so the dashboard stays closed to it.");
            err.code = "not_admin";
            throw err;
          });
        }
        writeSession(session, remember);
        return session;
      });
    });
  }

  /* The authorization check the frontend mirrors: RLS only returns a row from
     admins for the calling JWT when that user really is one, so "one row back"
     IS the verdict - a forged or non-admin token sees an empty table. */
  function verifyAdmin(session) {
    if (!session || !session.access_token) return Promise.resolve(false);
    return request(baseUrl() + "/rest/v1/admins?select=user_id&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1", {
      method: "GET",
      headers: { apikey: anonKey(), Authorization: "Bearer " + session.access_token }
    }).then(function (res) {
      return res.ok && Array.isArray(res.data) && res.data.length === 1;
    });
  }

  /* What every admin page calls before doing anything: returns a live,
     admin-confirmed session or null. Never throws. */
  function currentSession() {
    if (!configured()) return Promise.resolve(null);
    var s = readSession();
    if (!s) return Promise.resolve(null);
    if (needsRefresh(s)) {
      return refreshSession();
    }
    return Promise.resolve(s);
  }

  function signOut() {
    var s = readSession();
    clearSession();
    if (!s || !configured()) return Promise.resolve();
    return request(baseUrl() + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: anonKey(), Authorization: "Bearer " + s.access_token }
    }).catch(function () { return null; });
  }

  /* Password reset: an emailed link back to the login page. Supabase answers
     the same either way, so this never reveals whether an address is an
     admin - that is intentional. */
  function resetPassword(email, redirectTo) {
    if (!configured()) return Promise.reject(configError());
    return request(baseUrl() + "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo), {
      method: "POST",
      headers: { apikey: anonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email).trim().toLowerCase() })
    }).then(function (res) {
      if (!res.ok) throw apiError(res, "The reset request could not be sent.");
      return true;
    });
  }

  /* A recovery link lands on login.html with #access_token... in the URL
     (Supabase's implicit redirect flow). Exchange it for a session, confirm
     admin membership, then clean the URL. */
  function captureRecovery() {
    var hash = String(window.location.hash || "");
    if (hash.indexOf("access_token=") === -1) return Promise.resolve(null);
    var params = new URLSearchParams(hash.replace(/^#/, ""));
    var token = params.get("access_token");
    var refresh = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token || !configured()) return Promise.resolve(null);
    return request(baseUrl() + "/auth/v1/user", {
      method: "GET",
      headers: { apikey: anonKey(), Authorization: "Bearer " + token }
    }).then(function (res) {
      if (!res.ok || !res.data || !res.data.id) return null;
      var session = { access_token: token, refresh_token: refresh || "", user: res.data };
      return verifyAdmin(session).then(function (ok) {
        if (!ok) return null;
        writeSession(session);
        return session;
      });
    }, function () { return null; });
  }

  /* ------------------------------------------------------------------ *
   * The admin's own account (Auth, not the products table)
   * --------------------------------------------------------------------------
   * /auth/v1/user is the endpoint that speaks about the signed-in user, so the
   * profile page reads and writes only what it is allowed to: the email GoTrue
   * already holds, the two keys this dashboard keeps in user_metadata, and the
   * password. A bearer token can only ever describe its own user, and no token
   * or user id is handed back to a page for display.
   * ------------------------------------------------------------------ */
  function authUser(method, body) {
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/auth/v1/user", {
        method: method,
        headers: {
          apikey: anonKey(),
          Authorization: "Bearer " + s.access_token,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      }).then(function (res) {
        if (res.status === 401 || res.status === 403) {
          /* Not "wrong password": the token was accepted for the call and
             refused for the change, which is what Supabase answers when a
             sensitive field wants a sign-in that is fresher than this one. */
          if (res.data && /reauth/i.test(String(res.data.message || res.data.error || ""))) {
            var re = new Error("Supabase wants a fresh sign-in before the password changes. Log out, log in again, then try once more.");
            re.code = "reauth";
            throw re;
          }
          var out = new Error("Not authorised - sign in again.");
          out.code = "signed_out";
          throw out;
        }
        if (!res.ok) throw apiError(res, "The account could not be updated.");
        return res.data && res.data.user ? res.data.user : res.data;
      });
    });
  }

  function currentUser() {
    return authUser("GET", null);
  }

  /* Only these two metadata keys are ever written, so anything the owner set
     on the account by other means stays exactly as it was. */
  function updateAccount(data) {
    var clean = {};
    Object.keys(data || {}).forEach(function (key) {
      if (key === "display_name") clean.display_name = cleanText(data[key], 60);
      else if (key === "avatar_url") clean.avatar_url = String(data[key] || "").trim().slice(0, 500);
    });
    return authUser("PUT", { data: clean }).then(function (user) {
      rememberUser(user);
      return user;
    });
  }

  /* Supabase takes the new password on its own - the current one is never
     sent anywhere. Until the admin signs in again this browser keeps working
     with the session it already has. */
  function changePassword(password) {
    var value = String(password || "");
    if (value.length < 8) return Promise.reject(new Error("Choose a password of at least 8 characters."));
    return authUser("PUT", { password: value }).then(function (user) {
      rememberUser(user);
      return user;
    });
  }

  /* Keep the stored session's copy of the user in step with the account, so
     the sidebar name and picture refresh without another sign-in. */
  function rememberUser(user) {
    var found = readRaw();
    if (!found || !user || !user.id) return;
    found.json.user = user;
    writeSession(found.json, found.name !== "sessionStorage");
  }

  /* ------------------------------------------------------------------ *
   * Products - reads
   * ------------------------------------------------------------------ */
  function configError() {
    var err = new Error("Supabase is not configured. Set FIXON.supabase.url and FIXON.supabase.key in js/config.js.");
    err.code = "not_configured";
    return err;
  }

  /* The public catalog read the storefront uses: anon key, RLS hands back
     exactly the active rows. select=* keeps new columns flowing to the
     renderers without an edit here. */
  function activeProducts() {
    if (!configured()) return Promise.reject(configError());
    return request(baseUrl() + "/rest/v1/products?select=*&is_active=eq.true&order=created_at.desc", {
      method: "GET",
      headers: { apikey: anonKey(), Authorization: "Bearer " + anonKey() }
    }).then(function (res) {
      if (!res.ok) throw apiError(res, "The product list could not be loaded.");
      if (!Array.isArray(res.data)) throw new Error("Supabase answered the product list in an unexpected shape.");
      return res.data;
    });
  }

  /* Admin reads: every row including inactive ones, newest first. */
  function listProducts() {
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/rest/v1/products?select=*&order=created_at.desc", {
        method: "GET",
        headers: restHeaders({ Authorization: "Bearer " + s.access_token })
      }).then(function (res) {
        if (res.status === 401 || res.status === 403) { clearSession(); var e = new Error("Not authorised - sign in again."); e.code = "signed_out"; throw e; }
        if (!res.ok) throw apiError(res, "The product list could not be loaded.");
        return res.data;
      });
    });
  }

  /* One product by uuid, admins only (RLS hides inactive rows from anon, so
     this doubles as the edit page's existence check). */
  function getProduct(id) {
    if (!/^[\w-]{8,40}$/.test(String(id || ""))) return Promise.reject(new Error("That product address is not a valid id."));
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/rest/v1/products?select=*&id=eq." + encodeURIComponent(id), {
        method: "GET",
        headers: acceptOne(restHeaders({ Authorization: "Bearer " + s.access_token }))
      }).then(function (res) {
        if (res.status === 406 || res.status === 404) return null;   /* no such row for this admin */
        if (!res.ok) throw apiError(res, "The product could not be loaded.");
        return res.data;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Products - writes
   * --------------------------------------------------------------------------
   * Values are cleaned here before they leave the browser, so the dashboard
   * gets a clear error instead of a Postgres check message, and the columns
   * always arrive in the types the schema expects. These are convenience
   * rails, not security: RLS and the CHECK constraints are the security.
   * ------------------------------------------------------------------ */
  function cleanText(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  function toPrice(value) {
    var text = String(value == null ? "" : value).replace(/[^\d.]/g, "");
    if (!text) return null;                       /* "price on request" stays null */
    var n = Number(text);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  function toStock(value, allowEmpty) {
    var text = String(value == null ? "" : value).replace(/[^\d]/g, "");
    if (!text) return allowEmpty ? null : NaN;
    var n = Number(text);
    if (!isFinite(n) || n < 0) return NaN;
    return Math.floor(n);
  }

  function productPayload(input) {
    var src = input || {};
    var name = cleanText(src.name, 120);
    if (!name) throw new Error("A product needs a name before it can be saved.");
    if (name.length < 2) throw new Error("That name is too short to be useful.");
    var stock = src.stock === "" || src.stock == null ? null : toStock(src.stock, true);
    if (stock !== null && isNaN(stock)) throw new Error("The stock quantity must be a whole number, or left empty for 'not tracked'.");
    return {
      name: name,
      description: cleanText(src.description, 800),
      price: toPrice(src.price),
      category: cleanText(src.category, 60),
      image_url: cleanText(src.image_url, 500),
      stock: stock,
      stock_note: cleanText(src.stock_note, 60),
      featured: !!src.featured,
      is_active: src.is_active === false ? false : true
    };
  }

  function postgrestWrite(res, what) {
    if (res.status === 401 || res.status === 403) { clearSession(); var e = new Error("Not authorised - sign in again."); e.code = "signed_out"; throw e; }
    if (!res.ok) {
      var msg = what;
      if (res.data && /check constraint|violates/i.test(String(res.data.message || ""))) msg = what + ": a value was outside the allowed range.";
      else if (res.data && res.data.message) msg = what + ": " + res.data.message;
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return Array.isArray(res.data) ? res.data[0] : res.data;
  }

  function createProduct(input) {
    var payload;
    try { payload = productPayload(input); } catch (e) { return Promise.reject(e); }
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/rest/v1/products", {
        method: "POST",
        headers: restHeaders({
          Authorization: "Bearer " + s.access_token,
          Prefer: "return=representation"
        }),
        body: JSON.stringify(payload)
      }).then(function (res) {
        return postgrestWrite(res, "The product could not be created");
      });
    });
  }

  /* PATCH with every column present (productPayload always fills them), so
     editing is total: the stored row ends up exactly as the form says,
     including cleared descriptions and emptied prices. */
  function updateProduct(id, input) {
    if (!/^[\w-]{8,40}$/.test(String(id || ""))) return Promise.reject(new Error("That product address is not a valid id."));
    var payload;
    try { payload = productPayload(input); } catch (e) { return Promise.reject(e); }
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/rest/v1/products?id=eq." + encodeURIComponent(id), {
        method: "PATCH",
        headers: restHeaders({
          Authorization: "Bearer " + s.access_token,
          Prefer: "return=representation"
        }),
        body: JSON.stringify(payload)
      }).then(function (res) {
        var row = postgrestWrite(res, "The product could not be saved");
        if (!row) { var e = new Error("That product no longer exists - it may have been deleted."); e.code = "missing"; throw e; }
        return row;
      });
    });
  }

  function deleteProduct(id) {
    if (!/^[\w-]{8,40}$/.test(String(id || ""))) return Promise.reject(new Error("That product address is not a valid id."));
    return currentSession().then(function (s) {
      if (!s) { var e = new Error("Your admin session expired - sign in again."); e.code = "signed_out"; throw e; }
      return request(baseUrl() + "/rest/v1/products?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: restHeaders({ Authorization: "Bearer " + s.access_token })
      }).then(function (res) {
        postgrestWrite(res, "The product could not be deleted");
        return true;
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Storage
   * --------------------------------------------------------------------------
   * Uploads go to the public product-images bucket with the admin JWT, so
   * Supabase's storage policies (SETUP.sql section 5) are the gate. Object
   * names are generated here - never taken from the uploaded file's name -
   * so a "photo(1).jpg" or a path-carrying name cannot misfile or collide.
   * ------------------------------------------------------------------ */
  var UPLOAD_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  function validateImage(file) {
    if (!file) return Promise.reject(new Error("Choose an image file first."));
    if (!UPLOAD_TYPES[file.type]) {
      return Promise.reject(new Error("That file is not a JPEG, PNG or WebP image (" + (file.type || "unknown type") + ")."));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Promise.reject(new Error("That image is " + (file.size / 1048576).toFixed(1) + " MB - the limit is 5 MB."));
    }
    if (!file.size) return Promise.reject(new Error("That file came through empty."));
    return Promise.resolve(file);
  }

  function objectName(type) {
    var stamp = Date.now().toString(36);
    var rand = "";
    try {
      var bytes = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) rand += ("0" + bytes[i].toString(36)).slice(-2);
    } catch (e) {
      rand = Math.random().toString(36).slice(2, 10);
    }
    return "p-" + stamp + "-" + rand + "." + UPLOAD_TYPES[type];
  }

  /* Returns the public URL stored into products.image_url.
     -----------------------------------------------------------------
     XMLHttpRequest rather than fetch for this one call because it is the
     request the admin actually watches: upload.onprogress counts real bytes,
     so a 4 MB photo on a shop connection can show a bar that moves instead of
     a spinner that lies about being nearly finished. The contract is the
     original one - validate, generate a fresh object name, resolve the public
     address, clear the session and report signed_out when the token fails. */
  function uploadImage(file, onProgress) {
    return currentSession().then(function (s) {
      if (!s) { var e0 = new Error("Your admin session expired - sign in again."); e0.code = "signed_out"; throw e0; }
      return validateImage(file).then(function (img) {
        var name = objectName(img.type);
        return sendImage(name, img, s.access_token, onProgress).then(function () {
          return baseUrl() + "/storage/v1/object/public/" + STORAGE_BUCKET + "/" + name;
        });
      });
    });
  }

  function sendImage(name, file, token, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      try { xhr.open("POST", baseUrl() + "/storage/v1/object/" + STORAGE_BUCKET + "/" + encodeURIComponent(name) + "?upsert=false"); }
      catch (e) { reject(new Error("This browser cannot start the upload.")); return; }
      xhr.timeout = REQUEST_TIMEOUT;
      xhr.setRequestHeader("apikey", anonKey());
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("content-type", file.type);
      xhr.setRequestHeader("x-upsert", "false");

      if (xhr.upload && typeof onProgress === "function") {
        xhr.upload.addEventListener("progress", function (e) {
          if (!e.lengthComputable) return;
          onProgress(Math.max(0, Math.min(1, e.total ? e.loaded / e.total : 0)), e.loaded, e.total);
        });
      }

      function fail(message, code) {
        var err = new Error(message);
        if (code) err.code = code;
        reject(err);
      }

      xhr.addEventListener("load", function () {
        var status = xhr.status;
        if (status >= 200 && status < 300) { resolve(true); return; }
        var data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = { message: xhr.responseText }; }
        if (status === 401 || status === 403) {
          clearSession();
          fail("Not authorised to upload images - sign in again.", "signed_out");
          return;
        }
        if (status === 409) {
          fail("An image with that name already exists; press upload again - it uses a fresh name.");
          return;
        }
        fail((data && (data.message || data.error)) || "The image upload failed.", data && data.code ? data.code : "storage");
      });
      xhr.addEventListener("timeout", function () { fail("The upload timed out. Check the connection and try again.", "network"); });
      xhr.addEventListener("error", function () { fail("Could not reach Supabase. Check the project URL and your connection.", "network"); });
      xhr.addEventListener("abort", function () { fail("The upload was cancelled.", "aborted"); });
      xhr.send(file);
    });
  }

  /* ------------------------------------------------------------------ *
   * Is this photo actually reachable?
   * --------------------------------------------------------------------------
   * An upload can succeed and still give the shop nothing to look at: a
   * private bucket, a missing policy or a renamed bucket all answer 400/404
   * to the public path while the row keeps a perfectly-shaped address. The
   * storefront would then quietly show a stand-in picture, which reads to the
   * owner as "my uploaded image went missing", so the check happens here,
   * where the message can name the setting to fix.
   *
   * The probe is an <img> load, not a fetch: it needs no CORS header, it
   * proves exactly what a visitor's browser proves, and a query parameter
   * keeps a previously-failed load out of the cache.
   * ------------------------------------------------------------------ */
  function isStorageUrl(url) {
    var root = baseUrl() + "/storage/v1/object/public/" + STORAGE_BUCKET + "/";
    return !!url && String(url).indexOf(root) === 0;
  }

  function imageReadable(url, timeoutMs) {
    if (!url) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var probe = new Image();
      var settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        probe.onload = probe.onerror = null;
        resolve(!!ok);
      }
      var timer = setTimeout(function () { done(false); }, timeoutMs || 12000);
      probe.onload = function () { done(probe.naturalWidth > 0); };
      probe.onerror = function () { done(false); };
      probe.src = String(url) + (String(url).indexOf("?") === -1 ? "?" : "&") + "fixon_probe=" + Date.now();
    });
  }

  /* Safe cleanup only: an object is removed when no product row - active or
     not - still names its URL. Non-admin tokens see zero rows from the
     REST read below, which is why deleteObject first requires a session and
     the 204 answer proves the storage policy agreed. */
  function deleteImageByUrl(publicUrl) {
    var root = baseUrl() + "/storage/v1/object/public/" + STORAGE_BUCKET + "/";
    if (!publicUrl || publicUrl.indexOf(root) !== 0) return Promise.resolve(false);  /* external URL: ours to delete, leave it */
    var name = publicUrl.slice(root.length);
    if (!name) return Promise.resolve(false);
    return currentSession().then(function (s) {
      if (!s) return false;
      var headers = restHeaders({ Authorization: "Bearer " + s.access_token });
      /* One read of the URL column, compared here: a few hundred rows is
         nothing, and it avoids leaning on nested filter syntax for a
         "does any row still name this image" question. */
      return request(baseUrl() + "/rest/v1/products?select=image_url", { method: "GET", headers: headers })
        .then(function (res) {
        if (!res.ok || !Array.isArray(res.data)) return false;
        for (var i = 0; i < res.data.length; i++) {
          if (String(res.data[i].image_url || "") === publicUrl) return false;  /* still referenced */
        }
        return request(baseUrl() + "/storage/v1/object/" + STORAGE_BUCKET + "/" + name, {
          method: "DELETE",
          headers: { apikey: anonKey(), Authorization: "Bearer " + s.access_token }
        }).then(function (dres) {
          return dres.status === 200 || dres.status === 204;
        }, function () { return false; });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Export
   * ------------------------------------------------------------------ */
  window.fixonSupabase = {
    configured: configured,
    signIn: signIn,
    signOut: signOut,
    currentSession: currentSession,
    resetPassword: resetPassword,
    captureRecovery: captureRecovery,
    currentUser: currentUser,
    updateAccount: updateAccount,
    changePassword: changePassword,
    activeProducts: activeProducts,
    listProducts: listProducts,
    getProduct: getProduct,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    uploadImage: uploadImage,
    deleteImageByUrl: deleteImageByUrl,
    isStorageUrl: isStorageUrl,
    imageReadable: imageReadable,
    clearSession: clearSession,
    bucket: STORAGE_BUCKET,
    maxImageBytes: MAX_IMAGE_BYTES
  };
})();
