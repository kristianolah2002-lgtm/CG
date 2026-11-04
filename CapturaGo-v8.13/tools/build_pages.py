"""Generates SEO landing pages: /for/<occasion>.html, /services/<service>.html, /in/<city>.html
and sitemap.xml. Run:  python3 tools/build_pages.py   (from the project folder)"""
import os, re, html, json, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://capturago.com'
LOGO = sys.argv[1] if len(sys.argv) > 1 else '<a href="/" class="logo"><svg class="logo-icon" viewBox="-110 -110 220 220" width="0.9em" height="0.9em" aria-hidden="true" style="display:inline;vertical-align:-0.08em"><path d="M 0.00 -100.00 Q 3.18 -25.68 14.14 -14.14 Q 25.68 -3.18 100.00 0.00 Q 25.68 3.18 14.14 14.14 Q 3.18 25.68 0.00 100.00 Q -3.18 25.68 -14.14 14.14 Q -25.68 3.18 -100.00 0.00 Q -25.68 -3.18 -14.14 -14.14 Q -3.18 -25.68 0.00 -100.00 Z" fill="currentColor"/></svg> CapturaGo</a>'
e = html.escape

OCC = {
 'proposal':  ('Proposal photographers', 'Plan the moment, we\'ll make sure it\'s captured. Book a local creator who hides in plain sight and knows where the light is best.', 'They scout the spot with you beforehand and stay invisible until the yes.'),
 'couples':   ('Couples & honeymoon photographers', 'Stop taking selfies on your honeymoon. A local creator photographs the two of you in the city\'s most beautiful places.', 'Relaxed, guided posing — no modelling experience needed.'),
 'wedding':   ('Elopement & destination wedding creators', 'Photographers, videographers and same-day content creators for elopements and destination weddings.', 'Add a phone content creator for same-day Reels alongside your photographer.'),
 'solo':      ('Solo travel photographers', 'Travelling alone? Finally be in your own travel photos — with a local who knows the city and its hidden corners.', 'A great way to see the city with a local, too.'),
 'family':    ('Family & friends photographers', 'Everyone in the picture for once. Family trips, friend groups, bachelorettes and reunions.', 'Creators who are great with kids and big groups.'),
 'birthday':  ('Birthday & celebration photographers', 'Make the milestone look the part — birthdays, anniversaries and celebrations, wherever you are.', 'Pair it with flash or photo-dump style for the party.'),
 'headshots': ('Headshot & LinkedIn photographers', 'Professional headshots for LinkedIn, CVs and team pages — usually in under an hour, in a studio or around your city.', 'Ask for natural light and two outfits for variety.'),
 'dating':    ('Dating profile photographers', 'Natural, candid photos that look like you on a good day — the kind that actually get matches.', 'Candid and golden-hour styles work best for dating apps.'),
 'graduation':('Graduation photographers', 'Cap, gown and the whole campus — graduation photos with friends and family.', 'Book early: graduation weeks fill up fast.'),
 'content':   ('Content creators for influencers', 'A content partner who knows the angles: phone content, Reels, photo dumps and editing for your feed.', 'Phone content creators shoot on your phone so you can post the same day.'),
 'business':  ('Photographers for businesses & Airbnbs', 'Photos for cafés, restaurants, hotels, Airbnb listings and products — from local creators who know your city.', 'Good listing photos are one of the fastest ways to get more bookings.'),
 'events':    ('Event photographers & content creators', 'Parties, launches, conferences and festivals — photos, video and same-day social content.', 'Ask for a same-day highlights reel for your socials.'),
}
SVC = {
 'photo':      ('Book a local photographer', 'Professional and talented amateur photographers who live where you\'re going and know the best spots.'),
 'video':      ('Book a local videographer', 'Travel films, couple films and brand videos shot by locals who know where to film.'),
 'phone':      ('Phone content creators', 'They shoot on your phone in the casual style you post straight away — Reels, stories and photo dumps. No waiting for edits.'),
 'event':      ('Wedding & event content creators', 'Same-day Reels, behind-the-scenes clips and phone content alongside your official photographer.'),
 'drone':      ('Drone pilots', 'Aerial photos and video of coasts, mountains and cities. Creators confirm they hold the certificate required where they fly.'),
 'guide':      ('Local guides & fixers', 'No camera needed — a local who takes you to the best spots, the hidden ones tourists never find.'),
 'edit':       ('Photo retouching & colour grading', 'Send your photos, get them back retouched and colour-graded. Remote, from anywhere, with revisions included.'),
 'video_edit': ('Video editors for your trip footage', 'Turn the raw footage from your trip into a travel film or Reel. Remote, delivered online, with revisions.'),
 'clip':       ('Clippers for TikTok, Reels & Shorts', 'Clippers turn your long videos, streams and podcasts into short-form clips with hooks and captions.'),
 'thumbnail':  ('YouTube thumbnail designers', 'Thumbnails that get clicks, designed by creators who understand YouTube. Remote, with revisions.'),
 'ugc':        ('UGC creators for brands', 'Authentic product videos and testimonials from real creators — for ads, social and your website.'),
}
CITIES = [('prague','Prague','Czechia'),('vienna','Vienna','Austria'),('bratislava','Bratislava','Slovakia'),('budapest','Budapest','Hungary'),
          ('barcelona','Barcelona','Spain'),('berlin','Berlin','Germany'),('kyoto','Kyoto','Japan'),('bali','Bali','Indonesia'),
          ('santorini','Santorini','Greece'),('marrakech','Marrakech','Morocco'),('bangkok','Bangkok','Thailand'),('mexico-city','Mexico City','Mexico'),
          ('lisbon','Lisbon','Portugal'),('porto','Porto','Portugal'),('paris','Paris','France'),('rome','Rome','Italy'),('florence','Florence','Italy'),
          ('venice','Venice','Italy'),('amsterdam','Amsterdam','Netherlands'),('london','London','United Kingdom'),('istanbul','Istanbul','Türkiye'),
          ('dubrovnik','Dubrovnik','Croatia'),('krakow','Kraków','Poland'),('reykjavik','Reykjavík','Iceland'),('dubai','Dubai','United Arab Emirates'),
          ('tokyo','Tokyo','Japan'),('seoul','Seoul','South Korea'),('singapore','Singapore','Singapore'),('new-york','New York','USA'),
          ('cape-town','Cape Town','South Africa')]

