/* ==========================================================================
   profile.js — "내 연구원": 아바타·칭호·경험치·레벨·출석·상장 (dev.md #52, ideas.md §8)

   - 데이터(문구·규칙·도트)는 profile-data.js(window.PROFILE_DATA).
   - 기록은 이 기기 브라우저(localStorage "musunsang_profile")에만. 서버 전송 없음.
     완료 기록은 engine.js 가 쓰는 "musunsang_archive"를 함께 쓴다.
   - 저장소가 막힌 환경(시크릿 등)에서도 그 방문 동안은 메모리로 동작한다.
   - engine.js 는 window.Profile 이 있을 때만 recordResult / renderReward 를 부른다.
     (이 파일이 없으면 테스트 화면은 예전과 똑같다.)
   - 로드: tools/build-static.js 가 홈·테스트·내 연구실 페이지 <head>에 defer 로 넣는다.

   window.Profile
     .ready()                 출석·소급 처리 후 상태 요약을 돌려준다 (여러 번 불러도 한 번만 처리)
     .view()                  화면용 요약 (칭호·레벨·경험치·수집 등)
     .recordResult(id, code)  결과 화면(직접 끝낸 결과)에서 호출 → 보상 정보
     .renderReward(reward)    결과 화면에 보상 띠 표시 (null 이면 숨김)
     .setLook({hair|coat|item})
     .drawAvatar(canvas, look)
   ========================================================================== */

