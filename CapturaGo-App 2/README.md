# CapturaGo — mobile app (iPhone + Android)

One app for both phones, built with Expo (React Native). It uses **the same Supabase database,
logins and server functions as capturago.com** — an account made on the website works in the app
and the other way round. You don't need a Mac.

## What the app does
| Tab / screen | What people can do |
|---|---|
| **Explore** | Search by city (creators **✈️ on a trip** to that city show up too), **🗓 trip planner** ("who's free on my dates?", **⚡ Free tomorrow**, This weekend — the first free day is pre-picked when booking), AI match (falls back to keyword match if the AI is down), filter by service, occasion, vibe, "available now". **🔔 Notify me** when a city has no creators yet. Remote services (editors, clippers…) show everyone wherever they live. Sponsored listings first, clearly labelled. |
| **Messages** | Private chat between traveller and creator (same conversations as the website dashboard). Unread badge, **"Waiting for your reply · 3 h"** for creators, **⚡ quick replies** (built-in + your own), live updates, report & block, **Translate** any incoming message into your phone's language, a safety tip when someone suggests paying outside CapturaGo. |
| **Creator profile** | **Portfolio gallery** (swipe through full-screen), **📂 See a full shoot** (every photo from one real shoot, as a slideshow), **▶ intro video**, **📸 completed shoots · on CapturaGo since**, packages with **What's included** + **If something goes wrong**, local spots, **verified-booking reviews with photos**, 🏅 Founding badge, 💬 "Usually replies within an hour", ⚡ instant booking badge, portfolio link, ♥ favourite, **Message**, **Book**, **⚑ Report** a profile or a photo. Personal links `capturago.com/c/name` open it directly. |
| **Book** | In-person: pick a date (taken days are crossed out; the calendar folds into one line once picked), a time of day and **🤫 It's a surprise**. **What's included** and **What happens if…?** (rain, cancelling, no-show, late photos) before paying. On a creator's trip days the shoot is in the trip city (shown as soon as you pick the day; trip days are marked in the calendar). Remote: files link + brief. Price + 10% service fee (5% when the traveller came through the creator's own link), then Stripe's secure page opens inside the app. |
| **Bookings** | Same rules and buttons as the website dashboard, plus **Message** on every booking and **What's included · 📬 photos by …** (the package as it was when booked). Packages that promise photos keep the payment **on hold until the photos arrive** ("The photos are late" can be reported). **Shoot plan** on every upcoming session: meeting point with a map link (creator sets it), shot list & references (traveller), **weather forecast** for the day, **📅 Propose a new date** (the other side accepts or keeps the date), **Report a problem** incl. "the creator didn't show up". Creators upload the finished photos (**📷 Photos for the client**) and send them; travellers open **📸 Your photos** — revealed as a slideshow the first time, favourites, full-screen viewer, save one or all as a ZIP, **🔗 Share with friends** (view-only link that expires) — and **⭐ Leave a review** with up to 3 of their photos. Red badge when something needs you. |
| **Account** | Sign in / create account, **create or edit your creator listing** (cover + portfolio photos, **a full shoot** + intro video link, booking link, services, drone rules, packages with edited photos / delivery days / extras, spots), **availability & instant booking**, **✈️ trips** and **📅 calendar sync** (your Google/Apple/Outlook busy days block bookings), **📅 bookings in your calendar** (private link for any calendar app), **🏅 founding creator spot** (when your city is open), **booking link + QR code** (printable QR card, "clients via your link"), **💶 earnings + CSV export**, **payouts**, favourites, **cities you follow**, Privacy Policy & Terms (shown in the app), sign out, **delete account**. |

Everything except boosts works inside the app. **Boosts are only sold on the website** — Apple and Google take 15–30% of digital purchases made in apps,
so the app never sells or advertises them. Bookings are real-world services, which stores allow to be paid with Stripe.

---

## A. Try it before publishing
> Note: the "Expo Go" app from the stores only runs older Expo versions, so it can't open this app.
> Use one of these instead.

**1. On your computer, in the browser (10 min, free)** — fastest way to click through everything.
1. Install **Node.js LTS** from nodejs.org (big green button, default options).
2. Unzip this folder, e.g. to `Documents/CapturaGo-App`.
3. Open a terminal **in that folder** (Windows: open the folder, click the address bar, type `cmd`, Enter.
   Mac: right-click the folder → *New Terminal at Folder*).
4. `npm install` (1–3 minutes; warnings are fine)
5. `npx expo start --web` → a browser tab opens. Press F12 → click the phone icon to see it at phone size.

**2. On a real Android phone (30 min, free)** — the real app as people will get it.
Do section D steps 1–4 below. You get a link; open it on the Android phone and install
(allow "install unknown apps" when the phone asks). Send the same link to friends to test.

