/* =========================================================
 * 管理员发布功能（只对你自己开放）
 *
 * 原理：网站部署在 GitHub Pages，发布 = 通过 GitHub API 把文件提交到你的仓库，
 *       Pages 约 1 分钟后自动更新。只有持有 Token 的人才能写入仓库。
 *
 * 登录：在网址后加 #admin（例如 https://你的域名/#admin），填写仓库与 Token。
 *       Token 只保存在当前浏览器的 localStorage 里，不会出现在代码中。
 * 访客：看不到任何编辑按钮；即使打开登录框，没有 Token 也无法发布。
 * ========================================================= */
(() => {
  const KEY = "site-admin";
  const NOTES_INDEX = "content/notes/index.json";
  const PAPERS = "content/papers.json";
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  let cfg = store.get(KEY);
  const Admin = (window.Admin = {
    get active() { return !!(cfg && cfg.token && cfg.owner && cfg.repo); },
    readText: (path) => getFile(path).then((f) => f.text),
  });

  /* ---------- GitHub API ---------- */
  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
  async function api(path, opt = {}, c = cfg) {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`, {
      ...opt,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${c.token}`, "X-GitHub-Api-Version": "2022-11-28", ...(opt.headers || {}) },
    });
    if (!r.ok) {
      let msg = ""; try { msg = (await r.json()).message || ""; } catch (e) {}
      const err = new Error(`GitHub ${r.status}${msg ? "：" + msg : ""}`); err.status = r.status; throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  const b64encText = (str) => { let bin = ""; new TextEncoder().encode(str).forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };
  const b64decText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  async function getFile(path) {
    try {
      const j = await api(`/contents/${encPath(path)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
      return { sha: j.sha, text: b64decText(j.content || "") };
    } catch (e) { if (e.status === 404) return { sha: null, text: null }; throw e; }
  }
  const putFile = (path, content, message, sha, isB64 = false) => api(`/contents/${encPath(path)}`, {
    method: "PUT", body: JSON.stringify({ message, content: isB64 ? content : b64encText(content), branch: cfg.branch, ...(sha ? { sha } : {}) }),
  });
  const delFile = (path, message, sha) => api(`/contents/${encPath(path)}`, { method: "DELETE", body: JSON.stringify({ message, sha, branch: cfg.branch }) });
  const json = (v) => JSON.stringify(v, null, 2) + "\n";

  // 读 → 改 → 写 一个 JSON 文件；遇到并发冲突（409）自动重试一次
  async function updateJSON(path, mutate, message) {
    for (let attempt = 0; ; attempt++) {
      const f = await getFile(path);
      const next = mutate(f.text ? JSON.parse(f.text) : []);
      try { await putFile(path, json(next), message, f.sha); return next; }
      catch (e) { if (e.status === 409 && attempt < 1) continue; throw e; }
    }
  }

  /* ---------- 发布操作 ---------- */
  async function publishNote(meta, body, isNew) {
    const mdPath = `content/notes/${meta.slug}.md`;
    const existing = await getFile(mdPath);
    if (isNew && existing.sha) throw new Error(`已存在同名记录（${meta.slug}），请换一个链接名`);
    await putFile(mdPath, body.endsWith("\n") ? body : body + "\n", `${isNew ? "新增" : "更新"}记录：${meta.title}`, existing.sha);
    return updateJSON(NOTES_INDEX, (list) => [meta, ...list.filter((n) => n.slug !== meta.slug)]
      .sort((a, b) => String(b.date).localeCompare(String(a.date))), `更新记录索引：${meta.title}`);
  }
  async function deleteNote(slug, title) {
    const mdPath = `content/notes/${slug}.md`;
    const f = await getFile(mdPath);
    if (f.sha) await delFile(mdPath, `删除记录：${title}`, f.sha);
    const notes = await updateJSON(NOTES_INDEX, (list) => list.filter((n) => n.slug !== slug), `删除记录：${title}`);
    // 清理论文里指向这篇记录的链接
    let papers = null;
    const pf = await getFile(PAPERS);
    if (pf.text && JSON.parse(pf.text).some((p) => p.note === slug)) {
      papers = await updateJSON(PAPERS, (list) => list.map((p) => { if (p.note === slug) { const q = { ...p }; delete q.note; return q; } return p; }), `移除论文中的笔记链接：${title}`);
    }
    return { notes, papers };
  }
  const savePaper = (paper, oldTitle) => updateJSON(PAPERS, (list) => {
    const i = oldTitle ? list.findIndex((p) => p.title === oldTitle) : -1;
    if (i < 0 && list.some((p) => p.title === paper.title)) throw new Error("档案库里已经有同名论文了");
    if (i >= 0) list[i] = paper; else list.unshift(paper);
    return list;
  }, `${oldTitle ? "更新" : "添加"}论文：${paper.title}`);
  const deletePaper = (title) => updateJSON(PAPERS, (list) => list.filter((p) => p.title !== title), `删除论文：${title}`);

  async function uploadImage(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("图片不能超过 5MB");
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const ext = (file.name.match(/\.(\w+)$/) || [, "png"])[1].toLowerCase();
    const path = `content/images/${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await putFile(path, dataUrl.split(",")[1], `上传图片：${file.name}`, null, true);
    return path;
  }

  /* ---------- 通用 UI ---------- */
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = `adm-toast ${type}`; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), type === "err" ? 5200 : 3200);
    setTimeout(() => el.remove(), type === "err" ? 5600 : 3600);
  }
  function modal(html, { wide = false, onClose } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "adm-overlay";
    wrap.innerHTML = `<div class="adm-modal${wide ? " wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    document.body.classList.add("adm-lock");
    const close = (force) => {
      if (!force && onClose && onClose() === false) return;
      wrap.remove(); document.body.classList.remove("adm-lock"); document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close()));
    return { el: wrap.firstElementChild, close };
  }
  async function busy(btn, label, fn) {
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = label;
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const splitTags = (s) => [...new Set(String(s).split(/[,，、]/).map((t) => t.trim()).filter(Boolean))];
  const allNoteTags = () => [...new Set((window.SiteContent ? SiteContent.notes : []).flatMap((n) => n.tags || []))];
  const allPaperTags = () => [...new Set((window.SiteContent ? SiteContent.papers : []).flatMap((p) => p.tags || []))];
  const PUBLISHED = "已发布 ✓ 网站约 1 分钟后对访客更新";

  function tagSuggest(container, input, tags) {
    container.innerHTML = tags.map((t) => `<button type="button" class="adm-sug">${esc(t)}</button>`).join("");
    container.querySelectorAll(".adm-sug").forEach((b) => b.addEventListener("click", () => {
      const cur = splitTags(input.value);
      if (!cur.includes(b.textContent)) input.value = [...cur, b.textContent].join(", ");
      input.dispatchEvent(new Event("input"));
    }));
  }

  /* ---------- 懒加载 Markdown 渲染依赖（仅编辑器预览需要） ---------- */
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let mdReady = null;
  function ensureMarkdown() {
    if (window.renderMarkdown && window.marked) return Promise.resolve();
    if (!mdReady) {
      if (!document.querySelector('link[href*="katex"]')) {
        const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"; document.head.appendChild(l);
      }
      mdReady = Promise.all([
        window.marked ? 0 : loadScript("https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"),
        window.katex ? 0 : loadScript("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"),
      ]).then(() => (window.renderMarkdown ? 0 : loadScript("md.js")));
    }
    return mdReady;
  }

  /* ---------- 登录 ---------- */
  function openLogin() {
    const c = cfg || { owner: "", repo: "", branch: "main" };
    const m = modal(`
      <header class="adm-head"><b>管理员登录</b><button class="adm-x" data-close aria-label="关闭">✕</button></header>
      <form class="adm-form" autocomplete="off">
        <p class="adm-note">发布内容会直接提交到你的 GitHub 仓库。Token 只保存在这台设备的浏览器里。</p>
        <div class="adm-row">
          <label>GitHub 用户名<input name="owner" required value="${esc(c.owner)}" placeholder="your-name" /></label>
          <label>仓库名<input name="repo" required value="${esc(c.repo)}" placeholder="your-name.github.io" /></label>
          <label class="sm">分支<input name="branch" required value="${esc(c.branch || "main")}" /></label>
        </div>
        <label>Personal Access Token<input name="token" type="password" required placeholder="github_pat_…" /></label>
        <p class="adm-note">在 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Settings → Fine-grained tokens</a> 新建：只选这个仓库，权限 <code>Contents: Read and write</code>。</p>
        <p class="adm-err" hidden></p>
        <footer class="adm-foot"><button type="button" class="btn ghost" data-close>取消</button><button class="btn primary" type="submit">登录</button></footer>
      </form>`);
    const form = m.el.querySelector("form"), err = m.el.querySelector(".adm-err");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const next = { owner: f.owner.trim(), repo: f.repo.trim(), branch: f.branch.trim() || "main", token: f.token.trim() };
      err.hidden = true;
      await busy(form.querySelector("[type=submit]"), "验证中…", async () => {
        try {
          const repo = await api("", {}, next);
          if (!repo.permissions || !repo.permissions.push) throw new Error("这个 Token 没有该仓库的写入权限");
          cfg = next; store.set(KEY, cfg);
          m.close(true);
          toast("已登录，可以开始发布了");
          setTimeout(() => location.reload(), 600);
        } catch (ex) {
          err.textContent = ex.status === 401 ? "Token 无效或已过期" : ex.status === 404 ? "找不到这个仓库（检查用户名 / 仓库名，或 Token 是否授权了该仓库）" : ex.message;
          err.hidden = false;
        }
      });
    });
    form.querySelector(c.owner ? "[name=token]" : "[name=owner]").focus();
  }
  function logout() {
    if (!confirm("退出登录？这台设备上保存的 Token 会被清除。")) return;
    store.del(KEY); cfg = null; location.reload();
  }

  /* ---------- 记录编辑器 ---------- */
  async function openNoteEditor(slug) {
    const isNew = !slug;
    let meta = { title: "", date: today(), tags: [], summary: "", slug: "" }, body = "";
    if (!isNew) {
      try {
        const [idx, md] = await Promise.all([getFile(NOTES_INDEX), getFile(`content/notes/${slug}.md`)]);
        meta = { ...meta, ...(JSON.parse(idx.text || "[]").find((n) => n.slug === slug) || { slug }) };
        body = md.text || "";
      } catch (e) { return toast("读取记录失败：" + e.message, "err"); }
    }
    const draftKey = `draft:note:${slug || "new"}`;
    const draft = store.get(draftKey);
    let restored = false;
    if (draft && (draft.body !== body || draft.title !== meta.title)) {
      meta = { ...meta, title: draft.title, date: draft.date, tags: draft.tags, summary: draft.summary, slug: isNew ? draft.slug : meta.slug };
      body = draft.body; restored = true;
    }

    let dirty = false;
    const m = modal(`
      <header class="adm-head"><b>${isNew ? "写记录" : "编辑记录"}</b><span class="adm-status"></span><button class="adm-x" data-close aria-label="关闭">✕</button></header>
      <div class="ed">
        <input class="ed-title" name="title" placeholder="标题" value="${esc(meta.title)}" />
        <div class="adm-row">
          <label class="sm">日期<input type="date" name="date" value="${esc(meta.date)}" /></label>
          <label>链接名（slug）<input name="slug" value="${esc(meta.slug)}" placeholder="自动生成" ${isNew ? "" : "readonly"} pattern="[\\w-]+" /></label>
          <label class="grow">标签<input name="tags" value="${esc((meta.tags || []).join(", "))}" placeholder="用逗号分隔" /></label>
        </div>
        <div class="adm-sugs"></div>
        <label>摘要<textarea name="summary" rows="2" placeholder="显示在列表里的一两句话（留空则自动截取正文开头）">${esc(meta.summary)}</textarea></label>
        <div class="ed-toolbar">
          <button type="button" data-md="h2" title="二级标题">H2</button>
          <button type="button" data-md="bold" title="加粗"><b>B</b></button>
          <button type="button" data-md="italic" title="斜体"><i>I</i></button>
          <button type="button" data-md="quote" title="引用">❝</button>
          <button type="button" data-md="list" title="列表">• 列表</button>
          <button type="button" data-md="link" title="链接">链接</button>
          <button type="button" data-md="code" title="代码块">&lt;/&gt;</button>
          <button type="button" data-md="math" title="公式">∑ 公式</button>
          <button type="button" data-md="table" title="表格">表格</button>
          <button type="button" data-md="image" title="上传图片">图片</button>
          <span class="ed-tabs"><button type="button" data-view="edit" class="on">编辑</button><button type="button" data-view="preview">预览</button></span>
          <input type="file" accept="image/*" hidden />
        </div>
        <div class="ed-body" data-view="edit">
          <textarea class="ed-md" name="body" spellcheck="false" placeholder="用 Markdown 写作… 支持 $公式$、代码块、表格、图片">${esc(body)}</textarea>
          <div class="ed-preview prose"></div>
        </div>
      </div>
      <footer class="adm-foot">
        ${isNew ? "" : `<button type="button" class="btn ghost danger" data-act="delete">删除</button>`}
        <span class="adm-note grow">草稿自动保存在本机 · Ctrl+S 发布</span>
        <button type="button" class="btn ghost" data-close>关闭</button>
        <button type="button" class="btn primary" data-act="publish">发布</button>
      </footer>`, { wide: true, onClose: () => !dirty || confirm("还有未发布的修改（已存为本机草稿），确定关闭吗？") });

    const $ = (s) => m.el.querySelector(s);
    const f = { title: $("[name=title]"), date: $("[name=date]"), slug: $("[name=slug]"), tags: $("[name=tags]"), summary: $("[name=summary]"), body: $("[name=body]") };
    const status = $(".adm-status"), preview = $(".ed-preview"), bodyWrap = $(".ed-body");
    const localImages = {};
    if (restored) status.textContent = "已恢复本机草稿";
    tagSuggest($(".adm-sugs"), f.tags, allNoteTags());

    const autoSlug = () => {
      const ascii = f.title.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      return ascii.length >= 3 ? ascii : `${f.date.value || today()}-${Math.random().toString(36).slice(2, 6)}`;
    };
    let slugTouched = !!meta.slug;
    f.slug.addEventListener("input", () => { slugTouched = true; });

    let pvTimer = 0, saveTimer = 0;
    const renderPreview = () => ensureMarkdown().then(() => {
      let html = renderMarkdown(f.body.value || "*（还没有内容）*");
      for (const [p, url] of Object.entries(localImages)) html = html.split(`src="${p}"`).join(`src="${url}"`);
      preview.innerHTML = html;
    }).catch(() => { preview.textContent = "预览加载失败（需要联网）"; });
    const onChange = () => {
      dirty = true;
      if (isNew && !slugTouched) f.slug.placeholder = autoSlug();
      clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 250);
      clearTimeout(saveTimer); saveTimer = setTimeout(() => {
        store.set(draftKey, { title: f.title.value, date: f.date.value, slug: f.slug.value, tags: splitTags(f.tags.value), summary: f.summary.value, body: f.body.value });
        status.textContent = `草稿已保存 ${new Date().toTimeString().slice(0, 5)}`;
      }, 600);
    };
    Object.values(f).forEach((el) => el.addEventListener("input", onChange));
    renderPreview();

    // 工具栏：插入 Markdown 语法
    const insert = (before, after = "", placeholder = "") => {
      const t = f.body, s = t.selectionStart, e = t.selectionEnd, sel = t.value.slice(s, e) || placeholder;
      t.setRangeText(before + sel + after, s, e, "end");
      t.selectionStart = s + before.length; t.selectionEnd = s + before.length + sel.length;
      t.focus(); onChange();
    };
    const lineStart = (prefix) => {
      const t = f.body, s = t.selectionStart;
      const ls = t.value.lastIndexOf("\n", s - 1) + 1;
      t.setRangeText(prefix, ls, ls, "end"); t.focus(); onChange();
    };
    const fileInput = $("input[type=file]");
    const ACTIONS = {
      h2: () => lineStart("## "), bold: () => insert("**", "**", "重点"), italic: () => insert("*", "*", "斜体"),
      quote: () => lineStart("> "), list: () => lineStart("- "), link: () => insert("[", "](https://)", "链接文字"),
      code: () => insert("\n```python\n", "\n```\n", "# code"), math: () => insert("\n$$\n", "\n$$\n", "E = mc^2"),
      table: () => insert("\n| 列 1 | 列 2 |\n| --- | --- |\n| ", " |  |\n", "内容"),
      image: () => fileInput.click(),
    };
    m.el.querySelectorAll("[data-md]").forEach((b) => b.addEventListener("click", () => ACTIONS[b.dataset.md]()));
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0]; fileInput.value = "";
      if (!file) return;
      status.textContent = "图片上传中…";
      try {
        const path = await uploadImage(file);
        localImages[path] = URL.createObjectURL(file);
        insert(`![${file.name.replace(/\.\w+$/, "")}](${path})`);
        status.textContent = "图片已上传";
      } catch (e) { status.textContent = ""; toast("图片上传失败：" + e.message, "err"); }
    });
    m.el.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
      bodyWrap.dataset.view = b.dataset.view;
      m.el.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    }));

    const publishBtn = $("[data-act=publish]");
    const publish = () => busy(publishBtn, "发布中…", async () => {
      const title = f.title.value.trim(), text = f.body.value;
      if (!title) { f.title.focus(); return toast("请填写标题", "err"); }
      if (!text.trim()) { f.body.focus(); return toast("正文是空的", "err"); }
      const s = isNew ? (f.slug.value.trim() || f.slug.placeholder || autoSlug()) : meta.slug;
      if (!/^[\w-]+$/.test(s)) { f.slug.focus(); return toast("链接名只能包含字母、数字、- 和 _", "err"); }
      const plain = text.replace(/```[\s\S]*?```/g, "").replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^$\n]*\$/g, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#>*`|_~-]/g, "").replace(/\s+/g, " ").trim();
      const next = { slug: s, title, date: f.date.value || today(), tags: splitTags(f.tags.value), summary: f.summary.value.trim() || plain.slice(0, 80) + (plain.length > 80 ? "…" : "") };
      try {
        const notes = await publishNote(next, text, isNew);
        store.del(draftKey); dirty = false;
        if (window.SiteContent) SiteContent.setNotes(notes);
        m.close(true); toast(PUBLISHED);
        if (document.body.classList.contains("note-page")) setTimeout(() => { location.href = `note.html?slug=${encodeURIComponent(s)}`; }, 700);
      } catch (e) { toast("发布失败：" + e.message, "err"); }
    });
    publishBtn.addEventListener("click", publish);
    m.el.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); publish(); } });
    const delBtn = $("[data-act=delete]");
    if (delBtn) delBtn.addEventListener("click", () => confirmDeleteNote(meta.slug, meta.title, () => { dirty = false; m.close(true); }));
    (isNew ? f.title : f.body).focus();
  }

  async function confirmDeleteNote(slug, title, done) {
    if (!confirm(`确定删除记录《${title}》吗？\n会从网站上移除这篇文章（GitHub 提交历史里仍可找回）。`)) return;
    try {
      const { notes, papers } = await deleteNote(slug, title);
      store.del(`draft:note:${slug}`);
      if (done) done();
      toast("已删除");
      if (window.SiteContent) { SiteContent.setNotes(notes); if (papers) SiteContent.setPapers(papers); }
      if (document.body.classList.contains("note-page")) setTimeout(() => { location.href = "index.html#notes"; }, 700);
    } catch (e) { toast("删除失败：" + e.message, "err"); }
  }

  /* ---------- 论文表单 ---------- */
  function openPaperForm(title) {
    const old = title ? (SiteContent.papers.find((p) => p.title === title) || null) : null;
    const p = old || { title: "", authors: "", venue: "", year: new Date().getFullYear(), tags: [], status: "todo", rating: 0, tldr: "", pdf: "", code: "", note: "" };
    const notes = window.SiteContent ? SiteContent.notes : [];
    let dirty = false;
    const m = modal(`
      <header class="adm-head"><b>${old ? "编辑论文" : "添加论文"}</b><button class="adm-x" data-close aria-label="关闭">✕</button></header>
      <form class="adm-form">
        <label>论文链接（arXiv / PDF）<input name="pdf" type="url" value="${esc(p.pdf)}" placeholder="https://arxiv.org/abs/xxxx.xxxxx" /></label>
        <label>标题 *<input name="title" required value="${esc(p.title)}" /></label>
        <div class="adm-row">
          <label class="grow">作者<input name="authors" value="${esc(p.authors)}" placeholder="First Author et al." /></label>
          <label class="sm">会议 / 期刊<input name="venue" value="${esc(p.venue)}" placeholder="CoRL" /></label>
          <label class="xs">年份<input name="year" type="number" min="1950" max="2100" value="${esc(p.year)}" /></label>
        </div>
        <label>标签<input name="tags" value="${esc((p.tags || []).join(", "))}" placeholder="用逗号分隔" /></label>
        <div class="adm-sugs"></div>
        <div class="adm-row">
          <div class="adm-field"><span>阅读状态</span><div class="seg">
            ${[["todo", "想读"], ["reading", "在读"], ["read", "已读"]].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${p.status === v ? "checked" : ""} /><span>${l}</span></label>`).join("")}
          </div></div>
          <div class="adm-field"><span>评分</span><div class="rate" data-v="${p.rating || 0}">
            ${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-r="${i}" aria-label="${i} 分"></button>`).join("")}<button type="button" class="clear" data-r="0">清除</button>
          </div></div>
        </div>
        <label>一句话总结<textarea name="tldr" rows="2" placeholder="这篇论文做了什么、为什么重要">${esc(p.tldr)}</textarea></label>
        <div class="adm-row">
          <label class="grow">代码链接<input name="code" type="url" value="${esc(p.code || "")}" placeholder="https://github.com/…" /></label>
          <label class="grow">关联我的记录<select name="note"><option value="">（无）</option>
            ${notes.map((n) => `<option value="${esc(n.slug)}" ${p.note === n.slug ? "selected" : ""}>${esc(n.title)}</option>`).join("")}
          </select></label>
        </div>
        <footer class="adm-foot">
          ${old ? `<button type="button" class="btn ghost danger" data-act="delete">删除</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="btn ghost" data-close>取消</button>
          <button type="submit" class="btn primary">${old ? "保存" : "添加到档案库"}</button>
        </footer>
      </form>`, { onClose: () => !dirty || confirm("还有未保存的修改，确定关闭吗？") });

    const form = m.el.querySelector("form");
    form.addEventListener("input", () => { dirty = true; });
    tagSuggest(m.el.querySelector(".adm-sugs"), form.tags, allPaperTags());
    const rate = m.el.querySelector(".rate");
    const paint = () => rate.querySelectorAll("[data-r]").forEach((b) => b.classList.toggle("on", +b.dataset.r > 0 && +b.dataset.r <= +rate.dataset.v));
    rate.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => { rate.dataset.v = b.dataset.r; paint(); dirty = true; }));
    paint();
    // 粘贴 arXiv 链接时统一成 abs 地址
    form.pdf.addEventListener("change", () => {
      const id = (form.pdf.value.match(/arxiv\.org\/(?:abs|pdf)\/([\w.\-\/]+?)(?:v\d+)?(?:\.pdf)?$/i) || [])[1];
      if (id) { form.pdf.value = `https://arxiv.org/abs/${id}`; if (!form.venue.value) form.venue.value = "arXiv"; }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const paper = {
        title: d.title.trim(), authors: d.authors.trim(), venue: d.venue.trim(), year: +d.year || new Date().getFullYear(),
        tags: splitTags(d.tags), status: d.status || "todo", rating: +rate.dataset.v || 0, tldr: d.tldr.trim(),
      };
      if (d.pdf.trim()) paper.pdf = d.pdf.trim();
      if (d.code.trim()) paper.code = d.code.trim();
      if (d.note) paper.note = d.note;
      busy(form.querySelector("[type=submit]"), "保存中…", async () => {
        try {
          const list = await savePaper(paper, old && old.title);
          dirty = false; SiteContent.setPapers(list); m.close(true); toast(PUBLISHED);
        } catch (ex) { toast("保存失败：" + ex.message, "err"); }
      });
    });
    const delBtn = m.el.querySelector("[data-act=delete]");
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!confirm(`确定从档案库删除《${old.title}》吗？`)) return;
      try { const list = await deletePaper(old.title); dirty = false; SiteContent.setPapers(list); m.close(true); toast("已删除"); }
      catch (ex) { toast("删除失败：" + ex.message, "err"); }
    });
    form.querySelector(old ? "[name=tldr]" : "[name=pdf]").focus();
  }

  /* ---------- 管理入口（仅登录后可见） ---------- */
  function mountAdmin() {
    document.body.classList.add("is-admin");
    const isNotePage = document.body.classList.contains("note-page");
    const slug = new URLSearchParams(location.search).get("slug");
    const dock = document.createElement("div");
    dock.className = "adm-dock";
    dock.innerHTML = `
      <span class="adm-badge" title="已登录：${esc(cfg.owner)}/${esc(cfg.repo)}">ADMIN</span>
      ${isNotePage && slug ? `<button class="btn ghost" data-a="edit">✎ 编辑本篇</button>` : ""}
      <button class="btn primary" data-a="note">✎ 写记录</button>
      ${isNotePage ? "" : `<button class="btn ghost" data-a="paper">＋ 加论文</button>`}
      <button class="btn ghost icon" data-a="logout" title="退出登录">⏻</button>`;
    document.body.appendChild(dock);
    const on = (a, fn) => { const b = dock.querySelector(`[data-a=${a}]`); if (b) b.addEventListener("click", fn); };
    on("note", () => openNoteEditor());
    on("paper", () => openPaperForm());
    on("edit", () => openNoteEditor(slug));
    on("logout", logout);

    // 给列表里的每一项加上“编辑 / 删除”小按钮
    const decorate = (kind) => {
      if (kind === "notes") {
        document.querySelectorAll(".note-item[data-slug]").forEach((li) => {
          const s = li.dataset.slug, n = SiteContent.notes.find((x) => x.slug === s);
          const bar = document.createElement("div");
          bar.className = "adm-item-bar";
          bar.innerHTML = `<button data-e>编辑</button><button data-d class="danger">删除</button>`;
          bar.querySelector("[data-e]").addEventListener("click", () => openNoteEditor(s));
          bar.querySelector("[data-d]").addEventListener("click", () => confirmDeleteNote(s, n ? n.title : s));
          li.appendChild(bar);
        });
      } else {
        document.querySelectorAll(".paper[data-title]").forEach((card) => {
          const bar = document.createElement("div");
          bar.className = "adm-item-bar";
          bar.innerHTML = `<button data-e>编辑</button>`;
          bar.querySelector("[data-e]").addEventListener("click", () => openPaperForm(card.dataset.title));
          card.appendChild(bar);
        });
      }
    };
    document.addEventListener("content:render", (e) => decorate(e.detail.kind));
    decorate("notes"); decorate("papers");
  }

  /* ---------- 启动 ---------- */
  const checkHash = () => {
    if (location.hash !== "#admin") return;
    history.replaceState(null, "", location.pathname + location.search);
    if (Admin.active) toast(`已登录：${cfg.owner}/${cfg.repo}`); else openLogin();
  };
  const boot = () => { if (Admin.active) mountAdmin(); checkHash(); };
  window.addEventListener("hashchange", checkHash);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
