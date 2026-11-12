/* ==========================================================================
   FIXON admin - the product form, shared by add-product and edit-product
   --------------------------------------------------------------------------
   One form, two modes, four cards: the details, the numbers, the photo and
   where it shows. Every value is validated here before the save POSTs, but
   the database re-checks everything anyway (CHECK constraints + RLS), so a
   bypassed browser still cannot store a negative price or a 10-page
   description.

   Image rule, the one the shop asked for: the photo chosen in this form is
   the photo the site shows. The drop zone, the file button and the address
   box all end in the same place - image_url on the row - and pressing Save
   uploads whatever is still only chosen, so there is no second step to
   forget. The saved address is then loaded the way a visitor would; if
   Supabase cannot serve it, the dashboard says which setting to fix instead
   of the shop quietly showing a different picture. An upload failure stops
   the save: a product stored without the picture just chosen is the bug this
   flow exists to remove. A blob: address is rejected on save, because a
   blob: in the database would be invisible to every visitor but this tab.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var A = window.fixonAdmin;
  var el = A.el;
  var U = window.fixonUtils;
  var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var DISCOUNT_MAX = U.discountMax;

  function bytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function start(mode, existing) {
    var S = window.fixonSupabase;
    var page = document.getElementById("formHost");
    var originalImage = existing ? String(existing.image_url || "") : "";
    var saveLabel = mode === "add" ? "Create product" : "Save changes";
    var dirty = false;

    /* ------------------------------------------------------------ *
     * Cards and fields
     * ------------------------------------------------------------ */
    function panel(title, desc) {
      var p = el("section", "panel");
      var head = el("div", "page-head tight");
      head.appendChild(el("h2", null, title));
      if (desc) head.appendChild(el("p", null, desc));
      p.appendChild(head);
      var grid = el("div", "form-grid");
      p.appendChild(grid);
      page.appendChild(p);
      return grid;
    }

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
    descTa.placeholder = "What it is, what it fits, what makes it worth the price.";
    descTa.addEventListener("input", function () { dirty = true; });
    var priceIn = input("price", "text", existing && existing.price, { inputmode: "decimal", placeholder: "1499  (leave empty for \"Price on request\")" });
    var discIn = input("discount_percent", "number", existing && existing.discount_percent,
      { min: "1", max: String(DISCOUNT_MAX), step: "1", placeholder: "e.g. 10  (empty = no offer)" });
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
      { maxlength: "500", placeholder: "https://... or images/products/cover-blue.jpg (or drop a file above)" });

    var listEl = el("datalist");
    listEl.id = "f_catlist";
    ((window.FIXON && window.FIXON.productCategories) || []).forEach(function (c) {
      var o = el("option", null, c.id);
      o.value = c.id;
      listEl.appendChild(o);
    });
    page.appendChild(listEl);

    /* ------------------------------------------------------------ *
     * 1. Details
     * ------------------------------------------------------------ */
    var basics = panel("Product details",
      "The name and description are what a customer reads on the card, in the detail dialog and in the WhatsApp order message.");
    basics.appendChild(field("name", "Product name *", nameIn, "Two characters at least, up to 120.", true));
    basics.appendChild(field("description", "Description", descTa, "Plain text, up to 800 characters.", true));

    /* ------------------------------------------------------------ *
     * 2. Numbers
     * ------------------------------------------------------------ */
    var pricing = panel("Price, category and stock",
      "An empty price keeps the card on \"Price on request\", and a stock of 0 turns the order buttons off. The shop never invents either.");
    pricing.appendChild(field("price", "Price (₹)", priceIn, "Digits only, up to 1 crore. Empty means customers ask you first."));
    pricing.appendChild(field("discount_percent", "Discount %", discIn,
      "Optional, 1 to " + DISCOUNT_MAX + ". The price above stays the list price - this is what comes off it."));

    /* What the customer will actually be quoted, spelled out before anything
       is saved, because the two numbers on a card are easy to mix up. */
    var saleLine = el("p", "hint full");
    saleLine.setAttribute("role", "status");
    saleLine.setAttribute("aria-live", "polite");
    pricing.appendChild(saleLine);

    function paintSale() {
      var sale = U.saleOf(priceIn.value, discIn.value);
      var typed = discIn.value.trim();
      var asked = typed !== "" && (!isFinite(Number(typed)) || Number(typed) < 1 || Number(typed) > DISCOUNT_MAX);
      if (sale.price === null) {
        saleLine.textContent = typed
          ? "A percentage needs a price to come off, so fill in the price first."
          : "With no price the card reads \"" + ((window.FIXON && window.FIXON.priceNote) || "Price on request") + "\".";
        return;
      }
      if (!sale.percent) {
        saleLine.textContent = "Customers see " + A.money(sale.price) + "." +
          (asked ? " Nothing is taken off until a whole percentage between 1 and " + DISCOUNT_MAX + " is filled in." : "");
        return;
      }
      saleLine.textContent = "Customers see " + A.money(sale.price) + ", with " + A.money(sale.base) +
        " struck through and a " + sale.percent + "% OFF badge. An order on WhatsApp quotes " +
        A.money(sale.price) + " each.";
    }
    priceIn.addEventListener("input", paintSale);
    discIn.addEventListener("input", paintSale);
    paintSale();

    pricing.appendChild(field("category", "Category", catIn, "Type the shop's slug or pick one below."));
    pricing.appendChild(field("stock", "Stock quantity", stockIn, "0 shows \"Out of stock\". Empty = not counted."));
    pricing.appendChild(field("stock_note", "Stock note (optional)", noteIn, "Free text beside the dot, e.g. \"3 at the counter\"."));

    var picks = el("div", "field full");
    picks.appendChild(el("span", "hint", "Pick a category the shop already knows:"));
    var pickRow = el("div", "row");
    ((window.FIXON && window.FIXON.productCategories) || []).forEach(function (c) {
      var b = el("button", "chip-btn", c.label);
      b.type = "button";
      b.addEventListener("click", function () {
        catIn.value = c.id;
        dirty = true;
        markError("category", "");
        pickRow.querySelectorAll(".chip-btn").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
      });
      if (String(catIn.value || "").trim().toLowerCase() === c.id) b.classList.add("sel");
      pickRow.appendChild(b);
    });
    picks.appendChild(pickRow);
    pricing.appendChild(picks);

    /* ------------------------------------------------------------ *
     * 3. Photo
     * ------------------------------------------------------------ */
    var photo = panel("Product photo",
      "Drag a JPEG, PNG or WebP onto the box, or press Choose file. It uploads the moment you press " + saveLabel +
      ", so the photo you pick is the photo the shop shows.");

    var imgBlock = el("div", "field full");
    imgBlock.appendChild(el("label", null, "Image"));
    var drop = el("div", "img-drop");
    var dropBody = el("div", "drop-body");
    dropBody.appendChild(A.icon("upload"));
    dropBody.appendChild(el("b", null, "Drop an image here"));
    dropBody.appendChild(el("span", null, "or press Choose file - up to " + bytes(S.maxImageBytes)));
    drop.appendChild(dropBody);
    var preview = null;
    imgBlock.appendChild(drop);

    var fileIn = el("input");
    fileIn.type = "file";
    fileIn.id = "f_image_file";
    fileIn.accept = IMAGE_TYPES.join(",");
    fileIn.style.display = "none";

    var pickBtn = el("button", "btn btn-ghost");
    pickBtn.type = "button";
    pickBtn.appendChild(A.icon("file"));
    pickBtn.appendChild(el("span", null, "Choose file"));

    var upBtn = el("button", "btn btn-quiet", "Upload now");
    upBtn.type = "button";

    var clearBtn = el("button", "btn btn-ghost btn-sm", "Remove photo");
    clearBtn.type = "button";
    clearBtn.hidden = true;

    var chipSlot = el("div", "row");
    var imgMsg = el("div", "hint", "");
    imgMsg.setAttribute("role", "status");
    imgMsg.setAttribute("aria-live", "polite");

    var bar = el("div", "bar");
    var barFill = el("div", "fill");
    bar.appendChild(barFill);
    bar.hidden = true;
    var barNote = el("div", "bar-note");
    barNote.hidden = true;
    var barLeft = el("span", null, "");
    var barRight = el("span", null, "");
    barNote.appendChild(barLeft);
    barNote.appendChild(barRight);

    var actions = el("div", "img-actions");
    actions.appendChild(pickBtn);
    actions.appendChild(upBtn);
    actions.appendChild(clearBtn);
    imgBlock.appendChild(chipSlot);
    imgBlock.appendChild(actions);
    imgBlock.appendChild(bar);
    imgBlock.appendChild(barNote);
    imgBlock.appendChild(imgMsg);
    imgBlock.appendChild(fileIn);
    photo.appendChild(imgBlock);

    var urlBlock = el("div", "field full");
    var urlLab = el("label", null, "Image address (advanced)");
    urlLab.htmlFor = "f_image_url";
    urlBlock.appendChild(urlLab);
    urlBlock.appendChild(imageIn);
    urlBlock.appendChild(el("span", "hint",
      "Three shapes work: a file name in images/products/ of this site, any path inside the site, or a full https:// address. A file dropped above wins, because Save uploads it first."));
    urlBlock.appendChild(el("span", "err", ""));
    urlBlock.dataset.key = "image_url";
    photo.appendChild(urlBlock);

    /* previewBlob kept so an abandoned choice releases its object URL.
       pendingFile is the file chosen but not uploaded yet - Save uploads it. */
    var previewBlob = null;
    var pendingFile = null;

    function showPreview(src) {
      if (preview) preview.remove();
      drop.textContent = "";
      if (!src) {
        drop.classList.remove("has-img");
        drop.appendChild(dropBody);
        return;
      }
      drop.classList.add("has-img");
      preview = el("img");
      preview.src = src;
      preview.alt = "";
      drop.appendChild(preview);
    }

    function showChip(file) {
      chipSlot.textContent = "";
      clearBtn.hidden = !!(file || imageIn.value.trim());
      if (!file) return;
      var chip = el("div", "file-chip");
      chip.appendChild(A.icon("image"));
      chip.appendChild(el("b", null, file.name));
      chip.appendChild(el("span", null, bytes(file.size)));
      var x = el("button");
      x.type = "button";
      x.appendChild(A.icon("x"));
      x.setAttribute("aria-label", "Discard this file");
      x.addEventListener("click", function () { acceptFile(null); });
      chip.appendChild(x);
      chipSlot.appendChild(chip);
    }

    function showBar(on, indeterminate, pct, note) {
      bar.hidden = !on;
      barNote.hidden = !on;
      bar.classList.toggle("indeterminate", !!indeterminate);
      if (pct !== undefined && pct !== null) {
        barFill.style.width = Math.round(Math.max(0, Math.min(1, pct)) * 100) + "%";
        barRight.textContent = Math.round(Math.max(0, Math.min(1, pct)) * 100) + "%";
      }
      if (note !== undefined) barLeft.textContent = note;
    }

    /* One place where a file becomes the form's state: the file button, the
       drop zone and Save all arrive here, so no path can skip the checks. */
    function acceptFile(file) {
      markError("image_url", "");
      if (!file) {
        pendingFile = null;
        fileIn.value = "";
        showChip(null);
        showPreview(imageIn.value.trim());
        imgMsg.textContent = "";
        return;
      }
      if (IMAGE_TYPES.indexOf(file.type) === -1) {
        pendingFile = null;
        fileIn.value = "";
        showChip(null);
        showPreview(imageIn.value.trim());
        imgMsg.textContent = "That file is a " + (file.type || "unknown type") + " - choose a JPEG, PNG or WebP.";
        A.toast("That file type cannot be uploaded.", "error");
        return;
      }
      if (file.size > S.maxImageBytes) {
        pendingFile = null;
        fileIn.value = "";
        showChip(null);
        imgMsg.textContent = "That image is " + bytes(file.size) + " - the limit is " + bytes(S.maxImageBytes) + ".";
        A.toast("That image is too large.", "error");
        return;
      }
      if (!file.size) {
        pendingFile = null;
        fileIn.value = "";
        showChip(null);
        imgMsg.textContent = "That file came through empty.";
        return;
      }
      /* Chosen, not uploaded: Save picks this up and uploads it first, so the
         photo can never be stranded in the form. */
      pendingFile = file;
      if (previewBlob) URL.revokeObjectURL(previewBlob);
      previewBlob = URL.createObjectURL(file);
      showPreview(previewBlob);
      showChip(file);
      imgMsg.textContent = "Chosen and previewed. It uploads with " + saveLabel +
        ", or press Upload now to do it immediately.";
    }

    fileIn.addEventListener("change", function () {
      acceptFile(fileIn.files && fileIn.files[0]);
    });

    /* Drag and drop. The browser wants a prevented default on every drag
       event or it navigates to the file instead of handing it over. */
    ["dragenter", "dragover"].forEach(function (type) {
      drop.addEventListener(type, function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        drop.classList.add("dragging");
      });
    });
    ["dragleave", "dragend"].forEach(function (type) {
      drop.addEventListener(type, function () { drop.classList.remove("dragging"); });
    });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      drop.classList.remove("dragging");
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) {
        imgMsg.textContent = "Nothing was dropped - drag the image file itself onto this box.";
        return;
      }
      acceptFile(files[0]);
      /* acceptFile writes its own message about the file it took, so the
         multi-file note goes in front of it instead of being overwritten. */
      if (files.length > 1) {
        imgMsg.textContent = "Only the first of those " + files.length + " files was taken. " + imgMsg.textContent;
      }
    });
    drop.addEventListener("click", function () {
      if (drop.classList.contains("has-img")) return;
      fileIn.click();
    });

    pickBtn.addEventListener("click", function () { fileIn.click(); });

    clearBtn.addEventListener("click", function () {
      if (previewBlob) { URL.revokeObjectURL(previewBlob); previewBlob = null; }
      pendingFile = null;
      fileIn.value = "";
      imageIn.value = "";
      dirty = true;
      showChip(null);
      showPreview("");
      showBar(false);
      imgMsg.textContent = "Photo cleared. Save and this product will show its category illustration instead.";
    });

    /* One upload path, used by the button and by Save. Without a pending file
       it resolves the address already in the box, so callers always get the
       value the row is about to hold. */
    function uploadPending() {
      var file = pendingFile;
      if (!file) return Promise.resolve(String(imageIn.value || "").trim());
      setUploadBusy(true);
      showBar(true, true, 0, "Preparing " + file.name + "...");
      return S.uploadImage(file, function (pct, loaded, total) {
        showBar(true, false, pct, "Uploading " + bytes(loaded) + " of " + bytes(total));
      }).then(function (url) {
        pendingFile = null;
        imageIn.value = url;
        dirty = true;
        if (previewBlob) { URL.revokeObjectURL(previewBlob); previewBlob = null; }
        showPreview(url);           /* the real stored address, previewed */
        fileIn.value = "";
        showChip(null);
        clearBtn.hidden = false;
        showBar(true, false, 1, "Uploaded - checking the shop can load it...");
        return readableCheck(url).then(function (warning) {
          showBar(false, false, 1, "");
          imgMsg.textContent = warning || "Uploaded to Supabase - this is the photo the shop will show.";
          if (warning) A.toast(warning, "warn");
          else A.toast("Photo uploaded.", "success");
          return url;
        });
      }, function (err) {
        showBar(false);
        imgMsg.textContent = (err && err.message) || "The upload failed.";
        A.toast((err && err.message) || "The upload failed.", "error");
        throw err;
      }).finally(function () { setUploadBusy(false); });
    }

    function setUploadBusy(on) {
      upBtn.disabled = on;
      pickBtn.disabled = on;
      upBtn.textContent = on ? "Uploading..." : "Upload now";
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
      uploadPending().catch(function () { /* already reported */ });
    });

    showPreview(originalImage || imageIn.value.trim());
    if (originalImage || imageIn.value.trim()) clearBtn.hidden = false;

    /* ------------------------------------------------------------ *
     * 4. Visibility
     * ------------------------------------------------------------ */
    var vis = panel("Where it shows",
      "Both switches are safe to leave as they are: Active publishes on the shop, Featured puts the product in the home page strip.");
    var stateRow = el("div", "field full");
    var stateBox = el("label", "switch");
    stateBox.appendChild(activeIn);
    stateBox.appendChild(el("span", null, "Active - visible to customers"));
    stateRow.appendChild(stateBox);
    var featBox = el("label", "switch");
    featBox.appendChild(featIn);
    featBox.appendChild(el("span", null, "Featured - promoted on the home page"));
    stateRow.appendChild(featBox);
    stateRow.appendChild(el("span", "hint", "Untick Active to keep the row as a draft only this dashboard can see."));
    vis.appendChild(stateRow);

    /* ------------------------------------------------------------ *
     * Save / cancel
     * ------------------------------------------------------------ */
    var bar2 = el("div", "panel save-bar");
    var saveBtn = el("button", "btn btn-primary btn-lg", saveLabel);
    saveBtn.type = "button";
    var cancel = el("a", "btn btn-ghost", "Cancel");
    cancel.href = "products.html";
    var statusLine = el("span", "muted small", "");
    bar2.appendChild(statusLine);
    var btns = el("div", "row");
    btns.appendChild(cancel);
    btns.appendChild(saveBtn);
    bar2.appendChild(btns);
    page.appendChild(bar2);

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
      var discText = discIn.value.trim();
      if (discText) {
        var d = Number(discText);
        if (!isFinite(d) || d < 1 || d > DISCOUNT_MAX || Math.floor(d) !== d) {
          errs.discount_percent = "A discount is a whole percentage between 1 and " + DISCOUNT_MAX + ", or empty.";
        } else if (!priceText) {
          errs.discount_percent = "Set a price first - a percentage has to come off something.";
        }
      }
      var img = imageIn.value.trim();
      if (img && /^(javascript|data|vbscript|blob):/i.test(img)) {
        errs.image_url = "That image address is not usable - paste an https:// link or drop a file above.";
      }
      Object.keys(errs).forEach(function (k) { markError(k, errs[k]); });
      if (Object.keys(errs).length) return null;
      return {
        name: name,
        description: descTa.value,
        price: priceText,
        discount_percent: discText,
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
        var firstBad = page.querySelector(".field.bad input, .field.bad textarea");
        if (firstBad) firstBad.focus();
        return;
      }
      saveBtn.disabled = true;
      cancel.style.pointerEvents = "none";
      statusLine.textContent = pendingFile ? "Uploading photo..." : "Saving...";

      /* The chosen file goes up first and its address becomes the row's, so a
         photo picked in this form cannot be left behind by a Save press. A
         failed upload stops the save, and Save cannot be pressed twice while
         either step is running. */
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
          var replaced = !!originalImage && values.image_url !== originalImage;
          var extra = "";
          if (result && result.imageRemoved) {
            extra = " The replaced photo was deleted from storage.";
          } else if (replaced && !S.isStorageUrl(originalImage)) {
            /* Nothing was ever in the bucket to clean up - say so rather than
               blaming another product for a file this site serves itself. */
            extra = " The photo it used to show is not a Supabase file, so nothing was removed from storage.";
          } else if (replaced) {
            extra = " The old photo stays in storage because another product still uses it.";
          }
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
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  window.fixonAdminForm = { start: start };
})();
