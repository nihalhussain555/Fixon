# FIXON — mobile repair, services & accessories

A static website for an independent phone-repair shop: services, a repair
booking wizard, a device finder, and a **product shop fed by one plain-text
list** (`data/catalog.csv`). Visitors collect accessories in an order list and
send it to the shop on WhatsApp.

There is **no backend, no framework, no build step and no database.** HTML,
CSS and vanilla JavaScript only, so it deploys on GitHub Pages, Vercel or
Cloudflare Pages exactly as it is.

## What the site does and does not claim

This matters more than any visual detail: the shop's real reputation rides on
it.

- **No invented business facts.** Every photo, price, statistic, review,
  warranty line and address is either configured by the owner or shown as a
  clearly-labelled "needs a real value" slot. A missing value degrades visibly
  instead of being filled with a fake.
- **No fake purchase flow.** There is no cart that says "ordered", no payment
  page, no stock counter and no account. The order list lives in the visitor's
  browser and becomes a WhatsApp message only when they press Send.
- **No data leaves the device** until the visitor sends a message themselves.
  The booking and contact forms prepare text locally and open WhatsApp or
  copy-to-clipboard; they do not submit anything, and they say so on screen.
- **Nothing is real-time.** The product list is re-read every
  `refreshMinutes` (30), and a published CSV can lag behind an edit, so the
  pages show when the data was read rather than claiming it is live.

## Files

```
index.html            home: hero slider, accessories (live product strip + category
                      tiles), cover showcase, then services and the quote wizard
shop.html             the product grid: search, filters, sort, Details dialog, refresh
accessories.html      category tiles, each one a filtered link into shop.html
services.html         repair services + the counter-service strip
repairs.html          symptom-led repair information and a quote start
brands.html           find by device brand
models.html           find by model / series (deep-linked from brands.html)
booking.html          repair booking wizard (prepares a message, sends nothing)
contact.html          phone, WhatsApp, address, hours, map, message form (name,
                      contact, topic, device, best time to reply, message)
about.html            who FIXON is, process, FAQs
css/style.css         design system, sections 1-29 (29 is the order tray)
css/responsive.css    1200 / 1024 / 860 / 720 / 560 / 420 / 380 + coarse pointer
js/config.js          ALL business values + the shared helpers (window.FIXON)
js/catalog.js         reads and validates the shop's list; one request per source
js/products.js        a row -> a card, safely; the Add to order button
js/order.js           the order list and the WhatsApp message it composes
js/shop.js            filters, sorting, owner notes, the Details dialog
js/categories.js      accessories.html tiles
js/counter.js         services.html counter strip
js/finder.js          brands.html / models.html
js/booking.js         booking wizard
js/contact.js         contact composer
js/quote.js           quote entry points
js/theme.js           dark/light, remembered per device
js/app.js             hydration, nav, reveal, toasts, photo fallbacks
data/catalog.csv      the shop's product list (header row only until products are added)
images/               covers, services, accessories, brands, banners, before-after
```

## The one file the owner edits

`data/catalog.csv` — see **GOOGLE-SHEETS.md**. Header line:

```
name,price,description,image,category,active,featured,brand,model,url
```

Add one line per product, set `active` to `TRUE` to show it. Nothing else has
to change; the shop pages pick it up on the next read.

## Where the business details live

`js/config.js` holds every value the shop owns, in numbered sections. It is the
only file to edit for a phone number, an address, hours, a message wording or
the product-list address.

| to change | key |
|---|---|
| phone / WhatsApp | `phoneDial`, `whatsappNumber` (line 44-45) — **one** number, never hard-coded elsewhere |
| email, address, hours, map | `email`, `addressLine`, `openingHours`, `mapsUrl` |
| product list address | `catalog.csvUrl` (line 274) |
| how often pages re-read it | `catalog.refreshMinutes` |
| currency and the no-price wording | `currencySymbol`, `priceNote` |
| message templates | `messages` (each `{token}` is filled at click time) |
| categories, brands, services | `productCategories`, `deviceBrands`, `services`, `counterServices` |

Any value still starting with `SET_ME_` is deliberately treated as **not
configured**: its button goes muted, explains why in its tooltip, and a toast
names the key to fill. That is the intended behaviour — do not paper over it
with invented data.

## Run it locally

Any static server works. From this folder:

```bash
python -m http.server 8130 --bind 127.0.0.1
# then open http://127.0.0.1:8130/index.html
```

Notes that save an hour:

- **Use `127.0.0.1:8130/index.html`, not the bare `/`**, and keep one port for
  the whole session. On Windows `python -m http.server` sets
  `allow_reuse_address`, so two servers can both bind one port and split
  requests between them — which looks exactly like a missing `index.html`. Port
  80 on this machine is IIS, so a preview there shows the IIS landing page.
- `fetch()` will not work from `file://` — that is why a server is needed.
- The product list is read from `data/catalog.csv` locally (the
  `localFallback`), so it works with no internet and no GitHub.
- Add `?debug=1` to `shop.html` to see the owner notes panel: skipped rows,
  rejected prices/images, and which source answered.

To see the whole thing with products before the real list exists, temporarily
point `localFallback` at a test CSV **outside this repository**. Never commit a
fixture with invented prices — it would go live as fact.

## Deploy

Push the branch, then pick one host. Nothing is built, so each one just serves
the folder.

**GitHub Pages** (the site and the CSV then both live in the same repo):
repository → **Settings → Pages → Source: Deploy from a branch → `main` /
`(root)` → Save**. It takes a minute, and the address becomes
`https://<user>.github.io/<repo>/`. **As of 2026-10-30 Pages is not enabled on
this repository** — `https://nihalhussain555.github.io/Fixon/` answers 404 and
the Pages API reports no site, so the code is on GitHub but the website is not
published yet. After publishing, set `share.url` in `js/config.js` to the real
address.

**Vercel**: Add New → Project → import the repo → Framework: *Other* → Build
command: *(empty)* → Output directory: `.` → Deploy.

**Cloudflare Pages**: Create a project → connect the repo → Build command:
*(empty)* → Output directory: `(root)` → Save and deploy.

No rewrite rules or SPA fallback config is needed: every page is a real file,
and `shop.html?cat=cases` style links are query strings, not paths.

After deploying, check three things: the shop page shows your products,
`Add to order` → `Send order on WhatsApp` opens WhatsApp with the list typed
out, and the phone/WhatsApp links dial the shop.

## Widths the layout is held to

360, 375, 390, 414, 768, 1024, 1440 and 1920. The order tray is a right-hand
panel above 720px and a bottom sheet below it, parked above the sticky
Call / WhatsApp / Book bar so both stay reachable.

## Safety rules the code follows

- A spreadsheet row is untrusted text. Every value is assigned with
  `textContent`, never concatenated into `innerHTML`, so a cell containing
  markup cannot execute.
- Sheet links are filtered to `https://` or a same-site path; image cells must
  end in a real image extension.
- One shared loader, one in-flight request, one timer: opening a page does not
  stack duplicate listeners or hammer the CSV address.
- A failed read keeps the last good list on screen (`cached` state) instead of
  blanking the grid.
