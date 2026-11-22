/* ==========================================================================
   season.js — 홈 화면 시즌 테마 배경 (도트 + 계속 움직이는 효과)

   ▶ 테마 바꾸기: 아래 SITE_SEASON 한 줄만 바꾸고 배포한다. 자동으로 바뀌지 않는다
     (woody가 그때그때 요청 → 개발 세션이 바꿔서 배포, planning/dev.md #53).
       "default"   — 기본(크림색 배경, 그림 없음)
       "halloween" — 할로윈 파티 밤(woody 2026-11-21: 공포보다 파티, 밤하늘, 위쪽에도 호박·유령, 폭죽).
                     밤하늘·달·별, 깃발 가랜드 + 깜빡이는 전구, 터지는 폭죽, 위쪽을 떠다니는
                     호박·유령, 내리는 색종이, 올라가는 풍선, 떨어지는 사탕, 웃는 호박, 박쥐 몇 마리
                     (밤하늘 위 글씨 색은 common.css 의 html.season-halloween 규칙)
       "christmas" — 눈 내리는 크리스마스 밤(dev.md #63, 12월용): 전구 줄·눈·산타 썰매·트리·선물·눈사람 (아래 두 번째 블록)
     미리보기: 주소 끝에 ?season=default / ?season=halloween / ?season=christmas (배포 값은 그대로).

   - 화면 뒤에 고정된 canvas 하나에 그린다(본문 클릭·스크롤에 영향 없음).
   - 도트 1칸 = 4px(휴대폰 3px). 초당 약 12번만 다시 그려서 가볍고 도트 애니메이션 느낌.
   - 탭이 안 보이면 멈추고, "동작 줄이기" 설정이면 움직이지 않는 한 장만 그린다.
   ========================================================================== */

window.SITE_SEASON = "halloween";

// 다음 프레임 예약: 보통은 requestAnimationFrame, 프레임이 안 오는 환경(일부 앱 내 브라우저 등)에서는 120ms 타이머가 대신.
function seasonNextFrame(fn) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fn(performance.now());
  };
  requestAnimationFrame(go);
  setTimeout(go, 120);
}