(function () {
  "use strict";

  const D = window.PROFILE_DATA;
  if (!D) return;

  const KEY = "musunsang_profile";
  const ARCHIVE_KEY = "musunsang_archive"; // engine.js·archive.js 와 같은 키
  const HIST_MAX = 1000;
  const NICKNAME_KEY = "musunsang_nickname"; // engine.js 와 같은 키 — 내 연구원 이름 = 테스트 닉네임 (dev.md #55)
  const NICK_MAX = 10;

  function getNick() {
    try {
      return (localStorage.getItem(NICKNAME_KEY) || "").trim();
    } catch (e) {
      return memNick;
    }
  }
  let memNick = "";
  function setNick(name) {
    const v = String(name || "").trim().slice(0, NICK_MAX);
    memNick = v;
    try {
      localStorage.setItem(NICKNAME_KEY, v);
    } catch (e) {
      /* 저장 불가 */
    }
    track("nickname_set", {});
    return v;
  }

  // 이 스크립트 위치로 사이트 루트를 구한다(테스트 페이지는 ../../).
  const ROOT = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/assets\/js\/profile\.js(\?.*)?$/, "") : "";
  })();

  let storageOK = true;
  let state = null;
  let readyInfo = null; // 이번 방문에서 처리된 출석·소급·상장

  // ---------- 저장 ----------
  function blank() {
    return {
      v: 1,
      xp: 0,
      hair: null,
      coat: "white",
      item: null,
      last: null, // { testId, code, date }
      seen: [], // 칭호 도감: 나온 적 있는 유형 코드
      att: { last: null, streak: 0, total: 0, days: [] },
      retake: { date: null, tests: [], xp: 0 },
      earned: [], // [{ id, date }] — 절대 지우지 않음
      hist: [], // [{ t, c, d }] — 나중에 "1년 결산"용 (ideas.md 장기 이용자 후보)
      migrated: false,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s && typeof s === "object" ? Object.assign(blank(), s) : blank();
    } catch (e) {
      storageOK = false;
      return blank();
    }
  }

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOK = true;
    } catch (e) {
      storageOK = false;
    }
  }

  function readArchive() {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      const a = raw ? JSON.parse(raw) : {};
      return a && typeof a === "object" ? a : {};
    } catch (e) {
      return memArchive;
    }
  }
  let memArchive = {};
  function writeArchive(a) {
    memArchive = a;
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a));
    } catch (e) {
      /* 저장 불가 */
    }
  }

  // ---------- 날짜 (이 기기 기준) ----------
  function ymd(d) {
    const p = (n) => (n < 10 ? "0" : "") + n;
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function today() {
    return ymd(new Date());
  }
  function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return ymd(d);
  }

  // ---------- 계산 ----------
  function levelInfo(xp) {
    let level = 1;
    let rest = Math.max(0, xp | 0);
    let need = D.levelBase;
    while (rest >= need) {
      rest -= need;
      level += 1;
      need = D.levelBase + D.levelStep * (level - 1);
    }
    return { level: level, into: rest, need: need, toNext: need - rest };
  }

  function adjective(level) {
    for (let i = 0; i < D.adjectives.length; i++) if (level >= D.adjectives[i].from) return D.adjectives[i].word;
    return "";
  }

  function titleOf(s, level) {
    const t = s.last && D.types[s.last.code];
    return t ? adjective(level) + " " + t.title : D.noTitle;
  }

  function liveTests() {
    return (window.TESTS || []).filter((t) => t.status === "live");
  }

  function newestIds() {
    const live = liveTests();
    return live.slice(-D.xp.newestCount).map((t) => t.id);
  }

  function coatById(id) {
    for (let i = 0; i < D.coats.length; i++) if (D.coats[i].id === id) return D.coats[i];
    return D.coats[0];
  }

  function hasBadge(s, id) {
    return s.earned.some((e) => e.id === id);
  }

  function badgeById(id) {
    for (let i = 0; i < D.badges.length; i++) if (D.badges[i].id === id) return D.badges[i];
    return null;
  }

  // 상장 조건 — 진행도(have/need)를 돌려준다. 조건을 판단할 수 없으면 null.
  function progress(b, s, archive) {
    const done = Object.keys(archive);
    const live = liveTests();
    switch (b.kind) {
      case "count":
        return { have: done.length, need: b.n };
      case "all": {
        if (!live.length) return null;
        return { have: live.filter((t) => archive[t.id]).length, need: live.length };
      }
      case "group": {
        const g = live.filter((t) => t.group === b.group);
        if (!g.length) return null;
        return { have: g.filter((t) => archive[t.id]).length, need: g.length };
      }
      case "streak":
        return { have: s.att.streak, need: b.n };
      case "days":
        return { have: s.att.total, need: b.n };
      case "result": {
        const hit =
          (archive[b.testId] && b.codes.indexOf(archive[b.testId].code) >= 0) ||
          s.hist.some((h) => h.t === b.testId && b.codes.indexOf(h.c) >= 0);
        return { have: hit ? 1 : 0, need: 1 };
      }
      case "test":
        return { have: archive[b.testId] ? 1 : 0, need: 1 };
      case "dex":
        return { have: s.seen.length, need: D.typeOrder.length };
      default:
        return null;
    }
  }

  // 새로 받은 상장을 기록하고(경험치 포함) 목록을 돌려준다.
  function checkBadges(s, archive) {
    const got = [];
    D.badges.forEach((b) => {
      if (hasBadge(s, b.id)) return;
      const p = progress(b, s, archive);
      if (p && p.have >= p.need) {
        s.earned.push({ id: b.id, date: today() });
        s.xp += D.xp.badge;
        got.push(b);
      }
    });
    return got;
  }

  function addSeen(s, code) {
    if (D.types[code] && s.seen.indexOf(code) < 0) s.seen.push(code);
  }

  function addHist(s, testId, code, date) {
    s.hist.push({ t: testId, c: code, d: date });
    if (s.hist.length > HIST_MAX) s.hist.splice(0, s.hist.length - HIST_MAX);
  }

  function track(name, params) {
    if (typeof window.track === "function") window.track(name, params || {});
  }

  // ---------- 방문 처리: 소급 → 출석 → 상장 ----------
  function ready() {
    if (readyInfo) return readyInfo;
    state = load();
    const info = { attendance: null, migrated: null, badges: [], levelBefore: levelInfo(state.xp).level };
    const archive = readArchive();

    // 기존 기록 소급(처음 한 번): 기록된 테스트 수 × 100
    if (!state.migrated) {
      const ids = Object.keys(archive).filter((id) => archive[id] && archive[id].code);
      if (ids.length) {
        const sorted = ids.slice().sort((a, b) => (archive[a].date < archive[b].date ? -1 : 1));
        sorted.forEach((id) => {
          addSeen(state, archive[id].code);
          addHist(state, id, archive[id].code, archive[id].date || today());
        });
        const latest = sorted[sorted.length - 1];
        if (!state.last) state.last = { testId: latest, code: archive[latest].code, date: archive[latest].date };
        const gain = ids.length * D.xp.firstTest;
        state.xp += gain;
        info.migrated = { count: ids.length, xp: gain };
      }
      state.migrated = true;
    }

    // 출석: 오늘 첫 방문이면 지급
    const d = today();
    if (state.att.last !== d) {
      const streak = state.att.last === yesterday() ? state.att.streak + 1 : 1;
      const bonus = Math.min(D.xp.streakStep * (streak - 1), D.xp.streakMax);
      const gain = D.xp.attendance + bonus;
      state.att.last = d;
      state.att.streak = streak;
      state.att.total += 1;
      state.att.days = (state.att.days || []).concat(d).slice(-800); // 달력(내 연구실)에서 지난 달도 보도록 넉넉히
      state.xp += gain;
      info.attendance = { gain: gain, streak: streak, bonus: bonus };
      track("attendance", { streak: streak });
    }

    info.badges = checkBadges(state, archive);
    info.badges.forEach((b) => track("badge_earned", { badge_id: b.id }));
    info.levelAfter = levelInfo(state.xp).level;
    ensureWardrobe();
    info.newItems = grantLevelRewards();
    if (info.levelAfter > info.levelBefore) track("level_up", { level: info.levelAfter });
    save();
    readyInfo = info;
    return info;
  }

  // ---------- 화면용 요약 ----------
  function view() {
    ready();
    const lv = levelInfo(state.xp);
    const archive = readArchive();
    const live = liveTests();
    return {
      storageOK: storageOK,
      xp: state.xp,
      level: lv.level,
      into: lv.into,
      need: lv.need,
      toNext: lv.toNext,
      title: titleOf(state, lv.level),
      hasTitle: !!(state.last && D.types[state.last.code]),
      typeLine: state.last && D.types[state.last.code] ? D.types[state.last.code].line : "",
      collected: live.length ? live.filter((t) => archive[t.id]).length : Object.keys(archive).length,
      liveTotal: live.length,
      att: state.att,
      earned: state.earned.slice(),
      seen: state.seen.slice(),
      look: look(),
      tickets: ticketCount(),
      hairChosen: !!state.hair,
      nextHint: nextHint(archive),
    };
  }

  function look() {
    const lv = levelInfo(state.xp).level;
    let coat = coatById(state.coat);
    if (coat.level > lv) coat = D.coats[0];
    const item = state.item && hasItem(state.item) ? state.item : null;
    ensureWardrobe();
    return { hair: state.hair || D.defaultHair, coat: coat.id, item: item, wear: Object.assign({}, state.wear) };
  }

  // ---------- 옷장·가챠 (dev.md #57, avatar-parts.js) ----------
  const AP = () => window.AVATAR_PARTS;
  const COAT_TO_OUTFIT = { white: "white", sky: "sky", mint: "mint", coral: "coral", gold: "gold", rainbow: "rainbow" };

  // 처음 한 번: 기본 아이템 + 예전 머리·가운 선택을 새 착용 정보로 옮긴다.
  function ensureWardrobe() {
    if (!AP() || !state) return;
    if (!state.inv || typeof state.inv !== "object") state.inv = {};
    AP().STARTER.forEach((id) => {
      if (!state.inv[id]) state.inv[id] = 1;
    });
    // 예전 가운 해금(레벨) → 연구 가운 색
    D.coats.forEach((c) => {
      const id = "outfit.labcoat." + COAT_TO_OUTFIT[c.id];
      if (c.level <= levelInfo(state.xp).level && AP().ITEMS[id] && !state.inv[id]) state.inv[id] = 1;
    });
    if (!state.wear || typeof state.wear !== "object") {
      state.wear = {
        hair: "hair." + (state.hair || D.defaultHair) + ".brown",
        outfit: "outfit.labcoat." + (COAT_TO_OUTFIT[state.coat] || "white"),
        acc: null,
        glasses: null,
        effect: null,
      };
    }
    if (!AP().ITEMS[state.wear.hair] || !state.inv[state.wear.hair]) state.wear.hair = "hair.bob.brown";
    if (!AP().ITEMS[state.wear.outfit] || !state.inv[state.wear.outfit]) state.wear.outfit = "outfit.labcoat.white";
    if (typeof state.ticketsUsed !== "number") state.ticketsUsed = 0;
    if (typeof state.lvGranted !== "number") state.lvGranted = 1;
  }

  // 레벨업 자동 해금: 지금 레벨까지 아직 안 받은 보상을 준다. 새로 받은 아이템 목록을 돌려준다.
  function grantLevelRewards() {
    if (!AP()) return [];
    ensureWardrobe();
    const lv = levelInfo(state.xp).level;
    const got = [];
    for (let l = state.lvGranted + 1; l <= lv; l++) {
      const id = AP().LEVEL_REWARDS[l];
      if (id && AP().ITEMS[id]) {
        if (!state.inv[id]) got.push(AP().ITEMS[id]);
        state.inv[id] = (state.inv[id] || 0) + (state.inv[id] ? 0 : 1);
      }
    }
    if (lv > state.lvGranted) state.lvGranted = lv;
    if (IP()) {
      if (typeof state.lvGrantedIn !== "number") state.lvGrantedIn = 1;
      for (let l = state.lvGrantedIn + 1; l <= lv; l++) {
        const id = IP().LEVEL_REWARDS[l];
        if (id && IP().ITEMS[id] && !state.inv[id]) {
          state.inv[id] = 1;
          got.push(IP().ITEMS[id]);
        }
      }
      if (lv > state.lvGrantedIn) state.lvGrantedIn = lv;
    }
    return got;
  }

  function ticketCount() {
    if (!AP()) return 0;
    ensureWardrobe();
    return Math.max(0, Math.floor(state.xp / AP().GACHA.xpPerTicket) - state.ticketsUsed);
  }

  const IP = () => window.INTERIOR_PARTS;
  function catItems(cat) {
    if (cat === "interior") return IP() ? IP().ITEMS : {};
    return AP().ITEMS;
  }
  function itemsOfGrade(g, cat) {
    return Object.values(catItems(cat)).filter((it) => it.grade === g);
  }
  function itemById(id) {
    return (AP() && AP().ITEMS[id]) || (IP() && IP().ITEMS[id]) || null;
  }

  function rollGrade() {
    const r = Math.random();
    let acc = 0;
    const rates = AP().GACHA.rates;
    for (let g = 0; g < rates.length; g++) {
      acc += rates[g];
      if (r < acc) return g;
    }
    return 0;
  }

  function giveRandom(grade, cat) {
    const pool = itemsOfGrade(grade, cat);
    const it = pool[Math.floor(Math.random() * pool.length)];
    const isNew = !state.inv[it.id];
    state.inv[it.id] = (state.inv[it.id] || 0) + 1;
    return { item: it, isNew: isNew, count: state.inv[it.id] };
  }

  // 뽑기 1회 (뽑기권 1장). cat = "wear"(옷, 기본) | "interior"(가구)
  function pull(cat) {
    ready();
    if (ticketCount() < 1) return null;
    if (cat === "interior" && !IP()) return null;
    state.ticketsUsed += 1;
    const res = giveRandom(rollGrade(), cat);
    save();
    track("gacha_pull", { cat: cat || "wear", grade: res.item.grade, is_new: res.isNew ? 1 : 0 });
    return res;
  }

  // 등급별 남는 아이템(2개 이상 가진 것의 여분) 수
  function extras(grade, cat) {
    ensureWardrobe();
    return itemsOfGrade(grade, cat).reduce((sum, it) => sum + Math.max(0, (state.inv[it.id] || 0) - 1), 0);
  }

  // 같은 등급 여분 10개 → 뽑기 1회. 낮은 확률로 한 단계 위, 실패하면 같은 등급 중 하나.
  function exchange(grade, cat) {
    ready();
    const cost = AP().GACHA.exchangeCost;
    if (extras(grade, cat) < cost) return null;
    let left = cost;
    // 여분이 많은 것부터 쓴다
    itemsOfGrade(grade, cat)
      .filter((it) => (state.inv[it.id] || 0) > 1)
      .sort((a, b) => state.inv[b.id] - state.inv[a.id])
      .forEach((it) => {
        while (left > 0 && state.inv[it.id] > 1) {
          state.inv[it.id] -= 1;
          left -= 1;
        }
      });
    const up = grade < 3 && Math.random() < AP().GACHA.upgradeRate[grade];
    const res = giveRandom(up ? grade + 1 : grade, cat);
    res.upgraded = up;
    save();
    track("gacha_exchange", { cat: cat || "wear", grade: grade, upgraded: up ? 1 : 0 });
    return res;
  }

  function owned(id) {
    ensureWardrobe();
    return state.inv[id] || 0;
  }

  // 부위 하나 갈아입기 (가진 것만, 머리·옷은 비울 수 없음)
  function setWear(slot, id) {
    ready();
    ensureWardrobe();
    const required = slot === "hair" || slot === "outfit";
    if (!id) {
      if (required) return false;
      state.wear[slot] = null;
    } else {
      const it = AP().ITEMS[id];
      if (!it || it.slot !== slot || !state.inv[id]) return false;
      state.wear[slot] = id;
      if (slot === "hair") state.hair = it.shape;
    }
    save();
    track("customize", { slot: slot });
    return true;
  }

  function hasItem(itemId) {
    return D.badges.some((b) => b.item === itemId && hasBadge(state, b.id));
  }

  // 가장 가까운 공개 상장 하나의 힌트
  function nextHint(archive) {
    let best = null;
    D.badges.forEach((b) => {
      if (b.hidden || hasBadge(state, b.id)) return;
      const p = progress(b, state, archive);
      if (!p || p.have >= p.need) return;
      const left = p.need - p.have;
      // 테스트로 채우는 상장을 출석 상장보다 조금 앞세운다(같은 날 바로 할 수 있으니까)
      const score = left + (b.kind === "streak" || b.kind === "days" ? 0.5 : 0);
      if (!best || score < best.score) best = { b: b, left: left, score: score };
    });
    if (!best) return null;
    const b = best.b;
    let text;
    if (b.kind === "count" || b.kind === "all") text = `테스트 ${best.left}개 더`;
    else if (b.kind === "group") text = `${D.groups[b.group]} 테스트 ${best.left}개 더`;
    else if (b.kind === "streak") text = `연속 출석 ${best.left}일 더`;
    else if (b.kind === "days") text = `출석 ${best.left}번 더`;
    else text = "";
    return { id: b.id, name: b.name, text: text };
  }

  // ---------- 결과 기록 (engine.js 가 직접 끝낸 결과에서 호출) ----------
  function recordResult(testId, code) {
    ready();
    const lvBefore = levelInfo(state.xp).level;
    const titleBefore = titleOf(state, lvBefore);
    const archive = readArchive();
    const first = !archive[testId];
    const d = today();
    const gains = [];

    if (first) {
      gains.push({ label: "처음 한 테스트", xp: D.xp.firstTest });
      if (newestIds().indexOf(testId) >= 0) gains.push({ label: "최신 테스트", xp: D.xp.newestBonus });
    } else {
      if (state.retake.date !== d) state.retake = { date: d, tests: [], xp: 0 };
      if (state.retake.tests.indexOf(testId) < 0 && state.retake.xp < D.xp.retakeDailyCap) {
        const g = Math.min(D.xp.retake, D.xp.retakeDailyCap - state.retake.xp);
        gains.push({ label: "다시 하기", xp: g });
        state.retake.xp += g;
      }
      state.retake.tests.push(testId);
    }
    const gained = gains.reduce((sum, g) => sum + g.xp, 0);
    state.xp += gained;

    // 완료 기록은 engine.js 도 바로 뒤에 같은 값으로 저장한다(여기서 먼저 써야 상장 판정에 반영됨).
    archive[testId] = { code: code, date: d };
    writeArchive(archive);

    state.last = { testId: testId, code: code, date: d };
    const newType = state.seen.indexOf(code) < 0 && !!D.types[code];
    addSeen(state, code);
    addHist(state, testId, code, d);

    const badges = checkBadges(state, archive);
    const lvAfter = levelInfo(state.xp);
    const titleAfter = titleOf(state, lvAfter.level);
    const newItems = grantLevelRewards();
    save();

    if (gained) track("xp_gain", { source: first ? "first_test" : "retake", amount: gained });
    badges.forEach((b) => track("badge_earned", { badge_id: b.id }));
    if (lvAfter.level > lvBefore) track("level_up", { level: lvAfter.level });
    if (titleAfter !== titleBefore) track("title_change", {});

    return {
      gains: gains,
      gained: gained,
      badgeXp: badges.length * D.xp.badge,
      retakeCapped: !first && !gains.length,
      levelBefore: lvBefore,
      level: lvAfter.level,
      into: lvAfter.into,
      need: lvAfter.need,
      toNext: lvAfter.toNext,
      titleBefore: titleBefore,
      title: titleAfter,
      newType: newType,
      badges: badges,
      newItems: newItems,
      tickets: ticketCount(),
    };
  }

  function setLook(change) {
    ready();
    if (change.hair && D.head[change.hair]) {
      state.hair = change.hair;
      ensureWardrobe();
      if (state.wear && AP()) {
        const color = (AP().ITEMS[state.wear.hair] || {}).color || "brown";
        const id = "hair." + change.hair + "." + color;
        if (state.inv[id]) state.wear.hair = id;
        else if (state.inv["hair." + change.hair + ".brown"]) state.wear.hair = "hair." + change.hair + ".brown";
      }
    }
    if (change.coat) {
      const c = coatById(change.coat);
      if (c.id === change.coat && c.level <= levelInfo(state.xp).level) state.coat = c.id;
    }
    if ("item" in change) state.item = change.item && hasItem(change.item) ? change.item : null;
    save();
    track("customize", { slot: Object.keys(change)[0] });
  }

  // ---------- 도트 아바타 ----------
  function drawAvatar(canvas, lk, frame) {
    if (!canvas || !canvas.getContext) return;
    lk = lk || look();
    const ctx = canvas.getContext("2d");
    if (canvas.width !== 16) canvas.width = 16;
    if (canvas.height !== 16) canvas.height = 16;
    ctx.clearRect(0, 0, 16, 16);
    if (AP()) {
      const wear = Object.assign({}, lk.wear || (state && state.wear) || {});
      // 예전 방식 미리보기(머리 모양만 바꿔 보기)도 지원
      if (lk.hair && wear.hair && AP().ITEMS[wear.hair] && AP().ITEMS[wear.hair].shape !== lk.hair) {
        wear.hair = "hair." + lk.hair + "." + AP().ITEMS[wear.hair].color;
      }
      if (!wear.hair) wear.hair = "hair." + (lk.hair || D.defaultHair) + ".brown";
      const hand = lk.item && D.items[lk.item];
      AP().paint(ctx, wear, 0, 0, frame || 0, hand ? (set) => {
        hand.rows.forEach((row, dy) => {
          row.split("").forEach((ch, dx) => {
            if (ch !== ".") set(hand.y + dy, 11 + dx, D.palette[ch]);
          });
        });
      } : null);
      return;
    }
    paintAvatar(ctx, lk, 0, 0);
  }

  // (ox, oy) 위치에 16×16 아바타를 찍는다. 연구실 장면(drawLab)에서도 쓴다.
  function paintAvatar(ctx, lk, ox, oy) {
    const head = D.head[lk.hair] || D.head[D.defaultHair];
    const body = lk.hair === "bob" ? D.bodyBob : D.body;
    const grid = head.concat(body).map((r) => r.split(""));
    const it = lk.item && D.items[lk.item];
    if (it) {
      it.rows.forEach((row, dy) => {
        row.split("").forEach((ch, dx) => {
          if (ch !== ".") grid[it.y + dy][11 + dx] = ch;
        });
      });
    }
    const coat = coatById(lk.coat);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = grid[y][x];
        if (ch === ".") continue;
        let col = D.palette[ch];
        // 가운(w·g)은 몸 부분(9행 이하)만 색을 바꾼다. 소품 안의 흰색은 그대로.
        const isCoat = y >= 9 && (ch === "w" || ch === "g") && !(it && x >= 11 && y >= it.y && y < it.y + it.rows.length && it.rows[y - it.y][x - 11] !== ".");
        if (isCoat) {
          if (coat.rows) col = coat.rows[Math.min(y - 9, coat.rows.length - 1)];
          else col = ch === "w" ? coat.w : coat.g;
        }
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  // ---------- 연구실 장면 (내 연구실 페이지 프로필 배경) ----------
  // 60×34 도트: 타일 벽·창문·플라스크 선반·책상·바둑판 바닥, 가운데에 내 연구원이 선다.
  const LAB_W = 60;
  const LAB_H = 34;
  function drawLab(canvas, lk) {
    if (!canvas || !canvas.getContext) return;
    lk = lk || look();
    canvas.width = LAB_W;
    canvas.height = LAB_H;
    const ctx = canvas.getContext("2d");
    const P = D.palette;
    const rect = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const WALL = "#e3f1ff";
    const TILE = "#d0e4f6";
    const WOOD = "#b98552";
    const WOOD_D = "#8a5a32";

    // 벽 + 타일 줄눈
    rect(0, 0, LAB_W, 25, WALL);
    for (let x = 5; x < LAB_W; x += 6) rect(x, 0, 1, 25, TILE);
    for (let y = 5; y < 25; y += 6) rect(0, y, LAB_W, 1, TILE);
    // 걸레받이
    rect(0, 24, LAB_W, 1, "#b9cde0");
    // 바닥 바둑판
    for (let y = 25; y < LAB_H; y += 3) {
      for (let x = 0; x < LAB_W; x += 3) rect(x, y, 3, 3, ((x + y) / 3) % 2 ? "#efe4d6" : "#e2d2bf");
    }

    // 창문 (왼쪽 위)
    rect(3, 3, 13, 11, P.k);
    rect(4, 4, 11, 9, "#bfe3ff");
    rect(6, 6, 4, 1, "#ffffff"); // 구름
    rect(5, 7, 6, 1, "#ffffff");
    rect(9, 4, 1, 9, P.k); // 창살
    rect(4, 8, 11, 1, P.k);
    rect(2, 14, 15, 1, WOOD); // 창턱

    // 선반 두 줄 (오른쪽)
    const flask = (x, y, liquid) => {
      // 3칸 폭 삼각 플라스크 (y = 바닥 줄)
      rect(x + 1, y - 4, 1, 1, P.k);
      rect(x + 1, y - 3, 1, 1, "#ffffff");
      rect(x, y - 2, 3, 2, liquid);
      rect(x - 1, y - 1, 1, 1, P.k);
      rect(x + 3, y - 1, 1, 1, P.k);
      rect(x, y, 3, 1, P.k);
    };
    const tube = (x, y, liquid) => {
      rect(x, y - 4, 2, 1, P.k);
      rect(x, y - 3, 2, 1, "#ffffff");
      rect(x, y - 2, 2, 2, liquid);
    };
    rect(40, 9, 18, 1, WOOD);
    rect(40, 10, 18, 1, WOOD_D);
    flask(42, 8, P.c);
    tube(47, 8, P.n);
    flask(51, 8, P.y);
    tube(55, 8, P.b);
    rect(40, 17, 18, 1, WOOD);
    rect(40, 18, 18, 1, WOOD_D);
    rect(42, 13, 3, 4, "#ff9e8a"); // 책 세 권
    rect(45, 12, 2, 5, "#2fae91");
    rect(47, 14, 3, 3, "#ffc93c");
    flask(53, 16, "#82cbff");

    // 책상 (왼쪽 아래) + 비커
    rect(2, 22, 17, 2, WOOD);
    rect(2, 24, 17, 1, WOOD_D);
    rect(3, 25, 2, 7, WOOD_D);
    rect(16, 25, 2, 7, WOOD_D);
    rect(5, 18, 4, 4, "#ffffff");
    rect(5, 20, 4, 2, P.v);
    rect(4, 18, 1, 4, P.k);
    rect(9, 18, 1, 4, P.k);
    rect(4, 21, 6, 1, P.k);
    flask(13, 21, P.f);

    // 화분 (오른쪽 바닥)
    rect(51, 27, 5, 4, "#ffa94d");
    rect(51, 31, 5, 1, "#d97f2a");
    rect(52, 23, 1, 4, P.n);
    rect(54, 22, 1, 5, P.n);
    rect(51, 23, 1, 1, P.v);
    rect(55, 22, 1, 1, P.v);

    // 내 연구원 (가운데, 발이 바닥에 닿게) + 그림자
    rect(24, 32, 12, 1, "rgba(43,35,32,0.15)");
    paintAvatar(ctx, lk, 22, 17);
  }

  // ---------- 공통 UI 조각 ----------
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function avatarCanvas(cls, lk) {
    const c = document.createElement("canvas");
    c.className = "px-avatar " + (cls || "");
    c.setAttribute("aria-hidden", "true");
    drawAvatar(c, lk);
    return c;
  }

  function attendanceText(info, v) {
    if (info && info.attendance) {
      const a = info.attendance;
      return `오늘 출석 +${a.gain} 경험치` + (a.streak > 1 ? ` · ${a.streak}일 연속` : "");
    }
    return `오늘 출석 완료` + (v.att.streak > 1 ? ` · ${v.att.streak}일 연속` : "");
  }

  // ---------- 홈 카드 (#me-card) ----------
  function renderHubCard() {
    const root = document.getElementById("me-card");
    if (!root) return;
    const info = ready();
    const v = view();
    const pct = Math.round((v.into / v.need) * 100);
    const nick = getNick();

    // 이번 방문 소식은 짧게 한 줄로 (자세한 건 내 연구실)
    const notes = [];
    if (info.levelAfter > info.levelBefore) notes.push(`Lv.${info.levelAfter} 달성`);
    if (info.badges.length === 1) notes.push(`새 상장 '${info.badges[0].name}'`);
    else if (info.badges.length > 1) notes.push(`새 상장 ${info.badges.length}개`);
    if (info.migrated) notes.push(`예전 기록으로 +${info.migrated.xp}`);

    // 홈 첫 화면에 테스트가 보이도록 카드를 작게 (dev.md #60)
    // · 테스트 기록 0개: 한 줄 요약만 (이름·머리 모양은 첫 테스트 뒤로)
    // · 기록 있음: 아바타 + 이름·칭호 + 레벨 막대 + 수집 한 줄, 출석(달력)·내 연구실을 한 줄에
    const hasRecord = Object.keys(readArchive()).length > 0;
    root.classList.toggle("compact", !hasRecord);
    if (!hasRecord) {
      root.innerHTML = `
        <div class="me-top">
          <a class="me-avatar-link" href="${ROOT}archive.html" aria-label="내 연구실 열기"></a>
          <div class="me-info">
            <p class="me-title">${nick ? "🧪 " + esc(nick) + " · " : ""}견습 연구원 <small>Lv.${v.level}</small></p>
            <p class="me-line">테스트 하나만 해도 칭호가 생겨요</p>
          </div>
          <a class="me-link me-link-sm" href="${ROOT}archive.html">내 연구실 →</a>
        </div>
        ${v.storageOK ? "" : `<p class="me-warn">이 브라우저에서는 기록이 저장되지 않아요</p>`}`;
      root.querySelector(".me-avatar-link").appendChild(avatarCanvas("me-avatar", v.look));
    } else {
      root.innerHTML = `
        <div class="me-top">
          <a class="me-avatar-link" href="${ROOT}archive.html" aria-label="내 연구실 열기"></a>
          <div class="me-info">
            ${nick ? `<p class="me-nick">🧪 ${esc(nick)}</p>` : ""}
            <p class="me-title">${esc(v.title)}</p>
            <div class="me-level"><span class="me-lv">Lv.${v.level}</span><span class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${v.need}" aria-valuenow="${v.into}" aria-label="다음 레벨까지 경험치"><i style="width:${pct}%"></i></span><span class="me-next-inline">${v.toNext} 남음</span></div>
            <p class="me-meta">${v.liveTotal ? `${v.liveTotal}개 중 ${v.collected}개 수집` : `${v.collected}개 수집`} · 상장 ${v.earned.length}개${nick && v.hairChosen ? "" : ` · <button type="button" class="me-setup" id="me-setup">✏️ ${nick ? "머리 모양" : v.hairChosen ? "이름" : "이름·머리"} 정하기</button>`}</p>
          </div>
        </div>
        ${notes.length ? `<p class="me-note">🎉 ${esc(notes.join(" · "))}</p>` : ""}
        <div class="me-row">
          <button type="button" class="me-stamp${info.attendance ? " is-new" : ""}" id="me-stamp" aria-label="출석 달력 보기"><span class="me-stamp-mark" aria-hidden="true">✓</span>${esc(attendanceText(info, v))}<span class="me-stamp-more"><span class="me-stamp-cal" aria-hidden="true">📅</span></span></button>
          <a class="me-link" href="${ROOT}archive.html">내 연구실 →</a>
        </div>
        ${v.storageOK ? "" : `<p class="me-warn">이 브라우저에서는 기록이 저장되지 않아요</p>`}`;
      root.querySelector(".me-avatar-link").appendChild(avatarCanvas("me-avatar", v.look));
      const stampBtn = root.querySelector("#me-stamp");
      if (stampBtn) stampBtn.onclick = openCalendarModal;
      const setupBtn = root.querySelector("#me-setup");
      if (setupBtn) setupBtn.onclick = openSetupModal;
    }
    root.hidden = false;
    alignHubCard();
    track("profile_view", { place: "hub" });
  }

  // 이름·머리 모양 정하기 창 (첫 테스트를 끝낸 뒤 홈 카드에서, dev.md #60)
  function openSetupModal() {
    closeCalendarModal();
    const v = view();
    const bd = document.createElement("div");
    bd.className = "cal-modal-backdrop";
    bd.id = "cal-modal-backdrop";
    const box = document.createElement("section");
    box.className = "cal-modal";
    box.id = "cal-modal";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "cal-modal-title");
    box.innerHTML = `<div class="cal-modal-head"><h2 id="cal-modal-title">🧪 내 연구원 정하기</h2><button type="button" class="cal-modal-close" aria-label="닫기">✕</button></div>
      <form class="me-name" autocomplete="off"><label class="me-hair-title" for="me-name-input">이름 <small>(테스트 닉네임으로도 쓰여요)</small></label><div class="me-name-row"><input id="me-name-input" class="me-name-input" type="text" maxlength="${NICK_MAX}" placeholder="이름 (최대 ${NICK_MAX}자)" value="${esc(getNick())}" /><button type="submit" class="me-name-btn">저장</button></div></form>
      <div class="me-hair"><p class="me-hair-title">머리 모양</p><div class="me-hair-list"></div></div>
      <p class="cal-summary" style="margin-top:12px">더 많은 머리·옷은 내 연구실 옷장과 뽑기 기계에서 바꿀 수 있어요.</p>`;
    document.body.appendChild(bd);
    document.body.appendChild(box);
    const list = box.querySelector(".me-hair-list");
    const drawHair = () => {
      list.innerHTML = "";
      const cur = view().look;
      D.hairs.forEach((h) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "me-hair-btn";
        btn.setAttribute("aria-pressed", String(cur.hair === h.id && v.hairChosen));
        btn.setAttribute("aria-label", h.name);
        btn.appendChild(avatarCanvas("", Object.assign({}, cur, { hair: h.id })));
        const span = document.createElement("span");
        span.textContent = h.name;
        btn.appendChild(span);
        btn.onclick = () => {
          setLook({ hair: h.id });
          v.hairChosen = true;
          drawHair();
          renderHubCard();
        };
        list.appendChild(btn);
      });
    };
    drawHair();
    box.querySelector(".me-name").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = box.querySelector("#me-name-input");
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      setNick(input.value);
      renderHubCard();
      closeCalendarModal();
    });
    bd.onclick = closeCalendarModal;
    box.querySelector(".cal-modal-close").onclick = closeCalendarModal;
    document.addEventListener("keydown", calEsc);
    box.querySelector("#me-name-input").focus();
  }

  // 넓은 PC(오른쪽 고정 카드, common.css @media 1300px): 카드 윗선을 검색창 윗선에 맞춰 고정한다.
  // 스크롤해도 그 높이에 머물러 검색창 줄보다 위로 올라가지 않는다. 좁은 화면에서는 인라인 값을 지운다.
  const WIDE = window.matchMedia ? window.matchMedia("(min-width: 1300px)") : null;
  function alignHubCard() {
    const card = document.getElementById("me-card");
    if (!card) return;
    if (!WIDE || !WIDE.matches) {
      card.style.top = "";
      card.style.maxHeight = "";
      return;
    }
    const target = document.getElementById("hub-search");
    const ref = target && !target.hidden ? target : document.querySelector(".hub-main");
    if (!ref) return;
    const top = Math.round(ref.getBoundingClientRect().top + window.scrollY);
    card.style.top = top + "px";
    card.style.maxHeight = `calc(100vh - ${top + 24}px)`;
  }
  if (WIDE) {
    window.addEventListener("resize", alignHubCard);
    document.addEventListener("DOMContentLoaded", alignHubCard); // hub.js 가 검색창 hidden 을 푼 뒤
    window.addEventListener("load", alignHubCard); // 글꼴·이미지가 늦게 들어와 헤더 높이가 바뀌는 경우
  }

  // ---------- 출석 달력 (홈 카드 창 · 내 연구실 달력 공용) ----------
  // body 에 한 달 달력을 그린다. 출석한 날 ✓, 오늘 테두리, ‹ › 로 지난 달 보기.
  function renderCalendar(body, month) {
    ready();
    month = month || new Date();
    const y = month.getFullYear();
    const m = month.getMonth();
    const p2 = (n) => (n < 10 ? "0" : "") + n;
    const att = state.att;
    const days = new Set(att.days || []);
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const todayKey = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate());
    let cells = "";
    for (let i = 0; i < first; i++) cells += '<li class="cal-cell empty"></li>';
    let monthCount = 0;
    for (let d = 1; d <= count; d++) {
      const key = y + "-" + p2(m + 1) + "-" + p2(d);
      const on = days.has(key);
      if (on) monthCount++;
      cells += `<li class="cal-cell${on ? " on" : ""}${key === todayKey ? " today" : ""}"><span>${d}</span>${on ? '<i aria-label="출석">✓</i>' : ""}</li>`;
    }
    const isThisMonth = y === now.getFullYear() && m === now.getMonth();
    // 첫 출석 달보다 앞으로는 못 가게
    const firstDay = (att.days || [])[0];
    const firstMonth = firstDay ? new Date(Number(firstDay.slice(0, 4)), Number(firstDay.slice(5, 7)) - 1, 1) : now;
    const atFirst = y < firstMonth.getFullYear() || (y === firstMonth.getFullYear() && m <= firstMonth.getMonth());
    body.innerHTML = `
      <p class="cal-summary">총 출석 <b>${att.total}</b>일 · 지금 <b>${att.streak}</b>일 연속 · 이번 달 ${monthCount}일<br />들어올 때마다 자동으로 도장이 찍혀요. 연속으로 오면 경험치를 더 받아요.</p>
      <div class="cal-head">
        <button type="button" class="cal-nav" data-cal="prev" aria-label="지난 달"${atFirst ? " disabled" : ""}>‹</button>
        <strong>${y}년 ${m + 1}월</strong>
        <button type="button" class="cal-nav" data-cal="next" aria-label="다음 달"${isThisMonth ? " disabled" : ""}>›</button>
      </div>
      <ol class="cal-week">${"일월화수목금토".split("").map((d) => `<li>${d}</li>`).join("")}</ol>
      <ol class="cal-grid">${cells}</ol>`;
    body.querySelector('[data-cal="prev"]').onclick = () => renderCalendar(body, new Date(y, m - 1, 1));
    body.querySelector('[data-cal="next"]').onclick = () => renderCalendar(body, new Date(y, m + 1, 1));
  }

  function openCalendarModal() {
    closeCalendarModal();
    const bd = document.createElement("div");
    bd.className = "cal-modal-backdrop";
    bd.id = "cal-modal-backdrop";
    const box = document.createElement("section");
    box.className = "cal-modal";
    box.id = "cal-modal";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "cal-modal-title");
    box.innerHTML = `<div class="cal-modal-head"><h2 id="cal-modal-title">📅 출석 달력</h2><button type="button" class="cal-modal-close" aria-label="닫기">✕</button></div><div id="cal-modal-body"></div>`;
    document.body.appendChild(bd);
    document.body.appendChild(box);
    renderCalendar(box.querySelector("#cal-modal-body"), new Date());
    bd.onclick = closeCalendarModal;
    box.querySelector(".cal-modal-close").onclick = closeCalendarModal;
    box.querySelector(".cal-modal-close").focus();
    document.addEventListener("keydown", calEsc);
    track("calendar_open", { place: "hub" });
  }
  function calEsc(e) {
    if (e.key === "Escape") closeCalendarModal();
  }
  function closeCalendarModal() {
    ["cal-modal", "cal-modal-backdrop"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.removeEventListener("keydown", calEsc);
    const btn = document.getElementById("me-stamp");
    if (btn && document.activeElement === document.body) btn.focus();
  }

  // ---------- 결과 화면 보상 띠 ----------
  // 결과 화면 (dev.md #61): 결과 이름 아래엔 한 줄 칩만, 자세한 띠는 저장·공유 버튼 아래.
  // 결과 설명과 공유 버튼이 첫 화면에 먼저 보이게(공유가 주 유입 경로).
  function renderReward(reward) {
    let el = document.getElementById("result-reward");
    let chip = document.getElementById("result-reward-chip");
    if (!reward) {
      if (el) el.hidden = true;
      if (chip) chip.hidden = true;
      return;
    }
    if (!chip) {
      const anchor = document.getElementById("result-desc");
      if (!anchor) return;
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "reward-chip";
      chip.id = "result-reward-chip";
      anchor.parentNode.insertBefore(chip, anchor);
      chip.addEventListener("click", () => {
        const full = document.getElementById("result-reward");
        if (full) full.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    if (!el) {
      const actions = document.querySelector("#screen-result .result-actions");
      const fallback = document.getElementById("result-desc");
      if (!actions && !fallback) return;
      el = document.createElement("div");
      el.className = "result-reward";
      el.id = "result-reward";
      if (actions) actions.parentNode.insertBefore(el, actions.nextSibling);
      else fallback.parentNode.insertBefore(el, fallback);
    }
    const total = reward.gained + reward.badgeXp;
    const why = reward.gains.map((g) => `${g.label} +${g.xp}`);
    if (reward.badgeXp) why.push(`상장 +${reward.badgeXp}`);
    const pct = Math.round((reward.into / reward.need) * 100);
    const lines = [];
    if (reward.level > reward.levelBefore) lines.push(`<p class="reward-up">🎉 Lv.${reward.level} 달성!</p>`);
    if (reward.title !== reward.titleBefore) lines.push(`<p class="reward-title">칭호가 <strong>'${esc(reward.title)}'</strong>으로 바뀌었어요</p>`);
    if (reward.newType) lines.push(`<p class="reward-dex">칭호 도감에 새 칸이 열렸어요</p>`);
    reward.badges.forEach((b) => {
      const item = D.items[b.item];
      lines.push(`<p class="reward-badge">🏅 새 상장 도착: <strong>${esc(b.name)}</strong>${item ? ` · 소품 '${esc(item.name)}'을 받았어요` : ""}</p>`);
    });
    if (reward.newItems && reward.newItems.length) {
      lines.push(`<p class="reward-badge">🎁 레벨 보상: <strong>${esc(reward.newItems.map((it) => it.name).join(", "))}</strong></p>`);
    }
    // 한 줄 칩: 경험치 + 가장 큰 소식 하나
    const big = reward.level > reward.levelBefore ? `Lv.${reward.level} 달성!` : reward.badges.length ? "새 상장 도착!" : reward.title !== reward.titleBefore ? "칭호가 바뀌었어요" : "";
    chip.innerHTML = total
      ? `🧪 경험치 +${total}${big ? ` · <b>${big}</b>` : ""} <span aria-hidden="true">›</span>`
      : `🧪 오늘은 이 테스트 경험치를 이미 받았어요 <span aria-hidden="true">›</span>`;
    chip.setAttribute("aria-label", "내 연구원 보상 자세히 보기");
    chip.hidden = false;

    el.innerHTML = `
      <div class="reward-head">
        <span class="reward-avatar"></span>
        <div class="reward-body">
          <p class="reward-xp">${total ? `경험치 +${total}` : "오늘은 이 테스트 경험치를 이미 받았어요"}</p>
          ${why.length ? `<p class="reward-why">${esc(why.join(" · "))}</p>` : `<p class="reward-why">다시 하기 경험치는 테스트마다 하루 한 번이에요</p>`}
        </div>
      </div>
      <div class="reward-level"><span class="me-lv">Lv.${reward.level}</span><span class="xp-bar"><i style="width:${pct}%"></i></span></div>
      <p class="reward-next">${esc(reward.title)} · 다음 레벨까지 ${reward.toNext}</p>
      ${lines.join("")}
      <a class="reward-link" href="${ROOT}archive.html">내 연구실 보기 →</a>
    `;
    el.querySelector(".reward-avatar").appendChild(avatarCanvas("reward-avatar-img"));
    el.hidden = false;
  }

  // ---------- 다른 페이지의 출석 알림 ----------
  function attendanceToast() {
    const info = ready();
    if (!info.attendance || !storageOK) return;
    const msg = `출석 +${info.attendance.gain} 경험치` + (info.attendance.streak > 1 ? ` (${info.attendance.streak}일 연속)` : "");
    const toast = document.getElementById("toast");
    if (!toast) return;
    setTimeout(() => {
      if (toast.classList.contains("show")) return;
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2400);
    }, 600);
  }

  window.Profile = {
    ready: ready,
    view: view,
    recordResult: recordResult,
    renderReward: renderReward,
    setLook: setLook,
    getRoom: function () {
      ready();
      return state.room || null;
    },
    setRoom: function (layout) {
      ready();
      state.room = layout;
      save();
      track("room_edit", {});
    },
    drawAvatar: drawAvatar,
    renderCalendar: renderCalendar,
    openCalendar: openCalendarModal,
    tickets: ticketCount,
    pull: pull,
    extras: extras,
    exchange: exchange,
    owned: owned,
    itemById: itemById,
    setWear: setWear,
    inventory: function () {
      ready();
      ensureWardrobe();
      return Object.assign({}, state.inv);
    },
    getNick: getNick,
    setNick: setNick,
    NICK_MAX: NICK_MAX,
    drawLab: drawLab,
    avatarCanvas: avatarCanvas,
    levelInfo: levelInfo,
    progress: function (b) {
      ready();
      return progress(b, state, readArchive());
    },
    badgeById: badgeById,
    root: ROOT,
  };

  function init() {
    ready();
    if (document.getElementById("me-card")) renderHubCard();
    else if (document.getElementById("screen-intro") || document.getElementById("screen-result")) attendanceToast();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
