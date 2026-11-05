# FIXON — the product list (no code needed)

Everything in the shop comes from **one plain-text list**: `data/catalog.csv`.
You edit that list, the website follows. No developer, no re-deploy, no
database, no login.

A visitor adds items to an **order list** and presses **Send on WhatsApp**,
which opens WhatsApp with the list typed out. The order then exists only as a
message in your phone — nothing is stored on a server, because this site has
none.

> **Read this first.** `data/catalog.csv` currently holds thirteen rows that
> every name starts with `EXAMPLE -`. They are there so you can see the shop,
> the category pages and the order list working end to end. **The item names
> and prices are not FIXON's** — they were not supplied by the shop. Replace
> each row with a real item and a real price, or delete the rows, **before you
> publish the site**. Nothing is public until you enable GitHub Pages or deploy
> it, so there is no hurry, but do not skip this step.

---

## 1. The 60-second version

1. Open <https://github.com/nihalhussain555/Fixon/blob/main/data/catalog.csv>.
2. Click the **pencil** (Edit this file).
3. Add one line **under** the header line, exactly like this:

   ```csv
   name,price,description,image,category,active,featured,brand,model,url,images,colors,sizes,features,specs,stock,original_price,discount
   Clear Armor Case,1499,"Shockproof back cover for iPhone 15 / 16 series",,cases,TRUE,iPhone,iPhone 15 / 16 series,,,,,,,,,
   ```

   | column | what to type |
   |---|---|
   | `name` | the short shop name of the item |
   | `price` | digits only: `1499`. Leave blank for "Price on request" |
   | `description` | one sentence. Wrap it in double quotes if it contains a comma |
   | `image` | a bare file name (`cover-red.jpg`), a path inside this site (`images/products/cover-red.jpg`), or a full `https://` picture link — or leave blank for the category photo |
   | `category` | one of: `cases, protectors, pop-sockets, bottles, mugs, keychains, mousepads, custom, other` |
   | `active` | `TRUE` to show it, `FALSE` to hide it |
   | `featured` | optional — `TRUE` puts the row first in the home-page and category strips. Mark two or three; the strips fill the rest from ordinary active rows, so a row without this column still shows up |
   | `brand`, `model` | optional — these drive the "Find by device" pages and the "Fits" line on the product view |
   | `url` | optional — a link to a product page you want people to open |
   | `images` | optional — extra photos for the product view's thumbnails, separated by `;` (see section 3a) |
   | `colors`, `sizes` | optional — colour and size names, separated by `;` |
   | `features` | optional — short selling points, one per `;` |
   | `specs` | optional — `Label: value` details, one per `;` |
   | `stock` | optional — one plain status line, e.g. `In stock at the counter` |
   | `original_price` | optional — the list price to strike through, digits only (`1999`). Shown only when it is above `price` |
   | `discount` | optional — percent off, `20` or `20%`. Shown only when it matches the two prices |

   The last eight are what fills the richer product view. **Leave them blank and
   the product view simply shows less** — nothing is invented, no "In stock"
   appears unless you typed it, no thumbnail strip appears unless you add a
   second photo, and no struck price or "OFF" badge appears unless you type the
   figures. The example rows in `data/catalog.csv` have them filled in so
   you can see what each one does.

4. Scroll down and press **Commit changes**.
5. Wait about a minute, then reload the shop page. A reload always asks for the
   file again — the short delay is GitHub holding its own copy, not the site.

The header line is already there. **Never delete it, never reorder it, never
translate it.** Add your products from line 2 onwards.

## 2. Why that GitHub address is the one that works

The site reads the list through this one line in `js/config.js` (line 274):

```js
csvUrl: "https://raw.githubusercontent.com/nihalhussain555/Fixon/main/data/catalog.csv",
```

`raw.githubusercontent.com` answers a browser from another website with the
permission header browsers require (`Access-Control-Allow-Origin: *`). That is
the whole requirement: **the file has to be plain CSV *and* allow that
cross-site read.**

You normally never need to change that line. You only change it if you move the
file or switch to Google Sheets (section 4). If you do change it, put the new
address in **that one place only** — every page reads it from there.

There is a second line, `localFallback: "data/catalog.csv"`, which is the copy
inside the site. It is used for local testing and as a real-but-possibly-stale
copy if the GitHub address is ever unreachable. It points at the same file, so
you do not maintain two lists.

## 3. Editing rules the site applies

- **Only `active = TRUE` rows appear.** `TRUE`, `true`, `YES`, `Y`, `1`,
  `ACTIVE`, `OK` all count. Anything else hides the row without deleting it.
