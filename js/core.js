/* ============================================================
 * MALTA Lab — shared core (every page)
 *   - Language + theme state with localStorage persistence
 *   - Header, footer, mobile menu, theme/language toggles
 *   - Data loading; each page passes its own JSON + renderer
 *   - The background network lives in network.js
 *
 * Usage (from a page script):
 *   MALTA.start({ page: "home", data: { membros: "./data/membros.json" }, render });
 * ============================================================ */

(function () {
  "use strict";

  // ---- Storage (blocked in some private windows) ----
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } }
  };

  // ---- State ----
  const state = {
    lang: store.get("malta_lang") || null,
    theme: store.get("malta_theme") || null,
    page: "home",
    data: { site: null },
    render: null
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

  /** Escape user text → HTML. */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  /** "YYYY-MM-DD" → local Date. new Date("YYYY-MM-DD") is UTC midnight,
   *  which shows the previous day in Brazil (UTC-3). */
  function parseDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  }

  /** ISO date → localised short date. */
  function fmtDate(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
    const d = parseDate(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(state.lang === "en" ? "en-US" : "pt-BR", opts);
  }

  function fetchJson(path) {
    return fetch(path, { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${path}`);
      return r.json();
    });
  }

  // ---- Language ----
  /** Reflect the current language on <html lang>. */
  function applyLangAttr() {
    document.documentElement.setAttribute("lang", state.lang === "en" ? "en" : "pt-BR");
  }

  function setLang(lang) {
    state.lang = lang;
    store.set("malta_lang", lang);
    applyLangAttr();
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
    // Swap Kunumi logo (negativo = light ink for dark backgrounds)
    const kunumi = document.getElementById("kunumi-logo");
    if (kunumi) kunumi.src = t === "dark" ? "./img/kunumi_negativo.png" : "./img/kunumi_positivo.png";
    // Network colours follow the theme
    if (window.MALTANetwork) window.MALTANetwork.refresh();
  }

  function setTheme(theme) {
    state.theme = theme;
    store.set("malta_theme", theme);
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
      `<button data-theme="${o.id}" class="${cur === o.id ? "is-active" : ""}" aria-pressed="${cur === o.id}" aria-label="${o.label}" title="${o.label}">${o.svg}</button>`
    ).join("");
    tog.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => setTheme(b.dataset.theme))
    );
  }

  // ---- Header / footer ----
  /** Section anchors (#pesquisa…) live on the home page; prefix them elsewhere. */
  function pageHref(href) {
    if (state.page !== "home" && href.startsWith("#")) return "index.html" + href;
    return href;
  }

  function renderHeader() {
    const { site } = state.data;
    if (!site) return;

    const skip = $(".skip-link");
    if (skip) skip.textContent = state.lang === "en" ? "Skip to content" : "Pular para o conteúdo";

    // Brand: the wordmark lockup (name over the viridis bar)
    const brand = $("#brand");
    brand.innerHTML = `
      <span class="brand-lockup"><span class="brand-word">${esc(site.brand.short)}</span><span class="brand-bar" aria-hidden="true"></span></span>
      <span class="brand-sub">${esc(t(site.brand.affiliationLine))}</span>
    `;
    brand.setAttribute("aria-label", t(site.brand.long));
    brand.setAttribute("href", pageHref("#inicio"));

    // Nav (desktop + mobile); news pages mark the "Notícias" link as current
    const current = (item) => state.page === "news" && item.href === "noticias.html";
    const navDesktop = $("#nav-desktop");
    const navMobile  = $("#mobile-menu-list");
    navDesktop.innerHTML = site.nav.map(item =>
      `<a class="nav-link" href="${esc(pageHref(item.href))}"${current(item) ? ' aria-current="true"' : ""}>${esc(t(item.label))}</a>`
    ).join("");
    navMobile.innerHTML = site.nav.map(item =>
      `<a href="${esc(pageHref(item.href))}"${current(item) ? ' aria-current="true"' : ""}>${esc(t(item.label))}</a>`
    ).join("");

    // Language toggle (label = language name, in that language; visible text stays PT/EN)
    const langNames = { pt: "Português", en: "English" };
    const tog = $("#lang-toggle");
    tog.innerHTML = ["pt", "en"].map(l =>
      `<button data-lang="${l}" class="${state.lang === l ? "is-active" : ""}" aria-pressed="${state.lang === l}" aria-label="${langNames[l]}" lang="${l === "en" ? "en" : "pt-BR"}">${l.toUpperCase()}</button>`
    ).join("");
    tog.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => setLang(b.dataset.lang))
    );
  }

  function renderFooter() {
    const f = state.data.site?.footer;
    if (!f) return;
    $("#footer-tagline").textContent = t(f.tagline);
    // {year} token keeps the copyright current without yearly edits
    $("#footer-copy").textContent = t(f.copyright).replace("{year}", new Date().getFullYear());
    const link = $("#footer-link");
    link.textContent = t(f.institutionalLink.label);
    link.href = t(f.institutionalLink.href);
  }

  function renderAll() {
    renderHeader();
    if (state.render) state.render();
    renderFooter();
    renderThemeToggle();
  }

  // ---- Boot ----
  function initMobileMenu() {
    const menuBtn = $("#mobile-menu-button");
    const menu    = $("#mobile-menu");
    if (!menuBtn) return;
    // Keep aria-expanded in sync with the .is-open class
    const setMenuOpen = (open) => {
      menu.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    };
    menuBtn.addEventListener("click", () => setMenuOpen(!menu.classList.contains("is-open")));
    menu.addEventListener("click", e => {
      if (e.target.tagName === "A") setMenuOpen(false);
    });
    // Escape closes the menu and returns focus to the button
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setMenuOpen(false);
        menuBtn.focus();
      }
    });
  }

  async function loadData(paths) {
    try {
      const names = Object.keys(paths);
      const [site, ...rest] = await Promise.all([
        fetchJson("./data/site.json"),
        ...names.map(n => fetchJson(paths[n]))
      ]);
      state.data = { site };
      names.forEach((n, i) => { state.data[n] = rest[i]; });

      // Resolve language: stored > site default > navigator
      if (!state.lang) {
        const def = site?.brand?.defaultLang || (navigator.language || "pt").slice(0, 2);
        state.lang = (def === "en") ? "en" : "pt";
      }

      applyLangAttr();
      renderAll();
    } catch (err) {
      console.error("MALTA Lab — data load error", err);
      $("#app-error").hidden = false;
    }
  }

  /** Entry point for page scripts. */
  function start({ page = "home", data = {}, render = null } = {}) {
    state.page = page;
    state.render = render;
    // (Initial data-theme is set pre-paint by the inline script in each page's <head>)
    document.addEventListener("DOMContentLoaded", () => {
      initMobileMenu();
      applyTheme();
      loadData(data);
    });
  }

  window.MALTA = { state, $, $$, t, esc, fmtDate, parseDate, start };
})();
