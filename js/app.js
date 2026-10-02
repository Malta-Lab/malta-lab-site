/* ============================================================
 * MALTA Lab — home page
 *   - Renders every home section from /data/*.json
 *   - Publication filters by year + type
 *   - Legend + research cards light up their cluster in the background
 *   - Shared header/footer/theme/language live in core.js
 * ============================================================ */

(function () {
  "use strict";

  const { state, $, $$, t, esc, fmtDate } = window.MALTA;
  const pubFilter = { year: "all", type: "all", showAll: false };

  /** Initials avatar HTML for a member with no photo. */
  function initialsFor(name) {
    if (!name) return "??";
    const parts = name.replace(/^Prof\.?\s+Dr\.?\s+/, "").trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  /** Render a photo: <img> if URL, else initials block.
   *  alt="" because the member's name is printed right below the photo. */
  function photoHtml(imgUrl, name) {
    if (imgUrl && imgUrl.trim() && !imgUrl.includes("placehold")) {
      return `<img src="${esc(imgUrl)}" alt="" loading="lazy">`;
    }
    return `<span aria-hidden="true">${esc(initialsFor(name))}</span>`;
  }

  // ---- Renderers ----
  function renderHome() {
    // Each section renders on its own, so one that throws leaves the rest intact
    [renderHero, renderSobre, renderPesquisa, renderMembros,
     renderPublicacoes, renderNoticias, renderContato, renderMeta].forEach(render => {
      try { render(); }
      catch (err) { console.error(`MALTA Lab — ${render.name} failed`, err); }
    });
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

  function renderHero() {
    const { site, pesquisa, membros, publicacoes } = state.data;
    if (!site) return;

    const h = site.hero;
    $("#hero-name").textContent = t(site.brand.long);
    $("#hero-tagline").textContent = t(h.tagline);

    // CTAs
    $("#hero-ctas").innerHTML = h.ctas.map(c => {
      const primary = c.kind === "primary";
      return `<a href="${esc(c.href)}" class="btn btn-${primary ? "primary" : "secondary"}">${esc(t(c.label))}${primary ? ' <span class="arrow" aria-hidden="true">→</span>' : ""}</a>`;
    }).join("");

    // Stats (the research-area count heads the legend instead)
    const researcherCount =
      (membros?.coordenadores?.length || 0) +
      (membros?.alunos?.length || 0) +
      (membros?.alunos_graduacao?.length || 0);

    const stats = [
      { value: `${publicacoes?.length || 0}+`,
        label: state.lang === "en" ? "publications" : "publicações" },
      { value: `${researcherCount}`,
        label: state.lang === "en" ? "researchers" : "pesquisadores" }
    ];
    $("#hero-stats").innerHTML = stats.map(s =>
      `<span class="hero-stat"><strong>${esc(s.value)}</strong>${esc(s.label)}</span>`
    ).join("");

    // Legend: each research area is one cluster of the background network
    const areas = pesquisa || [];
    $("#hero-legend").innerHTML = `
      <p class="legend-title" id="legend-title">${esc(areas.length)} ${esc(state.lang === "en" ? "research areas" : "linhas de pesquisa")}</p>
      <ul class="legend-list">
        ${areas.map((l, i) => `
          <li><a href="#area-${esc(l.id)}" data-cluster="${i}" style="--swatch: var(--area-${i})">
            <span class="swatch" aria-hidden="true"></span>${esc(t(l.title))}
          </a></li>`).join("")}
      </ul>
      <p class="legend-hint" aria-hidden="true">${esc(t(h.legendHint))}</p>`;
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
          <h3>${esc(t(h.title))}</h3>
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
    // The swatch is the area's colour in the background network
    $("#pesquisa-grid").innerHTML = lines.map((l, i) => `
      <article class="research-card" id="area-${esc(l.id)}" data-cluster="${i}" style="--swatch: var(--area-${i})">
        <span class="swatch" aria-hidden="true"></span>
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
      if (mem.lattes)   links.push(`<a href="${esc(mem.lattes)}"   target="_blank" rel="noopener noreferrer" class="${linkClass}">Lattes</a>`);
      if (mem.linkedin) links.push(`<a href="${esc(mem.linkedin)}" target="_blank" rel="noopener noreferrer" class="${linkClass}">LinkedIn</a>`);
      if (mem.scholar)  links.push(`<a href="${esc(mem.scholar)}"  target="_blank" rel="noopener noreferrer" class="${linkClass}">Scholar</a>`);
      return links.length
        ? `<div class="member-links">${links.join("")}</div>` : "";
    };

    const cardHtml = (mem, role) => `
      <article class="member-card ${role}">
        <div class="member-photo">${photoHtml(mem.imgUrl, mem.name)}</div>
        <div class="member-info">
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

    // Display name for a type; data + filtering keep the raw PT key (e.g. "Periódico")
    const typeLabel = (typ) => t(lab.typeNames?.[typ]) || typ;

    const buildChips = (kind, values, current, label = (v) => v) => {
      const allChip = `<button class="chip ${current === "all" ? "is-active" : ""}" data-kind="${kind}" data-value="all" aria-pressed="${current === "all"}">${esc(t(lab.filterAll))}</button>`;
      const rest = values.map(v =>
        `<button class="chip ${current === v ? "is-active" : ""}" data-kind="${kind}" data-value="${esc(v)}" aria-pressed="${current === v}">${esc(label(v))}</button>`
      ).join("");
      return allChip + rest;
    };

    $("#pub-year-chips").innerHTML = buildChips("year", years, pubFilter.year);
    $("#pub-type-chips").innerHTML = buildChips("type", types, pubFilter.type, typeLabel);
    $("#pub-year-label").textContent = t(lab.filterYear);
    $("#pub-type-label").textContent = t(lab.filterType);

    // Filter chip click handlers
    $$("#pub-year-chips .chip, #pub-type-chips .chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const { kind, value } = btn.dataset;
        const hadFocus = document.activeElement === btn;
        pubFilter[kind] = value;
        renderPublicacoes();
        // Chips are rebuilt on every render: move focus to the matching new chip
        if (hadFocus) {
          const next = $$(`#pub-${kind}-chips .chip`).find(c => c.dataset.value === value);
          if (next) next.focus();
        }
      });
    });

    // Filter publications
    const filtered = pubs.filter(p =>
      (pubFilter.year === "all" || p.year === pubFilter.year) &&
      (pubFilter.type === "all" || p.type === pubFilter.type)
    );

    // With no filter active, only the latest rows show until "show all" is pressed
    const LIMIT = 10;
    const collapsed = pubFilter.year === "all" && pubFilter.type === "all" &&
      !pubFilter.showAll && filtered.length > LIMIT;
    const visible = collapsed ? filtered.slice(0, LIMIT) : filtered;

    $("#pub-count").textContent =
      `${t(lab.showing)} ${visible.length} ${t(lab.of)} ${pubs.length}`;

    // Render list
    const typeClass = (typ) => {
      const tl = (typ || "").toLowerCase();
      if (tl.startsWith("peri")) return "type-periodico";
      return "type-conferencia";
    };

    // Authors come as ABNT ("PARRAGA, O.; MÓRE, M. D."): print them in normal case
    // and bold the ones that are lab members (surname + every initial must agree)
    const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "del", "du", "der", "van", "von"]);
    const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const norm = (s) => fold(s).replace(/[\s-]+/g, " ").trim();
    // "TEIXEIRA-DOS-SANTOS" → "Teixeira-dos-Santos", "DE OLIVEIRA" → "de Oliveira"
    const surnameCase = (s) => s.toLowerCase().replace(/[^\s\-'’]+/g, w =>
      PARTICLES.has(w) ? w : w[0].toUpperCase() + w.slice(1));

    // Every way a member can be cited: a later word (or run of words) of the name
    // as the surname, with the initials of the given names before it
    const members = ["coordenadores", "alunos", "alunos_graduacao"]
      .flatMap(g => state.data.membros?.[g] || []);
    const memberKeys = members.flatMap(mem => {
      const words = mem.name.replace(/^(?:(?:Prof|Profa|Dr|Dra)\.?\s+)+/, "").trim().split(/\s+/).map(fold);
      const keys = [];
      for (let j = 1; j < words.length; j++) {
        if (words[j].endsWith(".")) continue;
        const given = words.slice(0, j).filter(w => !PARTICLES.has(w)).map(w => w[0]);
        for (let k = j; k < words.length && !words[k].endsWith("."); k++) {
          if (!PARTICLES.has(words[k])) keys.push({ mem, surname: norm(words.slice(j, k + 1).join(" ")), given });
        }
      }
      return keys;
    });
    // The paper may give fewer initials than the member's name, never different ones
    const memberFor = (surname, initials) => {
      const given = (initials.match(/\p{L}+/gu) || [])
        .filter(w => !PARTICLES.has(fold(w))).map(w => fold(w)[0]);
      const hits = new Set(memberKeys.filter(k =>
        k.surname === norm(surname) && given.length && given.length <= k.given.length &&
        given.every((g, i) => g === k.given[i])
      ).map(k => k.mem));
      return hits.size === 1 ? [...hits][0] : null;   // ambiguous → not bold
    };
    const authorsHtml = (list) => (list || "").split(";").map(a => a.trim()).filter(Boolean).map(a => {
      const m = /^([^,]+),\s*(.+)$/.exec(a);
      if (!m) return esc(a);                          // e.g. "et al."
      // Non-breaking spaces keep the initials on the surname's line
      const name = esc(`${surnameCase(m[1].trim())},\u00a0${m[2].trim().replace(/\s+/g, "\u00a0")}`);
      return memberFor(m[1], m[2]) ? `<strong>${name}</strong>` : name;
    }).join("; ");

    // Link out only when there is a real URL; call it "DOI" only when it is one
    const linkHtml = (href) => {
      let url;
      try { url = new URL(href); } catch (e) { return ""; }
      if (!/^https?:$/.test(url.protocol)) return "";
      const label = /^(dx\.)?doi\.org$/i.test(url.hostname) ? lab.viewDOI : lab.viewLink;
      return `<a class="pub-doi" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t(label))} ↗</a>`;
    };

    // The year prints once at the top of each group (repeats are screen-reader only)
    $("#pub-list").innerHTML = visible.map((p, i) => `
      <article class="pub-row${i === 0 || visible[i - 1].year !== p.year ? " is-year-start" : ""}">
        <div class="pub-badges">
          <span class="pub-badge year">${esc(p.year)}</span>
          <span class="pub-badge ${typeClass(p.type)}">${esc(typeLabel(p.type))}</span>
        </div>
        <div class="pub-main">
          <h3>${esc(p.title)}</h3>
          <div class="authors">${authorsHtml(p.authors)}</div>
          <div class="source">${esc(p.source)}</div>
        </div>
        ${linkHtml(p.doiUrl)}
      </article>
    `).join("") || `<p class="loading">${state.lang === "en" ? "No publications match these filters." : "Nenhuma publicação corresponde a estes filtros."}</p>`;

    // "Show all" button below the sheet
    let more = $("#pub-more");
    if (!more) {
      more = document.createElement("div");
      more.id = "pub-more";
      more.className = "pub-more";
      $("#pub-list").after(more);
    }
    more.innerHTML = collapsed
      ? `<button type="button" class="btn btn-secondary" aria-controls="pub-list">${esc(t(lab.showAll).replace("{n}", filtered.length))}</button>`
      : "";
    if (collapsed) {
      $("button", more).addEventListener("click", () => {
        pubFilter.showAll = true;
        renderPublicacoes();
        // The button is gone: continue from the first newly shown row
        const next = $$("#pub-list .pub-row")[LIMIT];
        if (next) {
          next.setAttribute("tabindex", "-1");
          next.focus();
        }
      });
    }
  }

  function renderNoticias() {
    const sec = state.data.site?.noticiasSection;
    const cats = state.data.site?.newsCategories || {};
    const items = state.data.noticias || [];
    if (sec) {
      $("#noticias-eyebrow").textContent = t(sec.eyebrow);
      $("#noticias-title").textContent   = t(sec.title);
      $("#noticias-body").textContent    = t(sec.body);
    }

    // Home shows the latest three; the full list lives on noticias.html
    const latest = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 3);
    const href = (n) => `noticia.html?n=${encodeURIComponent(n.slug)}`;
    $("#noticias-list").innerHTML = latest.map(n => `
      <article class="news-item">
        <div class="news-meta">
          <time datetime="${esc(n.date)}">${esc(fmtDate(n.date))}</time>
          ${cats[n.category] ? `<span class="news-tag">${esc(t(cats[n.category]))}</span>` : ""}
        </div>
        <h3><a class="news-title-link" href="${href(n)}">${esc(t(n.title))}</a></h3>
        <p>${esc(t(n.summary))}</p>
        <a class="news-link" href="${href(n)}" aria-hidden="true" tabindex="-1">${esc(t(sec?.labels?.readMore))} →</a>
      </article>
    `).join("");
    $("#noticias-more").innerHTML = items.length
      ? `<a class="btn btn-secondary" href="noticias.html">${esc(t(sec?.labels?.viewAll))} →</a>` : "";
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

  // ---- Background highlight ----
  // Hovering or focusing a legend entry or research card lights up its cluster
  function initClusterHighlight() {
    const cluster = (node) => (node && node.closest) ? node.closest("[data-cluster]") : null;
    const show = (el) => {
      if (window.MALTANetwork) window.MALTANetwork.highlight(el ? Number(el.dataset.cluster) : null);
    };
    const on = (e) => {
      const el = cluster(e.target);
      if (el) show(el);
    };
    // When a hover or focus ends, fall back to the entry that still has focus
    const off = (e) => {
      const el = cluster(e.target);
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      show(cluster(document.activeElement));
    };
    // Mouse only: touch screens emulate hovers that would leave a highlight stuck
    const mouseOnly = (handler) => (e) => { if (e.pointerType === "mouse") handler(e); };
    document.addEventListener("pointerover", mouseOnly(on));
    document.addEventListener("pointerout", mouseOnly(off));
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
  }

  function renderHomeAndNetwork() {
    if (window.MALTANetwork && state.data.pesquisa) {
      window.MALTANetwork.setClusters(state.data.pesquisa.length);
    }
    renderHome();
  }

  document.addEventListener("DOMContentLoaded", initClusterHighlight);

  // ---- Boot ----
  window.MALTA.start({
    page: "home",
    data: {
      pesquisa:    "./data/pesquisa.json",
      membros:     "./data/membros.json",
      publicacoes: "./data/publicacoes.json",
      noticias:    "./data/noticias.json"
    },
    render: renderHomeAndNetwork
  });
})();
