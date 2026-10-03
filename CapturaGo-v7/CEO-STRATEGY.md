# CapturaGo — CEO strategy

## 1. The business in one sentence
A marketplace where travellers book local creators who know the best spots. **We earn when a
shoot happens** (service fee) and **when creators want more visibility** (boosts).

## 2. Revenue model (built and tested)
| Stream | How it works | Why this design |
|---|---|---|
| **Service fee — 10% paid by the traveller** | Added at checkout. Creators keep 100% of their price. | Creators are the hard side to win. "Keep 100%" beats every competitor's pitch. Travellers accept a fee because they get protection. |
| **Protected payment (escrow)** | Money is held until after the shoot, then paid out. | It's the reason to book *through* CapturaGo instead of an Instagram DM. Protection is what the fee pays for. |
| **Boosts — €9 / 7 days, €24 / 30 days** | Paid top placement, labelled "Sponsored". | Pure margin, no payment risk. EU law requires the label. |

All fees are settings (`CLIENT_FEE_PCT`, `CREATOR_FEE_PCT`, boost prices). Change them without code.

### Unit economics of one €120 booking (estimate)
| | € |
|---|---|
| Traveller pays | 132.00 |
| Creator receives | 120.00 |
| **Your gross fee** | **12.00** |
| Card processing (≈1.5% + €0.25, European cards) | ≈ −2.25 |
| Stripe Connect payout costs | ≈ −0.40 |
| VAT on your fee, *if* you're VAT-registered (23% included in the fee) | ≈ −2.24 |
| **Net per booking** | **≈ €7–9.50** |

Non-European cards cost more. Confirm current rates at stripe.com/pricing and VAT treatment with an
accountant. Takeaway: **~1,000 bookings/month ≈ €7–9.5k net/month**, plus boosts.

## 3. Revenue roadmap
**Now (built):** service fee, escrow, boosts.

**Next 3–6 months (high value, low effort):**
1. **Gift a photoshoot**: gift cards for birthdays, anniversaries and proposals. Cash comes in upfront, people
   buy them all year, and every gift card brings in a new customer.
2. **Add-ons at checkout**: rush editing, +20 photos, video clip. Creators set the prices; the same 10% fee applies.
3. **Pro plan for creators (€9–15/month)**: cheaper boosts, a bigger gallery, analytics, priority support.
   Launch it only once creators are getting real bookings.

**6–18 months:**
4. **B2B**: hotels, wedding planners, tourism boards and influencer agencies book creators at
   scale with invoices. Fee 15–20%.
5. **Local spot guides**: creators sell their "secret spots" guide as a digital product (€5–15, 20%
   fee). Only CapturaGo has this, because only you collect local spots.
6. Partnerships (travel insurance, eSIMs) for small extra income. Never at the expense of user trust.

## 4. The #1 risk: people meeting on CapturaGo, then paying outside it
Every marketplace faces this. Defences, in order:
- **Protection only exists on CapturaGo**: escrow, refunds and dispute help. ✅ built
- **A low fee (10%)** so leaving isn't worth it. ✅
- **Next:** only travellers who completed a booking can leave reviews. Reviews are a creator's main
  asset, so they'll want bookings to go through the platform.
- **Later:** hide creators' contact details until a booking is made, and filter phone numbers and
  emails out of messages. Do this only once you have enough demand to justify the friction.

## 5. Growth playbook — city by city, supply first
1. **Pick 3 launch cities** where tourists already book photographers (e.g. Prague, Vienna, Budapest,
   or Bratislava at home). Don't launch "everywhere"; an empty map kills trust.
2. **Supply:** in each city, get **15 creators with packages and payouts active** before advertising.
   Do personal outreach on Instagram and offer "first 100 creators get 1 month of free boost".
3. **Demand:** city landing pages for Google ("photographer in Prague", "proposal photographer
   Vienna"). This is the next feature to build. Also TikTok/Reels of real shoots, and hotel concierge partnerships.
4. **Creator referral loop:** every creator shares their CapturaGo profile link. Reward referrals with boost credit.
5. Expand only when a city has **at least 1 booking per creator per month**.

## 6. Numbers to watch every week
GMV (total booking value) · bookings per city · % of creators with at least 1 booking/month ·
search → booking conversion · cancellation and dispute rate · creator response time.

## 7. Legal & operations — must be done before the first LIVE payment
- **Business entity** (živnosť or s.r.o.). Stripe requires it to activate payouts.
- **VAT:** your service fee and boosts are your own taxable services. Ask a tax adviser when you must
  register and how EU consumer sales (OSS) apply. Your accounting background helps here, but get it confirmed.
- **DAC7:** EU rules make platforms report creators' earnings to the tax authority every year
  (in Slovakia, to the Finančná správa, by 31 January). You'll need each creator's tax details. Plan this before
  creators earn real money. It's the next back-office feature.
- **Disputes:** decide your rules (who decides, what refund in which case) and answer within 48h.
  Disputed payments wait in Stripe until you refund or release them manually.
- Complete your postal address in the Terms & Privacy pages, and have a lawyer review them once revenue starts.

## 8. Next 90 days
| Weeks | Goal |
|---|---|
| 1–2 | Test mode end-to-end, register the business, activate Stripe. |
| 3–6 | Recruit 45 creators in 3 cities (15 each) with packages + payouts. |
| 5–8 | City SEO pages + "Gift a photoshoot". First real bookings. |
| 9–12 | Reviews only from completed bookings. Measure conversion; decide on Pro plan. |

Target by day 90: **50+ paid bookings**. That proves the model and is the story for investors.