**3. On a real iPhone** — Apple only allows installing through **TestFlight**, which needs the Apple
Developer account ($99/yr, section C). After the first iPhone build + submit (sections D5 and E),
the build appears in App Store Connect → *TestFlight*; add yourself and testers there and install with Apple's TestFlight app.

All three use your **real database** — what you do there is real (no payments happen until Stripe is live).

---

## B. Before you submit to the stores
1. **Deploy the `delete-account` function** — website guide SETUP-PAYMENTS-AND-AI.md, **Part 10**.
   Apple and Google reject apps without in-app account deletion.
2. **Have some real creators listed.** While the database has fewer than 6 listings, the app shows
   "Example" profiles (clearly marked). Reviewers can reject apps that look empty or like a demo,
   so submit once a handful of real creators are on the site.
3. **Make a review account** on capturago.com (e.g. `appreview@capturago.com` + a password).
   Apple and Google need a login to test signed-in screens.
4. Stripe live (when you have the IČO) is **not** required to publish — without it creators just
   can't take bookings yet ("Message" still works). But bookings are the core, so ideally launch with it.

## C. Store accounts (one time)
| | Apple App Store | Google Play |
|---|---|---|
| Cost | **$99 / year** — developer.apple.com/programs → *Enroll* | **$25 once** — play.google.com/console → *Sign up* |
| Type | Enroll as **Individual** (your name is shown as seller). "Organization" needs a company + D-U-N-S number. | **Personal** account. Needs an ID check. |
| Extra rule | Apple ID with two-factor authentication | New personal accounts must run a **closed test with at least 12 testers for 14 days** before going public. Ask friends/classmates; they need an Android phone and a Gmail. |

## D. Build the app in the cloud (no Mac needed)
1. Make a free account at **expo.dev**.
2. In the app folder terminal: `npx eas-cli@latest login`
3. Link the project (once): `npx eas-cli@latest init` → answer **Yes**. It adds your project ID to `app.json`.
4. **Test build for Android** (an .apk you can install directly on any Android phone):
   `npx eas-cli@latest build --platform android --profile preview`
   When it finishes (10–20 min) you get a link/QR code — open it on the phone and install.
