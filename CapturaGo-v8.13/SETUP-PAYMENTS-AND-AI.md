# Setting up payments, boosts and AI match

Do this in **test mode** first. Nothing is charged, and you can try the whole flow
with test cards while the site is still private. Going live is the last section.

Total time: about 60–90 minutes. Do the parts in order.

---

## Part 1 — Database (2 min)
Supabase → SQL Editor → New query → paste **all of `database.sql`** → Run.
You should see "Success. No rows returned." It contains everything (tables, security, payments,
remote delivery) and is safe to run on your existing database, and to run again any time.

## Part 2 — Stripe account (15 min)
1. Go to **stripe.com** → Sign up. Choose **Slovakia** as the country.
2. Keep the **"Test mode"** switch ON (top right). You don't need business details yet.
3. Turn on Connect: left menu → **Connect** → **Get started**
   - Choose **Marketplace**.
   - Choose **Express** accounts.
4. **Settings → Connect → Branding:** set the name "CapturaGo", upload `apple-touch-icon.png`
   from this folder as the icon, and set the colour to `#B04722`. Creators see this during setup.
5. **Developers → API keys:** copy the **Secret key** (starts with `sk_test_`).
   It's a password, so don't share it or put it in the website files.

## Part 3 — Deploy the 6 server functions (20 min)
If you already deployed them before v8, deploy `booking-action`, `create-checkout`, `stripe-webhook`
and `ai-match` again — they changed (remote delivery, new categories).

In Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
Repeat for each of the 6 functions below:
1. Name it **exactly** as listed (e.g. `create-checkout`).
2. Delete the example code, then paste the **entire** contents of
   `supabase/functions/<name>/index.ts` from this folder.
3. Click **Deploy**.

| Function name | Who can call it | After deploying |
|---|---|---|
| `ai-match` | Anyone | Function → Details → turn **OFF** "Verify JWT" / "Enforce JWT verification" |
| `stripe-webhook` | Stripe | Turn **OFF** "Verify JWT" |
| `stripe-connect` | Signed-in users | leave JWT ON |
| `create-checkout` | Signed-in users | leave JWT ON |
| `create-boost` | Signed-in users | leave JWT ON |
| `booking-action` | Signed-in users | leave JWT ON |
| `calendar` | Calendar apps + signed-in users | Turn **OFF** "Verify JWT" (added in Part 17) |

