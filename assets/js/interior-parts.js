/* ==========================================================================
   interior-parts.js — 내 연구실 인테리어 아이템 (dev.md #57 B단계)

   가구 종류 × 색 = 아이템. id = "in.종류.색" (예: in.sofa.mint). 등급 규칙은 꾸미기 옷과 같다
   (종류 기본 등급 + 색 보너스: 황금 +1, 무지개 +2, 최대 전설). 같은 뽑기권·확률·교환 규칙.
   종류(kind):
     floor  바닥 가구 (w×h 칸 차지, vh = 그림 높이 칸)   walk: 러그처럼 밟고 지나갈 수 있음
     wall   벽 장식 (뒷벽에 걸림, w 칸)
     wallpaper / flooring  방 전체 벽지·바닥 (놓는 게 아니라 "적용")
   그림은 도트 직접 그리기: draw(p, bx, by, c) — p(x, y, w, h, 색), (bx, by) = 바닥 가구는 차지하는 칸의
   왼쪽 아래 모서리, 벽 장식은 왼쪽 위(벽 맨 위). c = { a 주색, A 진한 색, L 밝은 색, k 외곽선 }.
   ========================================================================== */

(function () {
  "use strict";

  const COLORS = {
    coral: { name: "코랄", hex: "#ff8a6b", bonus: 0 },
    sky: { name: "하늘", hex: "#6cb8f5", bonus: 0 },
    mint: { name: "민트", hex: "#4fc3a1", bonus: 0 },
    yellow: { name: "노랑", hex: "#ffd84a", bonus: 0 },
    pink: { name: "분홍", hex: "#f08fb0", bonus: 0 },
    navy: { name: "남색", hex: "#34406b", bonus: 0 },
    purple: { name: "보라", hex: "#a27be0", bonus: 0 },
    gray: { name: "회색", hex: "#9aa1ab", bonus: 0 },
    gold: { name: "황금", hex: "#f2b632", bonus: 1 },
    rainbow: { name: "무지개", hex: "rainbow", bonus: 2 },
  };
  const RAINBOW = ["#ff6b6b", "#ffa94d", "#ffd84a", "#69db7c", "#4dabf7", "#9775fa", "#f783ac"];
  const K = "#2b2320";
  const W = "#ffffff";

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function lighten(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.round(v + (255 - v) * f);
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  // 색 묶음. 무지개는 줄(y)마다 바뀌는 함수 색.
  function palette(color) {
    const hex = (COLORS[color] || COLORS.gray).hex;
    if (hex === "rainbow") {
      const at = (y) => RAINBOW[((Math.floor(y / 2) % RAINBOW.length) + RAINBOW.length) % RAINBOW.length];
      return { a: (x, y) => at(y), A: (x, y) => shade(at(y), 0.75), L: (x, y) => lighten(at(y), 0.45), k: K };
    }
    return { a: hex, A: shade(hex, 0.72), L: lighten(hex, 0.45), k: K };
  }

  // ---------- 종류 ----------
  // grade: 기본 등급. colors: 쓸 색 목록(없으면 전부).
  const KINDS = {
    sofa: { name: "소파", kind: "floor", w: 2, h: 1, vh: 1.4, grade: 0,
      draw(p, bx, by, c) {
        p(bx, by - 22, 32, 18, c.k);
        p(bx + 1, by - 21, 30, 8, c.A); // 등받이
        p(bx + 1, by - 13, 30, 8, c.a); // 앉는 곳
        p(bx + 2, by - 12, 13, 2, c.L);
        p(bx + 17, by - 12, 13, 2, c.L);
        p(bx + 15, by - 13, 1, 8, c.A);
        p(bx, by - 16, 4, 11, c.k);
        p(bx + 1, by - 15, 2, 9, c.A); // 팔걸이
        p(bx + 28, by - 16, 4, 11, c.k);
        p(bx + 29, by - 15, 2, 9, c.A);
        p(bx + 3, by - 4, 2, 4, K);
        p(bx + 27, by - 4, 2, 4, K);
      } },
    armchair: { name: "안락의자", kind: "floor", w: 1, h: 1, vh: 1.4, grade: 0,
      draw(p, bx, by, c) {
        p(bx, by - 22, 16, 18, c.k);
        p(bx + 1, by - 21, 14, 8, c.A);
        p(bx + 1, by - 13, 14, 8, c.a);
        p(bx + 3, by - 12, 10, 2, c.L);
        p(bx, by - 15, 3, 10, c.k);
        p(bx + 13, by - 15, 3, 10, c.k);
        p(bx + 1, by - 14, 1, 8, c.A);
        p(bx + 14, by - 14, 1, 8, c.A);
        p(bx + 2, by - 4, 2, 4, K);
        p(bx + 12, by - 4, 2, 4, K);
      } },
    beanbag: { name: "빈백", kind: "floor", w: 1, h: 1, vh: 0.9, grade: 0,
      draw(p, bx, by, c) {
        p(bx + 3, by - 14, 10, 1, c.k);
        p(bx + 1, by - 13, 14, 1, c.k);
        p(bx, by - 12, 16, 11, c.k);
        p(bx + 2, by - 13, 12, 1, c.a);
        p(bx + 1, by - 12, 14, 10, c.a);
        p(bx + 3, by - 11, 5, 2, c.L);
        p(bx + 1, by - 5, 14, 3, c.A);
        p(bx + 2, by - 1, 12, 1, c.k);
      } },
    lamp: { name: "스탠드 조명", kind: "floor", w: 1, h: 1, vh: 2.1, grade: 0,
      draw(p, bx, by, c) {
        p(bx + 4, by - 3, 8, 3, K);
        p(bx + 7, by - 24, 2, 21, "#9aa1ab");
        p(bx + 4, by - 33, 8, 1, c.k);
        p(bx + 3, by - 32, 10, 1, c.k);
        p(bx + 2, by - 31, 12, 7, c.k);
        p(bx + 4, by - 32, 8, 1, c.a);
        p(bx + 3, by - 31, 10, 6, c.a);
        p(bx + 4, by - 30, 3, 4, c.L);
        p(bx + 3, by - 24, 10, 2, "rgba(255, 236, 150, 0.55)"); // 불빛
      } },
    monstera: { name: "큰 잎 화분", kind: "floor", w: 1, h: 1, vh: 1.8, grade: 0,
      draw(p, bx, by, c) {
        p(bx + 3, by - 9, 10, 9, c.k);
        p(bx + 4, by - 8, 8, 8, c.a);
        p(bx + 4, by - 8, 8, 2, c.A);
        const g = "#2fae91";
        const gl = "#9be0b0";
        p(bx + 7, by - 20, 2, 11, g);
        p(bx + 1, by - 22, 6, 5, g);
        p(bx + 2, by - 21, 2, 2, gl);
        p(bx + 9, by - 26, 6, 6, g);
        p(bx + 11, by - 25, 2, 2, gl);
        p(bx + 4, by - 28, 5, 6, g);
        p(bx + 5, by - 27, 2, 2, gl);
      } },
    cactus: { name: "선인장", kind: "floor", w: 1, h: 1, vh: 1.5, grade: 0,
      draw(p, bx, by, c) {
        p(bx + 4, by - 7, 8, 7, c.k);
        p(bx + 5, by - 6, 6, 6, c.a);
        p(bx + 5, by - 6, 6, 1, c.L);
        const g = "#3e9a5a";
        p(bx + 6, by - 22, 4, 15, K);
        p(bx + 7, by - 21, 2, 14, g);
        p(bx + 3, by - 17, 3, 6, K);
        p(bx + 4, by - 16, 1, 4, g);
        p(bx + 4, by - 12, 3, 1, g);
        p(bx + 10, by - 19, 3, 6, K);
        p(bx + 11, by - 18, 1, 4, g);
        p(bx + 9, by - 14, 3, 1, g);
        p(bx + 7, by - 23, 2, 1, "#ff8fb1"); // 꽃
      } },
    table: { name: "동그란 테이블", kind: "floor", w: 1, h: 1, vh: 1.1, grade: 0,
      draw(p, bx, by, c) {
        p(bx + 1, by - 16, 14, 6, c.k);
        p(bx + 2, by - 15, 12, 4, c.a);
        p(bx + 3, by - 15, 8, 1, c.L);
        p(bx + 7, by - 10, 2, 8, K);
        p(bx + 4, by - 2, 8, 2, K);
        p(bx + 9, by - 19, 3, 3, "#ffffff"); // 컵
        p(bx + 9, by - 18, 3, 1, "#c17a3d");
      } },
    rugRound: { name: "동그란 러그", kind: "floor", w: 2, h: 2, vh: 0, walk: true, grade: 0,
      draw(p, bx, by, c) {
        const y0 = by - 32;
        p(bx + 6, y0 + 4, 20, 24, c.A);
        p(bx + 3, y0 + 7, 26, 18, c.A);
        p(bx + 8, y0 + 6, 16, 20, c.a);
        p(bx + 5, y0 + 9, 22, 14, c.a);
        p(bx + 10, y0 + 11, 12, 10, c.L);
      } },
    rugStripe: { name: "줄무늬 러그", kind: "floor", w: 3, h: 2, vh: 0, walk: true, grade: 0,
      draw(p, bx, by, c) {
        const y0 = by - 32;
        p(bx + 2, y0 + 3, 44, 26, c.A);
        for (let i = 0; i < 6; i++) p(bx + 3, y0 + 4 + i * 4, 42, 2, i % 2 ? c.L : c.a);
        for (let i = 0; i < 8; i++) {
          p(bx + 4 + i * 5.5, y0 + 1, 2, 2, c.A);
          p(bx + 4 + i * 5.5, y0 + 29, 2, 2, c.A);
        }
      } },
    bed: { name: "침대", kind: "floor", w: 2, h: 2, vh: 2.3, grade: 1,
      draw(p, bx, by, c) {
        p(bx, by - 37, 32, 37, c.k);
        p(bx + 1, by - 36, 30, 8, c.A); // 머리판
        p(bx + 2, by - 28, 28, 24, W); // 매트리스
        p(bx + 4, by - 27, 10, 5, "#f1ece6"); // 베개
        p(bx + 18, by - 27, 10, 5, "#f1ece6");
        p(bx + 2, by - 20, 28, 15, c.a); // 이불
        p(bx + 2, by - 20, 28, 2, c.L);
        p(bx + 5, by - 15, 4, 2, c.L);
        p(bx + 20, by - 11, 4, 2, c.L);
        p(bx + 1, by - 4, 30, 3, c.A);
        p(bx + 2, by - 1, 2, 1, K);
        p(bx + 28, by - 1, 2, 1, K);
      } },
    aquarium: { name: "어항", kind: "floor", w: 2, h: 1, vh: 1.8, grade: 1,
      draw(p, bx, by, c) {
        p(bx + 1, by - 9, 30, 9, c.k);
        p(bx + 2, by - 8, 28, 7, c.a);
        p(bx + 2, by - 8, 28, 1, c.L);
        p(bx + 1, by - 28, 30, 19, c.k);
        p(bx + 2, by - 27, 28, 17, "#bfe3ff");
        p(bx + 2, by - 23, 28, 13, "#82cbff");
        p(bx + 2, by - 12, 28, 2, "#e9d6a8"); // 모래
        p(bx + 6, by - 18, 2, 6, "#2fae91"); // 수초
        p(bx + 24, by - 20, 2, 8, "#2fae91");
        p(bx + 12, by - 19, 4, 2, "#ff8a3d"); // 물고기
        p(bx + 16, by - 20, 2, 4, "#ff8a3d");
        p(bx + 19, by - 15, 3, 2, "#ffd84a");
        p(bx + 4, by - 26, 4, 1, W);
      } },
    globe: { name: "지구본", kind: "floor", w: 1, h: 1, vh: 1.6, grade: 1,
      draw(p, bx, by, c) {
        p(bx + 4, by - 3, 8, 3, c.A);
        p(bx + 7, by - 8, 2, 5, c.A);
        p(bx + 3, by - 24, 10, 1, c.k);
        p(bx + 2, by - 23, 12, 13, c.k);
        p(bx + 3, by - 22, 10, 11, "#4dabf7");
        p(bx + 4, by - 21, 4, 3, "#69db7c");
        p(bx + 8, by - 17, 4, 4, "#69db7c");
        p(bx + 5, by - 14, 2, 2, "#69db7c");
        p(bx + 1, by - 22, 1, 12, c.a); // 고리
        p(bx + 14, by - 22, 1, 12, c.a);
        p(bx + 3, by - 10, 10, 1, c.a);
      } },
    piano: { name: "피아노", kind: "floor", w: 2, h: 1, vh: 2.1, grade: 2,
      draw(p, bx, by, c) {
        p(bx, by - 33, 32, 33, c.k);
        p(bx + 1, by - 32, 30, 16, c.a);
        p(bx + 3, by - 30, 26, 2, c.L);
        p(bx + 1, by - 16, 30, 6, W); // 건반
        for (let i = 0; i < 9; i++) p(bx + 3 + i * 3.2, by - 16, 2, 3, K);
        p(bx + 1, by - 10, 30, 7, c.A);
        p(bx + 3, by - 3, 3, 3, c.A);
        p(bx + 26, by - 3, 3, 3, c.A);
        p(bx + 12, by - 27, 8, 5, "#fff8e1"); // 악보
      } },
    arcade: { name: "오락기", kind: "floor", w: 1, h: 1, vh: 2.2, grade: 2,
      draw(p, bx, by, c) {
        p(bx + 1, by - 35, 14, 35, c.k);
        p(bx + 2, by - 34, 12, 33, c.a);
        p(bx + 2, by - 34, 12, 4, c.A);
        p(bx + 3, by - 28, 10, 9, K); // 화면
        const t = (Date.now() / 300) | 0;
        p(bx + 4 + (t % 6), by - 26, 2, 2, "#ffd84a");
        p(bx + 9, by - 23, 2, 2, "#e8505b");
        p(bx + 4, by - 22, 3, 1, "#69db7c");
        p(bx + 2, by - 17, 12, 4, c.L);
        p(bx + 4, by - 18, 2, 3, "#e8505b"); // 조이스틱
        p(bx + 9, by - 16, 2, 2, "#2a86ff");
        p(bx + 12, by - 16, 1, 1, "#ffd84a");
      } },
    telescope: { name: "망원경", kind: "floor", w: 1, h: 1, vh: 2, grade: 2,
      draw(p, bx, by, c) {
        p(bx + 3, by - 12, 2, 12, K);
        p(bx + 11, by - 12, 2, 12, K);
        p(bx + 7, by - 12, 2, 12, K);
        p(bx + 5, by - 15, 6, 4, c.A);
        // 비스듬한 통
        for (let i = 0; i < 9; i++) p(bx + 2 + i, by - 17 - i * 1.6, 5, 4, i % 4 === 0 ? c.k : c.a);
        p(bx + 11, by - 31, 4, 3, c.L);
      } },
    rocket: { name: "로켓 모형", kind: "floor", w: 1, h: 1, vh: 2.2, grade: 3,
      draw(p, bx, by, c) {
        p(bx + 3, by - 3, 10, 3, K);
        p(bx + 6, by - 35, 4, 2, c.a);
        p(bx + 5, by - 33, 6, 24, c.k);
        p(bx + 6, by - 32, 4, 23, W);
        p(bx + 6, by - 26, 4, 4, "#4dabf7"); // 창
        p(bx + 7, by - 25, 1, 1, W);
        p(bx + 3, by - 14, 3, 6, c.a); // 날개
        p(bx + 10, by - 14, 3, 6, c.a);
        p(bx + 6, by - 9, 4, 2, c.A);
        const f = ((Date.now() / 150) | 0) % 2;
        p(bx + 7, by - 7, 2, 2 + f, "#ff8a3d"); // 불꽃
        p(bx + 7, by - 7, 2, 1, "#ffd84a");
      } },
    poster: { name: "포스터", kind: "wall", w: 1, grade: 0,
      draw(p, x0, y0, c) {
        p(x0 + 2, 9, 12, 18, c.k);
        p(x0 + 3, 10, 10, 16, c.a);
        p(x0 + 7, 13, 2, 2, W);
        p(x0 + 5, 15, 6, 2, W);
        p(x0 + 6, 17, 4, 2, W);
        p(x0 + 5, 19, 2, 2, W);
        p(x0 + 9, 19, 2, 2, W);
        p(x0 + 4, 23, 8, 1, c.L);
        p(x0 + 6, 8, 4, 2, "#ffe08a"); // 테이프
      } },
    clock: { name: "벽시계", kind: "wall", w: 1, grade: 1,
      draw(p, x0, y0, c) {
        p(x0 + 3, 10, 10, 1, c.k);
        p(x0 + 2, 11, 12, 10, c.k);
        p(x0 + 3, 21, 10, 1, c.k);
        p(x0 + 3, 11, 10, 10, c.a);
        p(x0 + 4, 12, 8, 8, W);
        const m = ((Date.now() / 1000) | 0) % 4;
        p(x0 + 7, 13, 2, 3, K);
        p(x0 + 8 + (m === 1 ? 1 : 0), 15, m === 0 || m === 2 ? 3 : 2, 2, K);
        p(x0 + 7, 15, 2, 2, "#e8505b");
      } },
    shelf: { name: "벽 선반", kind: "wall", w: 2, grade: 0,
      draw(p, x0, y0, c) {
        p(x0 + 2, 24, 28, 3, c.k);
        p(x0 + 3, 24, 26, 2, c.a);
        p(x0 + 5, 27, 2, 3, c.A);
        p(x0 + 25, 27, 2, 3, c.A);
        p(x0 + 5, 17, 5, 7, "#ffffff"); // 컵
        p(x0 + 5, 18, 5, 2, "#e8505b");
        p(x0 + 13, 15, 3, 9, "#2fae91"); // 책
        p(x0 + 16, 16, 3, 8, "#ffc93c");
        p(x0 + 22, 18, 5, 6, "#ff8fb1"); // 화분
        p(x0 + 23, 14, 3, 4, "#2fae91");
      } },
    neon: { name: "하트 네온", kind: "wall", w: 1, grade: 2,
      draw(p, x0, y0, c) {
        const on = ((Date.now() / 700) | 0) % 5 !== 0;
        const col = on ? c.a : c.A;
        p(x0 + 2, 10, 12, 14, "rgba(43,35,32,0.85)");
        p(x0 + 4, 13, 3, 1, col);
        p(x0 + 9, 13, 3, 1, col);
        p(x0 + 3, 14, 1, 3, col);
        p(x0 + 12, 14, 1, 3, col);
        p(x0 + 7, 14, 2, 1, col);
        p(x0 + 4, 17, 1, 2, col);
        p(x0 + 11, 17, 1, 2, col);
        p(x0 + 5, 19, 1, 1, col);
        p(x0 + 10, 19, 1, 1, col);
        p(x0 + 6, 20, 1, 1, col);
        p(x0 + 9, 20, 1, 1, col);
        p(x0 + 7, 21, 2, 1, col);
        if (on) p(x0 + 2, 10, 12, 14, "rgba(255,255,255,0.06)");
      } },
    // 방 전체: 벽지·바닥 (적용형)
    wallPlain: { name: "단색 벽지", kind: "wallpaper", grade: 0 },
    wallStripe: { name: "줄무늬 벽지", kind: "wallpaper", grade: 0 },
    wallDot: { name: "물방울 벽지", kind: "wallpaper", grade: 1 },
    floorCheck: { name: "체크 바닥", kind: "flooring", grade: 0 },
    floorWood: { name: "나무 바닥", kind: "flooring", grade: 0 },
    floorStar: { name: "별 타일 바닥", kind: "flooring", grade: 1 },
  };

  const ITEMS = {};
  Object.keys(KINDS).forEach((kid) => {
    const k = KINDS[kid];
    Object.keys(COLORS).forEach((color) => {
      const id = "in." + kid + "." + color;
      ITEMS[id] = {
        id: id,
        slot: "interior",
        kindId: kid,
        kind: k.kind,
        color: color,
        grade: Math.min(3, k.grade + COLORS[color].bonus),
        name: COLORS[color].name + " " + k.name,
      };
    });
  });

  // 레벨업 자동 해금 (옷과 별도 목록)
  const LEVEL_REWARDS = {
    3: "in.beanbag.sky",
    6: "in.lamp.yellow",
    8: "in.poster.mint",
    11: "in.sofa.coral",
    14: "in.wallStripe.sky",
    16: "in.floorWood.yellow",
    22: "in.aquarium.sky",
    35: "in.piano.navy",
    45: "in.rocket.gold",
  };

  // 벽지 그리기: 벽 영역(0~h) 전체
  function drawWallpaper(p, id, w, h) {
    const it = ITEMS[id];
    if (!it) return false;
    const c = palette(it.color);
    const base = typeof c.L === "function" ? c.L : () => c.L;
    for (let y = 0; y < h; y++) p(0, y, w, 1, typeof c.L === "function" ? c.L(0, y) : c.L);
    if (it.kindId === "wallStripe") {
      for (let x = 0; x < w; x += 8) p(x, 0, 3, h, typeof c.a === "function" ? c.a(x, 0) : lighten(c.a, 0.2));
    } else if (it.kindId === "wallDot") {
      for (let y = 4; y < h; y += 8)
        for (let x = (y / 8) % 2 ? 0 : 4; x < w; x += 8) p(x, y, 2, 2, typeof c.a === "function" ? c.a(x, y) : c.a);
    } else {
      for (let x = 7; x < w; x += 8) p(x, 0, 1, h, typeof c.A === "function" ? c.A(x, 0) : lighten(c.A, 0.6));
    }
    void base;
    return true;
  }

  // 바닥 그리기: 바닥 영역 (y0 부터 h 만큼)
  function drawFlooring(p, id, w, y0, h, T) {
    const it = ITEMS[id];
    if (!it) return false;
    const c = palette(it.color);
    const col = (k, x, y) => (typeof c[k] === "function" ? c[k](x, y) : c[k]);
    if (it.kindId === "floorWood") {
      for (let y = y0; y < y0 + h; y += 6) {
        p(0, y, w, 6, col("L", 0, y));
        p(0, y + 5, w, 1, col("A", 0, y));
        for (let x = ((y - y0) / 6) % 2 ? 10 : 22; x < w; x += 24) p(x, y, 1, 5, col("A", x, y));
      }
    } else if (it.kindId === "floorStar") {
      for (let y = y0; y < y0 + h; y += T)
        for (let x = 0; x < w; x += T) {
          p(x, y, T, T, (x / T + (y - y0) / T) % 2 ? col("L", x, y) : lighten(typeof c.a === "function" ? "#ffffff" : c.a, 0.7));
          p(x + 7, y + 5, 2, 6, "rgba(255,255,255,0.8)");
          p(x + 5, y + 7, 6, 2, "rgba(255,255,255,0.8)");
        }
    } else {
      for (let y = y0; y < y0 + h; y += T / 2)
        for (let x = 0; x < w; x += T / 2) p(x, y, T / 2, T / 2, (x / (T / 2) + (y - y0) / (T / 2)) % 2 ? col("L", x, y) : lighten(typeof c.a === "function" ? "#ffffff" : c.a, 0.75));
    }
    return true;
  }

  // 바닥 가구·벽 장식 그리기
  function drawItem(p, id, bx, by) {
    const it = ITEMS[id];
    if (!it) return;
    const k = KINDS[it.kindId];
    if (!k.draw) return;
    const c = palette(it.color);
    // 색이 함수(무지개)면 칸 위치로 계산
    const pp = (x, y, w, h, col) => p(x, y, w, h, typeof col === "function" ? col(x, y) : col);
    k.draw(pp, bx, by, c);
  }

  window.INTERIOR_PARTS = {
    COLORS: COLORS,
    KINDS: KINDS,
    ITEMS: ITEMS,
    LEVEL_REWARDS: LEVEL_REWARDS,
    drawItem: drawItem,
    drawWallpaper: drawWallpaper,
    drawFlooring: drawFlooring,
    colorHex: (color) => {
      const h = (COLORS[color] || COLORS.gray).hex;
      return h === "rainbow" ? RAINBOW[0] : h;
    },
  };
})();
