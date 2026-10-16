/* TC Grün-Weiss Heiligenwald – Interaktion
   Abhängigkeiten (lokal): gsap, ScrollTrigger, Lenis, gallery-data.js */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!window.gsap;
  root.classList.add('js');
  /* Die Startseite heißt nur "/": ein evtl. angehängtes index.html wird in der Adresszeile ersetzt */
  if (/\/index\.html$/.test(location.pathname) && history.replaceState) {
    history.replaceState(null, '', location.pathname.replace(/index\.html$/, '') + location.search + location.hash);
  }
  /* Handy und Tablet: native Scrollphysik und weniger Effekte, damit nichts ruckelt */
  var lite = window.matchMedia('(pointer: coarse), (max-width: 980px)').matches;

  /* Liquid-Glass-Verzerrung nur in Chromium-Browsern (backdrop-filter mit SVG-Filter) */
  try {
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    if (!lite && brands.some(function (b) { return /Chromium/.test(b.brand); })) {
      /* Erst nach dem Laden einschalten, damit der Seitenstart nicht auf den Filter wartet */
      window.addEventListener('load', function () { setTimeout(function () { root.classList.add('lg-ok'); }, 800); });
    }
  } catch (e) { /* ignorieren */ }

  /* ---------- Sanftes Scrollen ---------- */
  var lenis = null;
  if (!reduce && !lite && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (hasGsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  } else if (hasGsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  function scrollToTarget(el) {
    if (lenis) lenis.scrollTo(el, { offset: -16, duration: 1.3 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var m = href && href.match(/^(?:\/|index\.html)?#(.+)$/);
    if (!m) return;
    var el = doc.getElementById(m[1]);
    if (!el) return;
    e.preventDefault();
    var menu = doc.querySelector('.nav-menu');
    if (menu) { menu.classList.remove('open'); var hd = doc.querySelector('.site-header'); if (hd) hd.classList.remove('menu-open'); }
    scrollToTarget(el);
    if (history.replaceState) history.replaceState(null, '', '#' + m[1]);
  });

  /* ---------- Menü (Handy) ---------- */
  var toggle = doc.querySelector('.nav-toggle');
  var menu = doc.querySelector('.nav-menu');
  if (toggle && menu) {
    var header = doc.querySelector('.site-header');
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      if (header) header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    };
    toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    doc.addEventListener('click', function (e) { if (menu.classList.contains('open') && !e.target.closest('.nav')) setMenu(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  /* ---------- Kontaktformular ---------- */
  (function contactForm() {
    var form = doc.querySelector('.cform');
    if (!form || !window.fetch) return;
    var stamp = form.querySelector('[name=t]');
    var status = form.querySelector('.cstatus');
    var btn = form.querySelector('button[type=submit]');
    stamp.value = String(Date.now());
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'cstatus';
      status.textContent = '';
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Wird gesendet …';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Das Formular ist gerade nicht erreichbar. Bitte schreib uns direkt an tc-heiligenwald@t-online.de.' }; }); })
        .then(function (d) {
          status.textContent = d.message;
          if (d.ok) { form.reset(); stamp.value = String(Date.now()); } else { status.className = 'cstatus err'; }
        })
        .catch(function () {
          status.className = 'cstatus err';
          status.textContent = 'Keine Verbindung. Bitte versuche es später noch einmal oder schreib an tc-heiligenwald@t-online.de.';
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  })();

  /* ---------- Einblenden beim Scrollen + Zahlen hochzählen ---------- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-to'));
    if (reduce || !isFinite(to)) return;
    var t0 = performance.now();
    el.textContent = '0';
    (function step(now) {
      var p = Math.min(1, (now - t0) / 1300);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  var revealItems = [].slice.call(doc.querySelectorAll('.rv'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        [].forEach.call(en.target.querySelectorAll('.num'), countUp);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealItems.forEach(function (el) { io.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Parallax in Fotorahmen ---------- */
  if (hasGsap && window.ScrollTrigger && !reduce && !lite) {
    [].forEach.call(doc.querySelectorAll('[data-par]'), function (img) {
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- Hintergrund: sanfte Farbreise vom Verein bis "Spiel bei uns" ---------- */
  (function backgroundJourney() {
    var start = doc.getElementById('verein') || doc.querySelector('main');
    var end = doc.getElementById('kontakt') || doc.querySelector('footer');
    if (!start || !end || reduce || !(hasGsap && window.ScrollTrigger)) return;
    var bg = doc.createElement('div');
    bg.className = 'bgfx';
    bg.setAttribute('aria-hidden', 'true');
    doc.body.insertBefore(bg, doc.body.firstChild);
    /* Stopps: Fortschritt, Grundfarbe, Lichtfarbe, Lichtposition (x, y in Prozent) */
    var stops = [
      { p: 0,    c1: '#f6f5ef', c2: '#ffffff', x: 70, y: 20 },
      { p: 0.2,  c1: '#f6ecdb', c2: '#fcefd9', x: 25, y: 40 },
      { p: 0.45, c1: '#e8efdd', c2: '#d9e9cc', x: 75, y: 50 },
      { p: 0.7,  c1: '#f6ead7', c2: '#f3e0c6', x: 30, y: 62 },
      { p: 1,    c1: '#e8efdd', c2: '#d9e9cd', x: 70, y: 80 }
    ];
    function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    function mix(a, b, t) {
      var A = hex(a), B = hex(b);
      return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')';
    }
    var lastStep = -1;
    function apply(p) {
      var step = Math.round(p * (lite ? 24 : 120));
      if (step === lastStep) return;
      lastStep = step;
      p = step / (lite ? 24 : 120);
      var i = 0;
      while (i < stops.length - 2 && p > stops[i + 1].p) i++;
      var a = stops[i], b = stops[i + 1];
      var t = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
      bg.style.setProperty('--c1', mix(a.c1, b.c1, t));
      bg.style.setProperty('--c2', mix(a.c2, b.c2, t));
      bg.style.setProperty('--gx', (a.x + (b.x - a.x) * t).toFixed(1) + '%');
      bg.style.setProperty('--gy', (a.y + (b.y - a.y) * t).toFixed(1) + '%');
    }
    apply(0);
    ScrollTrigger.create({
      trigger: start, endTrigger: end, start: 'top 85%', end: 'bottom bottom', scrub: true,
      onUpdate: function (st) { apply(st.progress); }
    });

    /* Mesh-Wolken: weiche Farbflächen in mehreren Tiefenebenen. Nahe Wolken sind groß und ziehen
       schnell vorbei, ferne sind klein und langsam. Beim Durchqueren wachsen sie wie beim Heranfliegen. */
    var wrap = doc.createElement('div');
    wrap.className = 'meshwrap';
    wrap.setAttribute('aria-hidden', 'true');
    doc.body.insertBefore(wrap, bg.nextSibling);
    /* Position in Prozent von Breite und Höhe, Größe skaliert mit der Fensterbreite:
       so bleiben die Wolken bei jedem Zoom und jeder Fenstergröße mittig verteilt. */
    var colors = ['rgba(233,196,150,.55)', 'rgba(170,205,150,.50)', 'rgba(245,214,170,.50)', 'rgba(190,220,170,.48)'];
    var xs = [20, 80, 46, 68, 28, 56, 12, 88, 38, 62, 32, 74];
    var blobs = [];
    var small = doc.documentElement.clientWidth < 700;
    var count = small ? 7 : 12;
    for (var i = 0; i < count; i++) {
      var b = doc.createElement('div');
      b.className = 'blob';
      b.style.left = xs[i] + '%';
      b.style.top = ((i + 0.5) / count * 100) + '%';
      b.style.setProperty('--bc', colors[i % colors.length]);
      wrap.appendChild(b);
      blobs.push({ el: b, depth: (i % 3) + 1 });          /* 1 = fern, 3 = nah */
    }
    function layoutMesh() {
      var top = start.getBoundingClientRect().top + window.pageYOffset - 200;
      var bottom = end.getBoundingClientRect().bottom + window.pageYOffset;
      var w = doc.documentElement.clientWidth;
      wrap.style.top = Math.max(0, top) + 'px';
      wrap.style.height = Math.max(600, bottom - top) + 'px';
      var k = Math.max(0.7, Math.min(1.6, w / 1440));
      blobs.forEach(function (o) {
        var size = (260 + o.depth * 190) * k;
        o.el.style.width = size + 'px';
        o.el.style.height = size + 'px';
        o.el.style.marginLeft = (-size / 2) + 'px';
        o.el.style.marginTop = (-size / 2) + 'px';
      });
    }
    layoutMesh();
    if (!lite) blobs.forEach(function (o) {
      gsap.fromTo(o.el, { scale: 0.65, yPercent: 8 * o.depth }, {
        scale: 1.4, yPercent: -22 * o.depth, ease: 'none',
        scrollTrigger: { trigger: o.el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { layoutMesh(); ScrollTrigger.refresh(); }, 150);
    });
    window.addEventListener('load', function () { layoutMesh(); ScrollTrigger.refresh(); });
  })();

  /* ---------- "Spiel bei uns": Klick auf den Schläger schlägt eine Vorhand ---------- */
  /* 22 vorgerenderte Bilder (nur der Schläger, kein Mensch) laufen als Schlagbewegung ab. Beim Treffpunkt (Bild 12)
     fliegt der Ball weg, danach fällt ein neuer Ball ein. Die Bilder laden erst kurz vor dem Sichtbarwerden. */
  (function swing() {
    var stage = doc.querySelector('.cta-stage');
    var btn = doc.querySelector('.swing-btn');
    if (!stage || !btn) return;
    var wrap = stage.querySelector('.swing');
    var cv = stage.querySelector('.swing-canvas');
    var ball = stage.querySelector('.swing-ball');
    var ring = stage.querySelector('.swing-ring');
    if (!wrap || !cv || !ball || !cv.getContext) return;
    if (reduce) { btn.hidden = true; return; }       /* ohne Bewegung bleibt das Ruhebild stehen */
    var N = 22, CONTACT = 12, FRAME_MS = 30;
    var ctx = cv.getContext('2d');
    var imgs = [], loaded = 0, ready = false, busy = false, wantPlay = false;

    function draw(i) { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(imgs[i], 0, 0, cv.width, cv.height); }
    function load() {
      if (imgs.length) return;
      for (var i = 0; i < N; i++) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          loaded++;
          if (loaded === N) { ready = true; draw(0); if (wantPlay) { wantPlay = false; play(); } }
        };
        im.src = 'assets/hero/web/swing-' + (i < 10 ? '0' : '') + i + '.webp';
        imgs.push(im);
      }
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '700px 0px' });
      io.observe(stage);
    } else { load(); }

    function flyBall() {
      ball.animate([
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + 9vw),calc(-50% - 22%)) scale(.8) rotate(160deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate(calc(-50% + 22vw),calc(-50% - 12%)) scale(.3) rotate(420deg)', opacity: 0 }
      ], { duration: 950, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
      ring.animate([
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.7 },
        { transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }
      ], { duration: 520, easing: 'ease-out' });
    }
    function newBall() {
      ball.getAnimations().forEach(function (an) { an.cancel(); });
      var done = ball.animate([
        { transform: 'translate(-50%,calc(-50% - 230%)) scale(1)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.5 },
        { transform: 'translate(-50%,calc(-50% - 70%)) scale(1)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%,calc(-50% - 14%)) scale(1)', opacity: 1, offset: 0.93 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
      ], { duration: 1100, easing: 'ease-in' });
      done.onfinish = function () { busy = false; btn.removeAttribute('aria-busy'); };
    }
    function play() {
      if (busy) return;
      if (!ready) { wantPlay = true; load(); return; }
      busy = true;
      btn.setAttribute('aria-busy', 'true');
      var start = null, hit = false;
      (function step(now) {
        if (start === null) start = now;
        var f = Math.min(N - 1, Math.floor((now - start) / FRAME_MS));
        draw(f);
        if (!hit && f >= CONTACT) { hit = true; flyBall(); }
        if (f < N - 1) requestAnimationFrame(step);
        else setTimeout(function () { draw(0); newBall(); }, 380);
      })(performance.now());
    }
    wrap.addEventListener('click', play);
    btn.addEventListener('click', play);
  })();

  /* ---------- "Spiel bei uns": Bälle weichen aus und werden sandig ---------- */
  (function ctaBalls() {
    var stage = doc.querySelector('.cta-stage');
    if (!stage || reduce) return;
    var dust = stage.querySelector('.cdust');
    var balls = [].map.call(stage.querySelectorAll('.b'), function (el, i) {
      return { el: el, i: i, rx: 0, ry: 0, sand: 0, near: false, last: -9, ang: parseFloat(el.getAttribute('data-r')) || 0, dur: [6, 8, 7][i % 3] };
    });
    var rect = stage.getBoundingClientRect();
    var rectDirty = false;
    function measure() {
      balls.forEach(function (b) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; b.ox = b.el.offsetLeft; b.oy = b.el.offsetTop; });
      rect = stage.getBoundingClientRect();
      rectDirty = false;
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    window.addEventListener('scroll', function () { rectDirty = true; }, { passive: true });
    var mouse = { cx: -9999, cy: -9999 };
    var visible = false;
    window.addEventListener('pointermove', function (e) { mouse.cx = e.clientX; mouse.cy = e.clientY; }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
    } else { visible = true; }
    function puff(px, py, ballW) {
      if (!dust || !dust.animate) return;
      dust.style.width = Math.round(ballW * 2.6) + 'px';
      dust.style.left = px + 'px';
      dust.style.top = py + 'px';
      dust.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.25)' },
        { opacity: 0.9, transform: 'translate(-50%,-50%) scale(.8)', offset: 0.35 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }
      ], { duration: 800, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    (function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;
      var t = performance.now() / 1000;
      if (rectDirty) { rect = stage.getBoundingClientRect(); rectDirty = false; }
      var mx = mouse.cx - rect.left, my = mouse.cy - rect.top;
      balls.forEach(function (b) {
        var w = b.w;
        var cx = b.ox + w / 2, cy = b.oy + b.h / 2;
        var dx = mx - cx, dy = my - cy;
        var d = Math.hypot(dx, dy) || 1;
        var rad = w * 0.75 + 30, R = rad + 120;
        var pushX = 0, pushY = 0;
        if (d < R) { var f = (R - d) / R; pushX = -(dx / d) * f * 36; pushY = -(dy / d) * f * 36; }
        if (d < rad) {
          if (!b.near && b.sand < 0.04 && t - b.last > 1.5) { puff(cx, cy, w); b.last = t; }
          b.near = true;
          b.sand = Math.min(1, b.sand + 0.016);
        } else {
          b.near = false;
          b.sand = Math.max(0, b.sand - 0.0035);
        }
        b.el.style.setProperty('--sand', b.sand.toFixed(3));
        b.rx += (pushX - b.rx) * 0.1;
        b.ry += (pushY - b.ry) * 0.1;
        b.ang += 0.18 + (d < R ? 0.6 : 0);
        var ph = (t + b.i * 0.9) * (Math.PI * 2 / b.dur);
        b.el.style.transform = 'translate(' + b.rx.toFixed(1) + 'px,' + (b.ry + Math.sin(ph) * 10).toFixed(1) + 'px) rotate(' + (b.ang + Math.cos(ph) * 6).toFixed(1) + 'deg)';
      });
    })();
  })();

  /* ---------- Galerie: Alben und Vollbild ---------- */
  (function gallery() {
    var albums = window.ALBUMS;
    if (!albums) return;
    var base = 'assets/img/';
    var thumb = 'assets/img/thumb/';
    var bySlug = {};
    albums.forEach(function (a) { bySlug[a.slug] = a; });

    /* Fotozahlen in Kacheln eintragen */
    [].forEach.call(doc.querySelectorAll('[data-album]'), function (tile) {
      var a = bySlug[tile.getAttribute('data-album')];
      if (!a) return;
      var c = tile.querySelector('.cnt');
      if (c) c.textContent = a.year + ' · ' + a.photos.length + ' Fotos';
    });

    /* Alle Alben als Raster (galerie.html) */
    var grid = doc.getElementById('albums');
    if (grid) {
      albums.forEach(function (a) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'tile rv';
        b.setAttribute('data-album', a.slug);
        b.setAttribute('aria-label', 'Album ' + a.title + ' ' + a.year + ' öffnen');
        b.innerHTML = '<img loading="lazy" src="' + thumb + a.cover + '.webp" alt=""><span class="cap"><b>' + a.title + '</b><span>' + a.year + ' · ' + a.photos.length + ' Fotos</span></span>';
        grid.appendChild(b);
        if (!reduce && 'IntersectionObserver' in window) {
          var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { b.classList.add('in'); o.disconnect(); } }, { threshold: 0.1 });
          o.observe(b);
        } else { b.classList.add('in'); }
      });
    }

    /* Vollbild */
    var lb = doc.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Fotoansicht');
    lb.innerHTML =
      '<button type="button" class="lb-close" aria-label="Schließen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button type="button" class="lb-prev" aria-label="Vorheriges Foto"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="lb-next" aria-label="Nächstes Foto"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<img alt="">' +
      '<p class="lb-meta"></p>';
    doc.body.appendChild(lb);
    var img = lb.querySelector('img');
    var meta = lb.querySelector('.lb-meta');
    var cur = null, idx = 0, opener = null;

    function preload(i) {
      if (!cur) return;
      var n = cur.photos.length;
      var im = new Image();
      im.src = base + cur.photos[(i + n) % n] + '.webp';
    }
    function show(i) {
      var n = cur.photos.length;
      idx = (i + n) % n;
      img.classList.add('loading');
      img.onload = function () { img.classList.remove('loading'); };
      img.src = base + cur.photos[idx] + '.webp';
      img.alt = cur.title + ' ' + cur.year + ', Foto ' + (idx + 1) + ' von ' + n;
      meta.innerHTML = cur.title + ' ' + cur.year + '<small>' + (idx + 1) + ' / ' + n + '</small>';
      preload(idx + 1); preload(idx - 1);
    }
    function open(slug, from) {
      cur = bySlug[slug];
      if (!cur) return;
      opener = from || null;
      show(0);
      lb.classList.add('open');
      if (lenis) lenis.stop();
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      lb.classList.remove('open');
      if (lenis) lenis.start();
      if (opener) opener.focus();
    }
    doc.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-album]');
      if (t && t.tagName === 'BUTTON') open(t.getAttribute('data-album'), t);
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    doc.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    var sx = null;
    lb.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    lb.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 60) show(idx + (dx < 0 ? 1 : -1));
    });
  })();
})();
