/* FIXON - central business configuration.
 *
 * Every page reads contact details, WhatsApp links and the interactive
 * option lists from this file. Change a value here once - never hard-code
 * it inside HTML or other scripts.
 *
 * Any value still set to a "SET_ME_*" sentinel is treated as NOT configured:
 * buttons that depend on it are disabled with an explanatory toast instead
 * of sending the visitor to a fake number or an empty map.
 *
 * PRODUCT DATA IS NOT IN THIS FILE ANY MORE.
 * Products come from a spreadsheet the shop owner edits - see section 10 and
 * GOOGLE-SHEETS.md. Prices, descriptions, images and categories in this file
 * are never invented: a price only appears when the sheet supplies one.
 */
(function () {
  var PLACEHOLDER = /^SET_ME/;

  var FIXON = {
    /* ------------------------------------------------------------------ *
     * 1. IDENTITY
     * ------------------------------------------------------------------ */
    name: "FIXON",
    tagline: "Mobile Repair, Services & Accessories",
    /* The words below feed the share card and the structured data. The big
     * headline a visitor sees is written in index.html and accessories.html,
     * because it is split across lines and styled per word. Keep them in step
     * if you change one. */
    heroHeadline: "Everything Your Phone Needs.",
    heroSupport:
      "Explore quality mobile accessories and everyday mobile services.",

    /* Social sharing. Set both to the live values once the site has a domain:
     * share.url  = the exact page address, e.g. "https://fixon.example/"
     * share.image = a full https:// link to a 1200x630 picture.
     * Left as sentinels, the matching <meta> tags stay out of the HTML rather
     * than pointing at a URL that does not exist yet. */
    share: { url: "SET_ME_SITE_URL", image: "SET_ME_SHARE_IMAGE_URL" },

    /* ------------------------------------------------------------------ *
     * 2. CONTACT - TODO: replace every SET_ME_* value with real data
     * ------------------------------------------------------------------ */
    phoneDisplay: "+91 7306024668", // e.g. "+91 98765 43210"
    phoneDial: "7306024668", // digits only, with country code
    whatsappNumber: "7306024668", // digits only, no "+" or spaces
    email: "fixoninnovative@gmail.com", // e.g. "care@fixon.example"
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
      { days: "Monday - Sunday", time: "8:00 AM - 10:00 PM" },
      // { days: "Saturday", time: "8:00 AM - 10:00 PM" },
      // { days: "Sunday", time: "8:00 AM - 10:00 PM" }
    ],
    socialLinks: {}, // e.g. { instagram: "https://instagram.com/...", facebook: "https://..." }

    /* ------------------------------------------------------------------ *
     * 5. WHATSAPP MESSAGE TEMPLATES
     * Tokens in braces are replaced at click time. {shop} is always this
     * business name; {customer} is the visitor's own name.
     * ------------------------------------------------------------------ */
    messages: {
      general: "Hi {shop}, I would like to know more about your mobile service.",
      quote:
        "Hi {shop}, I need help with my {device} phone. The issue is {problem}. I would like to know about the repair.",
      service: "Hi {shop}, I am interested in the {service} service. Could you guide me?",
      accessory: "Hi {shop}, I am interested in {category}. Is it available?",
      product: "Hi {shop}, I am interested in {product}. Could you tell me if it suits my phone and what it costs?",
      booking:
        "Hi {shop}, I want to book a repair.\n\nName: {customer}\nPhone: {phone}\nDevice: {brand} {model}\nService: {service}\nPreferred: {date} at {time}\nIssue: {issue}",
      contact:
        "Hi {shop}, I have a question about {topic}.\n\n{message}\n\nDevice: {device}\nBest time to reply: {when}\n\n- {customer} ({contact})",

      /* The order tray (js/order.js) builds one message from the items the
         visitor added. {items}, {priced} and {extras} arrive already typed as
         lines by that script, so this template stays the single place where
         the shop's wording lives. Nothing is submitted anywhere: WhatsApp
         opens with this text and the visitor sends it themselves. */
      order:
        "Hi {shop}, I would like to order these accessories:\n\n{items}\n\n{priced}\n{extras}Please confirm availability, the total and how I should pay."
    },

    /* ------------------------------------------------------------------ *
     * 6. INTERACTIVE LISTS
     * Repair request wizard + booking dropdowns are driven from here.
     * ------------------------------------------------------------------ */
    deviceTypes: [
      { id: "iphone", label: "iPhone", icon: "◆" },
      { id: "android", label: "Android", icon: "▤" }
    ],

    problems: [
      "Broken Screen",
      "Battery",
      "Charging",
      "Camera",
      "Speaker",
      "Software",
      "Water Damage",
      "Other"
    ],

    brands: [
      "Apple",
      "Samsung",
      "OnePlus",
      "Vivo",
      "OPPO",
      "Realme",
      "Xiaomi",
      "Motorola",
      "Google Pixel",
      "Nothing",
      "Other Android"
    ],

    /* The contact form (contact.html) offers these as "what do you need", and
       the same script builds the model suggestions from deviceBrands below.
       These are wording choices, not business claims: none of them promises a
       price, a turnaround time or a part in stock. */
    contactTopics: [
      "Repair question",
      "Ordering accessories",
      "Cover or glass fitment",
      "Quote or booking",
      "Data transfer",
      "Something else"
    ],

    /* Free-text window, so no implied promise that FIXON is standing by at a
       certain hour. The shop replies when it replies. */
    callbackTimes: ["Any time", "Before noon", "Afternoon", "Evening"],

    services: [
      { id: "Screen Replacement", icon: "▣", blurb: "Broken or damaged display repair." },
      { id: "Battery Replacement", icon: "▰", blurb: "Battery replacement and battery-related issues." },
      { id: "Charging Port", icon: "⌁", blurb: "Charging and connectivity problems." },
      { id: "Camera Repair", icon: "◉", blurb: "Camera-related hardware problems." },
      { id: "Speaker & Microphone", icon: "♫", blurb: "Audio and microphone issues." },
      { id: "Software Service", icon: "⌘", blurb: "Software troubleshooting and optimization." },
      { id: "iPhone Service", icon: "◆", blurb: "iPhone diagnostics and repair." },
      { id: "Android Service", icon: "▤", blurb: "Android device repair and troubleshooting." },
      { id: "Data Transfer", icon: "⇄", blurb: "Move data safely between devices." },
      { id: "Diagnostics", icon: "⌖", blurb: "Identify device problems before repair." }
    ],

    /* ------------------------------------------------------------------ *
     * 7. PRODUCT CATEGORIES (accessories.html -> "Categories")
     * "id" is the slug the shop filter and the photo file use; "match"
     * lists the words a spreadsheet may put in its category column and
     * still count as this category (compared lower-case, as substrings).
     * A category with no live products renders as "not listed yet" instead
     * of disappearing, so the grid stays honest about what is on the sheet.
     * ------------------------------------------------------------------ */
    productCategories: [
      { id: "cases", label: "Cases & Covers", photo: "phone-covers", match: ["case", "cover", "back cover", "guard"], blurb: "Clear, shockproof, silicone, printed and premium covers for the model you carry." },
      { id: "protectors", label: "Tempered Glass & Protectors", photo: "tempered-glass", match: ["tempered", "glass", "protector", "screen guard"], blurb: "Screen protection fitted to your model, aligned and bubble-free." },
      { id: "chargers", label: "Chargers & Adapters", photo: "chargers", match: ["charger", "adapter", "brick", "wall plug"], blurb: "Wall chargers and multi-port bricks matched to your device's charging standard." },
      { id: "cables", label: "USB & Charging Cables", photo: "cables", match: ["cable", "usb", "lightning", "micro-usb"], blurb: "USB-C, Lightning and Micro-USB cables - the most common cause of slow charging." },
      { id: "power-banks", label: "Power Banks", photo: "power-banks", match: ["power bank", "powerbank", "battery pack"], blurb: "Portable battery packs for travel, counted at the counter before you buy." },
      { id: "audio", label: "Earphones & TWS", photo: "earphones", match: ["earphone", "earpod", "tws", "headphone", "buds", "audio"], blurb: "Wired earphones and true wireless buds, with pairing and fit checked first." },
      { id: "speakers", label: "Bluetooth Speakers", photo: "bluetooth-speakers", match: ["speaker", "bluetooth speaker", "soundbox"], blurb: "Portable speakers for calls, music and video, tested at the counter." },
      { id: "wearables", label: "Smartwatches & Wearables", photo: "smartwatches", match: ["watch", "band", "fitness", "wearable"], blurb: "Smart bands and watches, plus straps and chargers for the ones you own." },
      { id: "stands", label: "Stands & Holders", photo: "phone-stands", match: ["stand", "holder", "mount", "tripod"], blurb: "Desk stands, car mounts and holders for hands-free viewing." },
      { id: "storage", label: "Memory Cards & Storage", photo: "memory-cards", match: ["memory card", "sd card", "microsd", "pendrive", "otg"], blurb: "Memory cards and OTG storage, format-checked before they leave the shop." },
      { id: "other", label: "Other Accessories", photo: "other", match: ["other", "misc", "general"], blurb: "Cable protectors, SIM tools, cleaning kits and everything else at the counter." }
    ],

    bookingTimes: ["10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM", "06:00 PM", "08:00 PM"],

    /* ------------------------------------------------------------------ *
     * 7. DEVICE FINDER (brands.html / models.html)
     * "match" is the text the shop filter looks for in a listing's brand,
     * so it must equal the brand value used in js/products.js.
     * "models" are fitment labels: they narrow the visible listings only.
     * Appearing here does NOT claim FIXON stocks a part or cover for that
     * device - edit this array to match what the shop actually carries.
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
     * a price only when its spreadsheet row supplies a number; until then the
     * card keeps showing the text below. See section 10 and GOOGLE-SHEETS.md.
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
      { id: "screen", kicker: "SCREEN REPAIR", title: "Cracked display?", text: "Bring the phone in - we diagnose it first, then quote before any work starts.", cta: "Book a screen repair", href: "booking.html?service=Screen%20Replacement" },
      { id: "covers", kicker: "COVERS & GLASS", title: "Protect what you fixed", text: "Covers, tempered glass and chargers for the model you actually carry.", cta: "Browse covers", href: "brands.html" },
      { id: "tools", kicker: "REPAIR TOOLS", title: "Workshop parts, checked on the bench", text: "Ask FIXON what is in hand for your device before you order anything online.", cta: "Talk to FIXON", href: "contact.html" }
    ],

    /* ------------------------------------------------------------------ *
     * 10. CATALOG SOURCE - the shop's product list
     * ------------------------------------------------------------------
     * Products and their prices live in a spreadsheet, NOT in code, so the
     * owner can add, edit, activate or hide an item without a developer.
     *
     * WHAT WORKS AND WHAT CANNOT (this is the setting that breaks most often):
     *   The browser must be able to fetch a *plain CSV* from another site, and
     *   that response must carry "Access-Control-Allow-Origin: *". A OneDrive,
     *   Google Drive, Dropbox or Excel-online SHARE link is an HTML viewer page
     *   for a .xlsx file and sends no such header, so it can never be read here
     *   - that is not a bug in this site, it is how browsers enforce cross-site
     *   reads. Use one of the two addresses below instead.
     *
     *   csvUrl           ONE public CSV address. Two proven shapes:
     *                    1. a CSV committed to this repository, read through
     *                       https://raw.githubusercontent.com/<user>/<repo>/main/<path>
     *                       (raw.githubusercontent.com does send the CORS
     *                       header). Editing the file on GitHub updates the live
     *                       catalogue on the next page load - no re-deploy.
     *                    2. a Google Sheet published to the web as CSV, or its
     *                       export?format=csv link (see GOOGLE-SHEETS.md).
     *                    Leave it as a SET_ME_* value and the shop pages
     *                    politely say the catalogue is not online yet - nothing
     *                    is invented to fill the grid.
     *   localFallback    A CSV inside this site, tried when csvUrl is not set
     *                    or fails. It also serves as the offline copy for
     *                    local testing, and as the stale-but-real copy if the
     *                    raw link is ever unreachable. Same file either way:
     *                    data/catalog.csv.
     *   servicesCsvUrl   Optional second list for services (same columns; an
     *                    "icon" column is ignored). Leave "" to use the
     *                    FIXON.services and FIXON.counterServices lists below.
     *   refreshMinutes   How often an open page re-reads the list. A published
     *                    Google CSV can lag several minutes behind an edit and
     *                    raw.githubusercontent.com caches briefly too, so the
     *                    site never claims real-time updates.
     *
     * REQUIRED COLUMNS (header row, any order):
     *   name, price, description, image, category, active
     * OPTIONAL COLUMNS:
     *   featured  (TRUE puts it first in the home page and category strips)
     *   brand     (device brand, keeps brands.html / models.html deep links)
     *   model     (device series or model, same reason)
     *   url       (link to a product page the shop wants to send people to)
     *
     * Only rows whose "active" column is TRUE are displayed.
     * NEVER PUT CUSTOMER DATA, ORDER NOTES OR PRIVATE KEYS IN THIS SHEET: a
     * published CSV is readable by anyone who has the link and search engines
     * may index it. There is no place for service-account credentials or API
     * keys in frontend code, and this site needs none.
     * ------------------------------------------------------------------ */
    catalog: {
      csvUrl: "https://raw.githubusercontent.com/nihalhussain555/Fixon/main/data/catalog.csv",
      localFallback: "data/catalog.csv",
      servicesCsvUrl: "",
      refreshMinutes: 30
    },

    /* ------------------------------------------------------------------ *
     * 11. COUNTER SERVICES (services.html)
     * Fitting and help services, kept apart from the repair jobs in section
     * 6 so visitors can tell a repair from a fitting. No price is set here
     * because that is the shop's to state; "price: null" hides the price
     * line entirely. Add or delete entries to match what the shop does.
     * ------------------------------------------------------------------ */
    counterServices: [
      { id: "Screen Protector Installation", price: null, photo: "tempered-glass", blurb: "Alignment, dust-off and bubble-free fitting, on the glass you buy here or bring in." },
      { id: "Accessories Fitting", price: null, photo: "phone-covers", blurb: "Covers, mounts, cables and chargers fitted and tested at the counter before you leave." },
      { id: "Mobile Cleaning & Maintenance", price: null, photo: "cleaning", blurb: "Port and speaker lint cleared, screen sanitised, case check - useful every few months." },
      { id: "Phone Setup Assistance", price: null, photo: "data", blurb: "New phone setup, accounts, transfers, permissions and settings done with you." }
    ],

    /* NOTE on honesty:
     * This file deliberately contains no repair prices, no review scores,
     * no repair counts and no warranty promises. Those are business facts
     * only FIXON can confirm. Product prices are the same kind of fact, so
     * they live in the owner's spreadsheet and stay hidden until a row
     * supplies one.
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

  /* WhatsApp: one number, one entry point, pre-filled message. */
  function whatsappUrl(messageKey, tokens) {
    if (!isSet(FIXON.whatsappNumber)) return null;
    var template = FIXON.messages[messageKey] || FIXON.messages.general;
    var base = Object.assign({ shop: FIXON.name }, tokens || {});
    return "https://wa.me/" + FIXON.whatsappNumber + "?text=" + encodeURIComponent(fill(template, base));
  }

  function telUrl() {
    return isSet(FIXON.phoneDial) ? "tel:+" + FIXON.phoneDial.replace(/[^\d]/g, "") : null;
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
    whatsappUrl: whatsappUrl,
    telUrl: telUrl,
    mapsSearchUrl: mapsSearchUrl,
    mapsEmbedUrl: mapsEmbedUrl,
    addressLines: addressLines,
    hoursText: hoursText,
    firstConfigured: firstConfigured,
    formatPrice: formatPrice,
    brandById: brandById,
    photoSrc: photoSrc,
    copy: copy
  };
})();
