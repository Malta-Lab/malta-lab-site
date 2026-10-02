/* ============================================================
 * MALTA Lab — news pages
 *   - noticias.html: card list with category filter (?categoria=)
 *   - noticia.html?n=<slug>: full story from noticias/<slug>.<lang>.md
 *   - Images are never shown larger than their sharp size
 * ============================================================ */

(function () {
  "use strict";

  const { state, $, $$, t, esc, fmtDate, parseDate } = window.MALTA;

  const isArticle = !!document.getElementById("news-article");
  const params = new URLSearchParams(location.search);

  // ---- Shared helpers ----
  const site   = () => state.data.site || {};
  const labels = () => site().newsPage?.labels || {};
  const L      = (key) => t(labels()[key]);
  const catName = (key) => t(site().newsCategories?.[key]) || key;
  const storyHref = (n) => `noticia.html?n=${encodeURIComponent(n.slug)}`;
  const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");

  /** Highest pixel density we try to honour (2x covers retina screens). */
  const density = () => Math.min(window.devicePixelRatio || 1, 2);

  /** Run fn once the image has its natural size. */
  function whenLoaded(img, fn) {
    if (img.complete && img.naturalWidth) fn();
    else img.addEventListener("load", fn, { once: true });
  }

  /** Inline images: cap the displayed width at naturalWidth / density, so a
   *  photo is never stretched past the resolution it was saved at. */
  function capToSharpSize(img) {
    whenLoaded(img, () => {
      img.style.maxWidth = `min(100%, ${Math.floor(img.naturalWidth / density())}px)`;
      if (img.naturalWidth < 1200) {
        console.warn(`[MALTA] ${img.getAttribute("src")} has ${img.naturalWidth}px; use 1600px+ so it stays sharp at full width.`);
      }
    });
  }

  /** Cropped images (covers, gallery tiles): if the photo is too small to
   *  fill its box sharply, show it whole at its sharp size instead. */
  function guardCrop(img) {
    whenLoaded(img, () => {
      const box = img.parentElement.getBoundingClientRect();
      const needW = box.width * density(), needH = box.height * density();
      if (img.naturalWidth < needW * 0.9 || img.naturalHeight < needH * 0.9) {
        img.parentElement.classList.add("is-small");
        // A blurred copy of the same photo fills the box behind it (CSS ::before)
        img.parentElement.style.setProperty("--backdrop", `url("${(img.currentSrc || img.src).replace(/"/g, "%22")}")`);
        img.style.maxWidth  = `min(100%, ${Math.floor(img.naturalWidth  / density())}px)`;
        img.style.maxHeight = `min(100%, ${Math.floor(img.naturalHeight / density())}px)`;
        console.warn(`[MALTA] ${img.getAttribute("src")} (${img.naturalWidth}×${img.naturalHeight}px) is too small to fill a ${Math.round(box.width)}×${Math.round(box.height)} box sharply; showing it uncropped.`);
      }
    });
  }

  /** Cover/thumbnail markup; the date panel stands in when there's no photo. */
  function mediaHtml(n, { eager = false } = {}) {
    if (n.cover) {
      const pos = n.coverPosition ? ` style="object-position:${esc(n.coverPosition)}"` : "";
      return `<img src="${esc(n.cover)}" alt="${esc(t(n.coverAlt))}"${pos} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    }
    // No photo: the date becomes the visual, set large like a calendar plate
    const d = parseDate(n.date);
    const month = fmtDate(n.date, { month: "short" }).replace(".", "");
    return `
      <time class="news-dateplate" datetime="${esc(n.date)}">
        <span class="news-dateplate-day">${esc(String(d.getDate()).padStart(2, "0"))}</span>
        <span class="news-dateplate-month">${esc(month)} ${esc(String(d.getFullYear()))}</span>
      </time>`;
  }

  /** Category · date line; the date is left out when the date plate shows it. */
  function metaHtml(n) {
    const date = n.cover
      ? `<span class="news-sep" aria-hidden="true">·</span>
      <time datetime="${esc(n.date)}">${esc(fmtDate(n.date))}</time>` : "";
    return `
      <span class="news-cat">${esc(catName(n.category))}</span>${date}`;
  }

  function setMeta(title, description) {
    document.title = title ? `${title} · MALTA Lab` : "MALTA Lab · PUCRS";
    const m = document.querySelector('meta[name="description"]');
    if (m && description) m.content = description;
  }

  // ================================================================
  // List page
  // ================================================================
  let category = params.get("categoria") || "all";

  function renderList() {
    const page = site().newsPage;
    const items = (state.data.noticias || []).slice().sort(byDateDesc);
    if (page) {
      $("#news-eyebrow").textContent = t(page.eyebrow);
      $("#news-title").textContent   = t(page.title);
      $("#news-body").textContent    = t(page.body);
    }
    setMeta(t(page?.title), t(page?.body));

    // Only offer categories that have at least one story
    const present = Array.from(new Set(items.map(n => n.category)));
    if (category !== "all" && !present.includes(category)) category = "all";
    const order = Object.keys(site().newsCategories || {});
    present.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    $("#news-filter-label").textContent = L("filter");
    const chip = (value, text) =>
      `<button class="chip ${category === value ? "is-active" : ""}" data-value="${esc(value)}" aria-pressed="${category === value}">${esc(text)}</button>`;
    $("#news-chips").innerHTML = chip("all", L("all")) + present.map(c => chip(c, catName(c))).join("");
    $$("#news-chips .chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const hadFocus = document.activeElement === btn;
        category = btn.dataset.value;
        // Keep the filter in the URL so a filtered view can be shared
        const url = new URL(location.href);
        if (category === "all") url.searchParams.delete("categoria");
        else url.searchParams.set("categoria", category);
        history.replaceState(null, "", url);
        renderList();
        // Chips are rebuilt on every render: move focus to the matching new chip
        if (hadFocus) {
          const next = $$("#news-chips .chip").find(c => c.dataset.value === category);
          if (next) next.focus();
        }
      });
    });

    const shown = items.filter(n => category === "all" || n.category === category);
    $("#news-count").textContent = `${shown.length} ${shown.length === 1 ? L("countOne") : L("count")}`;

    if (!shown.length) {
      $("#news-grid").innerHTML = `
        <div class="news-empty">
          <p>${esc(L("empty"))}</p>
          <a class="btn btn-secondary" href="noticias.html">${esc(L("showAll"))}</a>
        </div>`;
      return;
    }

    $("#news-grid").innerHTML = shown.map((n, i) => `
      <article class="news-card${i === 0 ? " is-featured" : ""}${n.cover ? "" : " no-cover"}">
        <div class="news-card-media">${mediaHtml(n, { eager: i === 0 })}</div>
        <div class="news-card-body">
          <div class="news-card-meta">${metaHtml(n)}</div>
          <h2 class="news-card-title"><a href="${storyHref(n)}">${esc(t(n.title))}</a></h2>
          <p class="news-card-summary">${esc(t(n.summary))}</p>
        </div>
      </article>
    `).join("");
    $$("#news-grid .news-card-media img").forEach(guardCrop);
  }

  // ================================================================
  // Article page
  // ================================================================
  const bodyCache = {};          // "slug.lang" → { md, lang } promise
  let renderToken = 0;           // ignore stale fetches after a language switch

  function fetchBody(slug, lang) {
    const key = `${slug}.${lang}`;
    if (!bodyCache[key]) {
      const get = (l) => fetch(`noticias/${slug}.${l}.md`, { cache: "no-cache" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      bodyCache[key] = get(lang)
        .then(md => ({ md, lang }))
        .catch(err => {
          if (lang === "pt") throw err;
          // English missing: fall back to Portuguese
          console.warn(`[MALTA] noticias/${slug}.en.md not found; showing Portuguese.`);
          return get("pt").then(md => ({ md, lang: "pt" }));
        });
      bodyCache[key].catch(() => { delete bodyCache[key]; });
    }
    return bodyCache[key];
  }

  /** Markdown → sanitised DOM fragment. */
  function markdownToFragment(md) {
    const parse = window.marked?.parse || window.marked?.marked;
    const html = parse ? parse(md, { gfm: true }) : `<p>${esc(md)}</p>`;
    const clean = window.DOMPurify ? window.DOMPurify.sanitize(html) : esc(html);
    const tpl = document.createElement("template");
    tpl.innerHTML = clean;
    return tpl.content;
  }

  function renameTag(el, tag) {
    const next = document.createElement(tag);
    Array.from(el.attributes).forEach(a => next.setAttribute(a.name, a.value));
    while (el.firstChild) next.appendChild(el.firstChild);
    el.replaceWith(next);
    return next;
  }

  /** <img> → <figure> with a "Fig. N" caption (alt = caption, title = credit). */
  function buildFigure(img, n) {
    const fig = document.createElement("figure");
    fig.className = "article-figure";
    const caption = img.getAttribute("alt") || "";
    const credit  = img.getAttribute("title") || "";
    img.removeAttribute("title");
    img.loading = "lazy";
    img.decoding = "async";

    const zoom = document.createElement("a");
    zoom.className = "figure-zoom";
    zoom.href = img.getAttribute("src");
    zoom.setAttribute("aria-label", `${L("zoom")}: ${caption || L("figure") + " " + n}`);
    zoom.appendChild(img);
    fig.appendChild(zoom);

    const cap = document.createElement("figcaption");
    cap.innerHTML = `<span class="figure-label">${esc(L("figure"))} ${n}</span>`
      + (caption ? ` <span class="figure-text">${esc(caption)}</span>` : "")
      + (credit ? ` <span class="figure-credit">${esc(credit)}</span>` : "");
    fig.appendChild(cap);
    return fig;
  }

  /** Paragraphs that hold only images become figures; 2+ become a gallery. */
  function enhanceBody(root) {
    $$("h1", root).forEach(h => renameTag(h, "h2"));   // the story title is the page's only h1

    $$("a[href]", root).forEach(a => {
      if (/^https?:\/\//i.test(a.getAttribute("href"))) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
    });

    // In a quote, a last paragraph starting with "—" names who said it
    $$("blockquote > p:last-child", root).forEach(p => {
      if (/^\s*(—|--)/.test(p.textContent) && p.previousElementSibling) p.classList.add("quote-attribution");
    });

    let count = 0;
    $$("p", root).forEach(p => {
      const imgs = $$("img", p);
      if (!imgs.length) return;
      const onlyImages = Array.from(p.childNodes).every(node =>
        node.nodeName === "IMG" || node.nodeName === "BR" ||
        (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()));
      if (!onlyImages) { imgs.forEach(capToSharpSize); return; }

      const figs = imgs.map(img => buildFigure(img, ++count));
      if (figs.length === 1) {
        p.replaceWith(figs[0]);
        capToSharpSize(figs[0].querySelector("img"));
      } else {
        const gallery = document.createElement("div");
        gallery.className = "article-gallery";
        gallery.dataset.count = String(figs.length);
        figs.forEach(f => gallery.appendChild(f));
        p.replaceWith(gallery);
      }
    });
  }

  function guardGallery(root) {
    $$(".article-gallery img", root).forEach(guardCrop);
  }

  // ---- Lightbox ----
  function openLightbox(src, caption) {
    const box = $("#lightbox");
    if (!box || typeof box.showModal !== "function") { window.open(src, "_blank", "noopener"); return; }
    const img = $("#lightbox-img");
    img.removeAttribute("style");
    img.src = src;
    img.alt = caption;
    $("#lightbox-caption").textContent = caption;
    $("#lightbox-close").setAttribute("aria-label", L("close"));
    // Fit the viewport, but never past the photo's sharp size
    whenLoaded(img, () => {
      img.style.maxWidth  = `min(92vw, ${Math.floor(img.naturalWidth  / density())}px)`;
      img.style.maxHeight = `min(80vh, ${Math.floor(img.naturalHeight / density())}px)`;
    });
    box.showModal();
  }

  function initLightbox() {
    const box = $("#lightbox");
    if (!box) return;
    $("#article-body").addEventListener("click", e => {
      const link = e.target.closest(".figure-zoom");
      if (!link) return;
      e.preventDefault();
      // Rebuild the caption as text: "Fig. 2 Caption — Credit"
      const fig = link.closest("figure");
      const part = (sel) => fig?.querySelector(sel)?.textContent.trim() || "";
      const cap = [[part(".figure-label"), part(".figure-text")].filter(Boolean).join(" "), part(".figure-credit")]
        .filter(Boolean).join(" — ");
      openLightbox(link.getAttribute("href"), cap);
    });
    // Close on the button or a click on the backdrop
    box.addEventListener("click", e => {
      if (e.target === box || e.target.closest("#lightbox-close")) box.close();
    });
  }

  function renderNotFound() {
    $("#article-category").textContent = "";
    $("#article-date").textContent = "";
    $("#article-title").textContent = L("notFoundTitle");
    $("#article-summary").textContent = L("notFoundBody");
    $("#article-cover").hidden = true;
    $("#article-notice").hidden = true;
    $("#article-body").innerHTML =
      `<p><a class="btn btn-secondary" href="noticias.html">${esc(L("showAll"))}</a></p>`;
    $("#article-share").hidden = true;
    setMeta(L("notFoundTitle"));
  }

  function renderArticle() {
    $$(".article-back-label").forEach(el => { el.textContent = L("back"); });
    $("#article-copy-label").textContent = L("copyLink");

    const slug = params.get("n");
    const n = (state.data.noticias || []).find(x => x.slug === slug);
    if (!n) { renderNotFound(); return; }
    $("#article-share").hidden = false;

    $("#article-category").textContent = catName(n.category);
    $("#article-category").href = `noticias.html?categoria=${encodeURIComponent(n.category)}`;
    const date = $("#article-date");
    date.dateTime = n.date;
    date.textContent = fmtDate(n.date, { day: "numeric", month: "long", year: "numeric" });
    $("#article-title").textContent = t(n.title);
    $("#article-summary").textContent = t(n.summary);
    setMeta(t(n.title), t(n.summary));

    const cover = $("#article-cover");
    if (n.cover) {
      cover.hidden = false;
      cover.classList.remove("is-small");
      cover.querySelector(".article-cover-media").innerHTML = mediaHtml(n, { eager: true });
      const capText = t(n.coverAlt), credit = t(n.coverCredit);
      const cap = cover.querySelector("figcaption");
      cap.innerHTML = esc(capText) + (credit ? ` <span class="figure-credit">${esc(credit)}</span>` : "");
      cap.hidden = !capText && !credit;
      guardCrop(cover.querySelector("img"));
    } else {
      cover.hidden = true;
    }

    const token = ++renderToken;
    const wanted = state.lang === "en" ? "en" : "pt";
    const body = $("#article-body");
    fetchBody(n.slug, wanted).then(({ md, lang }) => {
      if (token !== renderToken) return;
      const notice = $("#article-notice");
      notice.hidden = lang === wanted;
      notice.textContent = lang === wanted ? "" : L("enFallback");
      body.lang = lang === "en" ? "en" : "pt-BR";
      const frag = markdownToFragment(md);
      enhanceBody(frag);
      body.replaceChildren(frag);
      guardGallery(body);
    }).catch(err => {
      if (token !== renderToken) return;
      console.error("MALTA Lab — story load error", err);
      body.innerHTML = `<p class="article-error">${esc(L("loadError"))}</p>`;
    });
  }

  function initShare() {
    const btn = $("#article-copy");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        $("#article-copy-label").textContent = L("copied");
        setTimeout(() => { $("#article-copy-label").textContent = L("copyLink"); }, 2000);
      } catch (e) {
        window.prompt(L("copyLink"), location.href);
      }
    });
  }

  // ---- Boot ----
  document.addEventListener("DOMContentLoaded", () => {
    if (isArticle) { initLightbox(); initShare(); }
  });

  window.MALTA.start({
    page: "news",
    data: { noticias: "./data/noticias.json" },
    render: isArticle ? renderArticle : renderList
  });
})();