- **A price you cannot read as a number is never guessed.** `1499`, `1,299`,
  `1.299`, `₹1,499.00`, `Rs. 1299` are all understood. `ask in store`, `TBA`,
  `12.13.14` are not: the card shows **"Price on request"** and the owner note
  (section 6) tells you which line to fix. A wrong price on screen is worse
  than no price.
- **Images come from the row, not from a folder rule.** The `image` column can
  hold a bare file name (`cover-red.jpg` — looked for in `images/products/`,
  which is `catalog.imageFolder` in `js/config.js`), a path inside this site
  (`images/products/cover-red.jpg`), or a full `https://` link. A `http://`,
  `drive.google.com`, Google Docs, Dropbox or OneDrive link is rejected and the
  **category photo** is used instead, labelled "Category illustration" so a
  stand-in never looks like a real photo of the item.
- **A row with no `name` is skipped** and reported in the owner notes.
- **Categories you spell unusually still show.** If the `category` value does
  not match the list in section 1, the item still appears in the grid, still
  matches a search for your spelling, and still gets its own tile on the
  Categories page (that tile links `shop.html?cat=raw:<your spelling>`, and the
  products page then shows a "Category <your spelling>" pill with one click back
  to everything). A typo cannot make a product vanish — it only means the
  products page has no button to press, because it has none: only a search box.
- Renaming a product changes its address in a visitor's saved order list. The
  item is then shown to them as "no longer on the online list" — they can still
  send it to you, and you can still understand it.

## 3a. The optional detail columns

These eight columns are what the product view — the panel that opens when someone
taps a product — shows beyond the name, price and description. **Every one of
them is optional. An empty cell renders as nothing at all.**

Separate the values inside one cell with a semicolon (`;`). A pipe (`|`) or a
line break inside the cell works too. Only use commas when you have wrapped the
cell in double quotes, because a bare comma ends the cell.

| column | becomes | example cell |
|---|---|---|
| `images` | the thumbnail strip under the main photo. The `image` column is always the first, biggest photo, so list only the extras here | `images/covers/minimal.jpg; images/covers/silicone.jpg` |
| `colors` | a row of chips under the price, captioned "Colour" | `Clear; Frosted; Smoke` |
| `sizes` | a row of chips captioned "Size / fits" | `11 / 12; 13 / 14; 15 / 16` |
| `features` | a ticked list, captioned "Features" | `Raised camera lip; Ports stay open` |
| `specs` | a label/value table, captioned "Specifications". Write `Label: value` and the part before the colon becomes the label | `Material: Flexible TPU; Thickness: 1.2 mm` |
| `stock` | one status line next to the price, with a green dot | `In stock at the counter` |
| `original_price` | the list price struck through beside the selling price, on the card and in the product view | `1999` |
| `discount` | an "OFF" badge on the photo and a chip beside the price | `25` or `25%` |

Notes that save a phone call:

- **Photos follow the same rules as the `image` column** (section 3): bare file
  names, paths inside this site, or full `https://` links. A rejected link is
  dropped from the strip rather than shown broken, and if every entry is
  rejected the product view falls back to the category illustration.
- **If you dislike one long cell**, add columns `image2`, `image3`, … `image6`
  instead — one photo each, in order. They are read the same way.
- **`stock` is a claim the visitor sees.** Type what is true on the day
  ("In stock at the counter", "Made to order - 2 to 3 days"). Leave it blank and
  the site says nothing about availability rather than guessing — and it never
  says "sold out", "only 2 left" or a delivery promise you have not made.
- **A price the sheet cannot read is a typo, not a discount.** Both offer
  columns are checked before anything reaches a visitor: the struck price shows
  only when `original_price` is a number above `price`, the percentage only from
  1 to 95, and when you fill both they have to agree — `price` 1499 against
  `original_price` 1999 is 25% off, so writing `40` there keeps the smaller
  claim, drops the badge, and tells you which line to fix (section 6). With no
  readable `price` there is nothing to compare, so both stay hidden.
- Long values are trimmed to keep the panel readable: colour and size chips hold
  about 34 characters each, feature and spec lines about 90, the status line
  about 60. Write short phrases and put the detail in `description`.
- The old ten-column sheet keeps working untouched: these columns are read only
  when they exist, so nothing needs re-typing to stay compatible.

## 4. Using Google Sheets instead (optional)

If you would rather type in Google Sheets than in GitHub:

1. Create the sheet, put the same header in row 1.
2. **File → Share → Publish to the web → Comma-separated values (.csv) →
   Publish.**
