/* ============================================================
 * MALTA Lab — application
 *   - Loads all content from /data/*.json
 *   - Bilingual (PT / EN) with localStorage persistence
 *   - Publication filters by year + type
 * ============================================================ */

(function () {
  "use strict";

  // ---- State ----
  const state = {
    lang: localStorage.getItem("malta_lang") || null,
    theme: localStorage.getItem("malta_theme") || null,
    data: { site: null, pesquisa: null, membros: null, publicacoes: null, noticias: null },
    pubFilter: { year: "all", type: "all" }
  };

  // ---- Tiny helpers ----
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Pick the right value for the current language.
   *  - If `v` is a string, return it as-is.
   *  - If `v` is an object with `pt`/`en`, return v[lang] (fallback to other lang or "").
   *  - If `v` is undefined/null, return "".
   */
  function t(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    const lang = state.lang;
    if (v[lang]) return v[lang];
    if (v.pt) return v.pt;
    if (v.en) return v.en;
    return "";
  }

  /** Initials avatar HTML for a member with no photo. */
  function initialsFor(name) {
    if (!name) return "??";
    const parts = name.replace(/^Prof\.?\s+Dr\.?\s+/, "").trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  /** Render a photo: <img> if URL, else initials block. */
  function photoHtml(imgUrl, name) {
    if (imgUrl && imgUrl.trim() && !imgUrl.includes("placehold")) {
      return `<img src="${imgUrl}" alt="${name}" loading="lazy">`;
    }
    return `<span aria-hidden="true">${initialsFor(name)}</span>`;
  }

  /** Escape user text → HTML. */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  /** ISO date → localised short date. */
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const loc = state.lang === "en" ? "en-US" : "pt-BR";
    return d.toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" });
  }

  // ---- Data loading ----
  async function loadAllData() {
    const fetchJson = (p) => fetch(p, { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${p}`);
      return r.json();
    });

    try {
      const [site, pesquisa, membros, publicacoes, noticias] = await Promise.all([
        fetchJson("./data/site.json"),
        fetchJson("./data/pesquisa.json"),
        fetchJson("./data/membros.json"),
        fetchJson("./data/publicacoes.json"),
        fetchJson("./data/noticias.json"),
      ]);
      state.data = { site, pesquisa, membros, publicacoes, noticias };

      // Resolve language: stored > site default > navigator
      if (!state.lang) {
        const def = site?.brand?.defaultLang || (navigator.language || "pt").slice(0, 2);
        state.lang = (def === "en") ? "en" : "pt";
      }

      renderAll();
    } catch (err) {
      console.error("MALTA Lab — data load error", err);
      $("#app-error").hidden = false;
    }
  }

  // ---- Renderers ----
  function setLang(lang) {
    state.lang = lang;
    localStorage.setItem("malta_lang", lang);
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "pt-BR");
    renderAll();
  }

  // ---- Theme (light / dark) ----
  const SUN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  const MOON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function resolveTheme() {
    if (state.theme === "light" || state.theme === "dark") return state.theme;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  function applyTheme() {
    const t = resolveTheme();
    document.documentElement.setAttribute("data-theme", t);
    // Swap hero logo
    const logo = document.getElementById("hero-logo");
    if (logo) logo.src = t === "dark" ? "./img/logow.png" : "./img/logo.png";
    // Re-init particles so dot/line colors match the theme
    initParticles();
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem("malta_theme", theme);
    applyTheme();
    renderThemeToggle();
  }

  function renderThemeToggle() {
    const tog = $("#theme-toggle");
    if (!tog) return;
    const cur = resolveTheme();
    tog.innerHTML = [
      { id: "light", svg: SUN_SVG,  label: state.lang === "en" ? "Light" : "Claro" },
      { id: "dark",  svg: MOON_SVG, label: state.lang === "en" ? "Dark"  : "Escuro" }
    ].map(o =>
      `<button data-theme="${o.id}" class="${cur === o.id ? "is-active" : ""}" aria-label="${o.label}" title="${o.label}">${o.svg}</button>`
    ).join("");
    tog.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => setTheme(b.dataset.theme))
    );
  }

  // ---- Particles (re-initable; reads CSS vars so it follows the theme) ----
  function initParticles() {
    if (!window.particlesJS) return;
    const css = getComputedStyle(document.documentElement);
    const dot  = css.getPropertyValue("--particle-dot").trim()  || "#5B6470";
    const line = css.getPropertyValue("--particle-line").trim() || "#B8B0A8";

    // Destroy any prior instance(s)
    if (window.pJSDom && window.pJSDom.length) {
      try {
        window.pJSDom.forEach(p => p.pJS.fn.vendors.destroypJS());
      } catch (e) { /* noop */ }
      window.pJSDom = [];
    }

    particlesJS("particles-js-container", {
      particles: {
        number: { value: 60, density: { enable: true, value_area: 900 } },
        color: { value: dot },
        shape: { type: "circle" },
        opacity: { value: 0.18, random: true },
        size: { value: 2.5, random: true },
        line_linked: { enable: true, distance: 160, color: line, opacity: 0.28, width: 1 },
        move: { enable: true, speed: 1.2, direction: "none", random: true, out_mode: "out" }
      },
      interactivity: {
        detect_on: "canvas",
        events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
      },
      retina_detect: true
    });
  }

  function renderAll() {
    renderHeader();
    renderHero();
    renderSobre();
    renderPesquisa();
    renderMembros();
    renderPublicacoes();
    renderNoticias();
    renderContato();
    renderFooter();
    renderMeta();
    renderThemeToggle();
  }

  function renderMeta() {
    const meta = state.data.site?.meta;
    if (!meta) return;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = t(meta.description);
    document.title = "MALTA Lab · PUCRS";
  }

  function renderHeader() {
    const { site } = state.data;
    if (!site) return;

    // Brand
    const brand = $("#brand");
    brand.innerHTML = `
      <span>${esc(site.brand.short)}</span>
      <span class="brand-sub">${esc(t(site.brand.affiliationLine))}</span>
    `;
    brand.setAttribute("aria-label", t(site.brand.long));

    // Nav (desktop + mobile)
    const navDesktop = $("#nav-desktop");
    const navMobile  = $("#mobile-menu-list");
    const linksHtml = site.nav.map(item =>
      `<a class="nav-link" href="${item.href}">${esc(t(item.label))}</a>`
    ).join("");
    navDesktop.innerHTML = linksHtml;
    navMobile.innerHTML = site.nav.map(item =>
      `<a href="${item.href}">${esc(t(item.label))}</a>`
    ).join("");

    // Language toggle
    const tog = $("#lang-toggle");
    tog.innerHTML = ["pt", "en"].map(l =>
      `<button data-lang="${l}" class="${state.lang === l ? "is-active" : ""}" aria-label="Switch to ${l.toUpperCase()}">${l.toUpperCase()}</button>`
    ).join("");
    tog.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => setLang(b.dataset.lang))
    );
  }

  function renderHero() {
    const { site, pesquisa, membros, publicacoes } = state.data;
    if (!site) return;

    const h = site.hero;
    $("#hero-tagline").textContent = t(h.tagline);

    // CTAs
    $("#hero-ctas").innerHTML = h.ctas.map(c =>
      `<a href="${c.href}" class="btn btn-${c.kind === "primary" ? "primary" : "secondary"}">${esc(t(c.label))}</a>`
    ).join("");

    // Stats
    const researcherCount =
      (membros?.coordenadores?.length || 0) +
      (membros?.alunos?.length || 0) +
      (membros?.alunos_graduacao?.length || 0);

    const stats = [
      { value: `${publicacoes?.length || 0}+`,
        label: state.lang === "en" ? "publications" : "publicações" },
      { value: `${pesquisa?.length || 0}`,
        label: state.lang === "en" ? "research areas" : "linhas de pesquisa" },
      { value: `${researcherCount}`,
        label: state.lang === "en" ? "researchers" : "pesquisadores" }
    ];
    $("#hero-stats").innerHTML = stats.map(s =>
      `<span class="stat-chip"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></span>`
    ).join("");
  }

  function renderSobre() {
    const s = state.data.site?.sobre;
    if (!s) return;
    $("#sobre-eyebrow").textContent = t(s.eyebrow);
    $("#sobre-title").textContent   = t(s.title);
    $("#sobre-body").textContent    = t(s.body);

    // Venues cloud
    $("#sobre-venues").innerHTML = (s.venues || []).map(v =>
      `<span>${esc(v)}</span>`).join("");

    // Highlights
    $("#sobre-highlights").innerHTML = (s.highlights || []).map(h => `
      <article class="card">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <h4>${esc(t(h.title))}</h4>
          <p>${esc(t(h.body))}</p>
        </div>
      </article>
    `).join("");
  }

  function renderPesquisa() {
    const sec = state.data.site?.pesquisaSection;
    const lines = state.data.pesquisa || [];
    if (sec) {
      $("#pesquisa-eyebrow").textContent = t(sec.eyebrow);
      $("#pesquisa-title").textContent   = t(sec.title);
      $("#pesquisa-body").textContent    = t(sec.body);
    }
    $("#pesquisa-grid").innerHTML = lines.map(l => `
      <article class="research-card">
        <div class="icon-tile" aria-hidden="true">${l.iconSvg}</div>
        <h3>${esc(t(l.title))}</h3>
        <p>${esc(t(l.description))}</p>
      </article>
    `).join("");
  }

  function renderMembros() {
    const sec = state.data.site?.membrosSection;
    const m = state.data.membros;
    if (!m) return;

    if (sec) {
      $("#membros-eyebrow").textContent = t(sec.eyebrow);
      $("#membros-title").textContent   = t(sec.title);
    }

    // helper for member card
    const linkClass = "member-link";
    const renderLinks = (mem) => {
      const links = [];
      if (mem.lattes)   links.push(`<a href="${mem.lattes}"   target="_blank" rel="noopener noreferrer" class="${linkClass}">Lattes</a>`);
      if (mem.linkedin) links.push(`<a href="${mem.linkedin}" target="_blank" rel="noopener noreferrer" class="${linkClass}">LinkedIn</a>`);
      if (mem.scholar)  links.push(`<a href="${mem.scholar}"  target="_blank" rel="noopener noreferrer" class="${linkClass}">Scholar</a>`);
      return links.length
        ? `<div class="member-links">${links.join("")}</div>` : "";
    };

    const cardHtml = (mem, role) => `
      <article class="member-card ${role}">
        <div>
          <div class="member-photo">${photoHtml(mem.imgUrl, mem.name)}</div>
          <div class="member-name">${esc(mem.name)}</div>
          <div class="member-role">${esc(t(mem.role))}</div>
          ${mem.topic ? `<p class="member-topic">${esc(t(mem.topic))}</p>` : ""}
          ${mem.specialty ? `<p class="member-topic">${esc(t(mem.specialty))}</p>` : ""}
        </div>
        ${renderLinks(mem)}
      </article>
    `;

    // Coordenadores
    $("#membros-coord-label").textContent = t(sec.labels.coordenadores);
    $("#coord-grid").innerHTML =
      m.coordenadores.map(c => cardHtml(c, "coord")).join("");

    // Alunos pós
    $("#membros-pos-label").textContent = t(sec.labels.alunos);
    $("#alunos-grid").innerHTML =
      m.alunos.map(a => cardHtml(a, "student")).join("");

    // Graduação — hide section if empty
    const gradWrap = $("#alunos-graduacao-wrap");
    if (m.alunos_graduacao && m.alunos_graduacao.length) {
      gradWrap.hidden = false;
      $("#membros-grad-label").textContent = t(sec.labels.alunos_graduacao);
      $("#alunos-graduacao-grid").innerHTML =
        m.alunos_graduacao.map(a => cardHtml(a, "student")).join("");
    } else {
      gradWrap.hidden = true;
    }
  }

  function renderPublicacoes() {
    const sec = state.data.site?.publicacoesSection;
    const pubs = state.data.publicacoes || [];
    if (sec) {
      $("#pubs-eyebrow").textContent = t(sec.eyebrow);
      $("#pubs-title").textContent   = t(sec.title);
      $("#pubs-body").textContent    = t(sec.body);
    }

    // Build filter options
    const years = Array.from(new Set(pubs.map(p => p.year))).sort((a, b) => b.localeCompare(a));
    const types = Array.from(new Set(pubs.map(p => p.type)));
    const lab = sec.labels;

    const buildChips = (kind, values, current) => {
      const allChip = `<button class="chip ${current === "all" ? "is-active" : ""}" data-kind="${kind}" data-value="all">${esc(t(lab.filterAll))}</button>`;
      const rest = values.map(v =>
        `<button class="chip ${current === v ? "is-active" : ""}" data-kind="${kind}" data-value="${esc(v)}">${esc(v)}</button>`
      ).join("");
      return allChip + rest;
    };

    $("#pub-year-chips").innerHTML = buildChips("year", years, state.pubFilter.year);
    $("#pub-type-chips").innerHTML = buildChips("type", types, state.pubFilter.type);
    $("#pub-year-label").textContent = t(lab.filterYear);
    $("#pub-type-label").textContent = t(lab.filterType);

    // Filter chip click handlers
    $$("#pub-year-chips .chip, #pub-type-chips .chip").forEach(btn => {
      btn.addEventListener("click", () => {
        state.pubFilter[btn.dataset.kind] = btn.dataset.value;
        renderPublicacoes();
      });
    });

    // Filter publications
    const filtered = pubs.filter(p =>
      (state.pubFilter.year === "all" || p.year === state.pubFilter.year) &&
      (state.pubFilter.type === "all" || p.type === state.pubFilter.type)
    );

    $("#pub-count").textContent =
      `${t(lab.showing)} ${filtered.length} ${t(lab.of)} ${pubs.length}`;

    // Render list
    const typeClass = (typ) => {
      const tl = (typ || "").toLowerCase();
      if (tl.startsWith("peri")) return "type-periodico";
      return "type-conferencia";
    };

    $("#pub-list").innerHTML = filtered.map(p => `
      <article class="pub-row">
        <div class="pub-badges">
          <span class="pub-badge year">${esc(p.year)}</span>
          <span class="pub-badge ${typeClass(p.type)}">${esc(p.type)}</span>
        </div>
        <div class="pub-main">
          <h3>${esc(p.title)}</h3>
          <div class="authors">${esc(p.authors)}</div>
          <div class="source">${esc(p.source)}</div>
        </div>
        <a class="pub-doi" href="${esc(p.doiUrl)}" target="_blank" rel="noopener noreferrer">${esc(t(lab.viewDOI))} ↗</a>
      </article>
    `).join("") || `<p class="loading">${state.lang === "en" ? "No publications match these filters." : "Nenhuma publicação corresponde a estes filtros."}</p>`;
  }

  function renderNoticias() {
    const sec = state.data.site?.noticiasSection;
    const items = state.data.noticias || [];
    if (sec) {
      $("#noticias-eyebrow").textContent = t(sec.eyebrow);
      $("#noticias-title").textContent   = t(sec.title);
      $("#noticias-body").textContent    = t(sec.body);
    }

    const sorted = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    $("#noticias-list").innerHTML = sorted.map(n => `
      <article class="news-item">
        <div class="news-meta">
          <time datetime="${esc(n.date)}">${esc(fmtDate(n.date))}</time>
          ${n.tag ? `<span class="news-tag">${esc(t(n.tag))}</span>` : ""}
        </div>
        <h3>${esc(t(n.title))}</h3>
        <p>${esc(t(n.body))}</p>
        ${n.link ? `<a class="news-link" href="${esc(n.link)}" ${n.link.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${state.lang === "en" ? "Read more" : "Saiba mais"} →</a>` : ""}
      </article>
    `).join("");
  }

  function renderContato() {
    const c = state.data.site?.contato;
    if (!c) return;

    $("#contato-eyebrow").textContent = t(c.eyebrow);
    $("#contato-title").textContent   = t(c.title);
    $("#contato-body").textContent    = t(c.body);

    // Address
    $("#addr-label").textContent = t(c.address.label);
    $("#addr-lines").innerHTML = (t(c.address.lines) || [])
      .map(l => `<p>${esc(l)}</p>`).join("");

    // Emails
    $("#emails").innerHTML = (c.emails || []).map(em => `
      <div>
        <h3>${esc(t(em.label))}</h3>
        <a href="mailto:${esc(em.value)}">${esc(em.value)}</a>
      </div>
    `).join("");

    // Social (only the ones with a real href)
    const realSocial = (c.social || []).filter(s => s.href && s.href.trim());
    const socialWrap = $("#social-wrap");
    if (realSocial.length) {
      socialWrap.hidden = false;
      $("#social-label").textContent = state.lang === "en" ? "Online" : "Online";
      $("#social-links").innerHTML = realSocial.map(s =>
        `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`
      ).join("");
    } else {
      socialWrap.hidden = true;
    }
  }

  function renderFooter() {
    const f = state.data.site?.footer;
    if (!f) return;
    $("#footer-tagline").textContent = t(f.tagline);
    $("#footer-copy").textContent = t(f.copyright);
    const link = $("#footer-link");
    link.textContent = t(f.institutionalLink.label);
    link.href = f.institutionalLink.href;
  }

  // ---- Boot ----
  // Apply theme as early as possible to avoid a flash of wrong colors
  (function bootTheme() {
    const stored = localStorage.getItem("malta_theme");
    let initial = stored;
    if (initial !== "light" && initial !== "dark") {
      initial = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", initial);
  })();

  document.addEventListener("DOMContentLoaded", () => {
    // Mobile menu toggle
    const menuBtn = $("#mobile-menu-button");
    const menu    = $("#mobile-menu");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => menu.classList.toggle("is-open"));
      menu.addEventListener("click", e => {
        if (e.target.tagName === "A") menu.classList.remove("is-open");
      });
    }
    // Apply theme + particles once particlesJS is loaded
    if (window.particlesJS) {
      applyTheme();
    } else {
      window.addEventListener("load", applyTheme);
    }
    loadAllData();
  });
})();
