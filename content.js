/* =========================================================
 * 记录 & 档案库：从 content/ 读取数据并渲染
 * - 记录：content/notes/index.json（文章正文在 content/notes/<slug>.md）
 * - 档案库：content/papers.json
 * 管理员登录后由 admin.js 负责发布 / 编辑；这里只负责展示
 * ========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 管理员登录时从 GitHub 读取最新内容（避免部署延迟），否则读网站上的文件
  const load = (path) => (window.Admin && Admin.active ? Admin.readText(path) : Promise.reject())
    .then((t) => { if (t == null) throw new Error(404); return t; })
    .catch(() => fetch(path, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }))
    .then((t) => JSON.parse(t));

  const byDate = (a, b) => String(b.date).localeCompare(String(a.date));
  const byYear = (a, b) => (b.year || 0) - (a.year || 0);
  const announce = (kind) => document.dispatchEvent(new CustomEvent("content:render", { detail: { kind } }));

  function chips(el, items, active, onPick) {
    el.innerHTML = items.map(([key, label, n]) =>
      `<button class="chip${key === active ? " on" : ""}" data-key="${esc(key)}">${esc(label)}${n != null ? `<small>${n}</small>` : ""}</button>`).join("");
    el.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => onPick(b.dataset.key)));
  }
  const countBy = (list, fn) => list.reduce((m, x) => { [].concat(fn(x)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)); return m; }, new Map());

  const state = { notes: [], papers: [] };
  // 给 admin.js 用：读取 / 替换数据后重新渲染
  window.SiteContent = {
    get notes() { return state.notes; },
    get papers() { return state.papers; },
    setNotes(list) { state.notes = list.slice().sort(byDate); renderNotes && renderNotes(); },
    setPapers(list) { state.papers = list.slice().sort(byYear); renderPapers && renderPapers(); },
  };
  let renderNotes = null, renderPapers = null;

  /* ---------- 记录 ---------- */
  const noteList = $("noteList");
  if (noteList) {
    const PAGE = 5;
    let tag = "", expanded = false;
    renderNotes = () => {
      const notes = state.notes;
      if (tag && !notes.some((n) => (n.tags || []).includes(tag))) tag = "";
      const shown = notes.filter((n) => !tag || (n.tags || []).includes(tag));
      const list = expanded ? shown : shown.slice(0, PAGE);
      noteList.innerHTML = list.length ? list.map((n) => `
        <li class="note-item" data-slug="${esc(n.slug)}">
          <a href="note.html?slug=${encodeURIComponent(n.slug)}">
            <time>${esc(n.date)}</time>
            <div class="note-main">
              <h4>${esc(n.title)}</h4>
              <p>${esc(n.summary || "")}</p>
              <ul class="tags small">${(n.tags || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
            </div>
            <span class="arrow">→</span>
          </a>
        </li>`).join("") : `<li class="empty">${notes.length ? "这个标签下还没有记录。" : "还没有记录。"}</li>`;
      $("noteMore").hidden = expanded || shown.length <= PAGE;
      const tags = [...countBy(notes, (n) => n.tags || [])].sort((a, b) => b[1] - a[1]);
      chips($("noteTags"), [["", "全部", notes.length], ...tags.map(([t, c]) => [t, t, c])], tag, (k) => { tag = k; renderNotes(); });
      announce("notes");
    };
    $("noteMore").addEventListener("click", () => { expanded = true; renderNotes(); });
    load("content/notes/index.json")
      .then((data) => SiteContent.setNotes(data))
      .catch(() => { noteList.innerHTML = `<li class="empty">记录加载失败。请通过本地服务器或线上地址访问（不能直接双击打开 html 文件）。</li>`; });
  }

  /* ---------- 档案库 ---------- */
  const paperList = $("paperList");
  if (paperList) {
    const PAGE = 6;
    const STATUS = { read: "已读", reading: "在读", todo: "想读" };
    let q = "", status = "", tag = "", expanded = false;
    const stars = (n) => n > 0
      ? `<span class="stars" title="${n}/5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>` : "";

    renderPapers = () => {
      const papers = state.papers;
      if (tag && !papers.some((p) => (p.tags || []).includes(tag))) tag = "";
      const kw = q.trim().toLowerCase();
      const hit = papers.filter((p) =>
        (!status || p.status === status) &&
        (!tag || (p.tags || []).includes(tag)) &&
        (!kw || [p.title, p.authors, p.venue, p.tldr, ...(p.tags || [])].join(" ").toLowerCase().includes(kw)));
      const list = expanded || kw ? hit : hit.slice(0, PAGE);
      paperList.innerHTML = list.length ? list.map((p) => `
        <article class="paper" data-title="${esc(p.title)}">
          <div class="paper-meta">
            <span class="venue">${esc(p.venue)} ${esc(p.year)}</span>
            <span class="status s-${esc(p.status)}">${STATUS[p.status] || ""}</span>
            ${stars(p.rating)}
          </div>
          <h4>${p.pdf ? `<a href="${esc(p.pdf)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)}</h4>
          <p class="authors">${esc(p.authors)}</p>
          ${p.tldr ? `<p class="tldr">${esc(p.tldr)}</p>` : ""}
          <div class="paper-foot">
            <ul class="tags small">${(p.tags || []).map((t) => `<li><button data-tag="${esc(t)}">${esc(t)}</button></li>`).join("")}</ul>
            <div class="links">
              ${p.pdf ? `<a href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""}
              ${p.code ? `<a href="${esc(p.code)}" target="_blank" rel="noopener">Code</a>` : ""}
              ${p.note ? `<a class="note-link" href="note.html?slug=${encodeURIComponent(p.note)}">笔记</a>` : ""}
            </div>
          </div>
        </article>`).join("") : `<p class="empty">${papers.length ? "没有找到匹配的论文。" : "档案库还是空的。"}</p>`;
      paperList.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => { tag = tag === b.dataset.tag ? "" : b.dataset.tag; renderPapers(); }));

      $("paperCount").textContent = `共 ${papers.length} 篇 · 当前显示 ${list.length} / ${hit.length} 篇`;
      $("paperMore").hidden = expanded || kw || hit.length <= PAGE;

      const sc = countBy(papers, (p) => p.status);
      chips($("paperStatus"), [["", "全部", papers.length], ...Object.entries(STATUS).map(([k, l]) => [k, l, sc.get(k) || 0])], status, (k) => { status = k; renderPapers(); });
      const tags = [...countBy(papers, (p) => p.tags || [])].sort((a, b) => b[1] - a[1]);
      chips($("paperTags"), [["", "# 全部标签"], ...tags.map(([t, c]) => [t, "# " + t, c])], tag, (k) => { tag = k; renderPapers(); });
      announce("papers");
    };

    $("paperSearch").addEventListener("input", (e) => { q = e.target.value; renderPapers(); });
    $("paperMore").addEventListener("click", () => { expanded = true; renderPapers(); });
    load("content/papers.json")
      .then((data) => SiteContent.setPapers(data))
      .catch(() => { paperList.innerHTML = `<p class="empty">档案库加载失败。请通过本地服务器或线上地址访问。</p>`; });
  }
})();
