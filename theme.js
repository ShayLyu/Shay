/* =========================================================
 * 主题：纸白（浅色） / 夜读（深色）
 * - 在 <head> 中加载，首屏渲染前就应用，避免闪烁
 * - 颜色格式统一为 "R, G, B"
 * ========================================================= */
(() => {
  const THEMES = {
    paper: {
      label: "纸白",
      paper: "245, 242, 234", surface: "252, 250, 245", ink: "26, 25, 22", muted: "110, 106, 96", sh: "26, 25, 22",
      c1: "217, 119, 87", c2: "122, 154, 108", c3: "106, 140, 191", c4: "224, 176, 76", term: "31, 30, 27",
    },
    night: {
      label: "夜读",
      paper: "30, 29, 26", surface: "40, 38, 35", ink: "236, 232, 221", muted: "158, 153, 141", sh: "8, 8, 7",
      c1: "226, 135, 103", c2: "150, 182, 134", c3: "132, 163, 210", c4: "232, 190, 100", term: "20, 19, 17",
    },
  };
  // 给 arm.js 用的别名与方块颜色
  for (const t of Object.values(THEMES)) {
    t.bg = t.paper; t.fg = t.ink;
    t.blocks = [[t.c1, "橙"], [t.c2, "绿"], [t.c3, "蓝"], [t.c4, "黄"]];
  }

  const KEY = "site-theme";
  const listeners = [];
  let current = "paper"; // 默认纸白；访客切换后会被记住
  try { const s = localStorage.getItem(KEY); if (s && THEMES[s]) current = s; } catch (e) {}

  function apply(id) {
    const t = THEMES[id]; if (!t) return;
    current = id;
    const st = document.documentElement.style;
    const map = { "--paper-rgb": t.paper, "--surface-rgb": t.surface, "--ink-rgb": t.ink, "--muted-rgb": t.muted,
      "--sh-rgb": t.sh, "--c1": t.c1, "--c2": t.c2, "--c3": t.c3, "--c4": t.c4, "--term-rgb": t.term };
    for (const k in map) st.setProperty(k, map[k]);
    st.colorScheme = id === "night" ? "dark" : "light";
    document.documentElement.dataset.theme = id;
    listeners.forEach((fn) => fn(t, id));
  }

  window.SiteTheme = {
    THEMES,
    get id() { return current; },
    get t() { return THEMES[current]; },
    set(id) { apply(id); try { localStorage.setItem(KEY, id); } catch (e) {} },
    toggle() { this.set(current === "paper" ? "night" : "paper"); },
    onChange(fn) { listeners.push(fn); },
  };
  apply(current);
})();
