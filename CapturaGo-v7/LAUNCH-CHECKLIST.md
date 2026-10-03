# CapturaGo — Launch checklist

> **New in v7 (payments, boosts, AI match):** after steps 1–2 below, run `payments-patch.sql`
> and follow **SETUP-PAYMENTS-AND-AI.md** (test mode first). Strategy: **CEO-STRATEGY.md**.

Do these in order. Don't skip step 1 or 2.

---

## 1. Hero photo — already included
Your own photo (the Paris couple + photographer shot) is already in
`images/CG.webp` and wired into the hero. Nothing to do here. If you ever
want to swap it, just replace that file with a new one of the same name,
or open `style.css`, find `.hero{` near the top, and point the `url(...)`
at a different file or hosted image.

## 2. Run the security patch (3 min) — REQUIRED, even if you ran an older version
**Run the NEW `security-patch.sql` from this folder**, even if you already ran an earlier one.
The new version also hides creators' and reviewers' private email addresses from the public.
It's safe to run more than once.

Supabase → SQL Editor → New query → paste all of `security-patch.sql` → Run.
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
| favicon.ico / .svg, apple-touch-icon.png, site.webmanifest | Icons |
| robots.txt, sitemap.xml | Google indexing |
| _headers | Security headers (Netlify reads this automatically) |
| fonts/, vendor/ | Self-hosted fonts, map and database libraries |
| schema.sql, security-patch.sql | Database setup (schema already run; run the patch) |
| supabase/functions/notify-inquiry | Inquiry email function (deploy later, needs Resend) |