(Ignore the `_src` folder; that's where I edit the code. The `index.ts` files are what you deploy.)

## Part 4 — Secrets (5 min)
Supabase → **Edge Functions** → **Secrets** → add each of these:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | your `sk_test_...` key |
| `SITE_URL` | `https://capturago.com` |
| `CLIENT_FEE_PCT` | `10` (the traveller service fee in %) |
| `CREATOR_FEE_PCT` | `0` (creators keep 100%) |
| `RESEND_API_KEY` | a **new** Resend key (Resend → API Keys → Sending access) |
| `EMAIL_FROM` | `CapturaGo <noreply@capturago.com>` |
| `SUPPORT_EMAIL` | `hello@capturago.com` (receives dispute alerts) |
| `ANTHROPIC_API_KEY` | from Part 6 |
| `STRIPE_WEBHOOK_SECRET` | from Part 5 |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | from Part 5 |

If you ever change the fee %, also change `clientFeePercent` / `creatorFeePercent` at the top of
`site.js` so the website shows the same numbers, then redeploy the site.

## Part 5 — Stripe webhooks (10 min)
Stripe → **Developers → Webhooks** → **Add endpoint**. You need **two** endpoints with the **same URL**:

URL for both: `https://drpugnclcgfmrfhxujwu.supabase.co/functions/v1/stripe-webhook`

**Endpoint 1 — "Events on your account":** select these events:
`checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
→ Add endpoint → reveal the **Signing secret** (`whsec_...`) → save it as `STRIPE_WEBHOOK_SECRET`.

**Endpoint 2 — "Events on connected accounts":** select `account.updated`
→ Add endpoint → its own **Signing secret** → save it as `STRIPE_CONNECT_WEBHOOK_SECRET`.

## Part 6 — AI match (5 min)
1. **console.anthropic.com** → sign up → **Billing** → add a small prepaid balance (e.g. $5).
2. **API keys** → Create key → save it as the `ANTHROPIC_API_KEY` secret.
3. Cost: each search sends your creator list to the model. With Claude Haiku 4.5 and a few hundred
   creators, that's roughly one cent per search or less (check anthropic.com/pricing for current prices).
   Each visitor is limited to 20 searches per hour.
   Without a key, the site automatically uses a simpler keyword match, so nothing breaks.

## Part 7 — Deploy the website
Drag the `CapturaGo-v7` folder into Netlify, as before.

## Part 8 — Test the whole flow in test mode (20 min)
Use two accounts: your creator account and a second email as the traveller.
1. **Creator:** Dashboard → My listing → add a package (e.g. "Portraits", 60 min, €100) → Save.
2. **Creator:** Payments → choose Slovakia → **Set up payouts with Stripe**. Stripe's test form
   offers test values (test phone/SMS code, test bank account); use them.
   Back on the dashboard, Payments should show **✓ Payouts active**.
3. **Traveller** (another browser or a private window, signed in with the second account):
   open the creator → **Book** → pick a date → pay with the test card
   `4242 4242 4242 4242`, any future expiry date, any CVC.
4. You should land on "Booking received 🎉". Both accounts get an email, and the creator sees the booking.
5. **Creator:** Confirm booking. **Traveller:** try Cancel (it refunds while ≥ 7 days away).
6. **Boost:** creator → Boost → 7 days → pay with `4242...`. The listing appears first, marked "Sponsored".
7. **AI match:** on the homepage, describe a shoot in your creator's city.
8. **Remote order:** creator → add a package with type "Remote delivery". Traveller books it with a
   Google Drive link → creator Accepts → Deliver files (paste a link) → traveller requests a revision
   or approves → payout released.

Check Stripe → Payments and Stripe → Connect → Accounts to see everything appear.
If something fails, send me a screenshot of the error and of Supabase → Edge Functions → Logs.

---

## Part 9 — Automatic jobs + admin panel (15 min)
**A. Deploy two more functions** (same way as Part 3):
| Function name | After deploying |
|---|---|
| `scheduled-jobs` | turn **OFF** "Verify JWT" (it checks its own secret) |
| `admin` | leave JWT **ON** |

Also re-deploy `stripe-webhook`, `create-checkout` and `ai-match` (they changed in v8.3).

**B. Create a job secret.** Make up a long random password (30+ characters, letters and numbers,
e.g. from a password generator). Supabase → Edge Functions → Secrets → add `CRON_SECRET` = that password.

**C. Run the jobs every hour.** Supabase → Database → Extensions → enable **pg_cron** and **pg_net**.
Then SQL Editor → New query → paste this, replacing `YOUR_CRON_SECRET` with the same password → Run:
```sql
select cron.schedule(
  'capturago-hourly-jobs',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://drpugnclcgfmrfhxujwu.supabase.co/functions/v1/scheduled-jobs',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
       body := '{}'::jsonb
     ) $$
);
```

**D. Make yourself admin** (SQL Editor, replace the email with the one you sign in with):
```sql
insert into admins (user_id)
select id from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;
```

**E. Open `capturago.com/admin.html`** while signed in. Click **Run jobs now** once — the
"Automatic jobs" box should show a run. From then on it runs every hour; if it ever stops,
the admin panel shows a ⚠ warning.

What the jobs do: expire unpaid checkouts after 24 h; remind creators after 24 h to confirm a
paid booking and cancel + refund it after 72 h (or if the shoot is tomorrow); release payouts
3 days after a shoot or after a delivery; send "shoot tomorrow" and "delivery late" emails.

## Part 10 — Account deletion (5 min) — needed before the app goes into the stores
Apple and Google require that people can delete their account themselves. The website page
`/delete-account.html` and the app both use one new server function.

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it **exactly** `delete-account`.
3. Delete the example code, paste the **entire** contents of `supabase/functions/delete-account/index.ts`, click **Deploy**.
4. **Verify JWT:** leave it ON if Supabase lets you save. If it only saves with it OFF, turn it OFF —
   that's safe: the function checks the person's login with Supabase itself and can only ever delete
   the account that is signed in.

No new secrets are needed. To test: create a throwaway account on the website, open
Dashboard → **Delete account**, type `DELETE`. The person disappears from Supabase → Authentication → Users.
Someone with an active booking (paid, confirmed, delivered or under review) gets a message to finish
or cancel it first — that's on purpose, so nobody loses money.

## Part 11 — Private messages (10 min) — v8.5
Travellers and creators now message each other inside CapturaGo (website dashboard **and** the app)
instead of by email. Only the two people in a conversation can read it.

1. **Database:** Supabase → SQL Editor → New query → paste the whole `database.sql` → **Run**.
   (Safe to re-run. It adds the messages tables and their security rules.)
2. **Re-deploy 4 functions** (same way as Part 3 — open each one, paste the new `index.ts`, Deploy):
   `admin`, `scheduled-jobs`, `create-checkout`, `stripe-connect`. Keep their Verify JWT settings as before.
3. **Email alerts for unread messages:** these go out from the hourly job (Part 9). Check that these
   secrets exist (Edge Functions → Secrets): `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` (Part 4).
   The email only says *who* wrote — never the message text.
4. **Live updates:** nothing to do — step 1 switches them on. (If live updates are ever off, pages
   still refresh new messages every few seconds.)

**Test:** with two accounts (e.g. your normal one + a test one), open a creator profile → **Message** →
send something. The other account sees it under Dashboard → **Messages** (and in the app's Messages tab).
Try **Report** — it appears in the admin panel under **🚩 Reports**, the only place your team can read a conversation.

## Part 12 — Photo galleries, booking links, calendar, translation (15 min) — v8.6
New: creators' portfolio galleries, a private photo gallery for every booking, personal booking links
with a QR code (lower fee for travellers), an availability calendar with instant booking, time of day,
verified reviews only, and message translation.

1. **Database:** Supabase → SQL Editor → New query → paste the whole `database.sql` → **Run**.
   (Safe to re-run. It adds the new columns, the private **`deliveries`** storage bucket and its rules.)
   Check: Storage → you now see a bucket **deliveries** marked *Private*. It must stay private.
2. **Re-deploy 5 functions** (same way as Part 3 — open each, paste the new `index.ts`, Deploy; keep their
   Verify JWT settings as before): `create-checkout`, `stripe-webhook`, `booking-action`, `scheduled-jobs`,
   `delete-account`.
3. **New function `translate`:** Edge Functions → Deploy a new function → name it exactly `translate` →
   paste `supabase/functions/translate/index.ts` → Deploy. Leave **Verify JWT** on if Supabase lets you
   save it; if it won't save with it on, turn it off — the function checks the signed-in user itself.
   It uses the same `ANTHROPIC_API_KEY` secret as AI match (Part 6). Without that key the Translate
   button just says "not available right now".
4. **Optional — link fee:** travellers who book through a creator's link (capturago.com/c/name) pay
   **5%** instead of 10%. To change it, add the secret `CREATOR_LINK_CLIENT_FEE_PCT` (e.g. `5`) and set
   the same number in `site.js` (`creatorLinkFeePercent`) and in the app (`src/lib/config.ts`, `LINK_FEE_PCT`).
   It can never be higher than the normal fee.
5. **Booking links on Netlify:** nothing to do — `_redirects` already sends `/c/name` to the profile.
6. **Storage space:** delivered photos are deleted automatically 90 days after a booking is completed
   (30 days after a cancellation), and travellers get a reminder email 2 weeks before. At the time of writing the Supabase free
   plan includes 1 GB of files and Pro 100 GB; with many bookings you will need Pro — check
   Settings → Usage once a month.

**Test (with two accounts):**
- As a creator: Dashboard → **My listing** → add a few portfolio photos and choose your link → Save.
  Overview shows your link and QR code. **Availability** → tap two days off → Save.
- Open your link in a private window → your profile opens with the gallery; the days off can't be booked.
- After a test booking is confirmed: Dashboard → Bookings → **📷 Photos for the client** → upload →
  **Send**. The traveller gets an email; in their Bookings they see **📸 Your photos** → favourite, download all.
- When the booking is completed, the traveller sees **⭐ Leave a review** — the review shows "✓ Verified booking".

## Part 13 — Trust & planning: reports, insights, new dates, weather, shot lists, sharing (10 min) — v8.7
What's new: travellers can **report** a profile or photo (admin → ⚑ Reported profiles), you see **search
insights** in the admin panel (what people search for, where creators are missing), either side can **propose
a new date** (e.g. bad weather — free if both agree), upcoming shoots show the **weather forecast**, travellers
add a **shot list, references and "it's a surprise"**, creators set the **meeting point and time**, clients
can report **"the creator didn't show up"**, the **trip planner** ("who's free on my dates?", "Free tomorrow"),
**"Notify me"** when a creator joins an empty city, **reviews with up to 3 photos**, a **reveal slideshow** and
**view-only share links** for delivered galleries, and an **earnings page with CSV export** + a printable QR card.

1. **Database:** Supabase → SQL Editor → New query → paste the whole `database.sql` → **Run** (safe to re-run).
2. **Re-deploy 5 functions** (as in Part 3 — open each, paste the new `index.ts`, Deploy; keep their Verify JWT
   settings as before): `create-checkout`, `stripe-webhook`, `booking-action`, `scheduled-jobs`, `admin`.
3. **New function `shared-gallery`:** Edge Functions → Deploy a new function → name it exactly `shared-gallery`
   → paste `supabase/functions/shared-gallery/index.ts` → Deploy → **turn OFF "Verify JWT"** (friends who open a
   shared link aren't signed in; the function checks the link itself and only ever shows photos).
4. **No new secrets.** The weather comes from Open-Meteo (free, no key). City alert emails use your existing
   Resend setup and are sent by the hourly job.

**Test (two accounts, test mode):**
- Traveller: homepage → type a city with no creators → **🔔 Notify me** → Dashboard → Overview shows "Cities you follow".
- Homepage → **Trip planner** → **Free tomorrow** → free creators appear; booking opens on the right day. Tick
  **🤫 It's a surprise** → pay → the creator's email mentions the surprise; your email subject is neutral.
- Bookings → **📝 Shot list & references** → save. Creator → **📍 Set meeting point** → the traveller gets an email.
- Either side → **📅 Propose a new date** → the other side sees **Accept new date / Keep**.
- After the shoot day: **Report a problem → The creator didn't show up** → admin panel → Bookings shows the reason.
- Completed booking → **📸 Your photos** opens with a slideshow → **🔗 Share with friends** → open the link in a private window.
- **⭐ Leave a review** → pick 2 photos → they show under the review on the profile.
- Profile → **⚑ Report this profile** → admin → **⚑ Reported profiles** → Remove photo / Resolve.
- Admin → **🔎 Search insights** → your test searches appear (cities with searches but no creators = recruit there).
- Creator → Dashboard → **💶 Earnings** → Download CSV; Overview → booking link → **🖨 Printable card**.

## Part 14 — Founding creators, live city pages, shared galleries that sell (5 min) — v8.8
What's new: **founding creator spots** per city (badge + free boost for the first creators who finish their
listing; one per person, the database checks every rule), **live city pages** (`capturago.com/in/<city>` shows
the real creators there — 30 cities have their own page, any other city works too), shared galleries now end with
**"Like these photos? Book <creator>"**, and admin insights count share-link views/clicks and city page visits.
Creators can also copy a **"Book me on CapturaGo" button** for their own website.

If you haven't done Part 13 yet, do it together with this part (same steps, one run).
1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **Re-deploy 3 functions** (keep their Verify JWT settings): `admin`, `shared-gallery`, `scheduled-jobs`.
3. **Website:** deploy as usual. `_redirects` now sends `/in/<any city>` to the live city page — nothing to set up.
4. No new secrets.

**Start the programme (admin panel → 🏅 Founding creators):**
- Search insights → a city marked *recruit here* → **Open founding spots** (e.g. 10 spots, 90-day free boost) → Save.
- **Email creators in this city** tells the creators already listed there (once a week at most).
- New founders appear under *Founders* with their email — write them a personal welcome.
- **Remove spot** if a founder breaks the rules (e.g. stolen photos): the badge and the free boost end, and they can't claim again.

**Test:** as a creator in an open city, Dashboard → Overview shows *Founding creator spots…* with what's missing →
finish the listing → **Claim my founding spot** → your card shows 🏅 Founding. Open `capturago.com/in/<your city>`
and a shared gallery link — the "Like these photos?" box links to your profile.

## Part 15 — Faster replies, quick replies, review reminders, "a year ago" (3 min) — v8.9
What's new: profiles show **"Usually replies within an hour / a few hours / a day"** (measured by the server from
message times; appears after 3 answered travellers; slow creators simply get no badge). Creators see
**"Waiting for your reply · 3 h"** in their inbox and get **one email when a traveller has waited 2 hours**.
**⚡ Quick replies** in every chat (built-in suggestions + your own saved answers, `{name}` = the other person's
first name). Travellers get a **review reminder 2 days after a completed booking** and a **"A year ago in Kyoto"**
email with "Book Ana again" — both optional, with a **one-click unsubscribe** (`unsubscribe.html`) and a switch in
Dashboard → Overview / App → Account. Creators can **share a review as an image** (1080×1350, for Instagram), and
completed bookings show **"🧭 Where to next?"**.

Do this together with Parts 13 and 14 if you haven't yet:
1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **Re-deploy `scheduled-jobs`** (keep Verify JWT off — it checks its own secret). The hourly job now also
   recalculates reply times and sends the reminders.
3. **Website:** deploy as usual (new page `unsubscribe.html`).
4. No new secrets.

**Test:** send a message as a traveller and wait 2 hours (or run the jobs from the admin panel after changing the
time) → the creator gets "… is waiting for your reply". In a chat press ⚡ → pick a reply. Complete a test booking,
then run the jobs 2 days later → the traveller gets "How was your shoot with …?" with a working unsubscribe link.

## Part 16 — What's included, a full shoot, intro video, completed shoots (3 min) — v8.10
What's new: every package can say **how many edited photos**, **"photos within N days"** (in-person) and up to
**6 included extras**; profiles, the booking window and the app show them as a clear **"What's included"** list plus
**"If something goes wrong"** (the cancellation/weather/no-show rules) and a folded **"What happens if…?"** before
paying. When a traveller pays, a **copy of the package is saved with the booking**, so both sides see exactly what was
agreed ("What's included · 📬 photos by 31 Oct") even if the creator changes the package later; the creator gets
**one reminder email** when promised photos are due and not marked ready. Creators can add **"A full shoot"** (up to
40 photos from one real shoot, shown as a slideshow) and a **15-second intro video link** (YouTube, Instagram, TikTok
or Vimeo only — checked by the database too). Profiles show **"📸 12 completed shoots on CapturaGo · On CapturaGo
since September 2026"** — the count is kept by the database itself and can't be edited by creators.

1. **Database:** run the whole `database.sql` again (safe to re-run; old packages stay valid).
2. **Re-deploy `create-checkout`, `admin` and `scheduled-jobs`** (same settings as before). If you deploy the
   functions before running the database update, checkout still works — it just doesn't save the package copy.
3. **Website:** deploy as usual. No new pages.
4. No new secrets.

**Test:** Dashboard → My listing → add "Edited photos: 30", "Photos delivered within: 5 days", "Also included:
Location scouting, 2 outfits", add 3 photos under "A full shoot" and an Instagram reel link → Save. Open your profile:
you should see the list, the rules, "📂 See a full shoot" and "▶ Watch …'s intro". Try saving `https://evil.com` as the
intro → refused. Book a test package → in Bookings it shows "What's included · 📬 photos by …".

