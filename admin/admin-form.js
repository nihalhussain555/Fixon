/* ==========================================================================
   FIXON admin - the product form, shared by add-product and edit-product
   --------------------------------------------------------------------------
   One form, two modes. Every value is validated here before the save POSTs,
   but the database re-checks everything anyway (CHECK constraints + RLS),
   so a bypassed browser still cannot store a negative price or a 10-page
   description.

   Image rule, the one the shop asked for: the photo chosen in this form is
   the photo the site shows. Pressing Save uploads whatever is still only
   chosen, so there is no second step to forget, and the saved address is then
   loaded the way a visitor would - if Supabase cannot serve it, the dashboard
   says which setting to fix instead of the shop quietly showing a different
   picture. An external URL is allowed too, and a blob: preview address is
   rejected on save, because a blob: in the database would be invisible to
   every visitor but this browser tab.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var A = window.fixonAdmin;
  var el = A.el;

  function start(mode, existing) {
    var S = window.fixonSupabase;
    var page = document.getElementById("formHost");
    var originalImage = existing ? String(existing.image_url || "") : "";
    var dirty = false;

    /* ------------------------------------------------------------ *
     * Fields
     * ------------------------------------------------------------ */
    function field(key, labelText, control, hint, full) {
      var f = el("div", "field" + (full ? " full" : ""));
      var lab = el("label", null, labelText);
      lab.htmlFor = "f_" + key;
      f.appendChild(lab);
      f.appendChild(control);
      if (hint) f.appendChild(el("span", "hint", hint));
      f.appendChild(el("span", "err", ""));
      f.dataset.key = key;
      return f;
    }

    function markError(key, message) {
      var f = page.querySelector('[data-key="' + key + '"]');
      if (!f) return;
      f.classList.toggle("bad", !!message);
      var e = f.querySelector(".err");
      if (e) e.textContent = message || "";
    }

    function input(key, type, value, attrs) {
      var i = el("input");
      i.type = type;
      i.id = "f_" + key;
      i.value = value == null ? "" : String(value);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === "valueList") { i.setAttribute("list", "f_catlist"); return; }
        i.setAttribute(k, attrs[k]);
      });
      i.addEventListener("input", function () { dirty = true; markError(key, ""); });
      return i;
    }

    var nameIn = input("name", "text", existing && existing.name, { maxlength: "120", placeholder: "e.g. Clear shockproof cover - iPhone 15" });
    var descTa = el("textarea");
    descTa.id = "f_description";
    descTa.maxLength = 800;
    descTa.value = (existing && existing.description) || "";
    descTa.addEventListener("input", function () { dirty = true; });
    var priceIn = input("price", "text", existing && existing.price, { inputmode: "decimal", placeholder: "1499  (leave empty for \"Price on request\")" });
    var catIn = input("category", "text", existing && existing.category, { maxlength: "60", placeholder: "e.g. cases", valueList: true });
    var stockIn = input("stock", "number", existing && existing.stock, { min: "0", step: "1", placeholder: "e.g. 12  (empty = not tracked)" });
    var noteIn = input("stock_note", "text", existing && existing.stock_note, { maxlength: "60", placeholder: "In stock at the counter" });

    var activeIn = el("input");
    activeIn.type = "checkbox";
    activeIn.id = "f_is_active";
    activeIn.checked = existing ? !!existing.is_active : true;
    activeIn.addEventListener("change", function () { dirty = true; });

    var featIn = el("input");
    featIn.type = "checkbox";
    featIn.id = "f_featured";
    featIn.checked = existing ? !!existing.featured : false;
    featIn.addEventListener("change", function () { dirty = true; });

    var imageIn = input("image_url", "text", existing && existing.image_url,
      { maxlength: "500", placeholder: "https://... or images/products/cover-blue.jpg (or use Upload image below)" });

    var grid = el("div", "form-grid");
    grid.appendChild(field("name", "Product name *", nameIn, "Shown on the card and in WhatsApp orders.", true));
    grid.appendChild(field("description", "Description", descTa, "Plain text, up to 800 characters.", true));
    grid.appendChild(field("price", "Price", priceIn, "Digits only. Empty keeps the card at \"Price on request\" - the site never invents a number."));
    grid.appendChild(field("category", "Category", catIn, "Type or pick the shop's category slug (cases, protectors, mugs...)."));
    grid.appendChild(field("stock", "Stock quantity", stockIn, "0 shows \"Out of stock\" and blocks ordering. Empty = not tracked."));
    grid.appendChild(field("stock_note", "Stock note (optional)", noteIn, "Free text shown beside the dot, e.g. \"3 at the counter\"."));

    var stateRow = el("div", "field full");
    var stateBox = el("div", "switch");
    stateBox.appendChild(activeIn);
    var labA = el("label", null, "Active - visible to customers");
    labA.htmlFor = "f_is_active";
    stateBox.appendChild(labA);
    stateRow.appendChild(stateBox);
    var featBox = el("div", "switch");
    featBox.appendChild(featIn);
    var labF = el("label", null, "Featured - promoted on the home page strip");
    labF.htmlFor = "f_featured";
    featBox.appendChild(labF);
    stateRow.appendChild(featBox);
    grid.appendChild(stateRow);

    var listEl = el("datalist");
    listEl.id = "f_catlist";
    ((window.FIXON && window.FIXON.productCategories) || []).forEach(function (c) {
      var o = el("option", null, c.id);
      o.value = c.id;
      listEl.appendChild(o);
    });
    page.appendChild(listEl);
    page.appendChild(grid);

    /* ------------------------------------------------------------ *
     * Image upload + preview
     * ------------------------------------------------------------ */
    var imgBlock = el("div", "field full");
    imgBlock.appendChild(el("label", null, "Product image"));
    var drop = el("div", "img-drop", "No preview yet");
    var preview = null;
    imgBlock.appendChild(drop);

    var fileIn = el("input");
    fileIn.type = "file";
    fileIn.id = "f_image_file";
    fileIn.accept = "image/jpeg,image/png,image/webp";
    fileIn.style.display = "none";

    var pickBtn = el("button", "btn btn-ghost", "Choose file...");
    pickBtn.type = "button";
    pickBtn.addEventListener("click", function () { fileIn.click(); });

    var upBtn = el("button", "btn btn-quiet", "Upload image");
    upBtn.type = "button";

    var imgMsg = el("span", null, "");
    imgMsg.style.cssText = "color:var(--muted);font-size:.82rem;";

    var actions = el("div", "img-actions");
    actions.appendChild(pickBtn);
    actions.appendChild(upBtn);
    actions.appendChild(imgMsg);
    imgBlock.appendChild(actions);
    imgBlock.appendChild(fileIn);
    imgBlock.appendChild(el("span", "hint", "JPEG, PNG or WebP up to 5 MB. A chosen file uploads with the Save press, so the photo you pick is the photo the shop shows. Upload image does it immediately instead, and typing an address in the box above replaces it."));
    grid.appendChild(imgBlock);

    /* previewBlob kept so an abandoned choice releases its object URL.
       pendingFile is the file chosen but not uploaded yet - Save uploads it. */
    var previewBlob = null;
    var pendingFile = null;
    function showPreview(src) {
      if (preview) preview.remove();
      drop.textContent = "";
      if (!src) { drop.textContent = "No preview yet"; return; }
      preview = el("img");
      preview.src = src;
      preview.alt = "";
      drop.appendChild(preview);
    }

    fileIn.addEventListener("change", function () {
      var file = fileIn.files && fileIn.files[0];
      markError("image_url", "");
      if (!file) { pendingFile = null; showPreview(imageIn.value.trim()); imgMsg.textContent = ""; return; }
      if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) {
        imgMsg.textContent = "That file is a " + (file.type || "unknown") + " - choose a JPEG, PNG or WebP.";
        pendingFile = null;
        showPreview(imageIn.value.trim());
        fileIn.value = "";
        return;
      }
      if (file.size > S.maxImageBytes) {
        imgMsg.textContent = "That image is " + (file.size / 1048576).toFixed(1) + " MB - the limit is 5 MB.";
        pendingFile = null;
        fileIn.value = "";
        return;
      }
      /* Chosen, not uploaded: Save picks this up and uploads it first, so the
         photo can never be stranded in the form. */
      pendingFile = file;
      if (previewBlob) URL.revokeObjectURL(previewBlob);
      previewBlob = URL.createObjectURL(file);
      showPreview(previewBlob);
      imgMsg.textContent = "Chosen: " + file.name + " (" + Math.round(file.size / 1024) +
        " KB). It uploads when you press " + (mode === "add" ? "Create product" : "Save changes") +
        ", or press Upload image to do it now.";
    });

    /* One upload path, used by the button and by Save. Without a pending file
       it resolves the address already in the box, so callers always get the
       value the row is about to hold. */
    function uploadPending() {
      var file = pendingFile;
      if (!file) return Promise.resolve(String(imageIn.value || "").trim());
      setUploadBusy(true);
      return S.uploadImage(file).then(function (url) {
        pendingFile = null;
        imageIn.value = url;
        dirty = true;
        if (previewBlob) { URL.revokeObjectURL(previewBlob); previewBlob = null; }
        showPreview(url);           /* the real stored address, previewed */
        fileIn.value = "";
        return readableCheck(url).then(function (warning) {
          imgMsg.textContent = warning || "Uploaded to Supabase - this is the photo the shop will show.";
          if (warning) A.toast(warning, "warn");
          return url;
        });
      }, function (err) {
        imgMsg.textContent = (err && err.message) || "The upload failed.";
        throw err;
      }).finally(function () { setUploadBusy(false); });
    }

    function setUploadBusy(on) {
      upBtn.disabled = on;
      pickBtn.disabled = on;
      upBtn.textContent = on ? "Uploading..." : "Upload image";
    }

    /* The address is loaded the way a visitor loads it. Only our own bucket is
       probed: a private bucket or a renamed one stores a perfectly-shaped
       address that renders nowhere, and that is a setting to name, not a
       product to blame. */
    function readableCheck(url) {
      if (!url || !S.isStorageUrl(url)) return Promise.resolve(null);
      return S.imageReadable(url).then(function (ok) {
        if (ok) return null;
        return "Supabase accepted the file but is not serving it back yet, so the shop " +
          "cannot show this photo. Open Storage -> " + "product-images -> Settings and turn " +
          "Public on (or run supabase/SETUP.sql section 5), then reload the product.";
      }, function () { return null; });
    }

    upBtn.addEventListener("click", function () {
      if (!pendingFile) {
        /* Nothing chosen: if the preview is still the stored photo, say so
           instead of failing mysteriously. */
        imgMsg.textContent = fileIn.value ? "Choose a file first." : "No new file chosen - the saved image stays as it is.";
        return;
      }
      uploadPending();
    });

    showPreview(originalImage || imageIn.value.trim());

    /* ------------------------------------------------------------ *
     * Save / cancel
     * ------------------------------------------------------------ */
    var bar = el("div");
    bar.style.cssText = "display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap;";
    var saveBtn = el("button", "btn btn-primary", mode === "add" ? "Create product" : "Save changes");
    saveBtn.type = "button";
    var cancel = el("a", "btn btn-ghost", "Cancel");
    cancel.href = "products.html";
    var statusLine = el("span", null, "");
    statusLine.style.cssText = "color:var(--muted);font-size:.84rem;";
    bar.appendChild(saveBtn);
    bar.appendChild(cancel);
    bar.appendChild(statusLine);
    page.appendChild(bar);

    function collect() {
      var errs = {};
      var name = nameIn.value.trim();
      if (name.length < 2) errs.name = "Give the product a name of at least 2 characters.";
      var priceText = priceIn.value.trim();
      if (priceText) {
        var digits = priceText.replace(/[^\d.]/g, "");
        var n = Number(digits);
        if (!digits || !isFinite(n) || n <= 0) errs.price = "The price must be a positive number, or empty for \"Price on request\".";
        else if (n >= 10000000) errs.price = "That price is beyond what the shop can store (under 1 crore).";
      }
      var stockText = stockIn.value.trim();
      if (stockText !== "") {
        var s = Number(stockText);
        if (!isFinite(s) || s < 0 || Math.floor(s) !== s) errs.stock = "Stock must be a whole number of 0 or more, or empty.";
      }
      var img = imageIn.value.trim();
      if (img && /^(javascript|data|vbscript|blob):/i.test(img)) {
        errs.image_url = "That image address is not usable - paste an https:// link or upload a file.";
      }
      Object.keys(errs).forEach(function (k) { markError(k, errs[k]); });
      markError("name", errs.name || "");
      if (Object.keys(errs).length) return null;
      return {
        name: name,
        description: descTa.value,
        price: priceText,
        category: catIn.value,
        image_url: img,
        stock: stockText,
        stock_note: noteIn.value,
        featured: featIn.checked,
        is_active: activeIn.checked
      };
    }

    saveBtn.addEventListener("click", function () {
      var values = collect();
      if (!values) {
        A.toast("Fix the highlighted fields first.", "error");
        return;
      }
      saveBtn.disabled = true;
      cancel.style.pointerEvents = "none";
      statusLine.textContent = pendingFile ? "Uploading photo..." : "Saving...";

      /* The chosen file goes up first and its address becomes the row's, so a
         photo picked in this form cannot be left behind by a Save press. A
         failed upload stops the save: a product created without the picture
         the shop just chose is the bug this flow is meant to remove. */
      var step = uploadPending().then(function (url) {
        values.image_url = url;
        statusLine.textContent = "Saving...";
        return mode === "add"
          ? S.createProduct(values)
          : S.updateProduct(existing.id, values).then(function (row) {
              /* Replaced image? Clean the old bucket object, but only after the
                 new row is safely saved, and only if nothing else references
                 it (the helper checks). */
              if (originalImage && values.image_url !== originalImage) {
                return S.deleteImageByUrl(originalImage).then(function (removed) {
                  return { row: row, imageRemoved: removed };
                });
              }
              return { row: row, imageRemoved: false };
            });
      });

      step.then(function (result) {
        dirty = false;
        if (mode === "add") {
          statusLine.textContent = "Created.";
          A.toast(values.name + (values.is_active ? " is live on the shop." : " is saved as a draft - tick Active to show it."), "success");
          setTimeout(function () { window.location.href = "products.html"; }, 700);
        } else {
          var extra = result && result.imageRemoved ? " The replaced photo was deleted from storage."
            : (result && originalImage && values.image_url !== originalImage ? " The old photo stays because another product still uses it." : "");
          statusLine.textContent = "Saved.";
          A.toast(values.name + " updated." + extra, "success");
          existing = result.row;
          originalImage = String(result.row.image_url || "");
          saveBtn.disabled = false;
          cancel.style.pointerEvents = "";
        }
      }, function (err) {
        if (err && err.code === "signed_out") { window.location.replace("login.html"); return; }
        statusLine.textContent = "";
        A.toast((err && err.message) || "The save failed.", "error");
        saveBtn.disabled = false;
        cancel.style.pointerEvents = "";
      });
    });

    window.addEventListener("beforeunload", function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  window.fixonAdminForm = { start: start };
})();
