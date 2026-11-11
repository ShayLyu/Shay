/* =========================================================
 * 首屏互动：像素机器狗 ROBODOG
 * - 点击空地扔球 → 它去追、跳起来接、叼回到你身边
 * - 鼠标停在它身上 → 摸摸它（冒爱心、摇尾巴）
 * - 点它 → 汪！
 * - 没人理它 → 闲逛、闻闻、困了就回充电桩睡觉
 * 画布以 1/PX 分辨率绘制再放大，得到真正的像素画效果
 * ========================================================= */
(() => {
  const canvas = document.getElementById("dog");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const panel = canvas.parentElement;
  const $ = (id) => document.getElementById(id);
  const modeEl = $("dogMode"), statusEl = $("dogStatus"), scoreEl = $("dogScore"), hintEl = $("dogHint"), hudEl = $("dogHud");

  const PX = 4, U = PX;
  const DOCK_OFF = 84;                     // 睡觉位置：充电桩右侧（尾巴朝桩）                    // 1 像素 = 4 个 CSS 像素
  const snap = (v) => Math.round(v / PX) * PX;
  let T = SiteTheme.t;
  SiteTheme.onChange((t) => { T = t; });
  const A = (k, a = 1) => `rgba(${T[k]}, ${a})`;

  let aw, ah, ground, dockX, onScreen = true, frameN = 0;
  const dog = {
    x: 0, vx: 0, dir: 1, y: 0, vy: 0,     // y = 离地高度
    state: "idle", t: 0, phase: 0, idle: 0, targetX: 0,
    crouch: 0, headDown: 0, carry: false, bubble: null,
  };
  let ball = null, fetches = 0, battery = 86, parts = [], clouds = [];
  const pointer = { x: 0, y: 0, inside: false };

  /* ---------- 像素精灵 ---------- */
  const PAL = { k: "fg", o: "c1", y: "c4", w: "surface", g: "muted", s: "c2" };
  const SPR = {
    ball: [".kkkk.", "kyyyyk", "kywyyk", "kyyyyk", "kyyyyk", ".kkkk."],
    heart: [".o.o.", "ooooo", "ooooo", ".ooo.", "..o.."],
    bolt: ["...kk", "..kyk", ".kyk.", "kyyyk", ".kyk.", "kyk..", "kk..."],
    cloud: ["...gggg....", ".gggggggg..", "ggggggggggg"],
    z: ["kkk", "..k", ".k.", "kkk"],
  };
  function sprite(map, x, y, alpha = 1) {
    ctx.globalAlpha = alpha;
    map.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === ".") return;
      ctx.fillStyle = A(PAL[ch]); ctx.fillRect(snap(x) + i * U, snap(y) + j * U, U, U);
    }));
    ctx.globalAlpha = 1;
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    aw = r.width; ah = r.height;
    canvas.width = Math.round(aw / PX); canvas.height = Math.round(ah / PX);
    ctx.setTransform(canvas.width / aw, 0, 0, canvas.height / ah, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ground = snap(ah - 64);
    dockX = snap(Math.max(52, aw * 0.12));
    if (!dog.x) dog.x = aw * 0.58;
    dog.x = clampX(dog.x);
    clouds = [{ x: aw * 0.18, y: 92, s: 0.12 }, { x: aw * 0.68, y: 128, s: 0.07 }];
  }
  const clampX = (x) => Math.max(70, Math.min(aw - 70, x));

  /* ---------- 几何 ---------- */
  const lean = () => Math.round(dog.crouch);
  function mouth() {
    const hx = dog.headDown > 0.5 ? 1 : 0;
    return { x: dog.x + dog.dir * (21 + hx) * U, y: ground - dog.y + (-16 + lean() + Math.round(dog.headDown)) * U };
  }
  const overDog = () => pointer.inside && Math.abs(pointer.x - dog.x) < 60 && pointer.y > ground - dog.y - 110 && pointer.y < ground + 6;

  /* ---------- 行为 ---------- */
  function setState(s) { dog.state = s; dog.t = 0; }
  function say(text, dur = 70) { dog.bubble = { text, t: dur }; }
  function moveToward(tx, speed) {
    const dx = tx - dog.x;
    if (Math.abs(dx) < 5) { dog.vx *= 0.6; return true; }
    dog.vx += (Math.sign(dx) * Math.min(speed, Math.abs(dx) * 0.08 + 0.4) - dog.vx) * 0.15;
    return false;
  }
  function jump(v) { if (dog.y === 0) { dog.vy = v; puff(dog.x, ground, 4); } }

  function burst(type, x, y, n) {
    for (let i = 0; i < n; i++) parts.push({ type, x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5 - 1, life: 1 });
  }
  const puff = (x, y, n) => burst("dust", x, y, n);
  const heart = (x, y) => parts.push({ type: "heart", x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 0.6, vy: -1.1, life: 1 });

  function update() {
    const d = dog, m = mouth();
    d.t++; frameN++;
    const manual = pointer.inside;
    const wantBall = ball && !ball.held && !ball.fetched;
    const atDock = Math.abs(d.x - dockX - DOCK_OFF) < 24;
    let crouchT = 0, headT = 0;
    if (manual) d.idle = 0; else d.idle++;

    switch (d.state) {
      case "idle":
        if (wantBall) { setState("chase"); say("!"); break; }
        if (battery < 15) { setState("home"); say("LOW BAT"); break; }
        if (overDog()) { setState("pet"); break; }
        if (manual) {
          const dx = pointer.x - d.x;
          if (Math.abs(dx) > 70) moveToward(pointer.x - Math.sign(dx) * 50, Math.abs(dx) > 180 ? 2.6 : 1.4);
          else { d.vx *= 0.7; if (Math.abs(d.vx) < 0.2) d.dir = Math.sign(dx) || d.dir; }
        } else {
          d.vx *= 0.8;
          if (d.idle > 900) { setState("home"); say("..."); }
          else if (d.t > 150 && Math.random() < 0.012) { d.targetX = clampX(aw * (0.25 + Math.random() * 0.6)); setState("wander"); }
        }
        break;
      case "wander":
        if (wantBall || manual) { setState("idle"); break; }
        if (moveToward(d.targetX, 0.9)) { setState("sniff"); say("?", 50); }
        break;
      case "sniff":
        headT = 3; d.vx *= 0.7;
        if (d.t % 18 === 0) puff(m.x, ground, 1);
        if (wantBall || manual) { setState("idle"); break; }
        if (d.t > 110) setState("idle");
        break;
      case "home":
        if (wantBall && battery >= 15) { setState("chase"); break; }
        if (manual && battery >= 15) { setState("idle"); break; }
        if (moveToward(dockX + DOCK_OFF, 1.2)) { d.dir = 1; setState("sleep"); }
        break;
      case "sleep":
        crouchT = 5; headT = 2; d.vx = 0; d.dir = 1;
        if (d.t % 55 === 0) parts.push({ type: "z", x: m.x, y: m.y - 30, vx: 0.3, vy: -0.5, life: 1 });
        if (atDock) battery = Math.min(100, battery + 0.12);
        if ((manual && d.t > 40) || wantBall) { setState("wake"); say("!"); jump(4); }
        break;
      case "wake":
        if (d.t > 35) setState("idle");
        break;
      case "chase": {
        if (!wantBall) { setState("idle"); break; }
        const low = ball.y > ground - 40;
        const near = Math.abs(m.x - ball.x) < 40;
        if (low && near) { crouchT = 2; headT = 4; }
        moveToward(ball.x - d.dir * 21 * U, 3.6);
        if (Math.sign(ball.x - d.x) !== d.dir && Math.abs(ball.x - d.x) > 20) d.vx *= 0.85; // 掉头
        // 球在空中靠近时起跳去接
        if (!low && near && ball.vy > -2 && ball.y > ground - 200) jump(Math.min(8, Math.sqrt(2 * 0.45 * (ground - ball.y - 60)) + 1));
        if (Math.abs(m.x - ball.x) < 18 && (low || Math.abs(m.y - ball.y) < 24)) {
          ball.held = true; d.carry = true;
          burst("spark", ball.x, ball.y, 8);
          say(low ? "GOT IT" : "NICE!");
          setState("return");
        }
        break;
      }
      case "return": {
        if (!d.carry) { setState(wantBall ? "chase" : "idle"); break; }
        const target = manual ? pointer.x : aw * 0.6;
        if (moveToward(target - d.dir * 40, 2.2) || Math.abs(target - d.x) < 60) {
          d.vx = 0;
          ball.held = false; ball.fetched = true; d.carry = false;
          ball.x = m.x; ball.y = m.y; ball.vx = d.dir * 0.8; ball.vy = -1;
          fetches++;
          scoreEl.textContent = `FETCH ${fetches}`;
          scoreEl.classList.remove("pop"); void scoreEl.offsetWidth; scoreEl.classList.add("pop");
          for (let i = 0; i < 4; i++) heart(d.x, ground - 110);
          say("+1");
          setState("happy");
        }
        break;
      }
      case "happy":
        d.vx *= 0.7;
        if (d.t % 26 === 1) jump(3.4);
        if (d.t % 14 === 0) heart(d.x, ground - 100);
        if (wantBall) { setState("chase"); break; }
        if (d.t > 100) setState("idle");
        break;
      case "pet":
        crouchT = 1; d.vx *= 0.6;
        d.dir = Math.sign(pointer.x - d.x) || d.dir;
        if (d.t % 16 === 0) heart(d.x + d.dir * 30, ground - 105);
        if (d.t === 30) say("<3", 50);
        if (!overDog() && d.t > 10) setState("idle");
        if (wantBall) setState("chase");
        break;
      case "bark":
        d.vx *= 0.7;
        if (d.t > 45) setState("idle");
        break;
    }

    // 平滑姿态
    d.crouch += Math.sign(crouchT - d.crouch) * Math.min(0.25, Math.abs(crouchT - d.crouch));
    d.headDown += Math.sign(headT - d.headDown) * Math.min(0.3, Math.abs(headT - d.headDown));

    // 运动学
    d.x = clampX(d.x + d.vx);
    if (Math.abs(d.vx) > 0.25) d.dir = d.vx > 0 ? 1 : -1;
    d.phase += Math.abs(d.vx) * 0.16;
    if (d.y > 0 || d.vy > 0) {
      d.vy -= 0.45; d.y += d.vy;
      if (d.y <= 0) { d.y = 0; if (d.vy < -3) puff(d.x, ground, 5); d.vy = 0; }
    }
    if (Math.abs(d.vx) > 2.5 && d.y === 0 && frameN % 6 === 0) puff(d.x - d.dir * 36, ground, 1);
    battery = Math.max(0, battery - (Math.abs(d.vx) * 0.006 + 0.0015));

    // 球
    if (ball) {
      if (ball.held) { const mm = mouth(); ball.x = mm.x; ball.y = mm.y; }
      else {
        ball.vy += 0.35; ball.x += ball.vx; ball.y += ball.vy;
        const r = 3 * U;
        if (ball.y > ground - r) {
          ball.y = ground - r;
          if (ball.vy > 2) puff(ball.x, ground, 2);
          ball.vy = Math.abs(ball.vy) > 1.2 ? -ball.vy * 0.55 : 0;
          ball.vx *= 0.96;
        }
        if (ball.x < r + 6 || ball.x > aw - r - 6) { ball.vx *= -0.7; ball.x = Math.max(r + 6, Math.min(aw - r - 6, ball.x)); }
      }
    }
    if (d.bubble && --d.bubble.t <= 0) d.bubble = null;

    // 粒子
    parts = parts.filter((p) => (p.life -= p.type === "dust" ? 0.05 : 0.012) > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.type === "dust") p.vy *= 0.9;
      if (p.type === "spark") p.vy += 0.15;
    }
    for (const c of clouds) { c.x += c.s; if (c.x > aw + 20) c.x = -60; }
  }

  /* ---------- 绘制 ---------- */
  function pxText(text, x, y, color, size = 32) {
    ctx.font = `${size}px Silkscreen, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = color; ctx.fillText(text, snap(x), snap(y));
  }

  function drawDog() {
    const d = dog, dir = d.dir;
    const ox = snap(d.x), oy = snap(ground - d.y);
    const D = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(dir > 0 ? ox + x * U : ox - (x + w) * U, oy + y * U, w * U, h * U); };
    const O = (x, y, w, h, col) => { D(x - 1, y - 1, w + 2, h + 2, A("fg")); D(x, y, w, h, col); };
    const ink = A("fg"), far = A("muted"), white = A("surface"), acc = A("c1");
    const moving = Math.abs(d.vx) > 0.2 && d.y === 0;
    const breathe = !moving && d.state !== "sleep" && Math.floor(frameN / 40) % 2 === 0 ? 0 : 0;
    const bob = moving && Math.sin(d.phase * 2) > 0.3 ? -1 : breathe;
    const b = lean() + bob;                       // 身体整体下移量（格）
    const hd = Math.round(d.headDown), hx = d.headDown > 0.5 ? 1 : 0;
    const happy = d.state === "pet" || d.state === "happy";
    const sleeping = d.state === "sleep";

    // 腿（远侧先画，颜色浅一些）；对角步态
    const legs = [[-6, Math.PI, far], [6, 0, far], [-9, 0, ink], [8, Math.PI, ink]];
    for (const [lx, ph, col] of legs) {
      let lift = 0, sw = 0;
      if (moving) { const s = Math.sin(d.phase + ph); lift = s > 0 ? Math.round(s * 2) : 0; sw = Math.round(Math.cos(d.phase + ph)); }
      if (d.y > 0) lift = 2;
      const top = -7 + b, len = Math.max(1, -top - lift);
      D(lx + sw, top, 2, len, col);
      D(lx + sw, -1 - lift, 3, 1, col);
    }
    // 尾巴（天线式）
    const wagFast = happy, wag = wagFast ? Math.floor(frameN / 4) % 2 : (pointer.inside ? Math.floor(frameN / 10) % 2 : 0);
    if (sleeping) { D(-13, -9 + b, 3, 1, ink); D(-14, -9 + b, 1, 1, acc); }
    else if (wag) { D(-12, -16 + b, 1, 3, ink); D(-12, -17 + b, 1, 1, acc); }
    else { D(-14, -15 + b, 3, 1, ink); D(-12, -14 + b, 1, 1, ink); D(-15, -16 + b, 1, 1, acc); }
    // 身体
    O(-10, -13 + b, 20, 6, white);
    D(-10, -10 + b, 20, 1, acc);
    D(-1, -12 + b, 1, 2, A("fg", 0.35));
    // 背部传感器（激光雷达）
    D(-5, -15 + b, 5, 2, ink);
    D(-4, -16 + b, 3, 1, ink);
    D(-3, -16 + b, 1, 1, frameN % 50 < 25 ? acc : A("c2"));
    // 头
    const hy = b + hd;
    D(8, -15 + b, 3, 3, ink);
    O(9 + hx, -21 + hy, 10, 7, white);
    D(11 + hx, -20 + hy, 8, 4, ink);                        // 面罩
    O(19 + hx, -17 + hy, 2, 2, white);                      // 鼻子
    D(11 + hx, -23 + hy, 1, 2, ink); D(11 + hx, -24 + hy, 1, 1, acc); // 天线
    // 眼睛
    const ex1 = 12 + hx, ex2 = 16 + hx, ey = -19 + hy;
    const blink = frameN % 220 < 7;
    if (sleeping || blink) { D(ex1, ey + 1, 2, 1, acc); D(ex2, ey + 1, 2, 1, acc); }
    else if (happy) {
      for (const ex of [ex1, ex2]) { D(ex, ey + 1, 1, 1, acc); D(ex + 1, ey, 1, 1, acc); D(ex + 2, ey + 1, 1, 1, acc); }
    } else {
      const look = d.state === "chase" ? 1 : 0;
      D(ex1 + look, ey, 2, 2, acc); D(ex2 + look, ey, 2, 2, acc);
    }
  }

  function drawScene() {
    ctx.clearRect(0, 0, aw, ah);

    // 云
    for (const c of clouds) sprite(SPR.cloud, c.x, c.y, 0.35);

    // 地面
    ctx.fillStyle = A("fg"); ctx.fillRect(0, ground, aw, PX);
    ctx.fillStyle = A("fg", 0.2);
    for (let x = 0; x < aw; x += PX * 4) ctx.fillRect(snap(x), ground + PX * 2, PX * 2, PX);

    // 充电桩
    const charging = dog.state === "sleep" && Math.abs(dog.x - dockX - DOCK_OFF) < 24;
    ctx.fillStyle = A("fg"); ctx.fillRect(dockX - 4 * U, ground - 2 * U, 38 * U, 2 * U);
    ctx.fillStyle = A("c2"); ctx.fillRect(dockX - 3 * U, ground - 2 * U, 36 * U, U);
    ctx.fillStyle = A("fg"); ctx.fillRect(dockX - 4 * U, ground - 16 * U, 6 * U, 14 * U);
    ctx.fillStyle = A("surface"); ctx.fillRect(dockX - 3 * U, ground - 15 * U, 4 * U, 12 * U);
    sprite(SPR.bolt, dockX - 4 * U, ground - 13 * U, charging && frameN % 40 < 20 ? 0.35 : 1);

    // 球（地面上的影子）
    if (ball && !ball.held) {
      const h = Math.max(0, ground - ball.y);
      const w = Math.max(2, 6 - Math.floor(h / 40)) * U;
      ctx.fillStyle = A("fg", 0.2); ctx.fillRect(snap(ball.x - w / 2), ground - U, snap(w), U);
    }
    // 狗的影子
    ctx.fillStyle = A("fg", 0.15);
    const sw = Math.max(8, 22 - Math.floor(dog.y / 10)) * U;
    ctx.fillRect(snap(dog.x - sw / 2), ground - U, snap(sw), U);

    drawDog();
    if (ball) sprite(SPR.ball, ball.x - 3 * U, ball.y - 3 * U);

    // 粒子
    for (const p of parts) {
      if (p.life < 0.25 && Math.floor(p.life * 40) % 2) continue;
      if (p.type === "heart") sprite(SPR.heart, p.x, p.y);
      else if (p.type === "z") sprite(SPR.z, p.x, p.y, Math.min(1, p.life * 2));
      else if (p.type === "spark") { ctx.fillStyle = A("c4"); ctx.fillRect(snap(p.x), snap(p.y), U, U); }
      else { ctx.fillStyle = A("muted", p.life * 0.8); ctx.fillRect(snap(p.x), snap(p.y), U, U); }
    }

    // 对话气泡
    if (dog.bubble) {
      const m = mouth();
      const text = dog.bubble.text;
      ctx.font = "32px Silkscreen, monospace";
      const w = snap(ctx.measureText(text).width + 6 * U), h = 10 * U;
      const bx = snap(Math.max(8, Math.min(aw - w - 8, dog.x + dog.dir * 30 - w / 2)));
      const by = snap(m.y - 26 * U);
      ctx.fillStyle = A("fg"); ctx.fillRect(bx - U, by - U, w + 2 * U, h + 2 * U);
      ctx.fillStyle = A("surface"); ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = A("fg"); ctx.fillRect(snap(dog.x + dog.dir * 20), by + h + U, 2 * U, 2 * U);
      pxText(text, bx + w / 2, by + h / 2 + U / 2, A("fg"));
    }

    // 准星（鼠标在面板内）
    if (pointer.inside && !overDog()) {
      const cx = snap(pointer.x), cy = snap(pointer.y);
      ctx.fillStyle = A("c1");
      ctx.fillRect(cx - 3 * U, cy, 2 * U, U); ctx.fillRect(cx + 2 * U, cy, 2 * U, U);
      ctx.fillRect(cx, cy - 3 * U, U, 2 * U); ctx.fillRect(cx, cy + 2 * U, U, 2 * U);
    }
  }

  /* ---------- HUD ---------- */
  const STATUS = {
    idle: () => (pointer.inside ? "它在看着你" : "发呆中…"),
    wander: () => "到处逛逛", sniff: () => "闻闻这是什么？",
    home: () => (battery < 15 ? "电量低，回去充电" : "困了，回窝睡觉"),
    sleep: () => (Math.abs(dog.x - dockX - DOCK_OFF) < 24 ? "睡着了 · 充电中" : "睡着了"),
    wake: () => "醒了！", chase: () => "冲啊！追球！", return: () => "叼回来给你～",
    happy: () => "开心！再扔一次？", pet: () => "好舒服～", bark: () => "汪！",
  };
  function gait() {
    const s = dog.state, v = Math.abs(dog.vx);
    if (s === "sleep") return "SLEEP";
    if (dog.y > 0) return "JUMP";
    if (s === "sniff") return "SNIFF";
    return v > 2.8 ? "GALLOP" : v > 1.5 ? "TROT" : v > 0.25 ? "WALK" : "STAND";
  }
  let lastHud = "";
  function hud() {
    const g = gait();
    const cells = Math.round(battery / 20);
    const text = `BAT ${"■".repeat(cells)}${"□".repeat(5 - cells)} ${Math.round(battery)}%   GAIT ${g}   V ${(Math.abs(dog.vx) * 0.22).toFixed(2)}m/s`;
    if (text !== lastHud) { hudEl.textContent = text; lastHud = text; }
    if (modeEl.textContent !== g) modeEl.textContent = g;
    modeEl.classList.toggle("manual", ["chase", "return", "happy", "pet", "bark"].includes(dog.state));
    const st = STATUS[dog.state]();
    if (statusEl.textContent !== st) statusEl.textContent = st;
  }

  /* ---------- 交互 ---------- */
  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  }
  panel.addEventListener("pointerenter", (e) => { pointer.inside = true; setPointer(e); });
  panel.addEventListener("pointerleave", () => { pointer.inside = false; });
  panel.addEventListener("pointermove", (e) => { pointer.inside = true; setPointer(e); });
  panel.addEventListener("pointerdown", (e) => {
    setPointer(e); pointer.inside = true;
    hintEl.classList.add("used");
    e.preventDefault();
    if (overDog()) {                                  // 点它：汪！
      if (dog.state === "sleep") { setState("wake"); say("!"); jump(4); return; }
      setState("bark"); say("WOOF!"); jump(4.5);
      return;
    }
    // 点空地：从点击处抛出一个球
    const r = 3 * U;
    ball = {
      x: Math.max(r + 8, Math.min(aw - r - 8, pointer.x)),
      y: Math.max(90, Math.min(ground - r, pointer.y)),
      vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 2, held: false, fetched: false,
    };
    if (dog.carry) dog.carry = false;
    burst("spark", ball.x, ball.y, 6);
  });
  window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") pointer.inside = false; });

  /* ---------- 主循环 ---------- */
  function frame() {
    requestAnimationFrame(frame);
    if (!onScreen) return;
    update(); drawScene(); hud();
  }
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }).observe(panel);
  layout();
  window.addEventListener("resize", layout);
  requestAnimationFrame(frame);
})();
