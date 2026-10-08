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

    bookingTimes: ["10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM", "06:00 PM", "08:00 PM"]

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
    firstConfigured: firstConfigured
  };
})();
