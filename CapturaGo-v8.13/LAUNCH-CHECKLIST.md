# CapturaGo — Launch checklist

> **v8.18 + app v1.7 — more money per booking:** 💶 creators sell **extra photos** from the gallery (price per photo,
> previews until bought, full files locked in storage, creator paid instantly, your service fee on top, in the DAC7 report);
> 🔎 **creator pages** for Google (`/p/<name>`, in the sitemap) and rich link previews (`/c/<name>`) — run
> `python3 tools/build_creator_pages.py` before each upload; 📩 one **"finish your booking"** email after an unpaid
> checkout. Run `database.sql`, deploy `buy-photos` (Verify JWT on), re-deploy `stripe-webhook`, `shared-gallery`,
> `scheduled-jobs`: SETUP-PAYMENTS-AND-AI.md **Part 24**. Terms (6o, right of withdrawal) and Privacy Policy updated.
> **v8.17 + app v1.6 — creators answer their reviews:** one public reply under each review (Dashboard → ⭐ Reviews, or
> the app on your own profile), shown on the profile; creators are told about every new review (email + push) and the
> traveller once about the reply (admin panel → Reviews → Remove reply for abusive ones). Also: 🌅 sunrise / sunset /
> golden hour on booking cards and in the shoot-day email, 📅 "Book … again" on completed bookings, and fixes found by a
> full sweep of the site and app. Run `database.sql`, re-deploy `scheduled-jobs` and `admin`: SETUP-PAYMENTS-AND-AI.md **Part 23**.
> Terms (section 7) and Privacy Policy updated.
> **v8.16 + app v1.5 — push notifications:** booking news, "Notify me" alerts and "New message from …" (never the text)
> on people's phones; off in the app under Account. The app also gets the v8.14/v8.15 features (deals + 🎲 Surprise me
> with gift cards, Notify me, clients' favourite shots, fast responders first, 🧾 tax details). Run `database.sql`,
> deploy the new `push` function (Verify JWT **on**), re-deploy `booking-action`, `scheduled-jobs`, `stripe-webhook`,
> set up push credentials in EAS (iPhone push key, Android FCM): SETUP-PAYMENTS-AND-AI.md **Part 22**. Then build
> app 1.5.0 again (new native module) and submit.
> **v8.15 — EU DAC7 tax reporting (legally required; first report for 2026 due by 31 January 2027):** creators add
> their tax details in Dashboard → Payments → 🧾 Tax details (private; the database checks them); the hourly job asks
> creators who can be paid online and sends 2 reminders (day 14 and 45); admin panel → **🧾 Tax reporting** shows every
> creator paid in a year, per quarter (amount, jobs, fees), who lives in the EU (reportable) and who is missing details,
> with a **CSV for your accountant** and **"Email statements to creators"** (each creator must get theirs by 31 January).
> Optional secret `TAX_INFO_HOLD=on` holds payouts of creators still without details 60 days after the first request.
> Run `database.sql`, re-deploy `scheduled-jobs` and `admin`: SETUP-PAYMENTS-AND-AI.md **Part 21**. Terms (Taxes) and
> Privacy Policy (tax details, tax authority, 10-year retention) updated.
> **v8.14:** **gift cards on last-minute deals** (`/gift.html#deals`: find deals, see what your card covers, 🎲
> **Surprise me** picks one; buyers can make it a "Surprise me" gift); **weather-aware reminders** (heavy rain on the
> shoot day → the reminder email and text offer "📅 Propose a new date" in one tap); **fast responders ranked higher**
> (+ "💬 Replies within an hour" on cards; AI match prefers them when equal); **clients' favourite shots** on every
> profile (the first photo of each review); **🔔 Notify me** on fully booked creators (one email — or a text — when a
> day opens up or a deal appears; listed in Dashboard → Overview). Group bookings already exist (split the cost, v8.12).
> Run `database.sql`, re-deploy `scheduled-jobs`, `create-gift`, `stripe-webhook`, `ai-match`:
> SETUP-PAYMENTS-AND-AI.md **Part 20**. No new secrets. Terms (6b ranking, 6e moving, 6f gift cards, 6n, review
> photos) and Privacy Policy (creator alerts, Open-Meteo from our server, Twilio) updated.
> **v8.13:** language button at the top of every page (🌐 EN ▾); the creator dashboard, the app's creator screens
> and **all emails** in German/Spanish/French (the language is saved on the account); **last-minute deals** (−10–50%
> on a free day tomorrow or the day after, applied by the server, one email to travellers in that city); **text
> reminders** on the shoot day by SMS or WhatsApp (Twilio, number confirmed with a code, consent). Run
> `database.sql`, deploy the **new `phone` function (Verify JWT ON)** and re-deploy `create-checkout`,
> `stripe-webhook`, `booking-action`, `scheduled-jobs`, `admin`, `create-gift`: SETUP-PAYMENTS-AND-AI.md **Part 19**.
> Texts need a Twilio account (secrets in Supabase only); without it everything else works. Terms (6k–6m) and Privacy
> Policy (language on the account, deals, phone numbers, Twilio) updated. Before going live: upgrade Twilio from
> trial, set its geo permissions, and budget for SMS costs (roughly €0.05–0.10 per text).
> **v8.12:** gift cards (`/gift.html`, printable card, pay with a code), split the cost with friends (2–6 people,
> 48 h, automatic refunds), shoot requests & creator offers, invite a creator (both get a 7-day boost), partner
> programme for hotels/hostels (`/partners.html`, QR reception card, 5% guest fee, 3% thank-you), German/Spanish/
> French (website traveller pages + app), new two-month calendar and modern vector map (MapLibre + OpenFreeMap).
> Run `database.sql`, deploy the **new `create-gift` and `pay-share` functions (Verify JWT ON)** and re-deploy
> `create-checkout`, `stripe-webhook`, `booking-action`, `scheduled-jobs`, `admin`: SETUP-PAYMENTS-AND-AI.md
> **Part 18**. Terms (6f–6k) and Privacy Policy (gift cards, split, requests, invites, partners, languages, map
> provider) updated. Before going live: decide who pays partner thank-yous each month, and ask your accountant how
> gift-card sales and partner thank-yous are booked (prepayments / commissions).
> **v8.11:** payment held until the photos arrive (packages with "photos within N days"; paid out 3 days after the
> photos are sent; "the photos are late" report; one email to the traveller when they're late), creators on the road
> (✈️ trips: found in that city's search, city page and trip planner; bookings on trip days take place there — set by
> the database; trip alerts for followed cities), calendar sync (private calendar link for everyone; creators connect
> their own Google/Apple/Outlook calendar and busy days block bookings). Run `database.sql`, deploy the **new
> `calendar` function (Verify JWT OFF)** and re-deploy `create-checkout`, `stripe-webhook`, `booking-action`,
> `scheduled-jobs`, `admin`: SETUP-PAYMENTS-AND-AI.md **Part 17**. Terms (held payment, trips, calendar sync, problems)
> and Privacy Policy (trips, calendar sync and feed, calendar providers, retention) updated.
> **v8.10:** "What's included" on every package (edited photos, photos within N days, extras) + "If something goes
> wrong" rules + "What happens if…?" before paying; the package is saved with each booking ("photos by …" and one
> reminder to the creator when due); "A full shoot" sample gallery (slideshow), intro video link, "X completed shoots"
> and "On CapturaGo since". Run `database.sql`, re-deploy `create-checkout`, `admin`, `scheduled-jobs`:
> SETUP-PAYMENTS-AND-AI.md **Part 16**. Terms (creator rules, "What was agreed", badges) and Privacy Policy (listing,
> completed shoots, booking copy, intro links) updated. Fixed: phone sticky search button was cut off.
> **v8.9:** reply-time badge ("Usually replies within an hour"), "waiting for your reply" label + one reminder email
> after 2 hours, ⚡ quick replies in chats, review reminder 2 days after a completed booking, "A year ago" email with
> "book again", one-click unsubscribe (unsubscribe.html) + email switch, review-as-image for creators, "Where to next?".
> Run `database.sql`, re-deploy `scheduled-jobs`: SETUP-PAYMENTS-AND-AI.md **Part 15**. Terms (badges) and Privacy
> Policy (reply time, quick replies, email preferences) updated.
> **v8.8:** founding creators per city (admin opens spots; first creators with a finished listing get a 🏅 badge +
> free boost — one per person, enforced by the database), live city pages `/in/<city>` (30 SEO pages + any other city),
> shared galleries end with "Book this creator", share/city-page counts in admin insights, "Book me" website button.
> Run `database.sql`, re-deploy `admin`, `shared-gallery`, `scheduled-jobs`: SETUP-PAYMENTS-AND-AI.md **Part 14**.
> Terms (6e Founding creators, ranking) and Privacy Policy (founding spots, page counts) updated.
> **v8.7:** trust & planning — report a profile/photo (admin review), search insights in admin, propose a new
> date (both agree, e.g. bad weather), weather forecast on upcoming shoots, shot list + references + surprise mode,
> meeting point, "creator didn't show up" reports, trip planner + "Free tomorrow", "Notify me" for empty cities,
> reviews with photos, gallery slideshow + view-only share links, creator earnings + CSV, printable QR card.
> Run `database.sql`, re-deploy 5 functions and add `shared-gallery` (Verify JWT **off**):
> SETUP-PAYMENTS-AND-AI.md **Part 13**. Privacy Policy (new data, Open-Meteo, retention) and Terms (moving a shoot,
> surprises, no-shows, review photos, share links, reports) updated.
> **v8.6:** portfolio galleries, private photo delivery for every booking (download all as ZIP, deleted after
> 90 days), personal booking links + QR code (5% fee for travellers who use them), availability calendar with
> instant booking, time of day, verified-booking reviews only, message translation. Run `database.sql`,
> re-deploy 5 functions and add the new `translate` function: SETUP-PAYMENTS-AND-AI.md **Part 12**.
> Privacy Policy (3b, storage, retention) and Terms (fees, instant booking, photo delivery, reviews) updated.
> **v8.5:** private messages between travellers and creators (dashboard + app), reports & blocking, admin
> "Reports" page, email alerts for unread messages. Run `database.sql`, re-deploy 4 functions:
> SETUP-PAYMENTS-AND-AI.md **Part 11**. Privacy Policy + Terms updated (section 3a, rules on messages).
> **v8.4:** account deletion (`/delete-account.html`, link in the dashboard) — required for the mobile app.
> Deploy ONE new function, `delete-account`: SETUP-PAYMENTS-AND-AI.md **Part 10**. No database changes.
> Privacy Policy now has an app section (4a). Admin panel verification labels now match the public badges.
> **v8.3:** automatic hourly jobs + admin panel (`/admin.html`). Re-run `database.sql`, then follow
> SETUP-PAYMENTS-AND-AI.md **Part 9** (2 new functions, 3 re-deploys, hourly schedule, make yourself admin).
> **v8.2:** cookie consent banner (Reject / Customize / Accept, Google Consent Mode v2). To switch on
> Google Analytics, Google Ads, Meta Pixel or TikTok Pixel later: open `consent.js`, paste the ID(s) into
> CONFIG at the top, redeploy. Nothing loads until a visitor agrees. No database or function changes.
> **v8.1:** drone pilots now give region-specific details (EU operator number / A1-A3, US Part 107). Re-run `database.sql` (safe) — no function changes.
> **v8:** the database is now ONE file, `database.sql` (it replaces schema.sql, security-patch.sql and
> payments-patch.sql). Run it in step 2. Then follow **SETUP-PAYMENTS-AND-AI.md** (test mode first).
> Strategy: **CEO-STRATEGY.md**. Landing pages are generated by `tools/build_pages.py`.

