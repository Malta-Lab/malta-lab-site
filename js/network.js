/* ============================================================
 * MALTA Lab — background network (every page)
 *   One cluster of points per research area, plus loose points that
 *   bridge them, drifting like an embedding plot. Points that come
 *   close link up, and the mouse pulls the nearest ones.
 *   Cluster colours are sampled from viridis and published as
 *   --area-0 … --area-N on <html>, so the legend matches the plot.
 *
 *   MALTANetwork.setClusters(n)  one cluster per research area
 *   MALTANetwork.highlight(i)    light up cluster i (null = all)
 *   MALTANetwork.refresh()       re-read the theme
 * ============================================================ */

(function () {
  "use strict";

  // matplotlib's viridis, 11 evenly spaced stops
  const VIRIDIS = ["#440154", "#482475", "#414487", "#355f8d", "#2a788e", "#21918c",
                   "#22a884", "#44bf70", "#7ad151", "#bddf26", "#fde725"];

  // Per theme: the part of the map that stays visible on the paper colour,
  // the colour of loose points / cross-cluster links, and drawing strength
  const THEMES = {
    light: { range: [0.02, 0.84], neutral: [87, 81, 112],  line: 0.72, node: 0.95, loose: 0.6 },
    dark:  { range: [0.36, 1],    neutral: [162, 156, 182], line: 0.7,  node: 1,    loose: 0.55 }
  };

  const LEVELS = 4;          // link opacity is bucketed so each frame is a few strokes
  const reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false, addEventListener() {} };

  let canvas, ctx;
  let w = 0, h = 0, dpr = 1;
  let K = 6;
  let centers = [], nodes = [];
  let theme = THEMES.light, colors = [];
  let focus = null;
  const weight = [];         // per-cluster opacity, eased toward 1 or the dimmed value
  let pointer = null;
  let raf = 0;

  // ---- Helpers ----
  const rand = (a, b) => a + Math.random() * (b - a);
  const hexRgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.max(-2.2, Math.min(2.2, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  }

  function viridis(t) {
    const x = Math.min(Math.max(t, 0), 1) * (VIRIDIS.length - 1);
    const i = Math.min(Math.floor(x), VIRIDIS.length - 2), f = x - i;
    const a = hexRgb(VIRIDIS[i]), b = hexRgb(VIRIDIS[i + 1]);
    return a.map((v, k) => Math.round(v + (b[k] - v) * f));
  }

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

  // ---- Layout ----
  /** Cluster centres on a jittered grid (in 0..1 units), shuffled so the
   *  colours don't read as a left-to-right gradient. */
  function buildCenters() {
    const cols = w >= h ? 3 : 2;
    const rows = Math.ceil(K / cols);
    const cells = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
    centers = Array.from({ length: K }, (_, k) => {
      const cell = cells[k];
      return {
        u: ((cell % cols) + 0.5 + rand(-0.22, 0.22)) / cols,
        v: (Math.floor(cell / cols) + 0.5 + rand(-0.22, 0.22)) / rows,
        ax: rand(0.04, 0.08), ay: rand(0.04, 0.08),
        fx: rand(0.05, 0.09), fy: rand(0.05, 0.09),
        spin: rand(0.03, 0.06) * (Math.random() < 0.5 ? -1 : 1),
        p: rand(0, Math.PI * 2),
        x: 0, y: 0
      };
    });
  }

  function buildNodes() {
    const count = Math.round(Math.min(Math.max((w * h) / 9000, 44), 160));
    nodes = Array.from({ length: count }, (_, i) => {
      const loose = i % 10 < 3;   // 30% loose points
      return {
        k: loose ? -1 : i % K,
        u: Math.random(), v: Math.random(),
        ox: gauss(), oy: gauss(),
        r: loose ? rand(1.2, 2) : rand(2, 3.8),
        a: rand(14, 34), fx: rand(0.25, 0.6), fy: rand(0.25, 0.6), p: rand(0, Math.PI * 2),
        px: 0, py: 0, x: 0, y: 0
      };
    });
  }

  /** Positions are a function of time, so nothing drifts away or collapses. */
  function place(time) {
    const s = time / 1000;
    const spread = Math.min(w, h) * 0.09 + Math.max(w, h) * 0.025;
    const reach = linkDistance() * 1.25;
    for (const c of centers) {
      c.x = (c.u + c.ax * Math.sin(s * c.fx + c.p)) * w;
      c.y = (c.v + c.ay * Math.cos(s * c.fy + c.p)) * h;
      c.cos = Math.cos(s * c.spin); c.sin = Math.sin(s * c.spin);
    }
    for (const n of nodes) {
      let x, y;
      if (n.k < 0) {
        x = n.u * w; y = n.v * h;
      } else {
        const c = centers[n.k];
        const ox = n.ox * spread, oy = n.oy * spread * 0.8;
        x = c.x + ox * c.cos - oy * c.sin;
        y = c.y + ox * c.sin + oy * c.cos;
      }
      x += n.a * Math.sin(s * n.fx + n.p);
      y += n.a * Math.cos(s * n.fy + n.p * 1.3);

      // The mouse pulls nearby points a little toward it
      let tx = 0, ty = 0;
      if (pointer) {
        const dx = pointer.x - x, dy = pointer.y - y, d = Math.hypot(dx, dy);
        if (d < reach) { const f = (1 - d / reach) * 0.3; tx = dx * f; ty = dy * f; }
      }
      n.px += (tx - n.px) * 0.08;
      n.py += (ty - n.py) * 0.08;
      n.x = x + n.px;
      n.y = y + n.py;
    }
  }

  const linkDistance = () => Math.min(Math.max(Math.min(w, h) * 0.18, 96), 150);

  // ---- Drawing ----
  function easeWeights(instant) {
    for (let k = 0; k <= K; k++) {
      // index K = loose points and cross-cluster links
      const target = focus == null ? 1 : (k === focus ? 1 : 0.16);
      const cur = weight[k] == null ? target : weight[k];
      weight[k] = instant ? target : cur + (target - cur) * 0.12;
    }
  }

  function draw(instant) {
    easeWeights(instant);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const link = linkDistance(), link2 = link * link;
    const buckets = Array.from({ length: (K + 1) * LEVELS }, () => []);

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > link2) continue;
        const strength = 1 - Math.sqrt(d2) / link;
        const k = (a.k === b.k && a.k >= 0) ? a.k : K;
        buckets[k * LEVELS + Math.min(LEVELS - 1, Math.floor(strength * LEVELS))].push(a, b);
      }
    }

    ctx.lineWidth = 1.15;
    buckets.forEach((pts, idx) => {
      if (!pts.length) return;
      const k = Math.floor(idx / LEVELS), level = idx % LEVELS;
      const color = k === K ? theme.neutral : colors[k];
      const alpha = theme.line * ((level + 1) / LEVELS) * (k === K ? 0.75 : 1) * weight[k];
      if (alpha < 0.01) return;
      ctx.strokeStyle = rgba(color, alpha);
      ctx.beginPath();
      for (let p = 0; p < pts.length; p += 2) {
        ctx.moveTo(pts[p].x, pts[p].y);
        ctx.lineTo(pts[p + 1].x, pts[p + 1].y);
      }
      ctx.stroke();
    });

    // Lines from the mouse to the points it is pulling
    if (pointer) {
      const reach = link * 1.25;
      ctx.beginPath();
      for (const n of nodes) {
        const d = Math.hypot(n.x - pointer.x, n.y - pointer.y);
        if (d < reach) { ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(n.x, n.y); }
      }
      ctx.strokeStyle = rgba(theme.neutral, theme.line * 0.55);
      ctx.stroke();
    }

    // Points, one fill per cluster
    for (let k = -1; k < K; k++) {
      const idx = k < 0 ? K : k;
      const alpha = (k < 0 ? theme.loose : theme.node) * weight[idx];
      if (alpha < 0.01) continue;
      const grow = focus != null && k === focus ? 1.35 : 1;
      ctx.fillStyle = rgba(k < 0 ? theme.neutral : colors[k], alpha);
      ctx.beginPath();
      for (const n of nodes) {
        if (n.k !== k) continue;
        ctx.moveTo(n.x + n.r * grow, n.y);
        ctx.arc(n.x, n.y, n.r * grow, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // ---- Loop ----
  function frame(now) {
    raf = 0;
    if (reduceMotion.matches) {
      // Still picture: fixed time, no mouse pull
      place(0);
      draw(true);
      return;
    }
    place(now);
    draw(false);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  /** Draw now, then keep animating (unless motion is reduced). */
  function kick() {
    if (raf) return;
    frame(performance.now());
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.round(rect.width), nh = Math.round(rect.height);
    const ndpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nw === w && nh === h && ndpr === dpr) return;
    // New layout only when the shape really changes (not when a phone's URL bar slides)
    const rebuild = !nodes.length || Math.abs(nw - w) > w * 0.2 || (nw >= nh) !== (w >= h);
    w = nw; h = nh; dpr = ndpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (rebuild) { buildCenters(); buildNodes(); }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    kick();
  }

  // ---- Public API ----
  function refresh() {
    const name = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    theme = THEMES[name];
    const [lo, hi] = theme.range;
    colors = Array.from({ length: K }, (_, k) => viridis(lo + (hi - lo) * (K === 1 ? 0 : k / (K - 1))));
    const root = document.documentElement.style;
    colors.forEach((c, k) => root.setProperty(`--area-${k}`, `rgb(${c.join(" ")})`));
    if (canvas) { if (raf) { cancelAnimationFrame(raf); raf = 0; } kick(); }
  }

  function setClusters(n) {
    n = Math.max(1, Math.min(12, n | 0));
    if (n === K) return;
    K = n;
    weight.length = 0;
    refresh();
    if (canvas && w) { buildCenters(); buildNodes(); }
  }

  function highlight(k) {
    focus = (k == null || k < 0 || k >= K) ? null : k;
    if (reduceMotion.matches) kick();
  }

  // ---- Boot ----
  function init() {
    canvas = document.getElementById("bg-network");
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext("2d");
    refresh();
    resize();
    canvas.classList.add("is-ready");

    let timer = 0;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(resize, 120); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    reduceMotion.addEventListener?.("change", () => { pointer = null; kick(); });

    // Mouse only: on touch screens a tap would just flash lines
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || reduceMotion.matches) return;
      pointer = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { pointer = null; });
  }

  window.MALTANetwork = { refresh, setClusters, highlight };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
