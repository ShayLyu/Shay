/* =========================================================
 * Markdown + 数学公式渲染（阅读页和编辑器预览共用）
 * 依赖全局的 marked 与 katex
 * ========================================================= */
window.renderMarkdown = function (md) {
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 先把代码“藏起来”，再把公式换成占位符，避免 marked 把公式里的 _ * 当成格式符号
  const codes = [], maths = [];
  let src = String(md || "").replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => `@@CODE${codes.push(m) - 1}@@`);
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => `\n\n@@MATHB${maths.push(m) - 1}@@\n\n`);
  src = src.replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, m) => `@@MATHI${maths.push(m) - 1}@@`);
  src = src.replace(/@@CODE(\d+)@@/g, (_, k) => codes[k]);

  const tex = (s, display) => {
    if (!window.katex) return `<code>${esc(s)}</code>`;
    try { return katex.renderToString(s, { displayMode: display, throwOnError: false }); }
    catch (e) { return `<code>${esc(s)}</code>`; }
  };
  return marked.parse(src)
    .replace(/<p>@@MATHB(\d+)@@<\/p>/g, (_, k) => `<div class="math-block">${tex(maths[k], true)}</div>`)
    .replace(/@@MATHB(\d+)@@/g, (_, k) => tex(maths[k], true))
    .replace(/@@MATHI(\d+)@@/g, (_, k) => tex(maths[k], false));
};
