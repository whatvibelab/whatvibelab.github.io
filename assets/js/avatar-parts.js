/* ==========================================================================
   avatar-parts.js — 내 연구원 꾸미기 파츠 (dev.md #57)

   파츠 5종(머리·머리 장식·안경·옷·효과) × 색 조합 = 아이템. 아이템 id = "부위.모양.색" (예: hair.long.pink).
   등급(0 일반 · 1 레어 · 2 유니크 · 3 전설) = 모양 기본 등급 + 색 보너스(최대 3).
   그림은 16×16 도트 격자. 글자 = 색 채널:
     k 외곽선 · s 피부 · r 볼 · p 바지 · 머리는 h(머리색) · 옷은 w(주색) g(그림자) b(포인트) W(흰색)
     장식·안경·효과는 a(주색) A(진한 색) W(흰색) y(노랑)
   이 파일은 데이터와 그리기만. 보유·가챠 로직은 profile.js.
   ========================================================================== */

(function () {
  "use strict";

  const GRADES = [
    { id: 0, name: "일반", color: "#8a7d74", bg: "#f1ece6" },
    { id: 1, name: "레어", color: "#1d6fdc", bg: "#e3f1ff" },
    { id: 2, name: "유니크", color: "#8a4fd8", bg: "#efe6fb" },
    { id: 3, name: "전설", color: "#d18b00", bg: "#fff1c7" },
  ];

  // 색 — bonus 가 등급에 더해진다. rainbow 는 줄마다 다른 색.
  const COLORS = {
    brown: { name: "갈색", hex: "#6e4830", bonus: 0 },
    black: { name: "검정", hex: "#2f2a2e", bonus: 0 },
    blonde: { name: "금발", hex: "#e9b949", bonus: 0 },
    red: { name: "빨강", hex: "#c8553d", bonus: 0 },
    pink: { name: "분홍", hex: "#f08fb0", bonus: 0 },
    mint: { name: "민트", hex: "#4fc3a1", bonus: 0 },
    sky: { name: "하늘", hex: "#6cb8f5", bonus: 0 },
    navy: { name: "남색", hex: "#34406b", bonus: 0 },
    silver: { name: "은색", hex: "#c9ced6", bonus: 1 },
    white: { name: "흰색", hex: "#ffffff", bonus: 0 },
    gray: { name: "회색", hex: "#9aa1ab", bonus: 0 },
    coral: { name: "코랄", hex: "#ff8a6b", bonus: 0 },
    yellow: { name: "노랑", hex: "#ffd84a", bonus: 0 },
    purple: { name: "보라", hex: "#a27be0", bonus: 0 },
    gold: { name: "황금", hex: "#f2b632", bonus: 1 },
    rainbow: { name: "무지개", hex: "rainbow", bonus: 2 },
  };
  const RAINBOW = ["#ff6b6b", "#ffa94d", "#ffd84a", "#69db7c", "#4dabf7", "#9775fa", "#f783ac"];

  // ---------- 부위별 모양 ----------
  // 머리: head = 0~8행 전체(얼굴 포함), over = 몸통 위에 덧그리는 칸 [행, 열, 글자]
  const HAIR = {
    short: { name: "짧은 머리", grade: 0, head: [
      "................", ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhk...", "...khhhhhhhhk...",
      "...khsssssshk...", "...kskssssksk...", "...krssssssrk...", "....kssssssk...."] },
    bob: { name: "단발", grade: 0, wideShoulder: true, head: [
      "................", ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhk...", "..khhhhhhhhhhk..",
      "..khhsssshhhhk..", "..khskssssks" + "hk..", "..khrssssssrhk..", "..khkssssssk" + "hk.."] },
    bun: { name: "똥머리", grade: 0, head: [
      "......kkkk......", ".....khhhhk.....", "....kkhhhhkk....", "...khhhhhhhhk...", "...khhhhhhhhk...",
      "...khhsssshhk...", "...kskssssksk...", "...krssssssrk...", "....kssssssk...."] },
    long: { name: "긴 머리", grade: 0, head: [
      "................", ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhk...", "..khhhhhhhhhhk..",
      "..khsssssssshk..", "..khskssssks" + "hk..", "..khrssssssrhk..", "..khkssssssk" + "hk.."],
      over: [[9, 2, "k"], [9, 3, "h"], [10, 2, "k"], [10, 3, "h"], [11, 2, "k"], [11, 3, "h"], [12, 2, "k"], [12, 3, "k"],
             [9, 12, "h"], [9, 13, "k"], [10, 12, "h"], [10, 13, "k"], [11, 13, "k"], [12, 12, "k"], [12, 13, "k"]] },
    ponytail: { name: "포니테일", grade: 1, head: [
      "................", ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhkk..", "...khhhhhhhhkhk.",
      "...khsssssshkhk.", "...kskssssksk.hk", "...krssssssrk.hk", "....kssssssk..k."] },
    twin: { name: "양갈래", grade: 1, head: [
      "................", ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhk...", "..kkhhhhhhhhkk..", ".khkhsssssshkhk.", ".khksksssskskhk.", ".khkrssssssrkhk.", "..k.kssssssk.k.."] },
    curly: { name: "곱슬 머리", grade: 1, head: [
      ".....k.kk.k.....", "...kkhkhhkhkk...", "..khhhhhhhhhhk..", "..khhhhhhhhhhk..", "..khhhhhhhhhhk..",
      "..khhsssssshhk..", "...kskssssksk...", "...krssssssrk...", "....kssssssk...."] },
    odango: { name: "만두 머리", grade: 2, head: [
      "..kk........kk..", ".khhk.kkkk.khhk.", ".khhkkhhhhkkhhk.", "..kkhhhhhhhhkk..", "...khhhhhhhhk...",
      "...khsssssshk...", "...kskssssksk...", "...krssssssrk...", "....kssssssk...."] },
  };
  const HAIR_COLORS = ["brown", "black", "blonde", "red", "pink", "mint", "sky", "silver", "rainbow"];

  // 몸(9~15행). 옷이 9~13행, 14~15행은 바지·신발 공통.
  const LEGS = ["....kppkkppk....", "....kkk..kkk...."];
  const OUTFIT = {
    labcoat: { name: "연구 가운", grade: 0, accent: "#2a86ff", rows: [
      "....kgwwwwgk....", "...kwwwwwwbwk...", "..kswwwwwwwwsk..", "..kswwwwwwwwsk..", "...kgwwwwwwgk..."] },
    hoodie: { name: "후드티", grade: 0, rows: [
      "....kgwwwwgk....", "...kwwWwwWwwk...", "..kswwWwwWwwsk..", "..kswwggggwwsk..", "...kgwwwwwwgk..."] },
    stripe: { name: "줄무늬 티", grade: 0, rows: [
      "....kgwwwwgk....", "...kWWWWWWWWk...", "..kswwwwwwwwsk..", "..ksWWWWWWWWsk..", "...kgwwwwwwgk..."] },
    overall: { name: "멜빵바지", grade: 1, rows: [
      "....kWWWWWWk....", "...kWbWWWWbWk...", "..ksWbwwwwbWsk..", "..ksWwwbbwwWsk..", "...kwwwwwwwwk..."] },
    sweater: { name: "하트 니트", grade: 1, accent: "#ff6b8b", rows: [
      "....kgwwwwgk....", "...kwwwwwwwwk...", "..kswwbbwbbwsk..", "..kswwwbbbwwsk..", "...kgwwbwwwgk..."] },
    sailor: { name: "세일러 칼라", grade: 1, accent: "#e8505b", rows: [
      "....kWWWWWWk....", "...kWWWbbWWWk...", "..kswWwbbwWwsk..", "..kswwwwwwwwsk..", "...kgwwwwwwgk..."] },
    tuxedo: { name: "턱시도", grade: 2, accent: "#e8505b", rows: [
      "....kwWWWWwk....", "...kwwWbbWwwk...", "..kswwWWWWwwsk..", "..kswwWkkWwwsk..", "...kgwwWWwwgk..."] },
    cape: { name: "별빛 망토", grade: 3, accent: "#ffd84a", rows: [
      "...kwwwwwwwwk...", "..kwwwwwwwbwwk..", ".kwwswwwwwwswwk.", ".kwwbwwwwwwwwwk.", "..kgwwwwwwwwgk.."] },
  };
  const OUTFIT_COLORS = ["white", "gray", "sky", "mint", "coral", "yellow", "navy", "pink", "purple", "gold", "rainbow"];

  // 머리 장식: [행, 열, 글자]
  const ACC = {
    pin: { name: "머리핀", grade: 0, px: [[4, 11, "a"], [4, 12, "a"], [3, 12, "A"]] },
    ribbon: { name: "리본", grade: 0, px: [[1, 3, "a"], [2, 3, "a"], [3, 3, "a"], [2, 4, "A"], [1, 5, "a"], [2, 5, "a"], [3, 5, "a"]] },
    headband: { name: "머리띠", grade: 0, px: [[2, 4, "a"], [2, 5, "a"], [2, 6, "a"], [2, 7, "a"], [2, 8, "a"], [2, 9, "a"], [2, 10, "a"], [2, 11, "a"], [1, 5, "A"], [1, 10, "A"]] },
    flower: { name: "꽃 장식", grade: 1, px: [[2, 12, "a"], [3, 11, "a"], [3, 12, "y"], [3, 13, "a"], [4, 12, "a"]] },
    catears: { name: "고양이 귀", grade: 1, px: [[0, 4, "a"], [1, 4, "A"], [1, 3, "a"], [0, 11, "a"], [1, 11, "A"], [1, 12, "a"]] },
    star: { name: "별 핀", grade: 1, px: [[2, 3, "a"], [3, 2, "a"], [3, 3, "W"], [3, 4, "a"], [4, 3, "a"]] },
    crown: { name: "왕관", grade: 2, px: [[0, 5, "a"], [0, 8, "a"], [0, 10, "a"], [1, 5, "a"], [1, 6, "a"], [1, 7, "A"], [1, 8, "a"], [1, 9, "a"], [1, 10, "a"], [0, 7, "a"]] },
    halo: { name: "천사 고리", grade: 3, px: [[0, 5, "a"], [0, 6, "W"], [0, 7, "a"], [0, 8, "a"], [0, 9, "W"], [0, 10, "a"]] },
  };
  const ACC_COLORS = ["coral", "pink", "yellow", "mint", "sky", "white", "gold"];

  // 안경 (눈은 6행 5·10열)
  const GLASSES = {
    round: { name: "동그란 안경", grade: 0, px: [[5, 5, "a"], [6, 4, "a"], [6, 6, "a"], [7, 5, "a"], [5, 10, "a"], [6, 9, "a"], [6, 11, "a"], [7, 10, "a"], [6, 7, "a"], [6, 8, "a"]] },
    square: { name: "네모 안경", grade: 0, px: [[5, 4, "a"], [5, 5, "a"], [5, 6, "a"], [6, 4, "a"], [6, 6, "a"], [5, 9, "a"], [5, 10, "a"], [5, 11, "a"], [6, 9, "a"], [6, 11, "a"], [5, 7, "a"], [5, 8, "a"]] },
    sunglasses: { name: "선글라스", grade: 1, px: [[5, 4, "a"], [5, 5, "a"], [5, 6, "a"], [6, 4, "A"], [6, 5, "A"], [6, 6, "A"], [5, 9, "a"], [5, 10, "a"], [5, 11, "a"], [6, 9, "A"], [6, 10, "A"], [6, 11, "A"], [5, 7, "a"], [5, 8, "a"]] },
    monocle: { name: "외알 안경", grade: 1, px: [[5, 10, "a"], [6, 9, "a"], [6, 11, "a"], [7, 10, "a"], [8, 11, "y"], [9, 11, "y"]] },
    heart: { name: "하트 안경", grade: 2, px: [[5, 4, "a"], [5, 6, "a"], [6, 4, "a"], [6, 5, "A"], [6, 6, "a"], [7, 5, "a"], [5, 9, "a"], [5, 11, "a"], [6, 9, "a"], [6, 10, "A"], [6, 11, "a"], [7, 10, "a"], [6, 7, "a"], [6, 8, "a"]] },
    stars: { name: "별 안경", grade: 2, px: [[5, 5, "a"], [6, 4, "a"], [6, 5, "A"], [6, 6, "a"], [7, 5, "a"], [5, 10, "a"], [6, 9, "a"], [6, 10, "A"], [6, 11, "a"], [7, 10, "a"], [6, 7, "a"], [6, 8, "a"]] },
  };
  const GLASSES_COLORS = ["black", "brown", "red", "sky", "pink", "gold"];

  // 효과: 애니메이션 (frame 에 따라 그림이 바뀜). 기본 등급 1 이상.
  const EFFECT = {
    sparkle: { name: "반짝이", grade: 1 },
    hearts: { name: "하트 뿅뿅", grade: 1 },
    bubbles: { name: "비눗방울", grade: 1 },
    notes: { name: "음표", grade: 2 },
    petals: { name: "꽃잎", grade: 2 },
    snow: { name: "눈송이", grade: 2 },
    orbit: { name: "별 궤도", grade: 3 },
    aura: { name: "오라", grade: 3 },
  };
  const EFFECT_COLORS = ["yellow", "pink", "sky", "rainbow"];

  const SLOTS = [
    { id: "hair", name: "머리", shapes: HAIR, colors: HAIR_COLORS, required: true },
    { id: "acc", name: "머리 장식", shapes: ACC, colors: ACC_COLORS },
    { id: "glasses", name: "안경", shapes: GLASSES, colors: GLASSES_COLORS },
    { id: "outfit", name: "옷", shapes: OUTFIT, colors: OUTFIT_COLORS, required: true },
    { id: "effect", name: "효과", shapes: EFFECT, colors: EFFECT_COLORS },
  ];

  // 전체 아이템 목록
  const ITEMS = {};
  SLOTS.forEach((slot) => {
    Object.keys(slot.shapes).forEach((shape) => {
      slot.colors.forEach((color) => {
        const id = slot.id + "." + shape + "." + color;
        const grade = Math.min(3, slot.shapes[shape].grade + COLORS[color].bonus);
        ITEMS[id] = { id: id, slot: slot.id, shape: shape, color: color, grade: grade, name: COLORS[color].name + " " + slot.shapes[shape].name };
      });
    });
  });

  // 처음부터 가진 것 + 레벨업 자동 해금 (예전 가운 색 해금은 그대로 이어짐)
  const STARTER = ["hair.short.brown", "hair.bob.brown", "hair.bun.brown", "outfit.labcoat.white"];
  const LEVEL_REWARDS = {
    2: "hair.long.brown", 3: "acc.ribbon.coral", 4: "glasses.round.black", 5: "outfit.labcoat.sky",
    6: "outfit.hoodie.mint", 7: "hair.ponytail.brown", 8: "acc.headband.sky", 9: "glasses.square.brown",
    10: "outfit.labcoat.mint", 12: "effect.sparkle.yellow", 15: "hair.twin.black", 18: "acc.flower.pink",
    20: "outfit.labcoat.coral", 25: "acc.crown.gold", 30: "outfit.labcoat.gold", 40: "effect.orbit.rainbow",
    50: "outfit.labcoat.rainbow",
  };

  // 가챠 (ideas.md §9 — 숫자는 조정 가능)
  const GACHA = {
    xpPerTicket: 100,
    rates: [0.7, 0.22, 0.07, 0.01], // 일반·레어·유니크·전설
    exchangeCost: 10, // 같은 등급 남는 아이템 10개 → 1회
    upgradeRate: [0.2, 0.15, 0.1, 0], // 교환 뽑기에서 한 단계 위가 나올 확률
  };

  // ---------- 그리기 ----------
  function hexDarken(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function colorAt(color, row, shade) {
    const c = COLORS[color] || COLORS.white;
    const hex = c.hex === "rainbow" ? RAINBOW[((row % RAINBOW.length) + RAINBOW.length) % RAINBOW.length] : c.hex;
    return shade ? hexDarken(hex, shade) : hex;
  }

  const BASE = { k: "#2b2320", s: "#f5c9a8", r: "#ff9e8a", p: "#4a5568", W: "#ffffff", y: "#ffd84a" };

  function parse(id) {
    if (!id) return null;
    const it = ITEMS[id];
    return it || null;
  }

  // wear = { hair, acc, glasses, outfit, effect } (아이템 id), hand = 손 소품 그리기 함수(선택)
  function paint(ctx, wear, ox, oy, frame, hand) {
    frame = frame || 0;
    const hair = parse(wear.hair) || ITEMS["hair.bob.brown"];
    const outfit = parse(wear.outfit) || ITEMS["outfit.labcoat.white"];
    const H = HAIR[hair.shape];
    const O = OUTFIT[outfit.shape];
    const grid = [];
    const col = []; // 칸별 실제 색
    for (let y = 0; y < 16; y++) {
      grid.push(new Array(16).fill("."));
      col.push(new Array(16).fill(null));
    }
    const set = (y, x, c) => {
      if (y < 0 || y > 15 || x < 0 || x > 15) return;
      col[y][x] = c;
      grid[y][x] = "#";
    };
    // 몸(옷)
    const body = O.rows.concat(LEGS);
    body.forEach((row, i) => {
      const y = 9 + i;
      row.split("").forEach((ch, x) => {
        if (ch === ".") return;
        let c;
        if (ch === "w") c = colorAt(outfit.color, y, 0);
        else if (ch === "g") c = colorAt(outfit.color, y, 0.8);
        else if (ch === "b") c = outfit.color === "rainbow" ? "#ffffff" : O.accent || colorAt(outfit.color, y, 0.6);
        else c = BASE[ch];
        set(y, x, c);
      });
    });
    // 단발 계열은 어깨선이 넓다
    if (H.wideShoulder) {
      set(9, 2, BASE.k);
      set(9, 3, BASE.k);
      set(9, 12, BASE.k);
      set(9, 13, BASE.k);
    }
    // 머리(얼굴 포함)
    H.head.forEach((row, y) => {
      row.split("").forEach((ch, x) => {
        if (ch === ".") return;
        set(y, x, ch === "h" ? colorAt(hair.color, y, 0) : BASE[ch]);
      });
    });
    (H.over || []).forEach(([y, x, ch]) => set(y, x, ch === "h" ? colorAt(hair.color, y, 0) : BASE[ch]));
    // 머리 장식·안경
    [parse(wear.acc), parse(wear.glasses)].forEach((it) => {
      if (!it) return;
      const shape = it.slot === "acc" ? ACC[it.shape] : GLASSES[it.shape];
      shape.px.forEach(([y, x, ch]) => {
        let c;
        if (ch === "a") c = colorAt(it.color, x, 0);
        else if (ch === "A") c = colorAt(it.color, x, 0.7);
        else c = BASE[ch];
        set(y, x, c);
      });
    });
    // 손 소품 (profile-data.js items, 기존 방식)
    if (hand) hand(set);

    const effect = parse(wear.effect);
    // 오라는 몸 뒤에
    if (effect && effect.shape === "aura") {
      const glow = colorAt(effect.color, frame >> 2, 0);
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(frame / 6);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (grid[y][x] !== ".") continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx] === "#");
          if (near) {
            ctx.fillStyle = glow;
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      ctx.globalAlpha = 1;
    }
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if (!col[y][x]) continue;
        ctx.fillStyle = col[y][x];
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    if (effect && effect.shape !== "aura") drawEffect(ctx, effect, ox, oy, frame);
  }

  function drawEffect(ctx, it, ox, oy, f) {
    const p = (x, y, c, a) => {
      if (x < 0 || x > 15 || y < 0 || y > 15) return;
      ctx.globalAlpha = a == null ? 1 : a;
      ctx.fillStyle = c;
      ctx.fillRect(ox + Math.round(x), oy + Math.round(y), 1, 1);
      ctx.globalAlpha = 1;
    };
    const c = (i) => colorAt(it.color, i, 0);
    switch (it.shape) {
      case "sparkle": {
        const spots = [[1, 2], [14, 4], [0, 11], [15, 13], [13, 0]];
        spots.forEach(([x, y], i) => {
          const on = (f + i * 5) % 20 < 10;
          p(x, y, c(i));
          if (on) {
            p(x - 1, y, c(i), 0.8);
            p(x + 1, y, c(i), 0.8);
            p(x, y - 1, c(i), 0.8);
            p(x, y + 1, c(i), 0.8);
          }
        });
        break;
      }
      case "hearts": {
        [0, 13].forEach((x, i) => {
          const y = 14 - ((f / 2 + i * 7) % 14);
          const col = c(i + Math.floor(f / 8));
          p(x, y, col);
          p(x + 2, y, col);
          p(x, y + 1, col);
          p(x + 1, y + 1, col);
          p(x + 2, y + 1, col);
          p(x + 1, y + 2, col);
        });
        break;
      }
      case "bubbles": {
        [[1, 0], [14, 6], [2, 9]].forEach(([x, k], i) => {
          const y = 15 - ((f / 3 + k * 2) % 16);
          p(x, y - 1, c(i), 0.7);
          p(x - 1, y, c(i), 0.7);
          p(x + 1, y, c(i), 0.7);
          p(x, y + 1, c(i), 0.7);
          p(x, y, "#ffffff", 0.6);
        });
        break;
      }
      case "notes": {
        [[1, 0], [13, 8]].forEach(([x, k], i) => {
          const y = 6 + Math.round(Math.sin((f + k * 4) / 6) * 2);
          p(x, y + 2, c(i));
          p(x + 1, y + 2, c(i));
          p(x + 1, y + 1, c(i));
          p(x + 1, y, c(i));
          p(x + 2, y, c(i));
        });
        break;
      }
      case "petals": {
        [[2, 0], [12, 5], [7, 10], [14, 13]].forEach(([x, k], i) => {
          const y = (f / 3 + k) % 16;
          const xx = x + Math.round(Math.sin((f + k * 3) / 5));
          p(xx, y, c(i));
          p(xx + 1, y, c(i), 0.6);
        });
        break;
      }
      case "snow": {
        [[1, 0], [6, 7], [11, 3], [14, 11], [3, 12]].forEach(([x, k], i) => {
          const y = (f / 4 + k) % 16;
          p(x + Math.round(Math.sin((f + k) / 6)), y, c(i) === "#ffffff" ? "#dfe9f5" : c(i));
        });
        break;
      }
      case "orbit": {
        for (let i = 0; i < 2; i++) {
          const a = f / 8 + i * Math.PI;
          const x = 7.5 + Math.cos(a) * 7;
          const y = 7 + Math.sin(a) * 3;
          const col = c(i + Math.floor(f / 6));
          p(x, y, col);
          p(x - 1, y, col, 0.7);
          p(x + 1, y, col, 0.7);
          p(x, y - 1, col, 0.7);
          p(x, y + 1, col, 0.7);
        }
        break;
      }
      default:
        break;
    }
  }

  window.AVATAR_PARTS = {
    GRADES: GRADES,
    COLORS: COLORS,
    SLOTS: SLOTS,
    ITEMS: ITEMS,
    STARTER: STARTER,
    LEVEL_REWARDS: LEVEL_REWARDS,
    GACHA: GACHA,
    HAIR: HAIR,
    OUTFIT: OUTFIT,
    ACC: ACC,
    GLASSES: GLASSES,
    EFFECT: EFFECT,
    paint: paint,
    colorHex: (color) => colorAt(color, 3, 0),
  };
})();