Do these in order. Don't skip step 1 or 2.

---

## 1. Hero photo — already included
Your own photo (the Paris couple + photographer shot) is already in
`images/CG.webp` and wired into the hero. Nothing to do here. If you ever
want to swap it, just replace that file with a new one of the same name,
or open `style.css`, find `.hero{` near the top, and point the `url(...)`
at a different file or hosted image.

## 2. Run the security patch (3 min) — REQUIRED, even if you ran an older version
**Run `database.sql` from this folder**, even if you already ran earlier SQL files.
The new version also hides creators' and reviewers' private email addresses from the public.
It's safe to run more than once.

Supabase → SQL Editor → New query → paste all of `database.sql` → Run.
You should see "Success. No rows returned."
If you see a NOTICE about duplicate listings/reviews: delete your old test rows in
Table Editor → photographers / reviews, then run the file again.

## 3. Fill in 2 legal fields (2 min)
Open `privacy.html` and `terms.html` in VS Code, search (Cmd+F) for `fill-me`:
- your postal address (both files)
Then delete `class="fill-me"` from those spans so they're no longer highlighted.
(These pages are solid templates, not legal advice. Before you take payments, have them checked.)

## 4. Make hello@capturago.com actually work (10 min, free)
1. Sign up at improvmx.com → add domain `capturago.com` → forward to your Gmail.
2. In Squarespace DNS → Custom records, add exactly what ImprovMX shows you
   (two MX records + one SPF TXT record).
