/* ── CapturaGo in German, Spanish and French ──
   The pages are written in English. When another language is chosen, this script replaces every known
   piece of interface text (texts, placeholders, labels, titles) with its translation — also text that
   appears later (search results, booking window, messages from the server). Text it doesn't know stays
   English. Content written by people (names, descriptions, reviews, messages) is never touched: those
   elements carry translate="no" or are simply not in the dictionary.
   Dictionary + patterns: /i18n/<lang>.js (made from tools/i18n/ by tools/build-i18n.py); only the chosen
   language is downloaded. This script must be in <head> so that file loads before the page's own scripts. */
(function () {
  const LANGS = { en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français' };
  const LOCALE = { en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
  const pick = () => {
    try { const v = localStorage.getItem('cg_lang'); if (v && LANGS[v]) return v; } catch {}
    const nav = String((navigator.languages && navigator.languages[0]) || navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS[nav] ? nav : 'en';
  };
  const lang = pick();
  window.CG_LANG = lang;
  window.CG_LANGS = LANGS;
  window.setLanguage = function (l) {
    if (!LANGS[l]) return;
    try { localStorage.setItem('cg_lang', l); } catch {}
    // Signed in: remember it on the account too, so our emails and text messages come in this language
    const save = window.CG && window.CG.prefs && window.CG.prefs.setLanguage ? window.CG.prefs.setLanguage(l).catch(() => {}) : Promise.resolve();
    Promise.race([save, new Promise((r) => setTimeout(r, 1500))]).then(() => location.reload());
  };
  document.documentElement.lang = lang;

  /* Picker: a "🌐 EN ▾" button at the top of every page (main menu bar, sticky search bar, top bar of the
     simple pages, dashboard). It opens a small menu with the four languages. */
  const CODE = { en: 'EN', de: 'DE', es: 'ES', fr: 'FR' };
  let pickerN = 0;
  function closeAll(except) {
    document.querySelectorAll('.lang-pick.open').forEach((w) => { if (w !== except) { w.classList.remove('open'); w.querySelector('.lang-btn').setAttribute('aria-expanded', 'false'); } });
  }
  function makePicker() {
    const id = `langMenu${++pickerN}`;
    const wrap = document.createElement('div');
    wrap.className = 'lang-pick';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = `<button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}" aria-label="Language: ${LANGS[lang]}">`
      + `<span class="lang-globe" aria-hidden="true">🌐</span><span class="lang-code">${CODE[lang]}</span><span class="lang-caret" aria-hidden="true">▾</span></button>`
      + `<ul class="lang-menu" id="${id}" role="listbox" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<li role="option" aria-selected="${k === lang}" data-lang="${k}" tabindex="-1"><span class="lang-item-code">${CODE[k]}</span>${v}${k === lang ? '<span class="lang-tick" aria-hidden="true">✓</span>' : ''}</li>`).join('')}</ul>`;
    const btn = wrap.querySelector('.lang-btn'), items = [...wrap.querySelectorAll('li')];
    const open = (focusSel) => { closeAll(wrap); wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); const it = items.find((x) => x.dataset.lang === lang) || items[0]; (focusSel ? it : null)?.focus(); };
    const close = (refocus) => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.contains('open') ? close() : open(false); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); } });
    items.forEach((it, i) => {
      it.addEventListener('click', (e) => { e.stopPropagation(); close(); if (it.dataset.lang !== lang) window.setLanguage(it.dataset.lang); });
      it.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.click(); }
        else if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape');
      });
    });
    return wrap;
  }
  function addPicker() {
    document.querySelectorAll('[data-lang-picker], .simple-nav').forEach((spot) => {
      if (spot.querySelector('.lang-pick')) return;
      const wrap = makePicker();
      const back = spot.classList.contains('simple-nav') ? spot.querySelector('.back') : null;
      if (back) spot.insertBefore(wrap, back); else spot.appendChild(wrap);
    });
  }
  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPicker); else addPicker();

  if (lang === 'en') { window.tr = (s) => s; return; }
  if (!window.CG_I18N_DATA && document.readyState === 'loading') document.write(`<script src="/i18n/${lang}.js"><\/script>`);

  /* Dates: the pages ask for English dates ('en-GB'); show them in the chosen language instead */
  const loc = LOCALE[lang];
  const swap = (l) => (l === undefined || l === null || /^en/i.test(String(l)) ? loc : l);
  for (const m of ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString']) {
    const orig = Date.prototype[m];
    Date.prototype[m] = function (l, o) { return orig.call(this, swap(l), o); };
  }

  let dict = {}, patterns = [];
  function load() {
    const DATA = window.CG_I18N_DATA || { dict: {}, patterns: [] };
    dict = DATA.dict || {};
    patterns = (DATA.patterns || []).map(([src, t]) => { try { return [new RegExp(`^${src}$`, 'u'), t]; } catch { return null; } }).filter(Boolean);
  }
  const SPLIT = /^([^\p{L}\p{N}<]*?)([\p{L}\p{N}<"“(¿¡].*?)([\s→…*:.!?)]*)$/su;

  let loaded = false;
  function core(s) {
    if (!loaded) { load(); loaded = true; }
    const alt = s.includes('’') ? s.replace(/’/g, "'") : null;   // ’ and ' are the same
    const hit = dict[s] || (alt !== null ? dict[alt] : undefined);
    if (hit) return hit;
    const dot = s.includes(' · ');
    for (const x of alt !== null ? [s, alt] : [s]) {
      for (const [re, t] of patterns) {
        if (dot && !re.source.includes('·')) continue;   // a list "a · b" is translated piece by piece
        const m = x.match(re);
        if (!m || !t) continue;
        // $1…$9 = the matched parts; {1}…{9} = the matched part, translated too (e.g. a service name)
        return t.replace(/\{(\d)\}|\$(\d)/g, (_, a, b) => (a ? (translate(m[+a] || '') ) : (m[+b] || '')));
      }
    }
    return null;
  }
  /** Try the text as it is, then without emoji / symbols in front, without " *", "→", "…" or an emoji at
   *  the end, then sentence punctuation, then piece by piece for lists joined with " · ". */
  function attempt(s, depth) {
    let c = core(s);
    if (c !== null || depth > 3) return c;
    let m = s.match(/^([^\p{L}\p{N}<"“¿¡(]+)(.+)$/su);
    if (m) { c = attempt(m[2], depth + 1); if (c !== null) return m[1] + c; }
    m = s.match(/^(.+?)(\s*[→…*:]+|\s+[^\p{L}\p{N}\s]+)$/su);
    if (m) { c = attempt(m[1], depth + 1); if (c !== null) return c + m[2]; }
    m = s.match(SPLIT);
    if (m && (m[1] || m[3])) { c = core(m[2]); if (c !== null) return m[1] + c + m[3]; }
    if (s.includes(' · ')) {
      const parts = s.split(' · '), out = parts.map((p) => { const r = attempt(p, depth + 1); return r === null ? p : r; });
      if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
    }
    return null;
  }
  /** Translate one piece of text (keeps the spaces around it). Unknown text stays as it is. */
  function translate(text) {
    if (!text || !/\p{L}{2}/u.test(text)) return text;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    const out = attempt(text.trim().replace(/\s+/g, ' '), 0);
    return out === null ? text : lead + out + trail;
  }
  window.tr = translate;

  const SKIP = 'script,style,noscript,code,pre,textarea,[translate="no"],[contenteditable="true"],.notranslate';
  const done = new WeakMap();   // node → the text we put there (so our own change isn't translated again)
  function doText(n) {
    const v = n.nodeValue;
    if (done.get(n) === v) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const t = translate(v);
    if (t !== v) n.nodeValue = t;
    done.set(n, t);
  }
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const doneAttr = new WeakMap();
  const SKIP_ATTR = 'script,style,[translate="no"],[contenteditable="true"],.notranslate';   // a text box's own placeholder is translated
  function doAttrs(el) {
    if (el.closest(SKIP_ATTR)) return;
    let mem = doneAttr.get(el); if (!mem) { mem = {}; doneAttr.set(el, mem); }
    for (const a of ATTRS) {
      if (a === 'alt' && el.tagName === 'IMG') continue;   // image descriptions are written by people
      const v = el.getAttribute(a);
      if (!v || mem[a] === v) continue;
      const t = translate(v);
      if (t !== v) el.setAttribute(a, t);
      mem[a] = t;
    }
    if (el.tagName === 'INPUT' && /^(submit|button)$/i.test(el.type) && el.value) { const t = translate(el.value); if (t !== el.value) el.value = t; }
  }
  // Paragraphs written with inline tags (<strong>, <a>…) are translated as a whole when marked data-i18n
  function doBlock(el) {
    const key = el.innerHTML.replace(/\s+/g, ' ').trim();
    if (el.dataset.i18nDone === key) return;
    const hit = dict[key];
    if (hit) { el.innerHTML = hit; el.dataset.i18nDone = el.innerHTML.replace(/\s+/g, ' ').trim(); }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP_ATTR)) return;
    root.querySelectorAll('[data-i18n]').forEach(doBlock);
    if (root.matches('[data-i18n]')) doBlock(root);
    doAttrs(root);
    root.querySelectorAll('[placeholder],[aria-label],[title],input[type=submit],input[type=button]').forEach(doAttrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) doText(n);
  }
  function start() {
    load(); loaded = true;
    document.title = translate(document.title);
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') { if (m.target.nodeType === 1) doAttrs(m.target); }
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const t = translate(document.title); if (t !== document.title) document.title = t; })
      .observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // Native dialogs (confirm / alert) are worded in the scripts — translate them too
  const oc = window.confirm, oa = window.alert;
  window.confirm = (m) => oc.call(window, translate(String(m)));
  window.alert = (m) => oa.call(window, translate(String(m)));
})();