# --- keep pages in sync with taxonomy.js ---
tax = open(os.path.join(ROOT, 'taxonomy.js')).read()
svc_ids = re.findall(r"\{ id: '([a-z_]+)',\s+group:", tax)
occ_block = tax[tax.index('const occasions'):]
occ_ids = re.findall(r"\{ id: '([a-z_]+)',\s+icon:", occ_block)
missing = (set(svc_ids) ^ set(SVC)) | (set(occ_ids) ^ set(OCC))
if missing: sys.exit(f'Pages out of sync with taxonomy.js: {sorted(missing)}')
remote = set(re.findall(r"\{ id: '([a-z_]+)',\s+group: 'remote'", tax))

LIVE_SCRIPTS = '''<script src="/vendor/supabase.umd.js"></script>
<script src="/supabase.js"></script>
<script src="/site.js"></script>
<script src="/taxonomy.js"></script>
<script src="/city.js"></script>'''

def page(path, title, desc, eyebrow, h1, lead, points, cta_href, cta_text, related, live_city=None, dynamic=False):
    url = f'{SITE}/{path}'
    crumbs = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"CapturaGo","item":SITE + '/'},
        {"@type":"ListItem","position":2,"name":h1,"item":url}]}
    pts = ''.join(f'<div><strong>{e(a)}</strong><span>{e(b)}</span></div>' for a, b in points)
    rel = ''.join(f'<a href="/{e(h)}">{e(t)}</a>' for h, t in related)
    live = (f'<section class="city-live" id="cityLive" data-city="{e(live_city)}" aria-live="polite"></section>' if live_city
            else '<section class="city-live" id="cityLive" aria-live="polite"></section>' if dynamic else '')
    # City pages follow the visitor's language (i18n.js); the occasion / service pages are English SEO pages
    i18n = '\n  <script src="/i18n.js"></script>' if (live_city or dynamic) else ''
    robots = '<meta name="robots" content="noindex, follow" />' if dynamic else f'<link rel="canonical" href="{url}" />'
    out = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />{i18n}
  <title>{e(title)} – CapturaGo</title>
  <meta name="description" content="{e(desc)}" />
  {robots}
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{e(title)} – CapturaGo" />
  <meta property="og:description" content="{e(desc)}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}/images/og-cover.jpg" />
  <meta name="theme-color" content="#211911" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/fonts/fonts.css" />
  <link rel="stylesheet" href="/style.css" />
  <script type="application/ld+json">{json.dumps(crumbs)}</script>
</head>
<body class="page-simple">
<script src="/consent.js"></script>
<nav class="simple-nav">
  {LOGO}
  <a href="/#portfolio-section" class="back">Browse creators →</a>
