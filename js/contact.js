/* ==========================================================================
   FIXON - contact form
   Same honesty rule as the booking form: nothing is "sent" until the visitor
   actually sends it. The form validates here, then hands the finished text to
   WhatsApp or the clipboard. It never claims the shop has received anything,
   because there is no backend that could tell it.

   Fields are filled from js/config.js (contactTopics, deviceBrands,
   callbackTimes) so the wording lives in one file, and the message the visitor
   copies is built from the same messages.contact template as the WhatsApp link
   - one wording, two exits.
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("fixon:ready", init);

  /* Optional controls fall back to these, so the message never reads
     "Device: " with nothing after it. */
  var NO_DEVICE = "Not specified";
  var ANY_TIME = "Any time";

  function init() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    var status = document.getElementById("contactStatus");
    var U = window.fixonUtils;
    var CFG = window.FIXON;

    fill("contactTopic", CFG.contactTopics, null);
    var brandSel = fill("contactBrand", CFG.deviceBrands.map(function (b) { return b.label; }), "Select brand");
    /* No blank option here: the first entry is "Any time", which is a real
       answer and needs no explanation. Brand is the one genuinely optional
       control, so it is the only one with a placeholder. */
    fill("contactWhen", CFG.callbackTimes, null);
    var modelInput = document.getElementById("contactModel");
    var suggestions = document.getElementById("modelSuggestions");

    /* The model list is advice, not a constraint: typing anything else is
       allowed, which matters because a datalist never blocks free text. */
    if (brandSel && suggestions) {
      brandSel.addEventListener("change", function () {
        var brand = brandFor(CFG, brandSel.value);
        while (suggestions.firstChild) suggestions.removeChild(suggestions.firstChild);
        if (!brand) return;
        brand.models.forEach(function (model) {
          var option = document.createElement("option");
          option.value = model;
          suggestions.appendChild(option);
        });
      });
    }

    /* ------------------------------------------------------------------ *
     * Validation - runs on blur so a half-typed name is not shouted at, and
     * clears the moment the field is corrected.
     * ------------------------------------------------------------------ */
    function field(name) { return form.querySelector('[name="' + name + '"]'); }

    function setError(name, message) {
      var input = field(name);
      if (!input) return;
      var label = input.closest("label");
      if (!label) return;
      label.classList.toggle("field-error", !!message);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      var msg = label.querySelector(".field-msg");
      if (!msg) {
        msg = document.createElement("span");
        msg.className = "field-msg";
        label.appendChild(msg);
      }
      msg.textContent = message || "";
    }

    function isEmail(value) { return /.+@.+\..+/.test(value); }

    function isPhone(value) {
      var digits = value.replace(/[^\d]/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }

    var RULES = [
      { name: "name", test: function (v) { return v.length >= 2; }, msg: "Enter your name." },
      { name: "contact", test: function (v) { return isEmail(v) || isPhone(v); }, msg: "Give a phone number (8-15 digits) or an email address." },
      { name: "message", test: function (v) { return v.length >= 10; }, msg: "Tell us a bit more (at least 10 characters)." }
    ];

    function checkRule(rule) {
      var input = field(rule.name);
      if (!input) return true;
      var ok = rule.test(input.value.trim());
      setError(rule.name, ok ? "" : rule.msg);
      return ok;
    }

    /* Nothing is flagged before a field has been touched: validate() runs on
       blur for one field and on submit for all three. */
    function validate() {
      var ok = true;
      RULES.forEach(function (rule) { if (!checkRule(rule)) ok = false; });
      if (!ok) show("error", "Please fix the highlighted fields.");
      return ok;
    }

    form.addEventListener("blur", function (e) {
      var rule = RULES.filter(function (r) { return e.target && e.target.name === r.name; })[0];
      if (rule) checkRule(rule);
    }, true);

    form.addEventListener("input", function (e) {
      if (e.target && e.target.closest(".field-error")) setError(e.target.name, "");
    });

    /* ------------------------------------------------------------------ *
     * One message, built once, used by both exits
     * ------------------------------------------------------------------ */
    function tokens() {
      var brand = brandFor(CFG, brandSel ? brandSel.value : "");
      var model = modelInput ? modelInput.value.trim() : "";
      var device;
      if (brand && model) {
        /* "Apple iPhone" plus "iPhone 13" would read "Apple iPhone iPhone 13",
           so a model that already names its brand is left alone. */
        var namesBrand = brand.match && model.toLowerCase().indexOf(brand.match.toLowerCase()) > -1;
        device = namesBrand ? model : brand.label + " " + model;
      } else {
        device = brand ? brand.label : (model || NO_DEVICE);
      }
      var when = valueOf("when");
      return {
        shop: CFG.name,
        topic: valueOf("topic") || "your services",
        message: valueOf("message"),
        device: device,
        when: when || ANY_TIME,
        customer: valueOf("name"),
        contact: valueOf("contact")
      };
    }

    function valueOf(name) {
      var input = field(name);
      return input ? input.value.trim() : "";
    }

    function buildMessage() {
      return U.fill(CFG.messages.contact, tokens());
    }

    function messageUrl() {
      if (!U.isSet(CFG.whatsappNumber)) return null;
      return "https://wa.me/" + CFG.whatsappNumber + "?text=" + encodeURIComponent(buildMessage());
    }

    /* The preview box is what makes "copy" trustworthy: the visitor sees the
       exact text leaving their device. */
    function revealPreview() {
      var box = document.getElementById("contactPreviewBox");
      var area = document.getElementById("contactPreview");
      if (!box || !area) return null;
      area.value = buildMessage();
      box.hidden = false;
      return area;
    }

    function openWhatsApp() {
      var url = messageUrl();
      if (!url) return null;
      window.open(url, "_blank", "noopener");
      return url;
    }

    var waBtn = document.getElementById("contactWhatsBtn");
    if (waBtn) {
      waBtn.addEventListener("click", function () {
        if (!validate()) return;
        revealPreview();
        if (openWhatsApp()) {
          show("success", "WhatsApp is opening with your message. Press send there so it reaches FIXON.");
        } else {
          show("error", "FIXON.whatsappNumber is not set in js/config.js yet, so nothing can be opened. Copy the text below instead.");
        }
      });
    }

    var copyBtn = document.getElementById("contactCopyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!validate()) return;
        var area = revealPreview();
        U.copy(buildMessage()).then(function (ok) {
          if (ok) {
            window.showToast("Message copied to clipboard", "success");
            return;
          }
          if (area) { area.focus(); area.select(); }
          window.showToast("Clipboard blocked - the text is selected, press Ctrl + C", "warn");
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var submit = form.querySelector('[type="submit"]');
      submit.setAttribute("aria-busy", "true");
      submit.disabled = true;
      show("info", "Preparing your message…");

      setTimeout(function () {
        submit.setAttribute("aria-busy", "false");
        submit.disabled = false;
        if (!validate()) return;
        revealPreview();
        if (openWhatsApp()) {
          show("success", "Your message is ready in WhatsApp. Press send there so it reaches FIXON.");
        } else {
          show("success", "Your message is validated and shown below. WhatsApp is not configured in js/config.js yet, so copy it or call the shop.");
        }
      }, 380);
    });

    /* ------------------------------------------------------------------ *
     * Status line and selects
     * ------------------------------------------------------------------ */
    function show(kind, text) {
      status.className = "form-status is-visible is-" + kind;
      status.setAttribute("role", kind === "error" ? "alert" : "status");
      while (status.firstChild) status.removeChild(status.firstChild);
      var mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = kind === "info" ? "" : kind === "success" ? "✓" : "!";
      if (kind === "info") {
        var spinner = document.createElement("i");
        spinner.className = "spinner";
        mark.appendChild(spinner);
      }
      var body = document.createElement("span");
      body.textContent = text;
      status.appendChild(mark);
      status.appendChild(body);
    }

    /* Options come from config, so a shop can reword them without HTML. */
    function fill(id, values, placeholder) {
      var el = document.getElementById(id);
      if (!el) return null;
      while (el.firstChild) el.removeChild(el.firstChild);
      if (placeholder) {
        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = placeholder;
        el.appendChild(empty);
      }
      values.forEach(function (value) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        el.appendChild(option);
      });
      if (!placeholder && values.length) el.value = values[0];
      return el;
    }
  }

  /* deviceBrands labels are the long forms ("Apple iPhone"), and the models
     array belongs to the same entry, so brand and suggestions cannot drift. */
  function brandFor(CFG, label) {
    var list = CFG.deviceBrands;
    for (var i = 0; i < list.length; i++) if (list[i].label === label) return list[i];
    return null;
  }
})();
