/* ==========================================================================
   FIXON - repair booking form
   There is no backend in this project, so the form is honest about what it
   can do: it validates, keeps a local draft, and hands the finished request
   to WhatsApp (or the clipboard). It never claims the shop has received it.
   ========================================================================== */
(function () {
  "use strict";

  var DRAFT = "fixon_booking_draft";

  document.addEventListener("fixon:ready", init);

  function init() {
    var form = document.getElementById("bookingForm");
    if (!form) return;

    fillSelect("serviceSelect", window.FIXON.services.map(function (s) { return s.id; }), "Select a service");
    fillSelect("brandSelect", window.FIXON.brands, "Select brand");
    fillSelect("timeSelect", window.FIXON.bookingTimes, "Select time");

    prefillFromUrl(form);
    restoreDraft(form);

    var dateInput = form.querySelector('[name="date"]');
    if (dateInput) dateInput.min = new Date().toISOString().split("T")[0];

    form.addEventListener("input", function () { saveDraft(form); });
    form.addEventListener("change", function (e) {
      if (e.target && e.target.name) clearFieldError(form, e.target);
    });
    form.addEventListener("submit", function (e) { onSubmit(e, form); });

    var waBtn = document.getElementById("bookingWhatsBtn");
    if (waBtn) {
      waBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!validate(form)) return;
        var url = messageUrl(form);
        if (!url) { window.showToast("FIXON.whatsappNumber is not set in js/config.js", "warn"); return; }
        window.open(url, "_blank", "noopener");
        setStatus("success", "WhatsApp is opening with your details. Press send there so the request reaches FIXON.");
      });
    }

    var copyBtn = document.getElementById("bookingCopyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!validate(form)) return;
        var text = buildMessage(form);
        var preview = document.getElementById("bookingPreview");
        var actions = document.getElementById("formNext");
        if (preview) preview.value = text;
        if (actions) actions.hidden = false;
        copyText(text).then(function (ok) {
          if (ok) {
            window.showToast("Request copied to clipboard", "success");
            return;
          }
          if (preview) { preview.focus(); preview.select(); }
          window.showToast("Clipboard blocked - the text is selected, press Ctrl + C", "warn");
        });
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Selects built from central config so options can't drift apart
   * ------------------------------------------------------------------ */
  function fillSelect(id, values, placeholder) {
    var el = document.getElementById(id);
    if (!el) return;
    var keep = el.value;
    el.innerHTML = '<option value="">' + placeholder + "</option>" +
      values.map(function (v) { return '<option value="' + v + '">' + v + "</option>"; }).join("");
    if (keep) el.value = keep;
  }

  function prefillFromUrl(form) {
    var q = new URLSearchParams(location.search);
    [["service", "serviceSelect"], ["brand", "brandSelect"], ["time", "timeSelect"],
     ["name", "name"], ["phone", "phone"], ["model", "model"], ["issue", "issue"], ["date", "date"]]
      .forEach(function (pair) {
        var val = q.get(pair[0]);
        if (!val) return;
        var field = form.querySelector('[name="' + pair[1] + '"]') || document.getElementById(pair[1]);
        if (!field) return;
        field.value = val;
        if (field.tagName === "SELECT" && field.selectedIndex === -1) field.value = "";
      });
  }

  function saveDraft(form) {
    try {
      localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(form))));
    } catch (e) { /* storage blocked: draft simply isn't kept */ }
  }

  function restoreDraft(form) {
    if (new URLSearchParams(location.search).toString()) return; /* URL wins */
    var raw;
    try { raw = localStorage.getItem(DRAFT); } catch (e) { return; }
    if (!raw) return;
    var draft;
    try { draft = JSON.parse(raw); } catch (e) { return; }
    Object.keys(draft).forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      if (field && !field.value) field.value = draft[key];
    });
  }

  /* ------------------------------------------------------------------ *
   * Validation
   * ------------------------------------------------------------------ */
  var RULES = {
    name: function (v) { return v.trim().length >= 2 || "Enter your name (at least 2 characters)."; },
    phone: function (v) {
      var digits = v.replace(/[^\d]/g, "");
      return (digits.length >= 8 && digits.length <= 15) || "Enter a reachable phone number with 8-15 digits.";
    },
    brand: function (v) { return !!v || "Choose your device brand."; },
    model: function (v) { return v.trim().length >= 2 || "Enter your device model, e.g. iPhone 15 Pro."; },
    service: function (v) { return !!v || "Choose the service you need."; },
    date: function (v) {
      if (!v) return "Pick a preferred date.";
      var chosen = new Date(v + "T00:00:00");
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (chosen < today) return "Choose today or a future date.";
      var limit = new Date(today); limit.setFullYear(limit.getFullYear() + 1);
      return chosen <= limit || "That date looks too far ahead.";
    },
    time: function (v) { return !!v || "Pick a preferred time."; },
    issue: function (v) { return v.trim().length === 0 || v.trim().length >= 5 || "Add a little more detail (5+ characters), or clear the box."; }
  };

  function fieldOf(form, name) { return form.querySelector('[name="' + name + '"]'); }

  function clearFieldError(form, field) {
    var label = field && field.closest("label");
    if (!label) return;
    label.classList.remove("field-error");
    field.removeAttribute("aria-invalid");
    var msg = label.querySelector(".field-msg");
    if (msg) msg.textContent = "";
  }

  function markError(form, field, message) {
    var label = field.closest("label");
    if (!label) return;
    label.classList.add("field-error");
    field.setAttribute("aria-invalid", "true");
    var msg = label.querySelector(".field-msg");
    if (!msg) {
      msg = document.createElement("span");
      msg.className = "field-msg";
      label.appendChild(msg);
    }
    msg.textContent = message;
  }

  function validate(form) {
    var firstBad = null;
    Object.keys(RULES).forEach(function (key) {
      var field = fieldOf(form, key);
      if (!field) return;
      var result = RULES[key](field.value || "");
      if (result === true) clearFieldError(form, field);
      else {
        markError(form, field, result);
        if (!firstBad) firstBad = field;
      }
    });
    if (firstBad) {
      firstBad.focus();
      setStatus("error", "Please fix the highlighted fields before sending your request.");
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Payload + states
   * ------------------------------------------------------------------ */
  function payload(form) {
    var d = Object.fromEntries(new FormData(form));
    return {
      customer: d.name, phone: d.phone, brand: d.brand, model: d.model,
      service: d.service, date: d.date, time: d.time, issue: d.issue || "-"
    };
  }

  function buildMessage(form) {
    return window.fixonUtils.fill(
      window.FIXON.messages.booking,
      Object.assign({ shop: window.FIXON.name }, payload(form))
    );
  }

  function messageUrl(form) {
    return window.fixonUtils.whatsappUrl("booking", payload(form));
  }

  function setStatus(kind, text) {
    var box = document.getElementById("formStatus");
    if (!box) return;
    box.className = "form-status is-visible is-" + kind;
    box.innerHTML = '<span aria-hidden="true">' +
      (kind === "info" ? '<i class="spinner"></i>' : kind === "success" ? "✓" : "!") +
      "</span><span>" + text + "</span>";
    box.setAttribute("role", kind === "error" ? "alert" : "status");
  }

  function setBusy(busy, form) {
    var btn = form.querySelector('[type="submit"]');
    if (!btn) return;
    btn.setAttribute("aria-busy", String(busy));
    btn.disabled = busy;
    btn.dataset.label = btn.dataset.label || btn.textContent.trim();
    btn.textContent = busy ? "Preparing your request…" : btn.dataset.label;
  }

  function onSubmit(e, form) {
    e.preventDefault();
    if (!validate(form)) {
      var panel = document.getElementById("formNext");
      if (panel) panel.hidden = true;
      return;
    }

    setBusy(true, form);
    setStatus("info", "Preparing your request…");

    /* No network call exists yet, so this only assembles the request. */
    setTimeout(function () {
      setBusy(false, form);
      var url = messageUrl(form);
      var actions = document.getElementById("formNext");
      try {
        localStorage.setItem("fixon_last_booking", JSON.stringify(payload(form)));
      } catch (err) {
        setStatus("error", "Your browser blocked local storage, so this draft cannot be kept on this device.");
        return;
      }
      var preview = document.getElementById("bookingPreview");
      if (preview) preview.value = buildMessage(form);

      if (url) {
        var link = document.getElementById("formSendWa");
        if (link) {
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener";
          link.hidden = false;
        }
        setStatus("success", "Your request is ready. It stays on this device until you send it - open WhatsApp below and press send.");
      } else {
        setStatus("success", "Your request is ready. FIXON's WhatsApp number is not configured yet, so copy the text below and send it another way.");
      }
      if (actions) actions.hidden = false;
      if (actions) actions.scrollIntoView({ block: "nearest", behavior: document.documentElement.getAttribute("data-motion") === "reduced" ? "auto" : "smooth" });
    }, 420);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

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
})();