3. Squarespace already has a TXT record `v=spf1 -all` on `@`. A domain may only have ONE SPF record —
   **delete that one** and keep ImprovMX's.
4. Send a test email to hello@capturago.com.

## 5. CRITICAL: fix sign-up emails for real users
Supabase's built-in email sender only delivers to members of your own Supabase team, and only a
couple per hour. That's why YOUR confirmation email arrived — a stranger's would not, and they
could never log in.

**Test it:** sign up on your site with a different email address you own (not the Supabase one).
If no email arrives, do this:

1. resend.com → sign up free → Domains → Add `capturago.com`
2. Add the DNS records Resend shows you in Squarespace (they go on `send.` and `resend._domainkey` —
   they don't conflict with step 4). Wait until Resend shows "Verified".
3. Resend → API Keys → create one, copy it.
4. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Host: `smtp.resend.com` · Port: `465`
   - Username: `resend` · Password: your Resend API key
   - Sender email: `noreply@capturago.com` · Sender name: `CapturaGo`
5. Sign up again with the test address — the email should now arrive.

**Temporary workaround** if you need sign-ups working today: Supabase → Authentication →
Sign In / Providers → Email → turn OFF "Confirm email". Turn it back ON once Resend works.

## 6. Deploy (1 min)
Netlify → your project → Deploys → drag this whole folder onto the upload box.
Drag the folder itself, not its contents one by one.

## 7. Test on the live site (10 min)
- [ ] capturago.com loads with your hero photo; browser tab shows the ✦ icon
- [ ] capturago.com/anything-random shows the "Out of frame" page
- [ ] Footer links: Privacy, Terms open correctly
- [ ] Create an account (with a second email) → confirmation arrives → sign in works
- [ ] "Forgot password?" → email arrives → link opens the new-password page → new password works
- [ ] Add your own listing with a photo → it appears in the grid and on the map
- [ ] Dashboard → edit listing (change a spot) → Save → change is visible on the homepage
- [ ] In another browser, sign in as the second account → send an inquiry to your listing → it shows in your dashboard
- [ ] Second account leaves a review → your rating updates
- [ ] Try reviewing your own listing → blocked
- [ ] Test on your phone: menu button, search, profile, inquiry form

## 8. When you've created social accounts
Open `site.js`, fill in `instagram` / `tiktok` links at the top, redeploy. The icons appear in the
footer automatically. Leave them empty until the accounts exist.

---

## What's in this folder
| File | Purpose |
|---|---|
| index.html, script.js | Homepage |
| style.css | Styles for all pages |
| site.js | Shared helpers, storage notice, social links config |
| supabase.js | Database connection (your keys are already inside) |
| dashboard.html / .js / .css | Creator dashboard |
| privacy.html, terms.html | Legal pages |
| 404.html | Page-not-found (Netlify uses it automatically) |
| reset-password.html | Where "forgot password" emails lead |
| delete-account.html | Self-service account deletion (App Store / Google Play requirement) |
| app-return.html | “Done — return to the app” page shown after Stripe inside the app |
| share.html | View-only page for a gallery a traveller shared with friends (link expires) |
| in/, for/, services/ | SEO landing pages (built by `tools/build_pages.py`); city pages show live creators via city.js |
| city.html, city.js | Live page for any city without its own page (`/in/<city>`) |
| unsubscribe.html | One-click unsubscribe from tips & reminders emails |
| admin.html / admin.js | Admin panel: bookings, disputes, reports, search insights |
| favicon.ico / .svg, apple-touch-icon.png, site.webmanifest | Icons |
| robots.txt, sitemap.xml | Google indexing |
| _headers | Security headers (Netlify reads this automatically) |
| fonts/, vendor/ | Self-hosted fonts, map and database libraries |
| database.sql | The complete database setup — run it, safe to re-run |
| supabase/functions/notify-inquiry | Inquiry email function (deploy later, needs Resend) |
| supabase/functions/<name>/index.ts | The server functions (payments, bookings, jobs, admin, translate, shared galleries, **calendar**) — built from `supabase/functions/_src` by `build.py` |