5. **Store builds:**
   - Android: `npx eas-cli@latest build --platform android --profile production` → produces an **.aab**.
     Answer **Yes** when it offers to generate a keystore (EAS stores it safely — don't lose your expo.dev login).
   - iPhone: `npx eas-cli@latest build --platform ios --profile production` → sign in with your Apple
     developer account when asked and let EAS create the certificates (**Yes** to everything).
   Build numbers go up automatically (`eas.json`), you never change them by hand.

## E. Publish
**iPhone**
1. `npx eas-cli@latest submit --platform ios --latest` — uploads the build to App Store Connect (it creates the app the first time).
2. In **appstoreconnect.apple.com** → your app → fill in:
   - Screenshots: 6.9" or 6.5" iPhone (take them on a big iPhone, or in the simulator a friend's Mac has).
   - Description, keywords, support URL `https://capturago.com`, privacy policy URL `https://capturago.com/privacy.html`.
   - **App Privacy:** Data collected — *Contact info* (name, email), *User content* (messages, reviews,
     photos creators upload), *Purchases* (booking history), *Identifiers* (user ID). All "linked to the user",
     used for *App functionality*, **not used for tracking**.
   - **Review notes:** "Messages between users can be reported and blocked from the ⋯ menu in a chat;
     reports are reviewed by our team within 48 hours (hello@capturago.com)." Apple requires this for apps with user chat.
   - **Sign-in required:** give the review account from B3.
   - Age rating questionnaire → answers are all "None" → 4+. (Sign-up itself requires 18+.)
3. *Add for review* → *Submit*. Review usually takes 1–3 days.

**Android**
1. play.google.com/console → *Create app* → name CapturaGo, App, Free.
2. Upload the **.aab** to *Testing → Closed testing*, add your 12+ testers' emails, roll out. Wait 14 days.
   (Or let EAS upload: `npx eas-cli@latest submit --platform android --latest` — it puts builds on the *internal* track.)
3. Fill in *App content*: privacy policy URL, **Data safety** (same data as Apple list above — including
   *Messages* and *Photos*; data is encrypted in transit; users can request deletion → URL
   `https://capturago.com/delete-account.html`), ads: **No**,
   target audience **18+**, content rating questionnaire.
4. Store listing: short + full description, icon (`assets/icon.png`), feature graphic 1024×500, at least 2 phone screenshots.
5. After 14 days: *Production* → *Apply for production* → submit.

## F. Updating the app later
Change the code → raise `"version"` in `app.json` (1.7.0 → 1.7.1) → run the production builds again → submit.

> **Version 1.7.0** (💶 **extra photos for sale** — creators set a price per photo and mark extras in Photos; travellers
> see previews with 🔒 €… in their gallery and buy some or all through Stripe; the photos unlock right after paying)
> adds no new native modules. Do the website's SETUP-PAYMENTS-AND-AI.md **Part 24** first, then build and submit as usual.
> **Version 1.6.0** (↩ **answer your reviews** — on your own profile, every review gets a ↩ Reply button; edit or
> remove it any time; travellers see "↩ Reply from …" under the review; a notification for every new review · 🌅 sunrise,
> sunset and golden hour in the shoot plan, with a meeting-time tip for creators · 📅 "Book … again" on completed
> bookings · more translated screens) adds no
> new native modules. Do the website's SETUP-PAYMENTS-AND-AI.md **Part 23** first, then build and submit as usual.
> **Version 1.5.0** (🔔 **push notifications** — new bookings and booking news, "Notify me" alerts, "New message from
> …"; off under Account → Notifications on this phone · ⚡ **Last-minute deals** screen with 🎲 Surprise me and your
> gift card (Explore → ⚡ Last-minute deals, or Account) · 🔔 **Notify me** on fully booked creators + "Creators you're
> waiting for" in Account · 📸 **clients' favourite shots** on profiles · 💬 fast responders ranked higher · 🧾 **tax
> details (EU DAC7)** for creators in Account) adds a **new native module** (`expo-notifications`, `expo-device`):
> build again (section D) — an over-the-air update is not enough. Do the website's SETUP-PAYMENTS-AND-AI.md
> **Part 22** first (database, the `push` function, push credentials for iPhone and Android in EAS).
> **Version 1.4.0** (creator screens in German/Spanish/French — the chosen language is saved on the account so
> emails and texts use it; ⚡ last-minute deals in Availability, on creator cards and in booking; 📱 text reminders on
> the shoot day — Account → Text reminders. Needs the website's v8.13 database and functions.)
> **Version 1.3.0** (pay with a gift card, split the cost with friends and their payment links, shoot requests &
> offers, creator invites, German / Spanish / French — Account → Language, new calendar) adds no new native
> modules. Do the website's SETUP-PAYMENTS-AND-AI.md **Part 18** first (database + `create-gift`, `pay-share` and the
> re-deployed functions), then build and submit as usual (section D5 + E). Translations come from the website:
> after editing `tools/i18n/*.tsv` there, run `python3 tools/build-i18n.py /path/to/this/app`.

> **Version 1.2.0** (trip planner, shoot plan, new dates, weather, reports, review photos, sharing, earnings,
> 🏅 founding creators, reply-time badge, quick replies) adds no new native modules. Do the website's SETUP-PAYMENTS-AND-AI.md **Parts 13, 14 and 15** first (database + functions),
> then build and submit as usual (section D5 + E).

> **Version 1.1.0** (photo galleries, booking links, availability, translation) adds two native modules
> (`expo-file-system`, `expo-sharing`). Any test build you installed before (TestFlight / internal testing)
> must be **built again** (section D) — an over-the-air update is not enough. Do the website's
> SETUP-PAYMENTS-AND-AI.md **Part 12** first, so the database has the new tables.

---

## For developers
```bash
npm run typecheck   # strict TypeScript (app + tests)
npm run lint        # Expo ESLint rules
npm test            # unit tests for prices, booking rules, planning, weather, earnings CSV, filters, AI fallback, validation
```
- Routes are in `src/app/` (Expo Router). Data access: `src/lib/api.ts` (same queries as the website's `supabase.js`).
  All pricing/booking rules: `src/lib/logic.ts`; v1.2 planning, weather, trip planner, earnings and share rules:
  `src/lib/plan-logic.ts` (both mirror the website dashboard and server rules and are unit-tested).
- `src/lib/config.ts` holds the **public** Supabase anon key only. Never put the service_role key, Stripe or Resend keys in the app.
- Privacy Policy / Terms changed on the website? Run `python3 tools/sync-legal.py /path/to/website` so the app shows the same text.
- New service/vibe/occasion on the website? Run `python3 tools/sync-taxonomy.py /path/to/website/taxonomy.js`.
  `WEBSITE_TAXONOMY=/path/to/website/taxonomy.js npm test` then checks both lists are identical
  (without that variable the check looks for `../cg9/taxonomy.js` and is skipped if it isn't there).
- Icons/splash are generated by `tools/make-icons.py`.
- `ios/` and `android/` folders are generated by EAS during the build — don't create or edit them.
