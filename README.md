# FIXON — mobile covers, gifts & accessories

A static website for an independent accessories shop: mobile covers, tempered
glass, pop sockets, mugs, bottles, keychains, mousepads and customised gifts,
with a device-fitment finder and a **product shop fed entirely by Supabase**
(`admin/index.html` is the dashboard the shop edits; the site reads exactly
those rows). Visitors collect items in an order list and
send it to the shop on WhatsApp. (The old repair/services pages are archived
in `_removed-repair/`. The CSV/spreadsheet catalog and `data/catalog.csv`
have been removed - Supabase is the only product source.)

There is **no framework, no build step and no server code of our own.** HTML,
CSS and vanilla JavaScript only, so it deploys on GitHub Pages, Vercel or
Cloudflare Pages exactly as it is; the products live in a Supabase project
that the pages talk to over its REST API with the public anon key under Row
Level Security.

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
  The contact form prepares text locally and opens WhatsApp or
  copy-to-clipboard; it does not submit anything, and it says so on screen.
- **Nothing is real-time.** The product list is re-read every
  `refreshMinutes` (30), so the pages show when the data was read rather than
  claiming it is live.

## Files

```
index.html            home: hero slider, category tiles, live product strip,
                      cover showcase, brand fitment strip, how-ordering-works
shop.html             the product grid: one search box, Details dialog, order tray
accessories.html      category tiles, each one a filtered link into shop.html
brands.html           find covers and glass by device brand
contact.html          phone, WhatsApp, address, hours, map, message form (name,
                      contact, topic, device, best time to reply, message)
about.html            who FIXON is, process, FAQs
css/style.css         design system, sections 1-27 (26 is the product dialog, 27 the order tray)
css/responsive.css    1200 / 1024 / 900 / 860 / 720 / 560 / 420 / 380 + coarse pointer
js/config.js          ALL business values + the shared helpers (window.FIXON)
js/catalog.js         reads the active Supabase products, validates them, caches
                      one list per page (window.fixonCatalog)
js/supabase.js        the Supabase REST + Auth calls the shop and admin make
js/products.js        a row -> a card, safely; the Add to order button
js/order.js           the order list and the WhatsApp message it composes
js/shop.js            search, deep-link pills, owner notes, the Details dialog
js/categories.js      accessories.html tiles
js/finder.js          brands.html brand tiles
js/contact.js         contact composer
js/theme.js           light/dark, remembered per device (light is the default)
js/app.js             hydration, nav, reveal, toasts, photo fallbacks
admin/                the dashboard: sign-in, product list, add and edit rows
supabase/SETUP.sql    the one-pass database setup (tables, RLS, bucket)
images/               covers, accessories, brands, banners
images/products/      drop a photo here and type only its file name in the
                      dashboard's image field
_removed-repair/      archived repair/services pages (not linked anywhere)
api/whatsapp-order.js optional server-side WhatsApp delivery (WHATSAPP-ORDERS.md)
package.json          declares ESM + Node 20 for that function; no dependencies
vercel.json           keeps URLs exact and sizes the function
.env.example          the variable names that function reads - never the values
tools/                the order-endpoint test and a localhost runner that mounts it
```

## How the shop manages products

There is no product file in this repository any more. `data/catalog.csv` and
GOOGLE-SHEETS.md are gone, and nothing reads a spreadsheet: the shop's items
are rows of the Supabase `products` table, which `admin/index.html` edits and
`js/catalog.js` reads. A newly added, active row appears on the shop pages on
the next read, with no deploy.

| column | what it does |
|---|---|
| `name` | required, the card title |
| `price` | a number; left null the card says "Price on request" |
| `description` | the line under the title, up to 800 characters |
| `category` | matched against `productCategories` in `js/config.js`; unknown text is kept and shown as written |
| `image_url` | see below |
| `stock` | an integer; `0` marks the item sold out and blocks the order button, empty means "not tracked" |
| `stock_note` | free text in place of the count, e.g. "At the counter" |
| `featured` | puts the item first in the home and category strips |
| `is_active` | `false` hides the row from the site entirely (the dashboard still lists it) |