## Part 17 — Payment held until the photos arrive, creators on the road, calendar sync (5 min) — v8.11
What's new:
- **Payment held until the photos arrive.** If a package promises the photos "within N days", the money stays on
  hold until the creator sends the photos through CapturaGo, then is paid out **3 days later** (never earlier than
  3 days after the shoot). The traveller can report a problem until then, and **"the photos are late"** once the
  promised date has passed. Two days after a missed date the traveller gets one email ("your payment is still on
  hold"). Packages without "photos within" work exactly as before.
- **Creators on the road (trips).** Dashboard → Availability → ✈️ Trips ("Lisbon, 20–26 Nov"). Travellers
  searching Lisbon see the creator ("✈️ In Lisbon 20–26 Nov"), also on the city page `/in/lisbon` and in the trip
  planner; followers of Lisbon get one email. A booking on a trip day is **in the trip city** — the database sets
  this, shows it in the booking, emails and calendar, and uses the trip city's weather. A creator can't remove a
  trip that has a booked shoot, and a shoot can't be moved between cities.
- **Calendar sync.** Everyone: Dashboard → Overview → 📅 *Your bookings in your calendar* (a private link for Google,
  Apple or Outlook Calendar; "Make a new link" turns the old one off). Creators: Availability → 📅 *Sync your own
  calendar* — paste the secret iCal link of Google, Apple iCloud, Outlook, Proton or Fastmail; all-day events and
  events of 3 hours or more block those days (only dates are stored). The server only ever reads those providers.

1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **New function `calendar`:** Edge Functions → Deploy a new function → Via Editor → name it **exactly**
   `calendar` → paste `supabase/functions/calendar/index.ts` → Deploy → **turn OFF "Verify JWT"** (calendar apps
   can't sign in — the private link is the key; the "sync now" button checks the sign-in itself).
3. **Re-deploy 5 functions** (keep their Verify JWT settings): `create-checkout`, `stripe-webhook`,
   `booking-action`, `scheduled-jobs`, `admin`.
4. **Website:** deploy as usual. No new pages. App: same release as v8.10 (version 1.2.0).
5. No new secrets.

**Test:** Availability → add a trip to another city → search that city on the homepage: you appear with "✈️ In …".
Book one of those days → the booking says "✈️ In …". Overview → *Get my calendar link* → *Add to Google Calendar*
→ the booking appears (Google refreshes every few hours). Availability → connect your Google calendar's secret iCal
link → "Connected … N busy days" and those days are crossed out in your booking calendar.

## Part 18 — Gift cards, split payments, shoot requests, invites, partners, languages, new calendar & map (10 min) — v8.12
What's new:
- **Gift cards** — `capturago.com/gift.html`: €25–1,000, valid 3 years, emailed to the buyer (and the recipient if
  given), printable card. Travellers enter the code in the booking window; the rest is paid by card. Admin → 🎁
  Gift cards: find a code, refund an **unused** card (14-day rule in the terms).
- **Split the cost** — in the booking window (2–6 people, shoots ≥ 3 days away). The organiser pays first, then
  gets one link per friend (`/pay.html#t=…`, also in the email and in Bookings). 48 hours to pay — otherwise the
  hourly job refunds everyone and frees the day.
- **Shoot requests** — "📣 Post a request" in the trip planner (and in the app). Creators in that city on those
  dates get one email and answer in Dashboard → 📣 Requests (app: Account → Shoot requests & offers); the traveller
  compares offers and books one (normal protected checkout).
- **Invite a creator** — Dashboard → Overview → 🎁 Invite (app: My booking link, QR code & invites). After the
  invited creator's first completed booking both get a 7-day boost (max 10 per inviter).
- **Partners** — `capturago.com/partners.html`: hotels/hostels apply; you approve in Admin → 🏨 Partners. Their
  guests pay 5% instead of 10% (link `/?p=CODE` or the printable QR reception card); the partner earns 3% of the
  package price per completed booking — pay it by bank transfer monthly, then press "Mark … as paid".
- **German, Spanish, French** — language picker in the footer / top bar (website) and in Account (app). Emails,
  legal pages, the creator dashboard and the admin panel stay English.
- **New calendar and map** — a two-month date-range calendar (bottom sheet on phones) and a modern vector map
  (MapLibre, files in `vendor/maplibre/`, map tiles from OpenFreeMap — free, no key needed).

1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **Two new functions** (Edge Functions → Deploy a new function → Via Editor → name **exactly**, paste the file,
   Deploy, **keep "Verify JWT" ON**): `create-gift` (`supabase/functions/create-gift/index.ts`) and `pay-share`
   (`supabase/functions/pay-share/index.ts`).
3. **Re-deploy 5 functions** (keep their Verify JWT settings): `create-checkout`, `stripe-webhook`,
   `booking-action`, `scheduled-jobs`, `admin`.
4. **Stripe webhook:** the endpoint for `stripe-webhook` must send `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.expired` and
   `checkout.session.async_payment_failed` (you set these up in Part 5 — just check they're all ticked).
5. **Website:** deploy the whole folder (new pages `gift.html`, `pay.html`, `partners.html`, new files `i18n.js`,
   `i18n/`, `map.js`, `vendor/maplibre/`, `gift.js`, `partners.js`). **App:** version 1.3.0 (new release).
6. No new secrets. Optional: `PARTNER_CLIENT_FEE_PCT` (default 5) like `CREATOR_LINK_CLIENT_FEE_PCT`.

**Test (test mode):** buy a €25 gift card with card 4242… → the code arrives by email → book a package with it.
Book a shoot split in 2 → pay your share → open the friend's link in a private window, sign up, pay → the booking
becomes "Paid". Post a shoot request in your own city from a second account → your creator account gets the email
→ send an offer → book it. Open `/?p=CODE` after approving a test partner → the booking window shows "Service fee
(5%) — recommended by …". Switch the footer language to Deutsch.

## Part 19 — Everything in your language, last-minute deals, text reminders (10 min) — v8.13
What's new:
- **Language button at the top** — "🌐 EN ▾" in the menu bar (website, every page and the dashboard) and in
  Account (app). The **creator dashboard, the app's creator screens and all emails** are now in German, Spanish
  and French too. The language someone chooses is saved on their account, so our emails (and text messages) come
  in that language. Legal pages and the admin panel stay English.
- **Last-minute deals** — Dashboard → 🗓 Availability → ⚡ Last-minute deals (app: Availability): a creator with
  payouts set up lowers the price of their in-person packages by 10–50% for a **free** day **tomorrow or the day
  after**. The deal shows on their card and profile; the checkout applies it on the server (never for custom
  offers or remote work). About 10 minutes later the hourly job emails travellers who are in that city then (an
  open request, a followed city, or a booking there within 3 days) — at most one deal email a day per person,
  never to people who turned tips off.
- **Text reminders** — Dashboard → Overview → 📱 Text reminders (app: Account → Text reminders): travellers and
  creators add their mobile number, agree, and confirm it with a 6-digit code by SMS. On the shoot day (about
  7:00 local time, or 19:00 the evening before a start before 9:00) the hourly job texts both of them the meeting
  point and time — by SMS, or WhatsApp if they chose it and you set up a WhatsApp template.

1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **One new function** (Edge Functions → Deploy a new function → Via Editor → name **exactly** `phone`, paste
   `supabase/functions/phone/index.ts`, Deploy, **keep "Verify JWT" ON**).
3. **Re-deploy 6 functions** (keep their Verify JWT settings): `create-checkout`, `stripe-webhook`,
   `booking-action`, `scheduled-jobs`, `admin`, `create-gift` (all now write emails in the reader's language).
4. **Texts (Twilio)** — skip this step and everything else still works; the text-reminder card then says
   "Text reminders aren't available yet".
   1. Create an account at **twilio.com** → Console → copy the **Account SID** and **Auth Token**.
   2. Buy a phone number that can send SMS (Phone Numbers → Buy a number), or create a **Messaging Service**
      (better for many countries: Messaging → Services → add your number / an alphanumeric sender "CapturaGo").
   3. Supabase → Edge Functions → **Secrets** → add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and either
      `TWILIO_FROM` (the number, e.g. `+14155550123`) or `TWILIO_MESSAGING_SERVICE_SID` (`MG…`). Never put these
      anywhere else — not in the website, not in the app.
   4. Optional, recommended: `PHONE_CODE_SECRET` — any long random text (it keys the code hashes).
   5. Optional **WhatsApp:** connect a WhatsApp sender in Twilio, create a **Content template** of type
      "utility" with exactly this text, and get it approved:
      `CapturaGo reminder: {{1}}. Meeting point: {{2}}. Details: {{3}}`
      Then add the secrets `TWILIO_WHATSAPP_FROM` (the WhatsApp number, e.g. `+14155550123`) and
      `TWILIO_WHATSAPP_TEMPLATE_SID` (`HX…`). Optional translated templates (same 3 variables):
      `TWILIO_WHATSAPP_TEMPLATE_SID_DE`, `_ES`, `_FR`. Without them, people who chose WhatsApp get an SMS.
   6. Twilio → Messaging → Settings → **Geo permissions**: allow the countries your travellers come from.
      In trial mode Twilio only texts numbers you verified — upgrade the account before launch.
5. **Website:** deploy the whole folder. **App:** version 1.4.0 (new release).

**Test (test mode):** switch the website to Deutsch at the top → open the dashboard → everything is German; send a
message to yourself from a second account → the email arrives in German. As a creator with payouts: Availability →
⚡ set −20% for tomorrow → the homepage card shows "⚡ Last-minute −20%" → book that day from a second account → the
booking window and Stripe show the lower price. Add your own phone number in Overview → you get the code by SMS →
confirm → book a shoot for tomorrow with a meeting time before 9:00 → the reminder arrives the evening before.

## Part 20 — Deals for gift cards, rain-aware reminders, fast responders, clients' shots, "Notify me" (5 min) — v8.14
What's new:
- **Gift cards on last-minute deals.** `capturago.com/gift.html#deals` lists today's deals (tomorrow / the day after),
  optionally for one city. With a gift card code (signed in) each deal shows "🎁 Fully covered by your card" or what is
  left to pay; **Book this deal** opens the creator on that day and fills in the code. **🎲 Surprise me** picks a deal at
  random (one the card fully covers, if there is one). Buyers can tick **"Make it a Surprise me gift"** — the emails and
  the printable card then invite the recipient to press Surprise me. (Paying with a gift card on a deal already worked;
  the server applies the deal price first, then the card.)
- **Weather-aware reminders.** The hourly job checks Open-Meteo (free, no key) before the "your shoot is tomorrow" emails
  and the shoot-day text. If **heavy rain** is forecast (heavy rain / violent showers / thunderstorm, or 10 mm+ that is
  likely), both people get "🌧 Heavy rain is forecast — 📅 Propose a new date", one tap to `dashboard.html?move=…`, which
  opens "Propose a new date" with *bad weather* already chosen. Nothing changes until the other person accepts (as before).
  No offer when the booking can't be moved any more (3 moves, or a new date already proposed). If Open-Meteo is down, the
  normal reminders go out.
- **Fast responders ranked higher.** After boosted listings, creators who usually reply within an hour come first, then
  within a few hours, then within a day (same measurement as the badge: 3+ answered travellers). Homepage, city pages,
  trip planner; AI match prefers them between equal fits. Cards show "💬 Replies within an hour".
- **Clients' favourite shots.** Profiles show a row with the first photo of each review (the traveller's favourite —
  the review form now says so). No new data: these photos were already public with the reviews.
- **🔔 Notify me on fully booked creators.** When a creator has no free day in the next 2 weeks (or isn't taking
  bookings), the profile offers **Notify me** (+ "Also send me a text message" for people with a confirmed number). The
  hourly job sends one email (and one SMS if asked) when a day that was taken opens up within 60 days, or when the
  creator posts a last-minute deal. Travellers see and remove them in Dashboard → Overview → *Creators you're waiting for*.

1. **Database:** run the whole `database.sql` again (safe to re-run). It adds the `creator_watches` table and its
   functions, and a `surprise` column on gift cards.
2. **Re-deploy 4 functions** (keep their Verify JWT settings): `scheduled-jobs`, `create-gift`, `stripe-webhook`,
   `ai-match`. (All the other `index.ts` files were rebuilt too because they share the same helper code, but they work
   exactly as before — re-deploying them is optional.)
3. **Website:** deploy the whole folder (changed: `gift.html`, `gift.js`, `script.js`, `dashboard.*`, `city.js`,
   `site.js`, `supabase.js`, `style.css`, `i18n/`, `terms.html`, `privacy.html`).
4. No new secrets. "Notify me" texts use the Twilio setup from Part 19 (SMS only); without Twilio they're email only.
5. **App:** the mobile app (separate project) doesn't have these screens yet — it keeps working as before.

**Test (test mode, two accounts):**
- Creator A: Availability → ⚡ a −20% deal for tomorrow. Traveller B (signed in): `gift.html#deals` → type A's city →
  **Show deals** → A's deal appears; enter a test gift card code → "covered" / "to pay" → **Book this deal** → the
  booking window opens on tomorrow with the code applied. Try **🎲 Surprise me**.
- Buy a gift card with **Make it a "Surprise me" gift** → the recipient email mentions Surprise me and links to the deals.
- Creator A: mark the next 14 days as days off → Traveller B opens A's profile → **🔔 Notify me** → Dashboard shows
  *Creators you're waiting for*. Creator A frees one day → admin panel → **Run jobs now** → B gets "has a free day again".
- Book a shoot for tomorrow in a city where rain is forecast (or check the job summary: `rain_warnings`) → the reminder
  email has "Propose a new date"; the link opens that window with *bad weather* chosen.
- Leave a review with 2 photos → the first one appears under "Clients' favourite shots" on the profile.

## Part 21 — EU DAC7 tax reporting (10 min + your accountant) — v8.15
**Why:** platforms in the EU must report what their sellers earned once a year (Council Directive (EU) 2021/514,
"DAC7"). For **personal services like shoots there is no minimum** — every creator who was paid through CapturaGo
counts. CapturaGo is based in Slovakia, so the report goes to **Finančná správa** by **31 January** for the year
before, and **every creator must get a copy of what you report by the same date**. Creators who live outside the EU
aren't reported to an EU authority (they still get a summary).

What's new:
- **Creators:** Dashboard → Payments → **🧾 Tax details** (and a reminder on the Overview when it's needed): private
  person (name, date of birth, address, country, tax number — or place of birth if their country issues none) or
  business (registered name, registration number, address, tax number), VAT number optional. The database checks every
  field; only the creator and the server can read them. Kept 10 years, also after the account is deleted (the law).
- **Requests:** the hourly job emails creators who can be paid online and have no details (then reminders after 14
  and 45 days — the law requires a request and two reminders).
- **Payout hold (optional):** add the secret `TAX_INFO_HOLD` = `on` to stop automatic payouts for creators still without
  details 60 days after the first request (the sanction the rules allow). Payouts continue as soon as they add them.
  You can still release a booking by hand in the admin panel. Default: off.
- **Admin panel → 🧾 Tax reporting:** choose the year → every creator paid out that year (a booking counts when its
  payout was released), per quarter: amount (package price before our fee), number of jobs, our fees; "EU" = reportable;
  red = details missing. **Download CSV** (all DAC7 fields) and **Email statements to creators** (the tax number is
  masked in the email; each creator is emailed once per year — press again after fixing missing details).

1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **Re-deploy `scheduled-jobs` and `admin`** (keep their Verify JWT settings). Other `index.ts` files were rebuilt
   too (shared helper code) but work as before.
3. **Website:** deploy the whole folder.
4. **Optional:** secret `TAX_INFO_HOLD` = `on` (see above).
5. **Your part (with your accountant):** register CapturaGo as a platform operator for DAC7 with Finančná správa,
   and file the report through their portal by 31 January using the CSV (they need it in their XML format — your
   accountant or their portal converts it). Then press **Email statements to creators**.

**Test (test mode):** as a creator with payouts set up, Overview shows "🧾 Add your tax details" → Payments → fill the
form (try a 15-year-old birth date or a VAT number without a country code → refused) → Save → "✓ Saved". As admin:
complete a test booking → 🧾 Tax reporting → this year → your creator with Q-amounts → Download CSV → Email statements.

## Part 22 — Push notifications for the app, app v1.5 (15 min) — v8.16
**What's new:** the app (v1.5) shows **push notifications**: new bookings and every booking email (confirmed,
declined, photos ready, new date proposed, reminders…), "🔔 Notify me" alerts, and **"New message from …"** a moment
after someone writes (never the message text; one per unread conversation, like the email after 10 minutes). People
turn them off in the app (Account → Notifications on this phone); signing out stops them on that phone. The website
also triggers the message push, so app users hear about messages sent from the website. App v1.5 also brings the
v8.14/v8.15 features to the app: last-minute deals with 🎲 Surprise me and gift cards, "Notify me", clients' favourite
shots, fast responders ranked higher, and the 🧾 tax details form for creators.

1. **Database:** run the whole `database.sql` again (safe to re-run). Adds `push_tokens` (only the server reads it).
2. **New function `push`:** Edge Functions → Deploy a new function → name `push` → paste
   `supabase/functions/push/index.ts` → **Verify JWT: ON** (only signed-in people can call it; the function checks that
   the caller sent the latest message).
3. **Re-deploy** `booking-action`, `scheduled-jobs` and `stripe-webhook` (keep their Verify JWT settings). Other
   `index.ts` files were rebuilt too (shared helper code) but work as before.
4. **Website:** deploy the whole folder (chat messages trigger the push).
5. **App credentials (once, with EAS — see the app's README section D):** after `npx eas-cli@latest init`,
   - **iPhone:** `npx eas-cli@latest credentials -p ios` → *Push Notifications* → let EAS create a push key (or
     answer **Yes** when a production build offers it).
   - **Android:** create a Firebase project (free) → add an Android app with package `com.capturago.app` → download
     `google-services.json` → in Firebase *Project settings → Service accounts* generate a private key (JSON) →
     `npx eas-cli@latest credentials -p android` → *Google Service Account* → *Push Notifications (FCM V1)* → upload it.
     Put `google-services.json` in the app folder and add `"googleServicesFile": "./google-services.json"` under
     `"android"` in `app.json`.
   Then build the app again (a new native module was added — an over-the-air update is not enough).
6. **Optional secrets:** `EXPO_ACCESS_TOKEN` (only if you turn on "Enhanced push security" for the project on
   expo.dev), `PUSH_DISABLED` = `1` to switch all pushes off without a deploy.

**Test (real phone, test build):** sign in on the phone → allow notifications → from the website (other account)
send a message to that account → a "New message from …" notification arrives → tap it → the conversation opens.
Book and confirm a test booking → "Confirmed: …" arrives. Account → turn *Notifications on this phone* off → no more.
(Push doesn't work in Expo Go on Android or in simulators; use a test build from section D of the app README.)

## Part 23 — Creators answer their reviews, app v1.6 (3 min) — v8.17
**What's new:** creators can publish **one public reply** under each review (edit or remove it any time), from
Dashboard → **⭐ Reviews** (a hint counts reviews without a reply) or in the app on their own profile. The reply shows
under the review on the profile, on the website and in the app. The hourly job tells the creator about every **new
review** (email + app notification, with a tip for 3 stars or less: thank them, explain briefly, don't argue) and
tells the traveller **once** when the creator replied (10 minutes after the last edit, so a typo fix doesn't send two).
Reviews older than 2 days when you run this part don't trigger an email.

1. **Database:** run the whole `database.sql` again (safe to re-run).
2. **Re-deploy `scheduled-jobs` and `admin`** (keep their settings). Other `index.ts` files were rebuilt too (shared
   texts) but work as before.
3. **Website:** deploy the whole folder. Terms (section 7) and Privacy Policy mention replies.
4. **App:** version 1.6.0 adds no native modules — build and submit as usual (or publish an update).

**Test:** as a traveller, review a completed test booking → within the hour the creator gets "⭐ New review from …" →
Dashboard → Reviews → ↩ Reply → write → Publish → the reply shows on the profile → ~10 minutes later (next hourly run)
the traveller gets "… replied to your review". Edit it → no second email. Remove it → gone from the profile.
To remove an abusive reply as admin: admin panel → **Reviews** → **Remove reply** (the review itself stays).

**Also in this release (no extra setup):**
- 🌅 **Light on the shoot day:** booking cards (website and app) and the "your shoot is tomorrow" emails show sunrise,
  sunset and golden hour in the shoot city's local time, fitted to the booked time of day; creators get a suggested
  meeting time for sunrise and golden-hour shoots ("💡 For the best light, meet at 15:16"). Same free Open-Meteo request
  as the forecast — no new key. Golden hour = the hour after sunrise and the hour before sunset.
- 📅 **Book again:** completed bookings have "Book Ana again" (dashboard and app), opening the creator's profile.
- Fixes: bookings without map coordinates no longer ask the weather service for 0°,0° (wrong rain warnings); the
  privacy policy's tables fit phone screens; two missing fonts were no longer requested on the home page; the app's
  plan/photos screen titles and a few texts are now translated; in the app's web version, typing right after picking from
  a list (e.g. a country) works.

## Going live (only when the site is ready AND these are done)
1. **Register your business** (živnosť or s.r.o.). Stripe needs real business details to pay you.
2. Stripe → switch Test mode OFF → **Activate account** → enter business and bank details.
3. Repeat Part 2 step 5 and Part 5 in **live mode** (new `sk_live_` key, two new webhook endpoints,
   new signing secrets) → update the three Stripe secrets in Supabase.
4. Ask an accountant about **VAT** on your service fee and boosts, and about **DAC7** platform reporting
   (see CEO-STRATEGY.md). Get this done before your first live payment.
5. Make one real €10 test booking with your own card, then refund it from the dashboard.
