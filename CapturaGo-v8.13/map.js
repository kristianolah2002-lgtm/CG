/* ================================================================
   CapturaGo — the creators map (MapLibre, vector map from OpenFreeMap).
   Loaded lazily: the map library (≈300 KB) is only downloaded when the
   map comes close to the screen. If the modern map style can't be loaded,
   it falls back to plain OpenStreetMap tiles. Everything shown in markers
   and popups is set as text (never as HTML).
================================================================ */
(function () {
  const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
  const RASTER_STYLE = {
    version: 8,
    sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
  let libPromise = null;
  function loadLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'vendor/maplibre/maplibre-gl.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'vendor/maplibre/maplibre-gl.js';
      s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error('map library missing')));
      s.onerror = () => reject(new Error('map library failed to load'));
      document.head.appendChild(s);
    });
    return libPromise;
  }
  async function loadStyle() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(STYLE_URL, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) return RASTER_STYLE;
      const st = await r.json();
      return st && st.version === 8 && st.sources && Array.isArray(st.layers) ? st : RASTER_STYLE;
    } catch { return RASTER_STYLE; }
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /**
   * createCgMap(container, { center: [lat, lon], zoom }) → { setMarkers(items, fit), focus(lat, lon, zoom), resize() }
   * items: [{ id, lat, lon, name, line, services, price, img, initial, rating, reviews, example, onOpen }]
   */
  window.createCgMap = function (container, opts) {
    const home = { center: [opts.center[1], opts.center[0]], zoom: opts.zoom };
    let map = null, ready = false, starting = false, failed = false;
    let markers = [], pending = { items: [], fit: false }, pendingFocus = null;

    function cardFor(it) {
      const card = el('div', 'mp-card');
      const imgBox = el('div', 'mp-img');
      const src = it.img && window.safeUrl ? window.safeUrl(it.img) : '';
      if (src) { const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = src; img.onerror = () => { img.remove(); imgBox.append(el('span', 'mp-initial', it.initial || '?')); }; imgBox.append(img); }
      else imgBox.append(el('span', 'mp-initial', it.initial || '?'));
      if (it.example) imgBox.append(el('span', 'mp-tag', 'Example'));
      const body = el('div', 'mp-body');
      body.append(el('strong', 'mp-name', it.name));
      if (it.line) body.append(el('span', 'mp-line', it.line));
      if (it.services) body.append(el('span', 'mp-services', it.services));
      const meta = el('div', 'mp-meta');
      if (it.rating > 0) meta.append(el('span', 'mp-rating', `★ ${Number(it.rating).toFixed(1)} (${Number(it.reviews) || 0})`));
      if (it.price) meta.append(el('span', 'mp-price', `from €${it.price}`));
      if (meta.childNodes.length) body.append(meta);
      const btn = el('button', 'mp-open', 'View profile →');
      btn.type = 'button';
      btn.addEventListener('click', () => it.onOpen && it.onOpen());
      body.append(btn);
      card.append(imgBox, body);
      return card;
    }
    function markerFor(it) {
      const b = el('button', 'mk');
      b.type = 'button';
      b.setAttribute('aria-label', `${it.name}${it.line ? ', ' + it.line : ''}`);
      b.dataset.id = String(it.id);
      const ava = el('span', 'mk-ava');
      const src = it.img && window.safeUrl ? window.safeUrl(it.img) : '';
      if (src) { const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = src; img.onerror = () => { img.remove(); ava.textContent = it.initial || '?'; }; ava.append(img); }
      else ava.textContent = it.initial || '?';
      b.append(ava);
      if (it.price) b.append(el('span', 'mk-price', `€${it.price}`));
      return b;
    }
    function applyMarkers() {
      markers.forEach((m) => m.remove());
      markers = [];
      const gl = window.maplibregl;
      const pts = [];
      // Creators in the same city share a position: fan them out in a small circle so every pin can be tapped
      const valid = pending.items.filter((it) => Number.isFinite(it.lat) && Number.isFinite(it.lon));
      const groups = new Map();
      valid.forEach((it) => { const k = `${it.lat.toFixed(3)},${it.lon.toFixed(3)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
      for (const it of valid) {
        const g = groups.get(`${it.lat.toFixed(3)},${it.lon.toFixed(3)}`);
        const i = g.indexOf(it), n = g.length, r = n > 1 ? Math.min(22 + n * 4, 60) : 0;
        const off = n > 1 ? [Math.round(r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2)), Math.round(r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2))] : [0, 0];
        const popup = new gl.Popup({ offset: [off[0], off[1] - 30], closeButton: true, maxWidth: '300px', className: 'mp-popup', focusAfterOpen: false }).setDOMContent(cardFor(it));
        popup.on('open', () => requestAnimationFrame(() => {   // keep the whole card inside the map
          const pe = popup.getElement(); if (!pe) return;
          const pr = pe.getBoundingClientRect(), mr = container.getBoundingClientRect();
          let dx = 0, dy = 0;
          if (pr.left < mr.left + 10) dx = pr.left - mr.left - 10; else if (pr.right > mr.right - 10) dx = pr.right - mr.right + 10;
          if (pr.top < mr.top + 10) dy = pr.top - mr.top - 10; else if (pr.bottom > mr.bottom - 10) dy = pr.bottom - mr.bottom + 10;
          if (dx || dy) map.panBy([dx, dy], { duration: 350 });
        }));
        const elm = markerFor(it);
        const m = new gl.Marker({ element: elm, anchor: 'bottom', offset: off }).setLngLat([it.lon, it.lat]).setPopup(popup).addTo(map);
        markers.push(m);
        pts.push([it.lon, it.lat]);
      }
      if (pending.fit && pts.length === 1) map.easeTo({ center: pts[0], zoom: 11, duration: 700 });
      else if (pending.fit && pts.length > 1) {
        const b = new gl.LngLatBounds(pts[0], pts[0]);
        pts.forEach((p) => b.extend(p));
        map.fitBounds(b, { padding: 70, maxZoom: 11, duration: 700 });
      } else if (!pending.fit) map.easeTo({ center: home.center, zoom: home.zoom, duration: 500 });
    }
    async function start() {
      if (map || starting || failed) return;
      starting = true;
      try {
        const [gl, style] = await Promise.all([loadLib(), loadStyle()]);
        map = new gl.Map({ container, style, center: home.center, zoom: home.zoom, minZoom: 1.5, maxZoom: 18,
          attributionControl: false, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false });
        map.touchZoomRotate.disableRotation();
        map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
        let fellBack = style === RASTER_STYLE;
        map.on('error', (e) => { if (e && e.error && !e.tile && !e.sourceId) console.warn('[map]', e.error.message || e.error); });
        map.on('error', (e) => {   // the vector style broke later (e.g. tiles down) → plain OpenStreetMap
          if (fellBack || !e || !e.sourceId || ready === false) return;
          fellBack = true; map.setStyle(RASTER_STYLE);
        });
        map.on('load', () => {
          ready = true;
          container.classList.add('map-ready');
          applyMarkers();
          if (pendingFocus) { map.easeTo(pendingFocus); pendingFocus = null; }
        });
      } catch (e) {
        failed = true;
        container.classList.add('map-failed');
        container.innerHTML = '<div class="map-fallback"><strong>🗺 The map can\'t be shown here</strong><span>Your browser can\'t display the interactive map. The list of creators still works.</span></div>';
      } finally { starting = false; }
    }
    // Start when the map comes near the screen
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '600px 0px' });
      io.observe(container);
    } else start();

    return {
      setMarkers(items, fit) { pending = { items: items || [], fit: !!fit }; if (ready) applyMarkers(); },
      focus(lat, lon, zoom) {
        const view = { center: [lon, lat], zoom: zoom || 11, duration: 700 };
        if (ready) map.easeTo(view); else { pendingFocus = view; start(); }
      },
      resize() { if (map) map.resize(); },
      get ready() { return ready; },
      get failed() { return failed; },
    };
  };
})();
