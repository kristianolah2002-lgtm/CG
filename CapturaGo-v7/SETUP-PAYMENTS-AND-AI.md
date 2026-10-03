# Setting up payments, boosts and AI match

Do this in **test mode** first. Nothing is charged, and you can try the whole flow
with test cards while the site is still private. Going live is the last section.

Total time: about 60–90 minutes. Do the parts in order.

---

## Part 1 — Database (2 min)
Supabase → SQL Editor → New query → paste **all of `payments-patch.sql`** → Run.
You should see "Success. No rows returned." It's safe to run again.

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

Check Stripe → Payments and Stripe → Connect → Accounts to see everything appear.
If something fails, send me a screenshot of the error and of Supabase → Edge Functions → Logs.

---

## Going live (only when the site is ready AND these are done)
1. **Register your business** (živnosť or s.r.o.). Stripe needs real business details to pay you.
2. Stripe → switch Test mode OFF → **Activate account** → enter business and bank details.
3. Repeat Part 2 step 5 and Part 5 in **live mode** (new `sk_live_` key, two new webhook endpoints,
   new signing secrets) → update the three Stripe secrets in Supabase.
4. Ask an accountant about **VAT** on your service fee and boosts, and about **DAC7** platform reporting
   (see CEO-STRATEGY.md). Get this done before your first live payment.
5. Make one real €10 test booking with your own card, then refund it from the dashboard.
