/* ==========================================================================
   FIXON - "What's wrong with your phone?" repair request flow
   Builds a pre-filled WhatsApp message from the chosen device / brand /
   problem, and can hand the same selection to the booking form.
   Prices are never invented: the flow always ends in a human quote.
   ========================================================================== */
(function () {
  "use strict";

  var PROBLEM_TO_SERVICE = {
    "Broken Screen": "Screen Replacement",
    "Battery": "Battery Replacement",
    "Charging": "Charging Port",
    "Camera": "Camera Repair",
    "Speaker": "Speaker & Microphone",
    "Software": "Software Service",
    "Water Damage": "Diagnostics",
    "Other": "Diagnostics"
  };

  document.addEventListener("fixon:ready", init);

  function init() {
    var devices = document.getElementById("wizardDevices");
    var problems = document.getElementById("wizardProblems");
    if (!devices || !problems) return;

    var brandSel = document.getElementById("wizardBrand");
    var state = { device: null, problem: null, brand: "" };

    /* --- options rendered from central config --- */
    devices.innerHTML = window.FIXON.deviceTypes.map(function (d) {
      return '<button type="button" class="chip" data-device="' + d.id + '" data-label="' + d.label + '" aria-pressed="false">' +
        '<i aria-hidden="true">' + d.icon + "</i>" + d.label + "</button>";
    }).join("");

    problems.innerHTML = window.FIXON.problems.map(function (p) {
      return '<button type="button" class="chip" data-problem="' + p + '" data-label="' + p + '" aria-pressed="false">' + p + "</button>";
    }).join("");

    if (brandSel) {
      brandSel.innerHTML = '<option value="">Brand (optional)</option>' +
        window.FIXON.brands.map(function (b) { return '<option value="' + b + '">' + b + "</option>"; }).join("");
      brandSel.addEventListener("change", function () {
        state.brand = brandSel.value;
        update();
      });
    }

    function selectChip(group, chip, key) {
      group.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      state[key] = chip.dataset[key === "device" ? "device" : "problem"];
      state[key === "device" ? "deviceLabel" : "problemLabel"] = chip.dataset.label;
      update();
    }

    devices.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-device]");
      if (chip) selectChip(devices, chip, "device");
    });
    problems.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-problem]");
      if (chip) selectChip(problems, chip, "problem");
    });

    /* --- live summary --- */
    var summary = document.getElementById("wizardSummary");
    var quoteBtn = document.getElementById("wizardQuote");
    var formBtn = document.getElementById("wizardBooking");

    function deviceWord() {
      if (state.brand) return state.brand;
      return state.device ? state.deviceLabel : "phone";
    }

    function ready() { return !!state.device && !!state.problem; }

    function update() {
      if (summary) {
        summary.innerHTML = ready()
          ? "You selected: <b>" + state.deviceLabel + "</b> · <b>" + state.problemLabel + "</b>" +
            (state.brand ? " · <b>" + state.brand + "</b>" : "")
          : "Choose a device type and the problem to continue.";
      }
      [quoteBtn, formBtn].forEach(function (btn) {
        if (!btn) return;
        /* is-disabled = the visitor hasn't finished the form yet.
           is-unconfigured (used elsewhere) = the owner hasn't set a config value. */
        btn.classList.toggle("is-disabled", !ready());
        btn.setAttribute("aria-disabled", String(!ready()));
      });
      if (quoteBtn && ready()) {
        var href = window.fixonUtils.whatsappUrl("quote", {
          device: deviceWord(),
          problem: state.problemLabel.toLowerCase()
        });
        if (href) {
          quoteBtn.classList.remove("is-unconfigured");
          quoteBtn.removeAttribute("title");
          quoteBtn.href = href;
          quoteBtn.target = "_blank";
          quoteBtn.rel = "noopener";
        } else {
          quoteBtn.setAttribute("href", "#");
          quoteBtn.classList.add("is-unconfigured");
          quoteBtn.title = "FIXON.whatsappNumber is not set in js/config.js";
        }
      }
    }

    /* --- hand the selection to the booking form --- */
    function guard(fn) {
      return function (e) {
        if (!ready()) {
          e.preventDefault();
          window.showToast("Choose a device and the problem first", "warn");
          return;
        }
        fn(e);
      };
    }
    if (formBtn) {
      formBtn.addEventListener("click", guard(function (e) {
        e.preventDefault();
        var q = new URLSearchParams();
        q.set("service", PROBLEM_TO_SERVICE[state.problemLabel] || "Diagnostics");
        if (state.brand) q.set("brand", state.brand);
        q.set("issue", state.deviceLabel + " - " + state.problemLabel);
        location.href = "booking.html?" + q.toString();
      }));
    }
    if (quoteBtn) quoteBtn.addEventListener("click", guard(function () { /* follows href */ }));
    update();
  }
})();
