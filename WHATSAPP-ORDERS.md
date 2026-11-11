# WhatsApp product orders — how to switch this on

Pressing **Order on WhatsApp** in the product view can take one of two routes.
The site uses the first until you turn on the second, so nothing breaks if you
never get to this page.

1. **Device route (no setup, what the site does today).** The page downloads
   the product's own photo, then hands photo + text to the phone's share sheet.
   The visitor picks FIXON from their own contacts and presses send. That last
   step is the weak point: it can be skipped, and it can end up in the wrong
   chat.
2. **Server route (this document).** The page posts the product id to a small
   function on your host. That function re-reads the product from your own
   sheet, downloads its photo, uploads the photo to the WhatsApp Cloud API and
   posts it — image plus caption — to the number you configured. The visitor
   selects nothing, attaches nothing, and cannot redirect the order to another
   number.

There is **no third route where the browser talks to WhatsApp directly**. The
Cloud API does not send CORS headers, so a browser is not allowed to call it —
that is a platform rule, not a gap in this site. It is also why the token has to
live on a server.

## Files that make it work

```
api/whatsapp-order.js        the serverless function: validate, read sheet,
                             fetch photo, upload, send, report
package.json                 declares ESM + Node 20 for that function
vercel.json                  keeps URLs exact, gives the function memory
.env.example                 the variable names it reads, and what goes in each
tools/test-order-endpoint.mjs  runs the function against a mock WhatsApp
tools/serve-with-order-api.mjs  serves the site + the function on localhost
js/config.js → orderApi      the ONE frontend switch: the function's address
js/shop.js                   the button: loading state, result, fallback
```

## What you have to set up at Meta

The Cloud API needs a WhatsApp Business **account**, not just a phone with the
Business app installed. Roughly:

1. **Business Manager** — business.facebook.com — with a business profile.
2. **WhatsApp Business Account** inside it (Users → WhatsApp Accounts), and you
   as an admin of it.
3. **An app** on developers.facebook.com: type *Business*, add the *WhatsApp*
   product. The app's **App access token** shown in API Setup is only temporary;
   do not build on it.
4. **A System User** in Business Manager (not a personal employee login), given
   the WhatsApp account with *Full control*, then generate a **permanent**
   token for that System User from the Business Messaging app. This is the value
   that survives the week; a 24-hour token silently stops orders on day two.
5. **A registered phone number** in WhatsApp → API Setup. Its **Phone number ID**
   (a long digit string, *not* the number itself) is what the function calls.
   Test numbers can only message verified recipients.

Then decide which number should **receive** the order alerts. That is the
`WA_SHOP_NUMBER` value: digits only, international format, no `+`.

## Where each value goes

Nothing goes in the site's source. On Vercel: project → **Settings →
Environment Variables**, add each name from `.env.example` for the *Production*
environment, then redeploy. `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID` and
`WA_SHOP_NUMBER` are the three that gate delivery; `ORDER_ALLOWED_ORIGINS` is
the one that gates the browser.

After deploying, open the function's address in a browser (a GET). It answers
which variable names are still missing and never their values:

```
{"ok":false,"missingConfig":["WA_ACCESS_TOKEN","WA_SHOP_NUMBER"], ...}
```

## Deploying the function

1. Push this repository to GitHub.
2. vercel.com → Import → the FIXON repository. Framework preset: *Other*.
   Vercel picks up `vercel.json` and the `api/` folder; the static pages keep
   being served exactly as GitHub Pages serves them now.
3. Add the environment variables, redeploy.
4. Put the function's address into `js/config.js` → `orderApi.endpoint`, e.g.
   `https://fixon.vercel.app/api/whatsapp-order`. `ORDER_ALLOWED_ORIGINS` has to
   list the origin of whichever page calls it — the GitHub Pages address, the
   Vercel address, and `http://localhost:8123` while testing.
5. Deploy the site itself wherever you like. If the site and the function are on
   the same host, the page still needs its own origin in the allow-list.

## Checking it without sending a real order

```
node tools/test-order-endpoint.mjs
```

Intercepts the Graph API inside the test process, so it needs no token and
cannot reach WhatsApp by accident. It covers: hidden and unknown products, a
sheet with no photo column, an empty image cell, a `javascript:` image cell,
disallowed origins, non-JSON and oversized bodies, links and phone numbers
typed by visitors, duplicate clicks, per-IP volume limits, exact caption
wording, exact photo bytes, the recipient number, upload failures, message
failures, and the guarantee that a payload cannot invent the name, price, photo
or recipient the shop is told.

```
node tools/serve-with-order-api.mjs
```

serves the whole site on `http://localhost:8123` **and** answers
`/api/whatsapp-order` with the real function, so you can click the button in a
browser before deploying.

A direct check with curl, from the deployed function:

```
curl -X POST https://<your-host>/api/whatsapp-order \
  -H 'content-type: application/json' \
  -H 'origin: https://<your-site-origin>' \
  -d '{"productId":"p-tempered-glass-iphone-13","nonce":"check-1a2b3c"}'
```

`{"ok":true,"delivered":true,...}` means Meta returned a message id. Anything
else names the step that failed.

## The real test

Mock and curl checks prove the request is built correctly. Only a live delivery
proves the wiring: after the four variables are set, press **Order on
WhatsApp** on a product that has a photo in the sheet, and confirm that the
image arrives **with** the caption on the destination number. Until that has
happened, the feature is configured — not working.

## Things this cannot do, however it is wired

- **The order carries no click-to-reply contact.** A message your number sends
  to your number appears in your own chat, and the visitor's WhatsApp is not
  attached to it. That is why the tray's name / phone / notes boxes exist and
  why those words go into the caption — but a visitor who leaves them blank
  leaves you no way back. The pages already offer a Call / WhatsApp bar for
  that case.
- **Business-initiated messages are template-only** in WhatsApp's model. The
  Cloud API will accept what this function sends; whether Meta *delivers* an
  unsolicited free-form message depends on the account's status and window
  (a conversation the visitor started in the last 24 hours is the safe case).
  If the send succeeds but nothing appears on your phone, that is the reason to
  check first, and an approved *utility* template is the fix — a template is a
  Meta-side step this code deliberately does not attempt.
- **The recipient must be able to receive from your sender number.** Sending
  from a test number to an unregistered number is refused by Meta.
- **No payment, no stock, no order records.** The function delivers a message;
  it stores nothing, and no order list survives on the server.
- **Only photos the sheet actually names.** A row with an empty `image` cell
  produces a refusal, not a category illustration sent as if it were the
  product.

## Switching it back off

Set `orderApi.endpoint` in `js/config.js` to `""`. The button goes back to the
device route with no other change, and the function simply stops accepting
orders (its health route will list the variables as unset if you remove them
too).
