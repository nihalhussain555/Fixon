/* ==========================================================================
   FIXON - contact form
   Same honesty rule as the booking form: nothing is "sent" until the visitor
   actually sends it. The form validates, then hands the message to WhatsApp.
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("fixon:ready", init);

  function init() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    var status = document.getElementById("contactStatus");

    function show(kind, text) {
      status.className = "form-status is-visible is-" + kind;
      status.setAttribute("role", kind === "error" ? "alert" : "status");
      status.innerHTML = '<span aria-hidden="true">' +
        (kind === "info" ? '<i class="spinner"></i>' : kind === "success" ? "✓" : "!") +
        "</span><span>" + text + "</span>";
    }

    function field(name) { return form.querySelector('[name="' + name + '"]'); }

    function error(name, message) {
      var input = field(name);
      var label = input.closest("label");
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

    function validate() {
      var name = field("name").value.trim();
      var contact = field("contact").value.trim();
      var message = field("message").value.trim();
      var ok = true;

      error("name", name.length >= 2 ? "" : "Enter your name.");
      ok = ok && name.length >= 2;

      var isEmail = /.+@.+\..+/.test(contact);
      var isPhone = contact.replace(/[^\d]/g, "").length >= 8 && contact.replace(/[^\d]/g, "").length <= 15;
      error("contact", isEmail || isPhone ? "" : "Give a phone number (8-15 digits) or an email address.");
      ok = ok && (isEmail || isPhone);

      error("message", message.length >= 10 ? "" : "Tell us a bit more (at least 10 characters).");
      ok = ok && message.length >= 10;

      if (!ok) show("error", "Please fix the highlighted fields.");
      return ok;
    }

    form.addEventListener("input", function (e) {
      if (e.target.closest(".field-error")) error(e.target.name, "");
    });

    function buildUrl() {
      return window.fixonUtils.whatsappUrl("contact", {
        topic: field("topic").value,
        message: field("message").value.trim(),
        customer: field("name").value.trim(),
        contact: field("contact").value.trim()
      });
    }

    var waBtn = document.getElementById("contactWhatsBtn");
    if (waBtn) {
      waBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!validate()) return;
        var url = buildUrl();
        if (!url) { show("error", "FIXON.whatsappNumber is not set in js/config.js yet."); return; }
        window.open(url, "_blank", "noopener");
        show("success", "WhatsApp is opening with your message. Press send there so it reaches FIXON.");
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
        var url = buildUrl();
        if (url) {
          window.open(url, "_blank", "noopener");
          show("success", "Your message is ready in WhatsApp. Press send there so it reaches FIXON.");
        } else {
          show("success", "Your message is validated and ready. WhatsApp is not configured in js/config.js yet, so please call or set the number.");
        }
      }, 380);
    });
  }
})();