(function () {
  "use strict";

  let season = window.SITE_SEASON;
  try {
    const q = new URLSearchParams(location.search).get("season");
    if (q === "default" || q === "halloween" || q === "christmas") season = q;
  } catch (e) {
    /* 무시 */
  }
  if (season !== "halloween") return;

  document.documentElement.classList.add("season-halloween");

  const C = {
    k: "#2b2320", // 외곽선
    K: "#0b0e1f", // 박쥐(밤하늘보다 어두운 실루엣)
    o: "#ff8a3d", // 호박
    O: "#e0671f", // 호박 골
    d: "#6b4226", // 꼭지
    v: "#2fae91", // 잎
    y: "#ffd84a", // 호박 얼굴 불빛·금색
    w: "#ffffff", // 유령
    f: "#ffa3b8", // 볼터치
  };
  // 파티 색 (색종이·깃발·풍선·사탕)
  const PARTY = ["#ff8a3d", "#ffc93c", "#2fae91", "#ff8fb1", "#82cbff", "#fff6ec"];
  const FIREWORK = ["#ffc93c", "#ff8a3d", "#ff8fb1", "#82cbff", "#7be0bf", "#fff3a8"];

  const BAT = [
    ["KK.....KK", ".KK.K.KK.", "..KKKKK..", "....K...."],
    ["...K.K...", "..KKKKK..", ".KK.K.KK.", "KK.....KK"],
  ];
  const GHOST = [
    "..wwwww..",
    ".wwwwwww.",
    "wwwwwwwww",
    "wwkwwwkww",
    "wfwwwwwfw",
    "wwwkkkwww",
    "wwwwwwwww",
    "wwwwwwwww",
    "w.ww.ww.w",
  ];
  const HAT = ["..y..", "..o..", ".oyo.", ".yoy.", "oyoyo"];
  // 웃는 호박 (^ ^ 눈 + 볼터치 + 미소)
  const PUMPKIN = [
    ".....d.....",
    "....dd.v...",
    "..oooOooo..",
    ".ooOoooOoo.",
    "oooyoooyooo",
    "ooyoyoyoyoo",
    "ofooooooofo",
    "ooyoooooyoo",
    "oooyyyyyooo",
    ".ooOoooOoo.",
    "..ooooooo..",
  ];
  const BALLOON = ["..aaa..", ".aaaaa.", "aawaaaa", "aaaaaaa", "aaaaaaa", ".aaaaa.", "..aaa..", "...b..."];
  const CANDY = ["y.aaa.y", "yyaaayy", "y.aaa.y"];

  const canvas = document.createElement("canvas");
  canvas.className = "season-bg";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let stars = [];
  let bats = [];
  let ghosts = [];
  let confetti = [];
  let balloons = [];
  let candies = [];
  let flyers = []; // 위쪽을 떠다니는 호박
  let fireworks = [];
  let nextFirework = 0;
  let frame = 0;

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }
  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  function shade(hex) {
    // 풍선 매듭용으로 조금 어둡게
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.round(v * 0.8));
    return "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")";
  }

  function setup() {
    const S = window.innerWidth < 600 ? 3 : 4;
    W = Math.ceil(window.innerWidth / S);
    H = Math.ceil(window.innerHeight / S);
    canvas.width = W;
    canvas.height = H;
    const wide = W > 250;

    stars = [];
    for (let i = 0; i < Math.round(W / 7); i++) {
      stars.push({ x: Math.floor(rnd(2, W - 2)), y: Math.floor(rnd(14, H * 0.5)), p: Math.floor(rnd(0, 24)), big: Math.random() < 0.3 });
    }
    bats = [];
    const band = wide ? [0.12, 0.4] : [0.05, 0.13]; // 휴대폰은 제목 위 띠에서만
    for (let i = 0; i < (wide ? 3 : 2); i++) {
      bats.push({ x: rnd(-10, W), y: rnd(H * band[0], H * band[1]), v: rnd(0.35, 0.6) * (i % 2 ? -1 : 1), a: rnd(2, 4), ph: rnd(0, 6), f: i });
    }
    ghosts = [];
    for (let i = 0; i < (wide ? 4 : 3); i++) {
      // 위쪽(넓은 화면은 위 절반, 휴대폰은 제목 위 띠)과 아래쪽에 고루
      const up = i < 2;
      const gy = wide ? (up ? rnd(H * 0.12, H * 0.4) : rnd(H * 0.5, H * 0.75)) : up ? rnd(H * 0.05, H * 0.13) : rnd(H * 0.45, H * 0.7);
      if (wide && up) {
        ghosts.push({ x: i === 0 ? rnd(W * 0.06, W * 0.16) : rnd(W * 0.84, W * 0.9), y: rnd(H * 0.1, H * 0.22), v: 0, ph: rnd(0, 6), sway: 6 });
      } else if (!wide && up) {
        if (i === 0) ghosts.push({ x: Math.round(W * 0.5), y: 17, v: 0, ph: rnd(0, 6), bob: 1 });
        else ghosts.push({ x: rnd(0, W), y: rnd(H * 0.45, H * 0.7), v: rnd(0.12, 0.22), ph: rnd(0, 6) });
      } else {
        ghosts.push({ x: rnd(0, W), y: gy, v: rnd(0.12, 0.22) * (i % 2 ? -1 : 1), ph: rnd(0, 6) });
      }
    }
    confetti = [];
    for (let i = 0; i < Math.round(W * (wide ? 0.18 : 0.22)); i++) {
      confetti.push({ x: rnd(0, W), y: rnd(0, H), vy: rnd(0.25, 0.55), ph: rnd(0, 6), c: pick(PARTY), long: Math.random() < 0.4 });
    }
    balloons = [];
    const bCount = wide ? 6 : 2;
    for (let i = 0; i < bCount; i++) {
      // 넓은 화면은 양쪽 여백 위주로 올라가게
      const side = i % 2 ? rnd(W * 0.78, W - 10) : rnd(4, W * 0.2);
      balloons.push({ x: wide ? side : rnd(4, W - 10), y: rnd(H * 0.3, H + 30), v: rnd(0.18, 0.3), ph: rnd(0, 6), c: PARTY[i % 5] });
    }
    flyers = [];
    for (let i = 0; i < (wide ? 3 : 1); i++) {
      flyers.push(
        wide
          ? { x: i === 1 ? rnd(W * 0.82, W * 0.88) : rnd(W * 0.04, W * 0.18), y: i === 2 ? rnd(H * 0.3, H * 0.42) : rnd(H * 0.12, H * 0.28), v: 0, ph: rnd(0, 6), sway: 6 }
          : { x: Math.round(W * 0.24), y: 16, v: 0, ph: rnd(0, 6), bob: 1 } // 휴대폰: 가랜드 밑 틈
      );
    }
    fireworks = [];
    nextFirework = frame + 6;
    candies = [];
    for (let i = 0; i < (wide ? 5 : 3); i++) {
      candies.push({ x: rnd(0, W), y: rnd(-H, H), v: rnd(0.3, 0.5), ph: rnd(0, 6), c: pick(PARTY.slice(0, 5)) });
    }
  }

  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function sprite(rows, x, y, colors, flip) {
    x = Math.round(x);
    y = Math.round(y);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[flip ? row.length - 1 - c : c];
        if (ch === ".") continue;
        ctx.fillStyle = (colors && colors[ch]) || C[ch];
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  // 외곽선(테두리 색으로 상하좌우 한 칸씩 찍은 뒤 본체)
  function outlined(rows, x, y, edge, colors) {
    const e = {};
    rows.join("").split("").forEach((ch) => {
      if (ch !== ".") e[ch] = edge;
    });
    sprite(rows, x - 1, y, e);
    sprite(rows, x + 1, y, e);
    sprite(rows, x, y - 1, e);
    sprite(rows, x, y + 1, e);
    sprite(rows, x, y, colors);
  }

  // 위쪽 깃발 가랜드 + 깃발 사이 전구 (살랑살랑, 전구는 번갈아 깜빡)
  function garland() {
    const sag = W > 250 ? 9 : 6;
    const top = 2;
    const yAt = (x) => top + Math.round(sag * Math.sin((Math.PI * x) / W));
    for (let x = 0; x < W; x++) px(x, yAt(x), 1, 1, "#c9a27a");
    const gap = 11;
    const flagColors = ["#ff8a3d", "#fff6ec", "#ffc93c", "#2fae91", "#ff8fb1"];
    for (let i = 0, x = 3; x < W - 6; i++, x += gap) {
      const y0 = yAt(x + 3) + 1;
      const sway = Math.round(Math.sin(frame / 5 + i) * 0.6);
      const col = flagColors[i % flagColors.length];
      for (let r = 0; r < 6; r++) {
        const half = 3 - Math.floor(r / 2);
        px(x + 3 - half + (r > 3 ? sway : 0), y0 + r, half * 2, 1, col);
      }
      // 전구
      const bx = x + gap - 2;
      const by = yAt(bx) + 1;
      const on = (Math.floor(frame / 4) + i) % 2 === 0;
      px(bx, by, 2, 2, on ? "#fff3a8" : "#ffb000");
      if (on) {
        ctx.fillStyle = "rgba(255, 236, 150, 0.35)";
        ctx.fillRect(bx - 1, by - 1, 4, 4);
      }
    }
  }

  // 폭죽: 꼬리를 그리며 올라가다 터져서 사방으로 퍼지고, 떨어지며 사라진다.
  function launchFirework() {
    const wide = W > 250;
    const band = wide ? [0.08, 0.38] : [0.05, 0.09];
    // 넓은 화면은 본문(가운데 카드)에 가려지지 않게 양쪽 여백 위주, 가운데는 제목 위 높은 곳만.
    const side = true;
    const fwX = !wide ? rnd(W * 0.66, W * 0.82) : side ? (Math.random() < 0.5 ? rnd(W * 0.04, W * 0.22) : rnd(W * 0.78, W * 0.96)) : rnd(W * 0.3, W * 0.7);
    const fwTy = side ? rnd(H * band[0], H * band[1]) : rnd(H * 0.05, H * 0.14);
    fireworks.push({
      x: fwX,
      y: fwTy + (wide ? rnd(40, 65) : rnd(18, 30)), // 터질 높이보다 조금 아래에서 출발
      ty: fwTy,
      vy: wide ? -5 : -3.5, // 1초 안쪽으로 올라가 터지게
      c: pick(FIREWORK),
      c2: pick(FIREWORK),
      parts: null,
    });
  }

  function drawFireworks() {
    if (frame >= nextFirework) {
      launchFirework();
      nextFirework = frame + Math.round(rnd(10, 26));
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      if (!fw.parts) {
        fw.y += fw.vy;
        px(fw.x, fw.y, 1, 2, "#fff3c4");
        px(fw.x, fw.y + 2, 1, 1, "rgba(255, 220, 150, 0.6)");
        px(fw.x, fw.y + 3, 1, 1, "rgba(255, 220, 150, 0.3)");
        if (fw.y <= fw.ty) {
          // 바깥 고리 + 안쪽 고리, 속도를 조금씩 달리해 꽉 찬 불꽃으로
          const sp = W > 250 ? rnd(2.4, 3.0) : rnd(1.4, 1.8);
          fw.parts = [];
          [[Math.round(rnd(26, 32)), 1, fw.c], [Math.round(rnd(12, 16)), 0.55, fw.c2]].forEach(([n, mul, col]) => {
            for (let k = 0; k < n; k++) {
              const ang = (k / n) * Math.PI * 2 + rnd(-0.08, 0.08);
              const v = sp * mul * rnd(0.85, 1.1);
              fw.parts.push({ x: fw.x, y: fw.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, c: Math.random() < 0.15 ? "#ffffff" : col });
            }
          });
          fw.life = 0;
          fw.max = Math.round(rnd(16, 22));
        }
        continue;
      }
      fw.life += 1;
      const alpha = Math.max(0, 1 - fw.life / fw.max);
      if (fw.life <= 2) {
        ctx.fillStyle = "rgba(255, 246, 200, " + (0.5 - fw.life * 0.2) + ")";
        ctx.fillRect(Math.round(fw.x) - 3, Math.round(fw.ty) - 3, 7, 7);
      }
      ctx.globalAlpha = alpha;
      fw.parts.forEach((p) => {
        const ox = p.x;
        const oy = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy = p.vy * 0.92 + 0.04;
        // 끝무렵엔 반짝반짝
        if (fw.life > fw.max * 0.6 && Math.random() < 0.4) return;
        px(ox, oy, 1, 1, p.c); // 꼬리
        px(p.x, p.y, 2, 2, p.c);
      });
      ctx.globalAlpha = 1;
      if (fw.life >= fw.max) fireworks.splice(i, 1);
    }
  }

  function draw() {
    // 밤하늘: 위는 깊은 남색, 아래로 갈수록 조금 밝게
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#10162e");
    g.addColorStop(0.55, "#1f2a52");
    g.addColorStop(1, "#2c3866");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 별 (반짝)
    stars.forEach((s) => {
      if ((frame + s.p) % 24 >= 16) return;
      px(s.x, s.y, 1, 1, "#ffffff");
      if (s.big && (frame + s.p) % 24 < 8) {
        px(s.x - 1, s.y, 1, 1, "#ffe9b0");
        px(s.x + 1, s.y, 1, 1, "#ffe9b0");
        px(s.x, s.y - 1, 1, 1, "#ffe9b0");
        px(s.x, s.y + 1, 1, 1, "#ffe9b0");
      }
    });

    // 달 (오른쪽 위) + 은은한 빛
    const mx = W - 20;
    const my = 22;
    ctx.fillStyle = "rgba(255, 243, 196, 0.35)";
    ctx.beginPath();
    ctx.arc(mx, my, 13 + (frame % 32 < 16 ? 0 : 1), 0, Math.PI * 2);
    ctx.fill();
    for (let y = -9; y <= 9; y++) {
      for (let x = -9; x <= 9; x++) {
        if (x * x + y * y <= 81) px(mx + x, my + y, 1, 1, "#fff3c4");
      }
    }
    px(mx - 4, my - 3, 3, 2, "#f2df9a");
    px(mx + 2, my + 2, 2, 2, "#f2df9a");
    px(mx - 1, my + 5, 2, 1, "#f2df9a");

    // 폭죽 (달 다음, 다른 그림보다 뒤)
    drawFireworks();

    // 풍선 (천천히 올라가며 살랑, 끈 포함)
    balloons.forEach((b) => {
      b.y -= b.v;
      if (b.y < -24) {
        b.y = H + 4;
      }
      const x = b.x + Math.sin(frame / 10 + b.ph) * 2;
      for (let i = 0; i < 10; i++) px(x + 3 + Math.round(Math.sin(i / 2 + frame / 6 + b.ph) * 0.8), b.y + 8 + i, 1, 1, "rgba(255,246,236,0.45)");
      sprite(BALLOON, x, b.y, { a: b.c, b: shade(b.c) });
    });

    // 유령 (고깔모자 + 볼터치, 둥실둥실)
    ghosts.forEach((gh) => {
      gh.x += gh.v;
      if (gh.x > W + 12) gh.x = -12;
      if (gh.x < -12) gh.x = W + 12;
      const y = gh.y + Math.sin(frame / 8 + gh.ph) * (gh.bob || 3);
      const gx = gh.v ? gh.x : gh.x + Math.sin(frame / 12 + gh.ph) * (gh.sway || 2);
      outlined(GHOST, gx, y, "#e0cfc0", null);
      sprite(HAT, gx + 2, y - 5, null);
    });

    // 위쪽을 떠다니는 호박 (둥실 + 촛불 깜빡)
    flyers.forEach((p) => {
      p.x += p.v;
      if (p.x > W + 14) p.x = -14;
      if (p.x < -14) p.x = W + 14;
      const y = p.y + Math.sin(frame / 9 + p.ph) * (p.bob || 3);
      const fx = p.v ? p.x : p.x + Math.sin(frame / 12 + p.ph) * (p.sway || 2);
      outlined(PUMPKIN, fx, y, C.k, { y: Math.random() < 0.25 ? "#ffb000" : "#ffd84a" });
    });

    // 박쥐 (날갯짓 2프레임 + 물결 비행)
    bats.forEach((b) => {
      b.x += b.v;
      if (b.v > 0 && b.x > W + 10) b.x = -10;
      if (b.v < 0 && b.x < -10) b.x = W + 10;
      const y = b.y + Math.sin(frame / 6 + b.ph) * b.a;
      sprite(BAT[Math.floor((frame + b.f) / 3) % 2], b.x, y, null, b.v < 0);
    });

    // 사탕 (빙글빙글 대신 좌우로 흔들리며 떨어짐)
    candies.forEach((c) => {
      c.y += c.v;
      if (c.y > H + 4) {
        c.y = -6;
        c.x = rnd(0, W);
      }
      sprite(CANDY, c.x + Math.sin(frame / 7 + c.ph) * 3, c.y, { a: c.c, y: "#fff3a8" });
    });

    // 색종이 (계속 내림)
    confetti.forEach((p) => {
      p.y += p.vy;
      if (p.y > H) {
        p.y = -2;
        p.x = rnd(0, W);
      }
      const x = p.x + Math.sin(frame / 6 + p.ph) * 1.5;
      const flip = Math.floor(frame / 3 + p.ph) % 2;
      if (p.long) px(x, p.y, flip ? 2 : 1, flip ? 1 : 2, p.c);
      else px(x, p.y, 1, 1, p.c);
    });

    // 위쪽 가랜드 (맨 앞)
    garland();

    // 땅 + 웃는 호박 (촛불 깜빡)
    const groundY = H - 4;
    px(0, groundY, W, 4, "#3b2f45");
    for (let x = 0; x < W; x += 6) px(x, groundY - 1, 3, 1, "#3b2f45");
    const glow = () => ({ y: Math.random() < 0.25 ? "#ffb000" : "#ffd84a" });
    outlined(PUMPKIN, 4, groundY - 11, C.k, glow());
    if (W > 60) outlined(PUMPKIN, W - 16, groundY - 11, C.k, glow());
    if (W > 250) {
      outlined(PUMPKIN.slice(2), 18, groundY - 9, C.k, glow());
      outlined(PUMPKIN.slice(2), W - 30, groundY - 9, C.k, glow());
    }
  }

  let last = 0;
  let running = false;
  function loop(t) {
    if (!running) return;
    if (t - last >= 83) {
      last = t;
      frame += 1;
      draw();
    }
    seasonNextFrame(loop);
  }

  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    if (still || running) return;
    running = true;
    seasonNextFrame(loop);
  }
  function stop() {
    running = false;
  }

  function mount() {
    document.body.insertBefore(canvas, document.body.firstChild);
    setup();
    draw();
    start();
  }

  window.addEventListener("resize", () => {
    setup();
    draw();
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();

/* ==========================================================================
   크리스마스 (dev.md #63) — 눈 내리는 크리스마스 밤
   반짝이는 전구 줄, 계속 내리는 눈, 달 앞을 가끔 지나가는 산타 썰매, 장식이 깜빡이는 큰 트리(별 빛남),
   선물 상자, 눈사람, 눈 쌓인 바닥. 할로윈과 같은 규칙: 홈만·캔버스 1개·탭 숨김 정지·동작 줄이기 정지 화면,
   휴대폰에서는 로고·제목을 가리지 않게 가장자리·아래쪽 위주. 글씨 색은 common.css 의 밤하늘 규칙(.season-christmas).
   ========================================================================== */
(function () {
  "use strict";

  let season = window.SITE_SEASON;
  try {
    const q = new URLSearchParams(location.search).get("season");
    if (q === "default" || q === "halloween" || q === "christmas") season = q;
  } catch (e) {
    /* 무시 */
  }
  if (season !== "christmas") return;

  document.documentElement.classList.add("season-christmas");

  const K = "#0b0e1f";
  const LIGHTS = ["#e8505b", "#ffd84a", "#2fae91", "#4dabf7", "#ff8fb1"];

  const canvas = document.createElement("canvas");
  canvas.className = "season-bg";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let wide = false;
  let stars = [];
  let flakes = [];
  let sparkles = [];
  let frame = 0;
  let sleigh = null;
  let nextSleigh = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, 1, 1, c);
  }

  function setup() {
    const S = window.innerWidth < 600 ? 3 : 4;
    W = Math.ceil(window.innerWidth / S);
    H = Math.ceil(window.innerHeight / S);
    canvas.width = W;
    canvas.height = H;
    wide = W > 250;
    stars = [];
    for (let i = 0; i < Math.round(W / 7); i++) stars.push({ x: Math.floor(rnd(2, W - 2)), y: Math.floor(rnd(14, H * 0.5)), p: Math.floor(rnd(0, 24)), big: Math.random() < 0.25 });
    flakes = [];
    for (let i = 0; i < Math.round(W * (wide ? 0.35 : 0.45)); i++) {
      const near = Math.random() < 0.25; // 가까운 눈은 크고 빠르게
      flakes.push({ x: rnd(0, W), y: rnd(0, H), vy: near ? rnd(0.5, 0.8) : rnd(0.2, 0.4), ph: rnd(0, 6), big: near });
    }
    // 넓은 화면 양쪽 여백의 큰 눈 결정
    sparkles = [];
    if (wide) {
      for (let i = 0; i < 6; i++) sparkles.push({ x: i % 2 ? rnd(W * 0.8, W * 0.95) : rnd(W * 0.04, W * 0.2), y: rnd(H * 0.12, H * 0.6), p: Math.floor(rnd(0, 40)) });
    }
    nextSleigh = frame + 40;
  }

  // 위쪽 전구 줄 (초록 솔 가지 + 번갈아 깜빡이는 전구)
  function lightString() {
    const sag = wide ? 9 : 6;
    const yAt = (x) => 2 + Math.round(sag * Math.sin((Math.PI * x) / W));
    for (let x = 0; x < W; x++) {
      px(x, yAt(x), 1, 2, "#2f6b3e");
      if (x % 3 === 0) px(x, yAt(x) - 1, 1, 1, "#3e8a52");
    }
    for (let i = 0, x = 4; x < W - 2; i++, x += 8) {
      const y = yAt(x) + 2;
      const on = (Math.floor(frame / 6) + i) % 3 !== 0;
      const col = LIGHTS[i % LIGHTS.length];
      px(x, y, 1, 1, "#9aa1ab");
      px(x - 1, y + 1, 3, 3, on ? col : "#3b3f55");
      if (on) {
        ctx.fillStyle = "rgba(255, 245, 200, 0.25)";
        ctx.fillRect(x - 2, y, 5, 5);
        px(x - 1, y + 1, 1, 1, "#ffffff");
      }
    }
  }

  // 큰 트리 (bx = 가운데, by = 바닥)
  function tree(bx, by, size) {
    const layers = size === "big" ? [[14, 10], [11, 9], [8, 8], [5, 7]] : [[8, 7], [6, 6], [4, 5]];
    px(bx - 2, by - 4, 4, 4, "#6b4226");
    let y = by - 3;
    const ornaments = [];
    layers.forEach(([half, h], li) => {
      for (let r = 0; r < h; r++) {
        const w = Math.round(half * ((r + 1) / h));
        px(bx - w, y - h + r, w * 2 + 1, 1, r === h - 1 ? "#1f5a33" : "#2f8a4e");
        if (r === h - 1 && li < layers.length) ornaments.push([bx - w + 2, y - 1], [bx + w - 2, y - 1], [bx, y - 2]);
      }
      // 눈 쌓임
      px(bx - Math.round(half * 0.6), y - 1, Math.round(half * 0.5), 1, "#e8f1ff");
      y -= h - 2;
    });
    // 장식 공 깜빡임
    ornaments.forEach(([x, oy], i) => {
      const on = (Math.floor(frame / 5) + i) % 4 !== 0;
      px(x, oy, 2, 2, on ? LIGHTS[i % LIGHTS.length] : "#3b3f55");
    });
    // 꼭대기 별
    const sy = y - 1;
    const glow = 0.35 + 0.25 * Math.sin(frame / 5);
    ctx.fillStyle = "rgba(255, 216, 74, " + glow.toFixed(2) + ")";
    ctx.fillRect(bx - 4, sy - 4, 9, 9);
    px(bx, sy - 3, 1, 7, "#ffd84a");
    px(bx - 3, sy, 7, 1, "#ffd84a");
    px(bx - 1, sy - 1, 3, 3, "#fff3a8");
  }

  function gift(x, by, w, h, col, rib) {
    px(x - 1, by - h - 1, w + 2, h + 1, K);
    px(x, by - h, w, h, col);
    px(x + Math.floor(w / 2), by - h, 1, h, rib);
    px(x, by - Math.ceil(h / 2), w, 1, rib);
    px(x + Math.floor(w / 2) - 1, by - h - 2, 1, 2, rib);
    px(x + Math.floor(w / 2) + 1, by - h - 2, 1, 2, rib);
  }

  function snowman(cx, by) {
    disc(cx, by - 5, 5, "#f4f8ff");
    disc(cx, by - 13, 4, "#f4f8ff");
    px(cx - 4, by - 18, 9, 1, K); // 모자 챙
    px(cx - 3, by - 22, 7, 4, K);
    px(cx - 3, by - 19, 7, 1, "#e8505b");
    px(cx - 2, by - 14, 1, 1, K); // 눈
    px(cx + 1, by - 14, 1, 1, K);
    px(cx, by - 12, 3, 1, "#ff8a3d"); // 당근 코
    px(cx - 3, by - 9, 7, 2, "#e8505b"); // 목도리
    px(cx + 2, by - 9, 2, 4, "#e8505b");
    px(cx, by - 6, 1, 1, K);
    px(cx, by - 3, 1, 1, K);
    px(cx - 9, by - 11, 4, 1, "#6b4226"); // 팔
    px(cx + 6, by - 11, 4, 1, "#6b4226");
  }

  // 산타 썰매 + 순록 실루엣 (오른쪽 → 왼쪽)
  function drawSleigh(s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y + Math.sin(frame / 6) * 1.5);
    for (let i = 0; i < 3; i++) {
      const rx = x + i * 7;
      const leg = Math.floor(frame / 3 + i) % 2;
      px(rx, y, 5, 2, K);
      px(rx - 1, y - 2, 2, 2, K);
      px(rx - 2, y - 4, 1, 2, K); // 뿔
      px(rx, y - 4, 1, 2, K);
      px(rx + (leg ? 0 : 1), y + 2, 1, 2, K);
      px(rx + (leg ? 4 : 3), y + 2, 1, 2, K);
      if (i === 0) px(rx - 2, y - 1, 1, 1, "#e8505b"); // 빨간 코
      px(rx + 5, y + 1, 2, 1, "rgba(11,14,31,0.7)"); // 고삐
    }
    const sx = x + 22;
    px(sx, y - 1, 10, 4, K);
    px(sx - 1, y + 3, 12, 1, K);
    px(sx + 3, y - 5, 4, 4, "#e8505b"); // 산타
    px(sx + 4, y - 7, 2, 2, "#ffffff");
    px(sx + 7, y - 3, 3, 2, "#6b4226"); // 선물 자루
  }

  function draw() {
    frame++;
    // 밤하늘
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0e1530");
    g.addColorStop(0.6, "#1c2a50");
    g.addColorStop(1, "#2a3a63");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    stars.forEach((s) => {
      if ((frame + s.p) % 24 >= 16) return;
      px(s.x, s.y, 1, 1, "#ffffff");
      if (s.big && (frame + s.p) % 24 < 8) {
        px(s.x - 1, s.y, 3, 1, "rgba(255,255,255,0.6)");
        px(s.x, s.y - 1, 1, 3, "rgba(255,255,255,0.6)");
      }
    });

    // 달
    const mx = W - 20;
    const my = 22;
    ctx.fillStyle = "rgba(255, 243, 196, 0.3)";
    ctx.beginPath();
    ctx.arc(mx, my, 13 + (frame % 32 < 16 ? 0 : 1), 0, Math.PI * 2);
    ctx.fill();
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) px(mx + x, my + y, 1, 1, "#fff6d8");
    px(mx - 4, my - 3, 3, 2, "#efe3b8");
    px(mx + 2, my + 2, 2, 2, "#efe3b8");

    // 산타 썰매: 가끔 달 앞을 지나간다 (휴대폰은 가랜드와 제목 사이 띠)
    if (!sleigh && frame >= nextSleigh) sleigh = { x: W + 10, y: wide ? my + 2 : 18, v: wide ? 0.9 : 0.6 };
    if (sleigh) {
      sleigh.x -= sleigh.v;
      drawSleigh(sleigh);
      if (sleigh.x < -50) {
        sleigh = null;
        nextSleigh = frame + Math.round(rnd(180, 300)); // 15~25초마다
      }
    }

    // 넓은 화면 여백의 큰 눈 결정 (반짝)
    sparkles.forEach((s) => {
      const on = (frame + s.p) % 40 < 28;
      const c = on ? "#ffffff" : "rgba(255,255,255,0.4)";
      px(s.x, s.y - 3, 1, 7, c);
      px(s.x - 3, s.y, 7, 1, c);
      px(s.x - 2, s.y - 2, 1, 1, c);
      px(s.x + 2, s.y - 2, 1, 1, c);
      px(s.x - 2, s.y + 2, 1, 1, c);
      px(s.x + 2, s.y + 2, 1, 1, c);
    });

    // 바닥: 눈 덮인 언덕
    const gy = H - 6;
    for (let x = 0; x < W; x++) {
      const bump = Math.round(Math.sin(x / 9) * 1.5 + Math.sin(x / 23) * 1.5);
      px(x, gy + bump, 1, H - gy - bump, "#e8f1ff");
      px(x, gy + bump, 1, 1, "#ffffff");
    }

    // 트리·선물·눈사람 (휴대폰은 양쪽 아래 작게)
    if (wide) {
      tree(Math.round(W * 0.1), gy, "big");
      gift(Math.round(W * 0.1) + 12, gy, 7, 6, "#e8505b", "#ffd84a");
      gift(Math.round(W * 0.1) - 18, gy, 6, 5, "#4dabf7", "#ffffff");
      gift(Math.round(W * 0.1) + 21, gy, 5, 4, "#2fae91", "#ff8fb1");
      tree(W - 40, gy, "small");
      snowman(W - 18, gy);
    } else {
      tree(10, gy, "small");
      gift(20, gy, 6, 5, "#e8505b", "#ffd84a");
      snowman(W - 11, gy);
    }

    // 눈 (맨 앞)
    flakes.forEach((f) => {
      f.y += f.vy;
      if (f.y > H) {
        f.y = -2;
        f.x = rnd(0, W);
      }
      const x = f.x + Math.sin(frame / 10 + f.ph) * (f.big ? 2 : 1);
      if (f.big) {
        px(x, f.y, 2, 2, "rgba(255,255,255,0.95)");
      } else px(x, f.y, 1, 1, "rgba(255,255,255,0.8)");
    });

    lightString();
  }

  let running = false;
  let last = 0;
  function loop(t) {
    if (!running) return;
    if (t - last >= 83) {
      last = t;
      draw();
    }
    seasonNextFrame(loop);
  }
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    if (still || running) return;
    running = true;
    seasonNextFrame(loop);
  }
  function stop() {
    running = false;
  }
  function mount() {
    document.body.insertBefore(canvas, document.body.firstChild);
    setup();
    draw();
    start();
  }
  window.addEventListener("resize", () => {
    setup();
    draw();
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
