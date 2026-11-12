/* FIXON - central business configuration.
 *
 * FIXON is an accessories-only storefront: covers, protectors, pop sockets,
 * lifestyle products and personalised gifts. Repair and service booking do
 * not live here any more - if they ever return, they need their own pages.
 *
 * Every page reads contact details, WhatsApp links and the interactive
 * option lists from this file. Change a value here once - never hard-code
 * it inside HTML or other scripts.
 *
 * Any value still set to a "SET_ME_*" sentinel is treated as NOT configured:
 * buttons that depend on it are disabled with an explanatory toast instead
 * of sending the visitor to a fake number or an empty map.
 *
 * PRODUCT DATA IS NOT IN THIS FILE.
 * Products come from the Supabase project configured in the supabase
 * section - the /admin dashboard is where the shop edits them. Prices,
 * descriptions, images and categories in this file are never invented: a
 * price only appears when the product row supplies one.
 */
(function () {
  var PLACEHOLDER = /^SET_ME/;
  /* The ceiling the products table also enforces, so a mistyped 900 cannot
     turn a price into nothing. Keep it in step with the check in
     supabase/SETUP.sql section 1. */
  var DISCOUNT_MAX = 95;

  var FIXON = {
    /* ------------------------------------------------------------------ *
     * 1. IDENTITY
     * ------------------------------------------------------------------ */
    name: "FIXON",
    tagline: "Mobile Covers, Gifts & Accessories",
    /* The words below feed the share card and the structured data. The big
     * headline a visitor sees is written in index.html, because it is split
     * across lines and styled per word. Keep them in step if you change one. */
    heroHeadline: "Protect It. Personalise It.",
    heroSupport:
      "Mobile covers, tempered glass, pop sockets and personalised gifts at FIXON.",

    /* Social sharing. Set both to the live values once the site has a domain:
     * share.url  = the exact page address, e.g. "https://fixon.example/"
     * share.image = a full https:// link to a 1200x630 picture.
     * Left as sentinels, the matching <meta> tags stay out of the HTML rather
     * than pointing at a URL that does not exist yet. */
    share: { url: "SET_ME_SITE_URL", image: "SET_ME_SHARE_IMAGE_URL" },

    /* ------------------------------------------------------------------ *
     * 2. CONTACT
     * ------------------------------------------------------------------ */
    phoneDisplay: "+91 7306024668",
    phoneDial: "917306024668", // digits only, WITH country code (tel:+ links use this as-is)
    /* wa.me needs the full international number: country code first, then the
     * subscriber number, digits only. js/config.js strips any +, spaces,
     * brackets or hyphens before building a link, but the value below must
     * still carry the country code - a bare local number is not routable
     * through wa.me. */
    whatsappNumber: "917306024668", // +91 73060 24668 as wa.me wants it
    email: "fixoninnovative@gmail.com",
    addressLine: "Kerala Malappuram district", // street / building line
    addressCity: "MELATTUR",
    addressRegion: "India",
    addressPostalCode: "679326",
    addressCountry: "IN",

    /* ------------------------------------------------------------------ *
     * 3. LOCATION
     * mapsQuery: what Google should search for (address or shop name).
     * mapsUrl: optional full link - if set it wins over mapsQuery.
     * ------------------------------------------------------------------ */
    mapsQuery: "SET_ME_MAPS_QUERY",
    mapsUrl: "https://maps.app.goo.gl/4YbynqBVXH1pJBY48?g_st=aw",

    /* ------------------------------------------------------------------ *
     * 4. HOURS / SOCIAL
     * ------------------------------------------------------------------ */
    openingHours: [
      { days: "Monday - Sunday", time: "8:00 AM - 10:00 PM" }
    ],
    socialLinks: {}, // e.g. { instagram: "https://instagram.com/...", facebook: "https://..." }

    /* ------------------------------------------------------------------ *
     * 5. WHATSAPP MESSAGE TEMPLATES
     * Tokens in braces are replaced at click time. {shop} is always this
     * business name; {customer} is the visitor's own name.
     * ------------------------------------------------------------------ */
    messages: {
      general: "Hi {shop}, I would like to know more about your accessories and gifts.",
      accessory: "Hi {shop}, I am interested in {category}. Is it available?",
      product: "Hi {shop}, I am interested in {product}. Could you tell me if it suits my phone and what it costs?",
      contact:
        "Hi {shop}, I have a question about {topic}.\n\n{message}\n\nDevice: {device}\nBest time to reply: {when}\n\n- {customer} ({contact})",

      /* The order tray (js/order.js) builds one message from the items the
         visitor added. {items} arrives as one labelled block per item -
         "Product / Price / Quantity / Total" (plus the fitment in the name
         line and the total only when the product row carries a price) - separated
         by a blank line. {priced} is the grand-total line, {extras} whatever
         the visitor typed (name, phone model, delivery address, notes) and
         {date} the day the message was prepared. Nothing is submitted
         anywhere: the button opens a direct chat with FIXON's WhatsApp
         through https://wa.me/ and the visitor presses send there. */
      order:
        "Hello! I would like to place an order.\n\n{items}\n\n{priced}\n{extras}Order date: {date}\n\nPlease confirm availability and delivery details.",

      /* Order on WhatsApp (js/shop.js): one product sent straight from its
         details panel through the same direct wa.me chat. {details} arrives
         as the labelled lines this listing can actually answer - a product
         with no category cell simply has no category line - followed by
         {extras} and {date} as above. */
      orderProduct:
        "Hello! I would like to place an order.\n\n{details}\n\n{extras}Order date: {date}\n\nPlease confirm availability and delivery details."
    },

    /* ------------------------------------------------------------------ *
     * 6. PRODUCT CATEGORIES (accessories.html -> "Categories")
     * "id" is the slug the shop filter and the photo file use; "match"
     * lists the words a product's category value may carry and
     * still count as this category (compared lower-case, as substrings).
     * A category with no live products renders as "not listed yet" instead
     * of disappearing, so the grid stays honest about what is in the catalog.
     * Photo convention: images/accessories/<photo>.jpg - drop a real photo
     * under the missing file name and it shows up with no code change.
     * ------------------------------------------------------------------ */
    productCategories: [
      { id: "cases", label: "Mobile Covers", photo: "phone-covers", match: ["case", "cover", "back cover", "printed cover"], blurb: "Clear, shockproof, silicone, printed and premium covers for the model you carry." },
      { id: "protectors", label: "Tempered Glass", photo: "tempered-glass", match: ["tempered", "glass", "protector", "screen guard"], blurb: "Screen protection fitted to your model, aligned and bubble-free." },
      { id: "pop-sockets", label: "Pop Sockets & Grips", photo: "pop-sockets", match: ["pop socket", "grip", "ring holder", "stand"], blurb: "Grips, ring holders and pop sockets that double as a stand." },
      { id: "bottles", label: "Bottles & Sippers", photo: "bottles", match: ["bottle", "sipper", "tumbler", "water"], blurb: "Designer bottles and sipper bottles for school, office and travel." },
      { id: "mugs", label: "Mugs", photo: "mugs", match: ["mug", "coffee cup", "magic mug"], blurb: "Printed and magic mugs - a photo or a quote makes it personal." },
      { id: "keychains", label: "Keychains", photo: "keychains", match: ["keychain", "key chain", "keyring", "key ring"], blurb: "Small gifts that travel well: printed, metal and cute-character keychains." },
      { id: "mousepads", label: "Mousepads & Desk Mats", photo: "mousepads", match: ["mousepad", "mouse pad", "desk mat", "gaming pad"], blurb: "Printed mousepads and desk mats for work and gaming setups." },
      { id: "custom", label: "Customised Gifts", photo: "other", match: ["custom", "personalised", "personalized", "photo print", "gift"], blurb: "Your photo or your design on a cover, mug, bottle or keychain - ask us how." },
      { id: "other", label: "Other Accessories", photo: "other", match: ["other", "misc", "general"], blurb: "Everything else at the counter - if it fits a phone or a desk, ask." }
    ],

    /* ------------------------------------------------------------------ *
     * 7. DEVICE FINDER (brands.html)
     * Covers and protectors are sold by fitment, so this stays even without
     * repairs. "match" is the text the shop filter looks for in a listing's
     * brand, so it must equal the brand value used in the product data.
     * "models" are fitment labels: they narrow the visible listings only.
     * Appearing here does NOT claim FIXON stocks a cover for that device -
     * edit this array to match what the shop actually carries.
     * ------------------------------------------------------------------ */
    deviceBrands: [
      { id: "iphone", label: "Apple iPhone", match: "iPhone", models: [
        "iPhone 15 / 16 series", "iPhone 13 / 14 series", "iPhone 11 / 12 series"
      ] },
      { id: "samsung", label: "Samsung", match: "Samsung", models: [
        "Galaxy S24 / S25 series", "Galaxy A series", "Galaxy M / F series"
      ] },
      { id: "oneplus", label: "OnePlus", match: "OnePlus", models: [
        "OnePlus 12 / 13", "OnePlus Nord series"
      ] },
      { id: "pixel", label: "Google Pixel", match: "Pixel", models: [
        "Pixel 8 / 9", "Pixel 6 / 7"
      ] },
      { id: "xiaomi", label: "Xiaomi / Redmi", match: "Xiaomi", models: [
        "Redmi / Note series", "Xiaomi numbered series"
      ] },
      { id: "vivo", label: "Vivo", match: "Vivo", models: [ "V series", "Y series" ] },
      { id: "oppo", label: "OPPO", match: "OPPO", models: [ "Reno series", "A series" ] },
      { id: "realme", label: "Realme", match: "Realme", models: [ "Numbered series", "C / Narzo series" ] },
      { id: "motorola", label: "Motorola", match: "Motorola", models: [ "Edge series", "G series" ] },
      { id: "nothing", label: "Nothing", match: "Nothing", models: [ "Phone series" ] },
      { id: "other-android", label: "Other Android", match: "Android", models: [ "Tell us the model" ] }
    ],

    /* ------------------------------------------------------------------ *
     * 8. SHOP DISPLAY
     * Prices are business facts, so none are written in code. A listing shows
     * a price only when its Supabase row supplies a number; until then the
     * card keeps showing the text below. See the supabase and catalog
     * sections below and supabase/SETUP.sql.
     * ------------------------------------------------------------------ */
    currencySymbol: "₹", // shown before a configured price
    priceNote: "Price on request",

    /* ------------------------------------------------------------------ *
     * 9. HOME BANNERS (index.html slider)
     * Photos come from images/banners/<id>.jpg; a missing file falls back
     * to images/banners/generic.jpg. Copy stays free of numbers, ratings
     * and warranty wording because those are FIXON's to confirm.
     * ------------------------------------------------------------------ */
    banners: [
      { id: "covers", kicker: "MOBILE COVERS", title: "New designs in store", text: "Clear, shockproof, printed and premium covers for the model you actually carry.", cta: "Browse covers", href: "shop.html?cat=cases" },
      { id: "custom", kicker: "CUSTOM PRINTS", title: "Your design, on it", text: "A photo, a logo or a quote printed on covers, mugs, bottles and keychains. Ask us what is possible.", cta: "Ask about custom items", href: "contact.html" },
      { id: "tools", kicker: "GIFTS & EVERYDAY", title: "More than phone gear", text: "Mugs, bottles, keychains and mousepads - pick something that looks as good as it works.", cta: "Browse gifts", href: "accessories.html" }
    ],

    /* ------------------------------------------------------------------ *
     * 9b. SUPABASE - the product database and the admin dashboard
     * ----------------------------------------------------------------
     * Once FIXON.supabase below is filled in, the storefront's products and
     * the /admin dashboard's edits live in the Supabase project: the
     * dashboard writes, the site reads, and a newly added product shows on
     * the shop without any deploy. js/supabase.js does the talking;
     * supabase/SETUP.sql is the one-pass database setup.
     *
     * url  the project's API address, e.g. "https://abcd1234.supabase.co".
     *      Supabase dashboard -> Project Settings -> API -> Project URL.
     * key  the PUBLIC "anon" key from the same screen. It is published with
     *      the site on purpose - the database itself is protected by Row
     *      Level Security policies (see SETUP.sql), which only ever let
     *      visitors read active products and only let listed admins write.
     *      NEVER paste the "service_role" key or the database password
     *      here: anything in this file is public source code.
     *
     * Left as SET_ME_* (or set wrong), Supabase is the only product source,
     * so the shop pages say the catalogue is not online yet and the
     * dashboard shows a clear configuration message - nothing is invented
     * to fill the grid, and there is no other data source to fall back to.
     * ---------------------------------------------------------------- */
    supabase: {
      url: "https://vtlvgqrdnlnngtxgkthj.supabase.co/",
      key: "sb_publishable_qKBTLKMRMtTcaxcC8co5Kg_ShiB_LG-"
    },

    /* ------------------------------------------------------------------ *
     * 10. CATALOG DISPLAY - how the Supabase products are shown
     * ----------------------------------------------------------------
     * There is exactly ONE product source: the Supabase project configured
     * in section 9b. The CSV catalog and the data/catalog.csv file are gone;
     * whatever the /admin dashboard holds in the products table is what the
     * shop pages render, and nothing else. Unconfigured or unreachable
     * Supabase means an honest "not online yet" panel, never sample data.
     *
     * Products and their prices live in the database, NOT in code, so the
     * owner can add, edit, activate or hide an item without a developer.
     * Only rows with is_active = true are displayed; a row with no price
     * shows the "Price on request" text from section 8 rather than a
     * made-up number.
     *
     *   refreshMinutes   How often an open page re-reads the list, so a
     *                    product added in the dashboard appears without a
     *                    reload. The site never claims real-time updates.
     *   imageFolder      Where a bare file name typed in the dashboard's
     *                    image field is looked for: upload the photo to
     *                    images/products/ and type only "cover-red.jpg".
     *                    A value that already contains a slash, or a full
     *                    https:// address, is used exactly as written. Set
     *                    it to "" to require full paths or URLs.
     * ---------------------------------------------------------------- */
    catalog: {
      refreshMinutes: 30,
      /* Where a bare file name in the dashboard's image field is looked
         for. Upload a photo to that folder and type only "cover-red.jpg"
         in the row - no path, no code change. */
      imageFolder: "images/products"
    },

    /* ------------------------------------------------------------------ *
     * 11. ORDER ENDPOINT - server-side WhatsApp Cloud API delivery
     * ----------------------------------------------------------------
     * api/whatsapp-order.js is a Vercel serverless function that re-reads the
     * product row, downloads its photo, uploads it to the
     * WhatsApp Cloud API and posts it to the shop's number with the order
     * caption. Because the delivery happens on a server, the visitor does not
     * have to pick a contact or keep the photo safe in their gallery.
     *
     * endpoint   The deployed function's address, e.g.
     *            "https://fixon.vercel.app/api/whatsapp-order". NOT USED by
     *            the order buttons any more: they always open a direct
     *            wa.me chat with FIXON's number now, which is what the shop
     *            asked for. The function file stays for a possible future
     *            route and nothing calls it while this decision holds.
     *
     * There is deliberately nowhere in this file for an access token, a phone
     * number ID or an app secret. Those live in the hosting provider's
     * environment variables and never reach a browser; anything written here is
     * published to every visitor with the rest of the source. See
     * WHATSAPP-ORDERS.md. */
    orderApi: {
      endpoint: ""
    },

    /* Free-text window, so no implied promise that FIXON is standing by at a
       certain hour. The shop replies when it replies. */
    callbackTimes: ["Any time", "Before noon", "Afternoon", "Evening"],

    /* The contact form (contact.html) offers these as "what do you need".
       These are wording choices, not business claims: none of them promises
       a price or an item in stock. */
    contactTopics: [
      "Ordering accessories",
      "Cover or glass fitment",
      "Customised print or gift",
      "Bulk / gift order",
      "Price or stock question",
      "Something else"
    ],

    /* NOTE on honesty:
     * This file deliberately contains no review scores, no sales counts and
     * no warranty promises. Those are business facts only FIXON can confirm.
     * Product prices are the same kind of fact, so they live in the owner's
     * Supabase products table and stay hidden until a row supplies one.
     */
  };

  /* -------------------------------------------------------------------- *
   * Helpers - exposed on window so every script can reuse them.
   * -------------------------------------------------------------------- */
  function isSet(value) {
    return typeof value === "string" && value.trim() !== "" && !PLACEHOLDER.test(value.trim());
  }

  function firstConfigured(keys) {
    for (var i = 0; i < keys.length; i++) {
      if (isSet(FIXON[keys[i]])) return FIXON[keys[i]];
    }
    return null;
  }

  function fill(template, tokens) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return tokens && tokens[key] != null ? tokens[key] : "";
    });
  }

  /* The configured wording, filled in, without the wa.me wrapper: ORDER NOW
     needs the same text for a Web Share sheet that a link does not belong in. */
  function message(messageKey, tokens) {
    var template = FIXON.messages[messageKey] || FIXON.messages.general;
    return fill(template, Object.assign({ shop: FIXON.name }, tokens || {}));
  }

  /* The shop number in the exact shape wa.me demands: digits only, country
   * code first. Any +, spaces, brackets or hyphens the owner may type are
   * stripped here, so js/config.js can carry the readable form. An empty,
   * placeholder or implausible value returns null and every caller then
   * disables its button instead of opening a chat with nobody. */
  function whatsappDigits() {
    if (!isSet(FIXON.whatsappNumber)) return null;
    var digits = String(FIXON.whatsappNumber).replace(/[^\d]/g, "");
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  /* The one entry point for a direct WhatsApp chat: the official wa.me URL
     with the message encoded into it. This never uses navigator.share or any
     device share sheet - the visitor lands straight in FIXON's chat and only
     has to press send. */
  function whatsappDirect(text) {
    var digits = whatsappDigits();
    if (!digits) return null;
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(String(text || ""));
  }

  /* WhatsApp: one number, one entry point, pre-filled message. */
  function whatsappUrl(messageKey, tokens) {
    return whatsappDirect(message(messageKey, tokens));
  }

  /* The day the order was prepared, in the shop's own locale. */
  function orderDateText() {
    return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  /* The address that opens one listing on the shop page (js/shop.js reads
     ?product=). Two ways to know it: share.url when the owner has set it,
     otherwise the address the visitor is actually reading this product on -
     which is the same page, so it is never a guess. Over plain http(s) only,
     so a file:// preview or a javascript: oddity produces no link at all
     rather than a dead one. */
  function siteBase() {
    if (isSet(FIXON.share.url)) return String(FIXON.share.url).replace(/\/+$/, "");
    var here = window.location && window.location.origin;
    if (typeof here === "string" && /^https?:\/\/./i.test(here) && here !== "null") return here.replace(/\/+$/, "");
    return null;
  }

  function productPageUrl(id) {
    var base = siteBase();
    if (!base || !id) return null;
    return base + "/shop.html?product=" + encodeURIComponent(id);
  }

  function telUrl() {
    return isSet(FIXON.phoneDial) ? "tel:+" + FIXON.phoneDial.replace(/[^\d]/g, "") : null;
  }

  /* The order endpoint, or null. Nothing calls this any more - the order
     buttons always open the direct wa.me chat - but the helper and the
     orderApi block above stay so a future server-side route can be switched
     on without digging the plumbing back out. Only a real http(s) address
     (or a same-site path) is ever returned, so a half-typed value in
     config.js cannot point any future caller somewhere unexpected. */
  function orderEndpoint() {
    var raw = FIXON.orderApi && FIXON.orderApi.endpoint;
    if (!isSet(raw)) return null;
    var text = String(raw).trim();
    if (/^https?:\/\//i.test(text) || text.charAt(0) === "/") return text.replace(/\/+$/, "");
    return null;
  }

  function mapsSearchUrl() {
    if (isSet(FIXON.mapsUrl)) return FIXON.mapsUrl;
    var q = firstConfigured(["mapsQuery", "addressLine"]);
    return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : null;
  }

  /* Keyless embed - builds from the configured address/query only. */
  function mapsEmbedUrl() {
    var q = firstConfigured(["mapsQuery", "addressLine"]);
    return q ? "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&z=15&output=embed" : null;
  }

  function addressLines() {
    return [FIXON.addressLine, FIXON.addressCity, FIXON.addressRegion, FIXON.addressPostalCode]
      .filter(function (line) { return isSet(line); });
  }

  function hoursText() {
    var rows = FIXON.openingHours.filter(function (row) { return isSet(row.time); });
    return rows.length ? rows : null;
  }

  /* A listing shows a price only when it carries a usable number. An absent
     or blank price is the owner's "not set yet", never a stand-in figure. */
  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return null;
    var n = Number(String(value).replace(/[^\d.]/g, ""));
    if (!isFinite(n) || n <= 0) return null;
    return FIXON.currencySymbol + n.toLocaleString("en-IN");
  }

  /* A discount is stored as a percentage against the shop's list price, and
     worked out here in the one place so a card, the details dialog, the order
     tray, the WhatsApp total and the dashboard can never disagree.
     A whole-rupee list price rounds to a whole rupee, because a tag reading
     "₹449.1" is not how this shop quotes; a price with paise keeps two.
     base/percent come back null when there is no discount to show. */
  function saleOf(price, percent) {
    var base = Number(String(price == null ? "" : price).replace(/[^\d.]/g, ""));
    if (!isFinite(base) || base <= 0) return { price: null, base: null, percent: null };
    var pct = Number(percent);
    if (!isFinite(pct) || pct < 1 || pct > DISCOUNT_MAX || Math.floor(pct) !== pct) {
      return { price: base, base: base, percent: null };
    }
    var raw = base - (base * pct) / 100;
    var value = Math.floor(base) === base ? Math.round(raw) : Math.round(raw * 100) / 100;
    return { price: value, base: base, percent: pct };
  }

  function brandById(id) {
    var list = FIXON.deviceBrands;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Photos follow the same rule as the cover renders: one predictable file
     per item, so dropping a real photo over it needs no code change. */
  function photoSrc(dir, slug) {
    return "images/" + dir + "/" + String(slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".jpg";
  }

  /* Clipboard, with the fallback the older browsers and plain http previews
     need. Both forms that hand text over to the visitor use this one copy so
     they fail the same way: resolve(false), then the caller selects the text
     and tells the visitor to press Ctrl + C. */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  window.FIXON = FIXON;
  window.fixonUtils = {
    isSet: isSet,
    fill: fill,
    whatsappDigits: whatsappDigits,
    whatsappDirect: whatsappDirect,
    whatsappUrl: whatsappUrl,
    message: message,
    orderDateText: orderDateText,
    telUrl: telUrl,
    orderEndpoint: orderEndpoint,
    productPageUrl: productPageUrl,
    siteBase: siteBase,
    mapsSearchUrl: mapsSearchUrl,
    mapsEmbedUrl: mapsEmbedUrl,
    addressLines: addressLines,
    hoursText: hoursText,
    firstConfigured: firstConfigured,
    formatPrice: formatPrice,
    saleOf: saleOf,
    discountMax: DISCOUNT_MAX,
    brandById: brandById,
    photoSrc: photoSrc,
    copy: copy
  };
})();
