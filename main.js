(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ========== 1. 像素图标 ==========
   * '#' = 墨色，'o' = 强调色，'.' = 透明。每个图标一张字符画。
   */
  const ICONS = {
    robot: [
      "....#..#....",
      "....#..#....",
      "..########..",
      "..#......#..",
      ".##.oo.oo.##",
      ".##.oo.oo.##",
      "..#......#..",
      "..#.####.#..",
      "..########..",
      "....#..#....",
      "..########..",
      "..#......#..",
    ],
    sun: [
      ".....##.....",
      ".#...##...#.",
      "..#......#..",
      "....####....",
      "...######...",
      "##.######.##",
      "##.######.##",
      "...######...",
      "....####....",
      "..#......#..",
      ".#...##...#.",
      ".....##.....",
    ],
    moon: [
      "....####....",
      "..####......",
      ".###........",
      ".##.........",
      "###.........",
      "###......o..",
      "###.........",
      "###.........",
      ".###......#.",
      ".#####..###.",
      "..#######...",
      "....####....",
    ],
    chip: [
      "..#..##..#..",
      ".##########.",
      ".#........#.",
      "##.oooooo.##",
      ".#.o....o.#.",
      "##.o.##.o.##",
      ".#.o.##.o.#.",
      "##.o....o.##",
      ".#.oooooo.#.",
      ".#........#.",
      ".##########.",
      "..#..##..#..",
    ],
    eye: [
      "............",
      "....####....",
      "..##....##..",
      ".#..oooo..#.",
      "#..oo##oo..#",
      "#..oo##oo..#",
      ".#..oooo..#.",
      "..##....##..",
      "....####....",
      "............",
    ],
    cube: [
      "....####....",
      "..##oooo##..",
      "##oooooooo##",
      "#.##oooo##.#",
      "#...####...#",
      "#....##....#",
      "#....##....#",
      "#....##....#",
      "##...##...##",
      "..##.##.##..",
      "....####....",
    ],
    gear: [
      ".....##.....",
      "..#.####.#..",
      ".##########.",
      "..###..###..",
      ".###....###.",
      "####.oo.####",
      "####.oo.####",
      ".###....###.",
      "..###..###..",
      ".##########.",
      "..#.####.#..",
      ".....##.....",
    ],
    claw: [
      "....####....",
      "....#oo#....",
      ".##########.",
      ".#........#.",
      ".#........#.",
      ".#...oo...#.",
      ".##..oo..##.",
      "..#......#..",
      "..##....##..",
    ],
    hand: [
      "..#.#.#.....",
      "..#.#.#.#...",
      "..#.#.#.#...",
      "..#######...",
      "#.#######...",
      "##.######...",
      ".#.##oo##...",
      "..#######...",
      "...#####....",
      "...#####....",
    ],
    dog: [
      "........###.",
      "........#o##",
      ".########...",
      "##########..",
      ".#########..",
      ".#.#...#.#..",
      ".#.#...#.#..",
      "##.##.##.##.",
    ],
    search: [
      "..#####.....",
      ".#.....#....",
      "#..oo...#...",
      "#.o.....#...",
      "#.......#...",
      "#.......#...",
      ".#.....#....",
      "..#####.#...",
      ".......#.#..",
      "........#.#.",
      ".........#.#",
      "..........#.",
    ],
    house: [
      ".....##.....",
      "....####....",
      "...######...",
      "..########..",
      ".##########.",
      "############",
      ".#........#.",
      ".#.oo..##.#.",
      ".#.oo..##.#.",
      ".#.....##.#.",
      ".##########.",
    ],
  };
  function renderIcon(el) {
    const map = ICONS[el.dataset.icon]; if (!map) return;
    const h = map.length, w = Math.max(...map.map((r) => r.length));
    let rects = "";
    map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "#") rects += `<rect class="k" x="${x}" y="${y}" width="1" height="1"/>`;
      else if (ch === "o") rects += `<rect class="o" x="${x}" y="${y}" width="1" height="1"/>`;
    }));
    const s = Math.max(w, h);
    el.innerHTML = `<svg viewBox="${(w - s) / 2} ${(h - s) / 2} ${s} ${s}" aria-hidden="true">${rects}</svg>`;
  }
  document.querySelectorAll(".px-icon[data-icon]").forEach(renderIcon);
  window.renderPxIcon = renderIcon;

  /* ========== 2. 明暗主题切换 ========== */
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    const themeIcon = themeBtn.querySelector(".px-icon");
    const syncThemeIcon = () => { themeIcon.dataset.icon = SiteTheme.id === "paper" ? "moon" : "sun"; renderIcon(themeIcon); };
    syncThemeIcon();
    SiteTheme.onChange(syncThemeIcon);
    themeBtn.addEventListener("click", () => SiteTheme.toggle());
  }

  /* ========== 3. 打字机效果 ========== */
  const roles = ["Embodied AI Researcher", "Robot Learning Engineer", "Sim2Real Practitioner", "Making robots useful"];
  const typed = document.getElementById("typed");
  let ri = 0, ci = 0, deleting = false;
  function type() {
    const word = roles[ri];
    typed.textContent = word.slice(0, ci);
    if (!deleting && ci < word.length) ci++;
    else if (deleting && ci > 0) ci--;
    else if (!deleting) { deleting = true; return setTimeout(type, 1800); }
    else { deleting = false; ri = (ri + 1) % roles.length; }
    setTimeout(type, deleting ? 40 : 90);
  }
  if (typed) { if (reduceMotion) typed.textContent = roles[0]; else type(); }

  /* ========== 4. 终端自动输出 ========== */
  const termLines = [
    `<span class="p">➜</span> <span class="c">~</span> whoami`,
    `shay — embodied AI researcher`,
    ``,
    `<span class="p">➜</span> <span class="c">~</span> ros2 topic echo /shay/profile`,
    `<span class="c">focus</span>: [<span class="g">VLA</span>, <span class="g">manipulation</span>, <span class="g">sim2real</span>]`,
    `<span class="c">robots</span>: [<span class="g">franka</span>, <span class="g">ur5</span>, <span class="g">dex_hand</span>, <span class="g">quadruped</span>]`,
    `<span class="c">belief</span>: <span class="g">"intelligence needs a body"</span>`,
    `<span class="c">status</span>: <span class="p">TRAINING</span> <span class="m">(success_rate ↑)</span>`,
    `<span class="m">---</span>`,
    ``,
    `<span class="p">➜</span> <span class="c">~</span> python deploy.py --robot real`,
    `<span class="g">[OK]</span> policy loaded · 30 Hz control loop`,
    ``,
    `<span class="p">➜</span> <span class="c">~</span> <span class="m">█</span>`,
  ];
  const termBody = document.getElementById("termBody");
  let termStarted = false;
  function runTerminal() {
    if (termStarted) return; termStarted = true;
    if (reduceMotion) { termBody.innerHTML = termLines.join("\n"); return; }
    let i = 0;
    (function next() {
      if (i >= termLines.length) return;
      termBody.innerHTML += (i ? "\n" : "") + termLines[i++];
      setTimeout(next, termLines[i - 1].includes("➜") ? 500 : 140);
    })();
  }

  /* ========== 5. 数字滚动（阶梯式） ========== */
  function countUp(el) {
    const target = +el.dataset.count, steps = 16;
    let k = 0;
    const id = setInterval(() => {
      k++;
      el.textContent = Math.round((target * k) / steps);
      if (k >= steps) clearInterval(id);
    }, 60);
  }

  /* ========== 6. 滚动出现 ========== */
  const io = window.revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("visible");
      if (el.classList.contains("terminal")) runTerminal();
      const num = el.querySelector("[data-count]");
      if (num) countUp(num);
      io.unobserve(el);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 0.08 + "s";
    io.observe(el);
  });

  /* ========== 7. 导航 ========== */
  const nav = document.getElementById("nav");
  window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 40), { passive: true });
  const menuBtn = document.getElementById("menuBtn"), menu = document.getElementById("menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => { menuBtn.classList.toggle("open"); menu.classList.toggle("open"); });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { menuBtn.classList.remove("open"); menu.classList.remove("open"); }));
  }
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
