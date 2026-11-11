/* =========================================================
 * 记录阅读页：note.html?slug=xxx
 * 读取 content/notes/<slug>.md，渲染 Markdown 与公式（md.js）
 * ========================================================= */
(async () => {
  const art = document.getElementById("article");
  const pager = document.getElementById("pager");
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fail = (msg) => { art.innerHTML = `<h1 class="note-title">没找到这篇记录</h1><p class="empty">${esc(msg)}</p>`; };
  // 登录管理员时直接从 GitHub 读取最新内容（避免网站部署延迟），否则读网站上的文件
  const readText = (path) => (window.Admin && Admin.active ? Admin.readText(path) : Promise.reject())
    .then((t) => { if (t == null) throw new Error(404); return t; })
    .catch(() => fetch(path, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }))
    .then((t) => { if (t == null) throw new Error(404); return t; });

  if (!/^[\w-]+$/.test(slug)) return fail("链接里的文章名不正确。");

  let index = [], papers = [], md;
  try {
    [index, md, papers] = await Promise.all([
      readText("content/notes/index.json").then(JSON.parse),
      readText(`content/notes/${slug}.md`),
      readText("content/papers.json").then(JSON.parse).catch(() => []),
    ]);
  } catch (e) {
    return fail(`content/notes/${slug}.md 不存在，或页面不是通过服务器打开的。`);
  }

  index.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const i = index.findIndex((n) => n.slug === slug);
  const meta = index[i] || { title: slug, tags: [] };
  document.title = `${meta.title} · Shay Liu`;

  const chars = md.replace(/```[\s\S]*?```/g, "").replace(/\s/g, "").length;
  const minutes = Math.max(1, Math.round(chars / 450));
  const related = papers.filter((p) => p.note === slug);

  art.innerHTML = `
    <header class="note-head">
      <div class="note-meta"><time>${esc(meta.date || "")}</time><span>约 ${minutes} 分钟读完</span></div>
      <h1 class="note-title">${esc(meta.title)}</h1>
      <ul class="tags">${(meta.tags || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      ${related.map((p) => `<a class="related-paper" href="${esc(p.pdf || "#")}" target="_blank" rel="noopener"><span>PAPER</span>${esc(p.title)} <em>${esc(p.venue)} ${esc(p.year)}</em></a>`).join("")}
    </header>
    <div class="prose">${renderMarkdown(md)}</div>`;
  art.querySelectorAll(".prose a[href^='http']").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });

  // 上一篇 / 下一篇（按日期，列表里“上面”的是更新的）
  const newer = index[i - 1], older = index[i + 1];
  pager.innerHTML = `
    ${older ? `<a class="prev" href="note.html?slug=${encodeURIComponent(older.slug)}"><small>← 上一篇</small>${esc(older.title)}</a>` : "<span></span>"}
    ${newer ? `<a class="next" href="note.html?slug=${encodeURIComponent(newer.slug)}"><small>下一篇 →</small>${esc(newer.title)}</a>` : "<span></span>"}`;

  document.dispatchEvent(new CustomEvent("note:loaded", { detail: { meta, md } }));
})();