</nav>
<main class="landing">
  <section class="landing-hero">
    <div class="section-eyebrow" id="cityEyebrow">{e(eyebrow)}</div>
    <h1 id="cityTitle">{e(h1)}</h1>
    <p class="lead" id="cityLead">{e(lead)}</p>
  </section>
  {live}
  <div class="landing-points">{pts}</div>
  <div class="landing-cta">
    <a class="primary-btn" id="cityCta" href="{e(cta_href)}" style="text-decoration:none">{e(cta_text)}</a>
    <a class="secondary-btn" href="/#join-section" style="text-decoration:none">Are you a creator? List yourself free</a>
  </div>
  <section class="landing-related"><h2>Explore more</h2><nav>{rel}</nav></section>
</main>
<footer class="footer"><div class="footer-inner"><p>© 2026 CapturaGo · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p></div></footer>
{LIVE_SCRIPTS if (live_city or dynamic) else ''}
</body>
</html>
"""
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(out)
    return path

PROTECT = ('Protected payment', 'You pay securely and the money is only released to the creator after the job is done.')
pages = []
occ_links = [(f'for/{k}.html', v[0]) for k, v in OCC.items()]
svc_links = [(f'services/{k}.html', v[0]) for k, v in SVC.items()]
city_links = [(f'in/{s}.html', n) for s, n, _ in CITIES]
for k, (h1, lead, tip) in OCC.items():
    pages.append(page(f'for/{k}.html', h1, lead[:155], 'Who is it for?', h1, lead,
        [('Local creators', 'They live where you\'re going and know the spots tourists never find.'), ('Tip', tip), PROTECT],
        f'/?occasion={k}#portfolio-section', 'See creators', [l for l in occ_links if l[0] != f'for/{k}.html'][:6] + city_links[:4]))
for k, (h1, lead) in SVC.items():
    is_remote = k in remote
    first = ('Works from anywhere', 'Remote work is delivered online — the creator\'s location doesn\'t matter.') if is_remote else ('Local creators', 'They live where you\'re going and know the best spots.')
    third = ('Revisions included', 'Each package says how many revisions you get and when it\'s delivered.') if is_remote else ('Clear packages', 'Every package has a fixed price, so you know exactly what you pay.')
    pages.append(page(f'services/{k}.html', h1, lead[:155], 'Remote service' if is_remote else 'On location', h1, lead,
        [first, PROTECT, third], f'/?service={k}#portfolio-section', 'See creators', [l for l in svc_links if l[0] != f'services/{k}.html'][:6] + occ_links[:4]))
for slug, name, country in CITIES:
    h1 = f'Photographers & creators in {name}'
    lead = f'Book a local photographer, videographer, phone content creator or guide in {name}, {country} — someone who knows the golden-hour spots and the hidden corners.'
    pages.append(page(f'in/{slug}.html', h1, lead[:155], f'{name}, {country}', h1, lead,
        [('They know the spots', f'Creators in {name} list their favourite local shooting spots on their profile.'), ('For every occasion', 'Proposals, couples, solo travel, headshots, family trips and more.'), PROTECT],
        f'/?city={name}#portfolio-section', f'See creators in {name}', [l for l in city_links if l[0] != f'in/{slug}.html'][:8] + occ_links[:4], live_city=name))

# Any other city: /in/<anything> is served by /city.html (see _redirects) and filled in by city.js
page('city.html', 'Photographers & creators near you', 'Book a local photographer, videographer or guide wherever you travel.', 'Your destination',
     'Photographers & creators', 'Book a local photographer, videographer, phone content creator or guide — someone who knows the golden-hour spots and the hidden corners.',
     [('They know the spots', 'Creators list their favourite local shooting spots on their profile.'), ('For every occasion', 'Proposals, couples, solo travel, headshots, family trips and more.'), PROTECT],
     '/#portfolio-section', 'See all creators', city_links[:8] + occ_links[:4], dynamic=True)

# creator pages (/p/<handle>) come from tools/build_creator_pages.py — kept as they are
creator_urls = sorted(f'p/{os.path.splitext(f)[0]}' for f in os.listdir(os.path.join(ROOT, 'p')) if f.endswith('.html')) if os.path.isdir(os.path.join(ROOT, 'p')) else []
urls = ['', 'gift.html', 'partners.html', 'privacy.html', 'terms.html'] + pages + creator_urls
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + \
     ''.join(f'  <url><loc>{SITE}/{u}</loc></url>\n' for u in urls) + '</urlset>\n'
open(os.path.join(ROOT, 'sitemap.xml'), 'w').write(sm)
print(f'built {len(pages)} pages + sitemap ({len(urls)} urls)')