3. Copy that link into `csvUrl` in `js/config.js` and commit the change.
   The site also accepts the ordinary **edit** link and the
   `export?format=csv` link — it converts them for you.
4. Keep the sheet's own sharing at "Anyone with the link → Viewer"; a
   private sheet can never be read by a website.

Two things to know: a published Google CSV **can lag several minutes behind an
edit**, and the site re-reads it every `refreshMinutes` (30 by default). So an
edit is not instant, and the pages never claim it is. If you need it live
sooner, reload the shop page - a fresh load asks for the file again.

With the GitHub route the same caching applies (raw.githubusercontent.com holds
a file briefly), which is why step 5 in section 1 says *wait about a minute*.

## 5. What cannot ever work — and the message you will see

These are the ones people paste by accident:

| what you pasted | why it fails |
|---|---|
| a **OneDrive / SharePoint / Excel-online share link** (`1drv.ms`, `…onedrive.live.com`, `sharepoint.com`) | it serves an HTML viewer page for a **.xlsx** file, not CSV, and sends no cross-site permission header |
| a **Google Drive file link** (`drive.google.com/…`) | that is a file viewer, not a published sheet |
| a **Dropbox share link** | it redirects to a download page and refuses the browser's cross-site read |
| a **`.xlsx` file itself** | a workbook is a zipped binary; the site reads text |

The site does not waste time trying these. `js/catalog.js` recognises them and
the shop page says exactly which mistake it is and what to use instead, so the
error you see names your actual problem.

A `.xlsx` is not hard to convert: **Excel → File → Save a copy → CSV (Comma
delimited) → upload it to GitHub as `data/catalog.csv`** (Drag the file into the
GitHub page, or the **Add file → Upload files** button). Use **UTF-8 CSV** so
₹, quotes and Malayalam text survive.

## 6. Seeing what the site thinks of your rows

Open any shop page with `?debug=1` on the end, for example:

```
index.html?debug=1
shop.html?debug=1
```

An amber **"Sheet notes for the owner"** panel then lists the lines the site
skipped or repaired, with the reason and the line number — a price it could not
read, an image link it rejected, a row with no name. It also names which source
answered, and when. Normal visitors never see this panel.

## 7. Privacy and secrets — the two hard rules

1. **This list is public.** Anyone with the web address can read it, and search
   engines may index it. Names, prices and descriptions of products only.
   **Never** put customer names, phone numbers, order notes, IMEIs, supplier
   costs or anything private in the sheet.
2. **No credentials anywhere in the site.** There is no Google service account,
   API key, token or password in this code, and a browser-side site can never
   keep one secret. That is exactly why the list must be *published* rather
   than *shared with a key*. If anyone tells you to paste a key into `js/`, do
   not — the CSV routes above need none.

## 8. How the order list uses these rows

- **Add to order** on a card or in the Details dialog puts that row in a list
  held on the visitor's own device (this browser, this phone). Nothing is sent,
  reserved or uploaded yet, and the panel says so.
- Quantities are edited in the panel; the running figure counts **only priced
  rows** and states how many items have no price online, so a half-invented
  total is never presented as a bill.
- **Send order on WhatsApp** opens WhatsApp with the whole order typed out:
  quantity, name, listed price and the brand/model tags for each line, plus the
  total line and any name/phone/notes the visitor typed.
- The shop confirms availability, the final total and payment. **This site has
  no payment page and no stock counter** — it must not claim either.
- If you hide or delete a row while it is in someone's list, their panel marks
  it "no longer on the online list" instead of quietly dropping it.

## 9. Photos

Three ways to give an item a picture, all of them chosen per row:

1. **A file name.** Upload the photo to `images/products/` in this repository
   (GitHub's **Add files → Upload files**, pick that folder), then type just
   `cover-red.jpg` in the `image` column. This is the shortest route and needs
   no paths in the sheet.
2. **A path inside the site.** `images/accessories/phone-covers.jpg` works the
   same way — anything with a slash in it is used exactly as typed.
3. **A full `https://` link** to a picture hosted elsewhere.

Leave `image` blank and the category illustration from `images/accessories/`
is used, labelled "Category illustration" so it never pretends to be the item.
Missing files never break a page: the site falls back to a generic picture
once, and the owner note names the row whose link was rejected.

---

**Files involved:** `data/catalog.csv` (your list), `js/config.js` line 291
(where the address lives), `js/catalog.js` (reads and validates it),
`js/products.js` (cards), `js/order.js` (the order list and the WhatsApp
message), `js/shop.js` (search, the deep-link pills, Details dialog).