**An empty field renders as nothing** — the site never invents a colour, a
spec, a discount or an availability claim.

### The `image_url` field

The picture is chosen per product. Three shapes work:

```
cover-red.jpg                     a file in images/products/ of this site
images/accessories/mugs.jpg       any path inside this site
https://cdn.example.com/a.jpg     a picture hosted elsewhere (https only)
```

A bare file name is looked for in `catalog.imageFolder` in `js/config.js`, so
uploading the photo and typing `cover-red.jpg` is the whole job. Anything that
is not https or a same-site path is rejected and the category illustration is
used instead.

## Where the business details live

`js/config.js` holds every value the shop owns, in numbered sections. It is the
only file to edit for a phone number, an address, hours, a message wording or
the Supabase project the products come from.

| to change | key |
|---|---|
| phone / WhatsApp | `phoneDial`, `whatsappNumber` — **one** number, never hard-coded elsewhere |
| email, address, hours, map | `email`, `addressLine`, `openingHours`, `mapsUrl` |
| which Supabase project serves the products | `supabase.url`, `supabase.key` (anon) |
| where a bare image file name points | `catalog.imageFolder` |
| how often pages re-read it | `catalog.refreshMinutes` |
| currency and the no-price wording | `currencySymbol`, `priceNote` |
| message templates | `messages` (each `{token}` is filled at click time) |
| categories and brands | `productCategories`, `deviceBrands` |

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
- The product list is read from Supabase, so a local preview needs the
  project to be configured in `js/config.js` and an internet connection.
  Without it the shop pages honestly show "The online catalogue is not up
  yet" — there is no local file any more to fall back to.
- Add `?debug=1` to `shop.html` to see the owner notes panel: the read
  failure behind an error, rejected prices/images, and which source answered.

Supabase is the only product source, so testing with items that are not the
shop's means test rows in a **separate Supabase project** (point
`supabase.url`/`supabase.key` at it while you check, then back). Never commit
a plausible-looking invented price — with one source it goes live as fact.

## Deploy

Push the branch, then pick one host. Nothing is built, so each one just serves
the folder.

**GitHub Pages**:
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

After deploying, check three things: the shop page shows the products from
your Supabase project, `Add to order` → `Send order on WhatsApp` opens a
direct chat with the shop's number and the list typed out, and the
phone/WhatsApp links dial the shop.

## Server-side WhatsApp orders (inactive)

Every order button on the site opens a **direct `https://wa.me/` chat** with
FIXON's number and the order written into it; the visitor only presses send
there. No `navigator.share`, no device share menu, no attachment step - that
was the point of the ordering fix, so nothing on the storefront calls the
serverless function below.

It stays in the repository for a possible future route: **see
WHATSAPP-ORDERS.md** for `api/whatsapp-order.js`, which would post image +
caption to the number you configure through the WhatsApp Cloud API. It needs
a Meta WhatsApp Business account and four environment variables; nothing
about it touches the frontend beyond one address in `js/config.js` →
`orderApi`, which is `""` today, and no credential ever reaches a browser.

## Widths the layout is held to

320, 360, 375, 390, 414, 768, 1024, 1440 and 1920. The order tray is a right-hand
panel above 720px and a bottom sheet below it, parked above the sticky
Call / WhatsApp / Book bar so both stay reachable. The product dialog is two
columns (photo left, information right) above 900px, one column below it, and
its Add / WhatsApp buttons stick to the bottom of the panel on phones.

## Safety rules the code follows

- A product row is untrusted text, whoever typed it. Every value is assigned
  with `textContent`, never concatenated into `innerHTML`, so a field
  containing markup cannot execute.
- Image links are filtered to `https://` or a same-site path and must end in
  a real image extension, so a `javascript:` or `data:` field is rejected
  and the row falls back to its category illustration.
- One shared loader, one in-flight request, one timer: opening a page does
  not stack duplicate listeners or hammer the Supabase project.
- A failed read keeps the last good list on screen (`cached` state) instead
  of blanking the grid.
