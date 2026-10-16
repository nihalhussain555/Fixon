/* FIXON - central business configuration.
 *
 * Every page reads contact details, WhatsApp links and the interactive
 * option lists from this file. Change a value here once - never hard-code
 * it inside HTML or other scripts.
 *
 * Any value still set to a "SET_ME_*" sentinel is treated as NOT configured:
 * buttons that depend on it are disabled with an explanatory toast instead
 * of sending the visitor to a fake number or an empty map.
 */
(function () {
  var PLACEHOLDER = /^SET_ME/;

  var FIXON = {
    /* ------------------------------------------------------------------ *
     * 1. IDENTITY
     * ------------------------------------------------------------------ */
    name: "FIXON",
    tagline: "Mobile Repair, Services & Accessories",
    heroHeadline: "Your Phone. Fixed Right.",
    heroSupport:
      "Professional smartphone repair, diagnostics and accessories for Android and iPhone.",

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
      cover: "Hi {shop}, I like the {product} cover for {model}. Do you have it in stock?",
      booking:
        "Hi {shop}, I want to book a repair.\n\nName: {customer}\nPhone: {phone}\nDevice: {brand} {model}\nService: {service}\nPreferred: {date} at {time}\nIssue: {issue}",
      cart: "Hi {shop}, I would like to order these items:\n{items}",
      contact:
        "Hi {shop}, I have a question about {topic}.\n\n{message}\n\n- {customer} ({contact})"
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

    accessoryCategories: [
      "Phone Covers",
      "Tempered Glass",
      "Chargers",
      "Cables",
      "Power Adapters",
      "Earphones",
      "TWS",
      "Car Chargers",
      "Phone Stands"
    ],

    coverStyles: [
      "Clear",
      "Shockproof",
      "Silicone",
      "MagSafe",
      "Printed",
      "Premium",
      "Minimal",
      "Custom"
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
     * Prices are business facts, so none are set. A listing shows its price
     * only when a numeric "price" is added to it in js/products.js; until
     * then cards keep showing "Price on request".
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
    ]

    /* NOTE on honesty:
     * This file deliberately contains no repair prices, no review scores,
     * no repair counts and no warranty promises. Those are business facts
     * only FIXON can confirm. Add them here once they are real, then render
     * them from the same place.
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
    photoSrc: photoSrc
  };
})();
