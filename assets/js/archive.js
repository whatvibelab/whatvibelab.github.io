/* ==========================================================================
   archive.js — "내 연구실"(archive.html) 전용 스크립트. (dev.md #35 → #52 → #56 게임 방)
   engine.js가 결과 화면에서 localStorage(musunsang_archive)에 저장해 둔 완료 기록을
   읽어서 카드 목록 + 인사이트 한 줄로 보여주고, 요약 카드를 이미지로 저장한다.
   ========================================================================== */

(function () {
  "use strict";

  const SITE_NAME = "무슨상연구소";
  const SITE_LOGO_SRC = "assets/img/logo.svg"; // 루트 페이지 기준 경로
  const ARCHIVE_KEY = "musunsang_archive"; // engine.js 와 같은 키

  const AXIS_LABEL = {
    E: "외향형(E)", I: "내향형(I)",
    S: "현실형(S)", N: "상상형(N)",
    T: "논리형(T)", F: "감성형(F)",
    J: "계획형(J)", P: "즉흥형(P)",
  };

  function loadArchive() {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // testId+code 로 이름·이모지·태그라인·이동 경로·테스트 제목을 찾는다 (results-index.js).
  function findResult(testId, code) {
    const list = window.RESULTS_INDEX || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].testId === testId && list[i].code === code) return list[i];
    }
    return null;
  }

  // 완료 개수 + 가장 우세한 축(1~2개)을 한 줄로 요약한다.
  // 실제 문구는 콘텐츠 세션 확정 전까지의 자리표시자(dev.md #35 참고).
  function buildInsight(entries) {
    const total = entries.length;
    const count = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    entries.forEach((e) => {
      for (const ch of e.code) if (count[ch] != null) count[ch] += 1;
    });
    const axes = [
      ["E", "I"],
      ["S", "N"],
      ["T", "F"],
      ["J", "P"],
    ];
    const dominant = axes
      .map(([a, b]) => (count[a] >= count[b] ? { letter: a, n: count[a] } : { letter: b, n: count[b] }))
      .filter((d) => d.n / total > 0.5)
      .sort((a, b) => b.n / total - a.n / total)
      .slice(0, 2);

    let sentence = `지금까지 총 <strong>${total}개</strong>의 테스트를 완료했어요.`;
    if (dominant.length) {
      const parts = dominant.map((d) => `${d.n}개에서 <strong>${AXIS_LABEL[d.letter]}</strong>`);
      sentence += ` 그중 ${parts.join(", ")} 결과가 나왔어요.`;
    }
    return sentence;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderEmpty(root) {
    root.innerHTML =
      '<p class="archive-empty">아직 완료한 테스트가 없어요.<br />지금 시작해 보세요 → <a href="index.html">테스트 모아보기</a></p>';
  }

  // ---------- 내 연구실 (dev.md #52 · #56 게임 방) — profile.js·lab-room.js 가 있을 때만 ----------
  let room = null;
  let openAction = null;
  let leaving = false; // 나가기 버튼으로 떠나는 중이면 뒤로가기 가로채지 않음

  function labData() {
    return { P: window.Profile, D: window.PROFILE_DATA };
  }

  // 화면 전체 게임 (dev.md #56-2): 사이트 헤더·본문은 숨기고, 방(canvas)이 화면을 꽉 채운다.
  // 방 크기(칸)는 화면 비율에 맞춰 바뀌고, 아래쪽에 게임식 HUD 막대.
  function renderLab() {
    const { P, D } = labData();
    if (!P || !D || !window.LabRoom) return; // 없으면 예전 페이지(목록) 그대로
    let game = document.getElementById("game");
    if (game) game.remove();
    game = document.createElement("div");
    game.className = "game";
    game.id = "game";
    game.innerHTML = `
      <div class="game-stage" id="room-stage"></div>
      <div class="game-hud" id="game-hud">
        <button type="button" class="hud-me" id="lab-head" aria-label="내 정보 열기"></button>
        <p class="hud-hint" id="room-hint" aria-live="polite">바닥을 눌러 움직이고, 물건을 눌러 보세요</p>
        <div class="hud-btns">
          <button type="button" class="hud-btn" id="room-edit" aria-label="배치 바꾸기" title="배치 바꾸기">🛠</button>
          <button type="button" class="hud-btn" id="room-reset" aria-label="처음 배치로" title="처음 배치로" hidden>↺</button>
          <button type="button" class="hud-btn" id="hud-help" aria-label="도움말" title="도움말">❓</button>
          <button type="button" class="hud-btn" id="hud-exit" aria-label="연구소 나가기" title="나가기">🚪</button>
        </div>
      </div>
      <div class="edit-dock" id="edit-dock" hidden>
        <div class="edit-tools" id="edit-tools" hidden></div>
        <div class="edit-storage" id="edit-storage"></div>
      </div>
      <div class="room-panel-backdrop" id="room-backdrop" hidden></div>
      <section class="room-panel" id="room-panel" role="dialog" aria-modal="true" aria-labelledby="room-panel-title" hidden>
        <div class="room-panel-head">
          <h2 id="room-panel-title"></h2>
          <button type="button" class="room-panel-close" id="room-panel-close" aria-label="닫기">✕</button>
        </div>
        <div class="room-panel-body" id="room-panel-body"></div>
      </section>`;
    document.body.appendChild(game);
    document.body.classList.add("lab-game");
    renderHead();

    room = window.LabRoom.mount(document.getElementById("room-stage"), {
      getLook: () => P.view().look,
      getLayout: () => P.getRoom(),
      saveLayout: (l) => P.setRoom(l),
      onUse: (action) => openPanel(action),
      tickets: () => P.tickets(),
      isBlocked: () => !!openAction, // 가구 창이 열려 있으면 키보드로 움직이지 않음
      onPick: (info) => showPickTools(info),
      onLongPress: () => {
        if (!room.isEdit()) setEditMode(true);
      },
      // 꾹 눌러 끌어 옮긴 뒤 손을 떼면 배치 모드 끝(확인 버튼 생략)
      onQuickDropEnd: () => {
        if (room.isEdit()) setEditMode(false);
      },
      onDrag: (on) => {
        const dock = document.getElementById("edit-dock");
        if (dock) dock.classList.toggle("dragging", on);
      },
      onPlaced: () => {
        setPlacingBar(null);
        renderStorage();
        document.querySelectorAll(".storage-item.placing").forEach((x) => x.classList.remove("placing"));
      },
      onHint: (text) => {
        const el = document.getElementById("room-hint");
        if (el) el.textContent = text;
      },
    });
    window.LabRoom.current = room;
    fitRoom();
    let t = null;
    const refit = () => {
      clearTimeout(t);
      t = setTimeout(fitRoom, 120);
    };
    window.addEventListener("resize", refit);
    // HUD 높이가 바뀌면(안내 문구 줄바꿈·배치 도구 막대 등) 방 크기도 다시 맞춘다
    const stageEl = document.getElementById("room-stage");
    if (stageEl && window.ResizeObserver) new ResizeObserver(refit).observe(stageEl);

    const editBtn = document.getElementById("room-edit");
    const resetBtn = document.getElementById("room-reset");
    editBtn.onclick = () => setEditMode(!room.isEdit());
    resetBtn.onclick = () => room.resetLayout();
    window.addEventListener("resize", placeDock);
    document.getElementById("hud-help").onclick = () => openPanel("help");
    document.getElementById("hud-exit").onclick = () => openPanel("door");
    document.getElementById("lab-head").onclick = () => openPanel("me");
    document.getElementById("room-panel-close").onclick = closePanel;
    document.getElementById("room-backdrop").onclick = closePanel;
    // 나가기 단축키 (dev.md #56-4): ESC = 창 닫기 → 배치 끝내기 → 나가기 창 / Backspace = 나가기 창(입력 중 제외)
    document.addEventListener("keydown", (e) => {
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        if (openAction) closePanel();
        else if (room && room.isEdit()) setEditMode(false);
        else openPanel("door");
      } else if (e.key === "Backspace" && !typing && !openAction) {
        e.preventDefault();
        openPanel("door");
      }
    });
    // 브라우저 뒤로가기(마우스 뒤로 버튼·Alt+←·휴대폰 뒤로 제스처)도 바로 나가지 않고 나가기 창을 띄운다.
    // 들어올 때 기록을 한 칸 쌓아 두고, 뒤로가기가 오면 다시 쌓으면서 창을 연다.
    try {
      history.pushState({ lab: 1 }, "", location.href);
      window.addEventListener("popstate", () => {
        if (leaving) return;
        history.pushState({ lab: 1 }, "", location.href);
        if (openAction === "door") closePanel();
        else openPanel("door");
      });
    } catch (e) {
      /* history 를 못 쓰는 환경은 그냥 둔다 */
    }
    if (room.canvas) room.canvas.focus({ preventScroll: true });
  }

  // 화면에 맞춰 방 크기(칸)와 한 칸 크기를 정한다. 한 칸은 화면 폭 12칸·높이 10칸 중 작은 쪽, 28~64px.
  // 방은 HUD 위의 보이는 공간(#room-stage)에 딱 맞춘다 — HUD 에 가려지는 줄이 없게 (2026-11-22 woody)
  // 폭은 칸 수로 꽉 채우고, 세로는 가장 가까운 칸 수로 맞춘 뒤 남는 몇 px 은 칸 높이를 아주 조금(최대 반 칸 이내) 늘려 메운다.
  function fitRoom() {
    if (!room) return;
    const stage = document.getElementById("room-stage");
    const hud = document.getElementById("game-hud");
    const vw = (stage && stage.clientWidth) || window.innerWidth;
    const vh = (stage && stage.clientHeight) || window.innerHeight - (hud ? hud.offsetHeight : 0);
    if (vw <= 0 || vh <= 0) return;
    const target = Math.max(28, Math.min(64, Math.floor(Math.min(vw / 12, vh / 10))));
    const cols = Math.max(12, Math.floor(vw / target));
    const tile = vw / cols;
    const rows = Math.max(10, Math.round(vh / tile));
    room.resize(cols, rows);
    room.canvas.style.width = vw + "px";
    room.canvas.style.height = vh + "px";
  }

  // HUD 왼쪽: 이름·칭호·레벨 (누르면 "내 정보")
  function renderHead() {
    const el = document.getElementById("lab-head");
    const { P } = labData();
    if (!el || !P) return;
    const v = P.view();
    const pct = Math.round((v.into / v.need) * 100);
    const nick = P.getNick();
    el.innerHTML = `
      <span class="hud-me-name">${nick ? "🧪 " + escapeHtml(nick) : "🧪 내 연구원"}</span>
      <span class="hud-me-title">${escapeHtml(v.title)}</span>
      <span class="hud-me-lv"><b>Lv.${v.level}</b><span class="xp-bar"><i style="width:${pct}%"></i></span>${v.tickets ? `<span class="hud-ticket">🎟 ${v.tickets}</span>` : ""}</span>`;
  }

  // ---------- 가구 창 ----------
  const PANEL_TITLES = {
    wardrobe: "👗 옷장",
    calendar: "📅 출석 달력",
    dex: "📚 도감",
    gacha: "🎰 뽑기 기계",
    badges: "🏅 상장 액자",
    records: "🖥️ 연구 기록",
    door: "🚪 연구소 문",
    me: "🧪 내 정보",
    help: "❓ 이렇게 놀아요",
  };

  function openPanel(action) {
    const panel = document.getElementById("room-panel");
    const body = document.getElementById("room-panel-body");
    if (!panel || !body || !PANEL_TITLES[action]) return;
    openAction = action;
    document.getElementById("room-panel-title").textContent = PANEL_TITLES[action];
    fillPanel(action, body);
    panel.hidden = false;
    document.getElementById("room-backdrop").hidden = false;
    document.body.classList.add("room-panel-open");
    const close = document.getElementById("room-panel-close");
    if (close) close.focus();
    if (typeof window.track === "function") window.track("room_use", { item: action });
  }

  function closePanel() {
    const panel = document.getElementById("room-panel");
    if (panel) panel.hidden = true;
    const bd = document.getElementById("room-backdrop");
    if (bd) bd.hidden = true;
    document.body.classList.remove("room-panel-open");
    openAction = null;
    if (room && room.canvas) room.canvas.focus();
  }

  function fillPanel(action, body) {
    const { P, D } = labData();
    const v = P.view();
    if (action === "wardrobe") {
      if (window.AVATAR_PARTS) renderWardrobe(body, wardrobeSlot);
      else {
        body.innerHTML = '<div class="lab-look" id="lab-look"></div>';
        renderLook(document.getElementById("lab-look"), () => {
          if (room) room.refresh();
          fillPanel("wardrobe", body);
        });
      }
    } else if (action === "gacha") {
      renderGacha(body, null);
    } else if (action === "dex") {
      renderDex(body, dexTab);
    } else if (action === "badges") {
      body.innerHTML = `<p class="lab-help">받은 상장 ${v.earned.length}/${D.badges.length}개. 상장을 받으면 옷장에서 쓸 소품도 하나씩 생겨요.</p><ul class="lab-badges">${badgesHtml(v, D, P)}</ul>`;
    } else if (action === "calendar") {
      renderCalendar(body, v, new Date());
    } else if (action === "records") {
      const entries = completedEntries();
      body.innerHTML = entries.length
        ? `<p class="lab-help">지금까지 완료한 테스트 ${entries.length}개예요.</p><div class="archive-list">${entries.map(cardHtml).join("")}</div>`
        : `<p class="archive-empty">아직 완료한 테스트가 없어요.<br /><a href="index.html">테스트 하러 가기 →</a></p>`;
    } else if (action === "me") {
      const pct = Math.round((v.into / v.need) * 100);
      body.innerHTML = `
        <div class="me-sheet">
          <div class="wd-preview" id="me-avatar"></div>
          <div>
            <form class="lab-nick" id="lab-nick" autocomplete="off"></form>
            <p class="lab-title">${escapeHtml(v.title)}</p>
            <p class="lab-line">${v.hasTitle ? escapeHtml(v.typeLine) : "테스트 하나만 해도 칭호가 생겨요"}</p>
          </div>
        </div>
        <div class="me-level"><span class="me-lv">Lv.${v.level}</span><span class="xp-bar"><i style="width:${pct}%"></i></span></div>
        <p class="me-next">누적 경험치 ${v.xp} · 다음 레벨까지 ${v.toNext}</p>
        <p class="lab-help">출석 ${v.att.total}일(연속 ${v.att.streak}일) · ${v.liveTotal ? `${v.liveTotal}개 중 ${v.collected}개 수집` : `${v.collected}개 수집`} · 상장 ${v.earned.length}개 · 뽑기권 ${v.tickets}장</p>
        <h3 class="gx-title">경험치 받는 법</h3>
        <ul class="lab-rules">
          <li>처음 하는 테스트 <b>+${D.xp.firstTest}</b> · 최신 테스트 ${D.xp.newestCount}개는 <b>+${D.xp.newestBonus}</b> 더</li>
          <li>다시 하기 <b>+${D.xp.retake}</b> (같은 테스트는 하루 한 번, 하루 최대 ${D.xp.retakeDailyCap})</li>
          <li>출석 <b>+${D.xp.attendance}</b> · 연속 출석이면 하루 최대 <b>+${D.xp.attendance + D.xp.streakMax}</b></li>
          <li>상장 받기 <b>+${D.xp.badge}</b> · 경험치 100마다 뽑기권 1장</li>
        </ul>
        <a class="btn btn-primary me-go" href="index.html">테스트 하러 가기 →</a>`;
      body.querySelector("#me-avatar").appendChild(previewCanvas(v.look, "wd-big"));
      renderNick(body.querySelector("#lab-nick"));
    } else if (action === "help") {
      body.innerHTML = `
        <ul class="lab-rules">
          <li><b>움직이기</b> 바닥을 누르면 그곳까지 걸어가요. PC는 방향키(또는 WASD)로도 움직여요.</li>
          <li><b>쓸 수 있는 물건</b> 위에 <b>말풍선 아이콘</b>이 떠 있고 테두리가 반짝여요. 가까이 가면 말풍선이 노랗게 바뀌어요. 표시가 없는 화분·러그·창문은 장식이에요.</li>
          <li><b>물건 쓰기</b> 물건을 누르면 옆까지 가서 열어요. 가까이 서서 스페이스·엔터를 눌러도 돼요.</li>
          <li><b>옷장</b> 꾸미기 · <b>달력</b> 출석 · <b>책장</b> 도감 · <b>상장 액자</b> 상장 · <b>책상</b> 연구 기록 · <b>뽑기 기계</b> 아이템 뽑기 · <b>문</b> 나가기</li>
          <li><b>🛠 배치 바꾸기</b> 가구를 <b>꾹 누르면</b> 바로 집어서 끌 수 있어요(배치 모드가 자동으로 켜져요). 🛠 버튼으로도 켤 수 있고, 배치는 이 기기에 저장돼요.</li>
          <li><b>내 정보</b> 왼쪽 아래 이름을 누르면 레벨·경험치·이름 바꾸기가 있어요.</li>
        </ul>
        <p class="lab-help">기록은 서버가 아니라 이 기기의 브라우저에만 저장돼요. 브라우저 기록을 지우거나 다른 기기로 바꾸면 처음부터 시작해요. <a href="privacy.html">개인정보처리방침</a></p>`;
    } else if (action === "door") {
      let sameSite = false;
      try {
        sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin;
      } catch (e) {
        sameSite = false;
      }
      body.innerHTML = `
        <p class="lab-help">연구소 밖으로 나갈까요? <small>(ESC를 한 번 더 누르면 연구소에 남아요)</small></p>
        <div class="room-door-actions">
          <a class="btn btn-primary" href="index.html">홈으로 나가기</a>
          ${sameSite ? '<button type="button" class="btn btn-secondary" id="door-back">들어오기 전 페이지로</button>' : ""}
          <button type="button" class="btn btn-secondary" id="door-stay">연구소에 더 있을래요</button>
        </div>`;
      const back = document.getElementById("door-back");
      if (back)
        back.onclick = () => {
          leaving = true;
          history.go(-2); // 들어올 때 쌓아 둔 한 칸 + 원래 이전 페이지
        };
      document.getElementById("door-stay").onclick = closePanel;
    }
  }

  // ---------- 꾸미기 아이템 (dev.md #57) ----------
  let wardrobeSlot = "hair";
  let dexTab = "titles";
  const GRADE_CLASS = ["g0", "g1", "g2", "g3"];

  function previewCanvas(look, cls) {
    const { P } = labData();
    const c = P.avatarCanvas(cls || "", look);
    return c;
  }

  function lookWith(slot, id) {
    const { P } = labData();
    const lk = P.view().look;
    if (slot === "item") return Object.assign({}, lk, { item: id });
    const wear = Object.assign({}, lk.wear);
    wear[slot] = id;
    return Object.assign({}, lk, { wear: wear });
  }

  function gradeTag(g) {
    const G = window.AVATAR_PARTS.GRADES[g];
    return `<span class="grade-tag ${GRADE_CLASS[g]}">${G.name}</span>`;
  }

  function renderWardrobe(body, slot) {
    const { P, D } = labData();
    const A = window.AVATAR_PARTS;
    const v = P.view();
    const inv = P.inventory();
    wardrobeSlot = slot;
    const slots = A.SLOTS.map((s) => ({ id: s.id, name: s.name })).concat([{ id: "item", name: "손 소품" }]);
    body.innerHTML = `
      <div class="wd-top"><div class="wd-preview" id="wd-preview"></div>
        <p class="lab-help">가진 아이템만 입을 수 있어요. 레벨이 오르면 자동으로 생기고, 나머지는 <b>뽑기 기계</b>에서 뽑아요.</p></div>
      <div class="wd-tabs" role="tablist">${slots.map((s) => `<button type="button" role="tab" class="wd-tab${s.id === slot ? " on" : ""}" data-slot="${s.id}" aria-selected="${s.id === slot}">${s.name}</button>`).join("")}</div>
      <div class="wd-list" id="wd-list"></div>`;
    body.querySelector("#wd-preview").appendChild(previewCanvas(v.look, "wd-big"));
    body.querySelectorAll(".wd-tab").forEach((b) => (b.onclick = () => renderWardrobe(body, b.dataset.slot)));
    const list = body.querySelector("#wd-list");
    const add = (label, look, pressed, onPick, grade, count) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wd-item " + (grade != null ? GRADE_CLASS[grade] : "");
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.appendChild(previewCanvas(look));
      const name = document.createElement("span");
      name.className = "wd-name";
      name.textContent = label;
      btn.appendChild(name);
      if (count > 1) {
        const c = document.createElement("span");
        c.className = "wd-count";
        c.textContent = "×" + count;
        btn.appendChild(c);
      }
      btn.onclick = onPick;
      list.appendChild(btn);
    };
    const refresh = () => {
      if (room) room.refresh();
      renderHead();
      renderWardrobe(body, slot);
    };
    if (slot === "item") {
      const owned = D.badges.filter((b) => v.earned.some((e) => e.id === b.id)).map((b) => b.item);
      add("없음", lookWith("item", null), !v.look.item, () => { P.setLook({ item: null }); refresh(); });
      owned.forEach((id) => add(D.items[id].name, lookWith("item", id), v.look.item === id, () => { P.setLook({ item: id }); refresh(); }));
      if (!owned.length) list.insertAdjacentHTML("afterend", '<p class="lab-help">손 소품은 상장을 받으면 생겨요.</p>');
      return;
    }
    const sl = A.SLOTS.find((x) => x.id === slot);
    if (!sl.required) add("없음", lookWith(slot, null), !v.look.wear[slot], () => { P.setWear(slot, null); refresh(); });
    Object.values(A.ITEMS)
      .filter((it) => it.slot === slot && inv[it.id])
      .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name))
      .forEach((it) => add(it.name, lookWith(slot, it.id), v.look.wear[slot] === it.id, () => { P.setWear(slot, it.id); refresh(); }, it.grade, inv[it.id]));
  }

  // 뽑기 기계: 뽑기권으로 1회, 남는 아이템 10개로 교환 뽑기
  // ---------- 인테리어 아이템 미리보기 (dev.md #57 B) ----------
  const INTERIOR_GROUPS = [
    { id: "floor", name: "가구", kinds: ["floor"] },
    { id: "wall", name: "벽 장식", kinds: ["wall"] },
    { id: "room", name: "벽지·바닥", kinds: ["wallpaper", "flooring"] },
  ];

  function interiorCanvas(id, cls) {
    const I = window.INTERIOR_PARTS;
    const it = I && I.ITEMS[id];
    const c = document.createElement("canvas");
    c.className = "px-avatar " + (cls || "");
    c.setAttribute("aria-hidden", "true");
    if (!it) return c;
    const k = I.KINDS[it.kindId];
    const ctx = c.getContext("2d");
    const p = (x, y, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    if (it.kind === "wallpaper") {
      c.width = 32;
      c.height = 32;
      I.drawWallpaper(p, id, 32, 32);
    } else if (it.kind === "flooring") {
      c.width = 32;
      c.height = 32;
      I.drawFlooring(p, id, 32, 0, 32, 16);
    } else if (it.kind === "wall") {
      c.width = (k.w || 1) * 16;
      c.height = 32;
      p(0, 0, c.width, 32, "#e3f1ff");
      I.drawItem(p, id, 0, 0);
    } else {
      const w = (k.w || 1) * 16;
      const h = Math.max(16, Math.ceil(Math.max(k.vh || 0, k.h || 1) * 16)) + 2;
      c.width = w;
      c.height = h;
      I.drawItem(p, id, 0, h);
    }
    return c;
  }

  // 아이템 하나의 그림 (옷이면 캐릭터에 입혀서, 가구면 가구 그림)
  function itemArt(it, cls) {
    if (it.slot === "interior") return interiorCanvas(it.id, cls);
    return previewCanvas(lookWith(it.slot, it.id), cls);
  }

  // 뽑기 기계: 옷 / 가구 탭, 뽑기권으로 1회, 남는 아이템 10개로 교환 뽑기(카테고리별)
  let gachaCat = "wear";
  function renderGacha(body, result) {
    const { P } = labData();
    const A = window.AVATAR_PARTS;
    if (!A) return;
    const hasInterior = !!window.INTERIOR_PARTS;
    if (!hasInterior) gachaCat = "wear";
    const t = P.tickets();
    const rates = A.GACHA.rates.map((r, g) => `${A.GRADES[g].name} ${Math.round(r * 1000) / 10}%`).join(" · ");
    const ex = [0, 1, 2, 3].map((g) => {
      const n = P.extras(g, gachaCat);
      const up = A.GACHA.upgradeRate[g];
      return `<li class="gx-row">${gradeTag(g)}<span>남는 아이템 <b>${n}</b>/${A.GACHA.exchangeCost}</span><button type="button" class="room-tool gx-btn" data-grade="${g}"${n >= A.GACHA.exchangeCost ? "" : " disabled"}>교환 뽑기</button><small>${up ? `${Math.round(up * 100)}% 확률로 ${A.GRADES[g + 1].name}` : "같은 등급만"}</small></li>`;
    });
    const catName = gachaCat === "interior" ? "가구" : "옷";
    body.innerHTML = `
      ${hasInterior ? `<div class="wd-tabs gacha-cats"><button type="button" class="wd-tab${gachaCat === "wear" ? " on" : ""}" data-cat="wear">👗 옷 뽑기</button><button type="button" class="wd-tab${gachaCat === "interior" ? " on" : ""}" data-cat="interior">🛋 가구 뽑기</button></div>` : ""}
      <div class="gacha-box">
        <div class="gacha-result" id="gacha-result">${result ? "" : `<div class="gacha-capsule idle${gachaCat === "interior" ? " blue" : ""}" aria-hidden="true"></div>`}</div>
        <p class="gacha-tickets">뽑기권 <b>${t}</b>장 <small>(옷·가구 같이 써요)</small></p>
        <button type="button" class="btn btn-primary gacha-pull" id="gacha-pull"${t > 0 ? "" : " disabled"}>${catName} 뽑기 1회</button>
        <p class="lab-help">경험치 ${A.GACHA.xpPerTicket}마다 뽑기권 1장이 생겨요. 테스트·출석으로 경험치를 모아 보세요.<br />${rates}</p>
      </div>
      <h3 class="gx-title">남는 ${catName} 교환</h3>
      <p class="lab-help">같은 아이템을 2개 이상 가지면 1개를 뺀 나머지가 '남는 아이템'이에요. 같은 등급 ${A.GACHA.exchangeCost}개로 교환 뽑기를 할 수 있고, 낮은 확률로 한 단계 위 등급이 나와요. (옷과 가구는 따로 세요)</p>
      <ul class="gx-list">${ex.join("")}</ul>`;
    if (result) showResult(body.querySelector("#gacha-result"), result);
    body.querySelectorAll(".gacha-cats .wd-tab").forEach((b) => {
      b.onclick = () => {
        gachaCat = b.dataset.cat;
        renderGacha(body, null);
      };
    });
    body.querySelector("#gacha-pull").onclick = () => {
      const r = P.pull(gachaCat);
      if (r) spin(body, r);
    };
    body.querySelectorAll(".gx-btn").forEach((b) => {
      b.onclick = () => {
        const r = P.exchange(Number(b.dataset.grade), gachaCat);
        if (r) spin(body, r);
      };
    });
  }

  function spin(body, r) {
    const box = body.querySelector("#gacha-result");
    body.querySelectorAll("button").forEach((b) => (b.disabled = true));
    box.innerHTML = `<div class="gacha-capsule spin${gachaCat === "interior" ? " blue" : ""}" aria-hidden="true"></div><p class="gacha-wait">두근두근…</p>`;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      renderGacha(body, r);
      if (room) room.refresh();
      renderHead();
    }, reduce ? 150 : 1100);
  }

  function showResult(box, r) {
    const A = window.AVATAR_PARTS;
    const it = r.item;
    const isInterior = it.slot === "interior";
    const slotName = isInterior
      ? (INTERIOR_GROUPS.find((g) => g.kinds.indexOf(it.kind) >= 0) || { name: "가구" }).name
      : A.SLOTS.find((s) => s.id === it.slot).name;
    box.innerHTML = `
      <div class="gacha-card ${GRADE_CLASS[it.grade]}">
        <div class="gacha-card-art"></div>
        <div>${gradeTag(it.grade)}${r.isNew ? '<span class="gacha-new">NEW</span>' : `<span class="gacha-dup">${r.count}개째</span>`}${r.upgraded ? '<span class="gacha-new up">등급 업!</span>' : ""}
          <p class="gacha-name">${escapeHtml(it.name)}</p>
          <p class="gacha-slot">${escapeHtml(slotName)}</p>
          <button type="button" class="room-tool" id="gacha-wear">${isInterior ? (it.kind === "wallpaper" || it.kind === "flooring" ? "바로 바꿔 보기" : "방에 놓으러 가기") : "바로 입어 보기"}</button>
        </div>
      </div>`;
    box.querySelector(".gacha-card-art").appendChild(itemArt(it, "gacha-art"));
    box.querySelector("#gacha-wear").onclick = () => {
      if (isInterior) {
        closePanel();
        if (it.kind === "wallpaper" && room) room.setWallpaper(it.id);
        else if (it.kind === "flooring" && room) room.setFlooring(it.id);
        else {
          setEditMode(true);
          storageTab = it.kind === "wall" ? "wall" : "floor";
          renderStorage();
          if (room) room.startPlacing(it.id);
        }
        return;
      }
      labData().P.setWear(it.slot, it.id);
      if (room) room.refresh();
      renderHead();
      wardrobeSlot = it.slot;
      openPanel("wardrobe");
    };
  }

  // 도감: 칭호 16칸 + 옷(부위별) + 가구(종류별). 못 모은 건 ?
  function renderDex(body, tab) {
    const { P, D } = labData();
    const A = window.AVATAR_PARTS;
    const I = window.INTERIOR_PARTS;
    const v = P.view();
    dexTab = tab;
    const tabs = [{ id: "titles", name: `칭호 ${v.seen.length}/16` }];
    let inv = {};
    const pools = {};
    if (A) {
      inv = P.inventory();
      A.SLOTS.forEach((s) => {
        pools[s.id] = Object.values(A.ITEMS).filter((it) => it.slot === s.id);
        tabs.push({ id: s.id, name: `${s.name} ${pools[s.id].filter((it) => inv[it.id]).length}/${pools[s.id].length}` });
      });
    }
    if (I) {
      INTERIOR_GROUPS.forEach((g) => {
        const id = "in-" + g.id;
        pools[id] = Object.values(I.ITEMS).filter((it) => g.kinds.indexOf(it.kind) >= 0);
        tabs.push({ id: id, name: `${g.name} ${pools[id].filter((it) => inv[it.id]).length}/${pools[id].length}` });
      });
    }
    body.innerHTML = `<div class="wd-tabs">${tabs.map((t) => `<button type="button" class="wd-tab${t.id === tab ? " on" : ""}" data-tab="${t.id}">${t.name}</button>`).join("")}</div><div id="dex-body"></div>`;
    body.querySelectorAll(".wd-tab").forEach((b) => (b.onclick = () => renderDex(body, b.dataset.tab)));
    const box = body.querySelector("#dex-body");
    if (tab === "titles" || !pools[tab]) {
      box.innerHTML = `<p class="lab-help">어떤 테스트에서든 그 유형의 결과가 나오면 칸이 열려요. 칭호는 가장 최근에 직접 끝낸 결과로 정해지고, 앞의 말은 레벨이 오를수록 바뀌어요.</p><ul class="lab-dex">${dexHtml(v, D)}</ul>`;
      return;
    }
    const grid = document.createElement("ul");
    grid.className = "item-dex";
    pools[tab]
      .slice()
      .sort((a, b) => a.grade - b.grade || String(a.shape || a.kindId).localeCompare(String(b.shape || b.kindId)))
      .forEach((it) => {
        const li = document.createElement("li");
        li.className = "item-cell " + GRADE_CLASS[it.grade] + (inv[it.id] ? " got" : "");
        if (inv[it.id]) {
          li.appendChild(itemArt(it));
          li.insertAdjacentHTML("beforeend", `<span>${escapeHtml(it.name)}</span>`);
        } else {
          li.innerHTML = `<b aria-hidden="true">?</b><span>${A.GRADES[it.grade].name}</span>`;
          li.setAttribute("aria-label", "아직 못 모은 " + A.GRADES[it.grade].name + " 아이템");
        }
        grid.appendChild(li);
      });
    box.appendChild(grid);
  }

  // ---------- 배치 모드: 가구 보관함 + 고른 가구 도구 ----------
  let storageTab = "floor";
  function setEditMode(on) {
    if (!room) return;
    room.setEdit(on);
    const editBtn = document.getElementById("room-edit");
    const resetBtn = document.getElementById("room-reset");
    editBtn.textContent = on ? "✔" : "🛠";
    editBtn.setAttribute("aria-label", on ? "배치 끝내기" : "배치 바꾸기");
    editBtn.classList.toggle("on", on);
    resetBtn.hidden = !on;
    const dock = document.getElementById("edit-dock");
    if (dock) {
      dock.hidden = !on;
      placeDock();
    }
    showPickTools(null);
    setPlacingBar(null);
    if (on) renderStorage();
  }

  function placeDock() {
    const dock = document.getElementById("edit-dock");
    const hud = document.getElementById("game-hud");
    if (dock && hud) dock.style.bottom = hud.offsetHeight + "px";
  }

  function renderStorage() {
    const box = document.getElementById("edit-storage");
    const { P } = labData();
    const I = window.INTERIOR_PARTS;
    if (!box || !I || !room) return;
    const inv = P.inventory();
    const rs = room.room();
    const group = INTERIOR_GROUPS.find((g) => g.id === storageTab) || INTERIOR_GROUPS[0];
    const owned = Object.values(I.ITEMS)
      .filter((it) => inv[it.id] && group.kinds.indexOf(it.kind) >= 0)
      .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name));
    box.innerHTML = `
      <div class="wd-tabs">${INTERIOR_GROUPS.map((g) => `<button type="button" class="wd-tab${g.id === storageTab ? " on" : ""}" data-st="${g.id}">${g.name}</button>`).join("")}</div>
      <div class="storage-list" id="storage-list"></div>`;
    box.querySelectorAll("[data-st]").forEach((b) => {
      b.onclick = () => {
        storageTab = b.dataset.st;
        renderStorage();
      };
    });
    const list = box.querySelector("#storage-list");
    if (group.id === "room") {
      // 기본으로 되돌리기
      [["wallpaper", "기본 벽지"], ["flooring", "기본 바닥"]].forEach(([kind, label]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "storage-item";
        btn.setAttribute("aria-pressed", String(kind === "wallpaper" ? !rs.wallpaper : !rs.flooring));
        btn.innerHTML = `<span class="storage-swatch ${kind}"></span><span class="wd-name">${label}</span>`;
        btn.onclick = () => {
          if (kind === "wallpaper") room.setWallpaper(null);
          else room.setFlooring(null);
          renderStorage();
        };
        list.appendChild(btn);
      });
    }
    if (!owned.length && group.id !== "room") {
      list.insertAdjacentHTML("beforeend", `<p class="lab-help">아직 ${group.name}이 없어요. 뽑기 기계에서 '가구 뽑기'를 해 보세요.</p>`);
    }
    owned.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "storage-item " + GRADE_CLASS[it.grade];
      let left = null;
      if (it.kind === "wallpaper" || it.kind === "flooring") {
        const on = (it.kind === "wallpaper" ? rs.wallpaper : rs.flooring) === it.id;
        btn.setAttribute("aria-pressed", String(on));
      } else {
        left = inv[it.id] - room.placedCount(it.id);
        btn.disabled = left <= 0;
      }
      btn.appendChild(interiorCanvas(it.id));
      btn.insertAdjacentHTML("beforeend", `<span class="wd-name">${escapeHtml(it.name)}</span>${left != null ? `<span class="wd-count">${left}/${inv[it.id]}</span>` : ""}`);
      btn.onclick = () => {
        if (it.kind === "wallpaper") {
          room.setWallpaper(it.id);
          renderStorage();
        } else if (it.kind === "flooring") {
          room.setFlooring(it.id);
          renderStorage();
        } else {
          room.startPlacing(it.id);
          setPlacingBar(it.name);
        }
      };
      list.appendChild(btn);
    });
  }

  // 보관함에서 꺼내는 중: 보관함을 접고 "○○ 놓는 중 · 취소" 한 줄만
  function setPlacingBar(name) {
    const dock = document.getElementById("edit-dock");
    const tools = document.getElementById("edit-tools");
    if (!dock || !tools) return;
    dock.classList.toggle("placing", !!name);
    if (!name) {
      tools.hidden = true;
      return;
    }
    tools.hidden = false;
    tools.innerHTML = `<span class="edit-tools-name">${escapeHtml(name)} 놓는 중 — 방에서 놓을 칸을 누르세요</span>
      <button type="button" class="room-tool" id="tool-cancel-place">취소</button>`;
    tools.querySelector("#tool-cancel-place").onclick = () => {
      room.cancelPlacing();
      setPlacingBar(null);
    };
  }

  function showPickTools(info) {
    const tools = document.getElementById("edit-tools");
    if (!tools) return;
    if (!info) {
      tools.hidden = true;
      return;
    }
    tools.hidden = false;
    tools.innerHTML = `<span class="edit-tools-name">${escapeHtml(info.name)}</span>
      <button type="button" class="room-tool" id="tool-flip">↔ 뒤집기</button>
      ${info.placed ? '<button type="button" class="room-tool" id="tool-store">📦 보관함에 넣기</button>' : ""}
      <button type="button" class="room-tool" id="tool-cancel">선택 취소</button>`;
    tools.querySelector("#tool-flip").onclick = () => room.flipPicked();
    const st = tools.querySelector("#tool-store");
    if (st) st.onclick = () => room.storePicked();
    tools.querySelector("#tool-cancel").onclick = () => room.unpick();
  }

  function dexHtml(v, D) {
    return D.typeOrder
      .map((code) => {
        const open = v.seen.indexOf(code) >= 0;
        const t = D.types[code];
        return open
          ? `<li class="lab-dex-cell open"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.line)}</span></li>`
          : `<li class="lab-dex-cell"><strong>?</strong><span>아직 못 만난 칭호</span></li>`;
      })
      .join("");
  }

  function badgesHtml(v, D, P) {
    return D.badges
      .map((b) => {
        const got = v.earned.find((e) => e.id === b.id);
        if (got) {
          const item = D.items[b.item];
          return `<li class="lab-badge got"><span class="lab-badge-mark">🏅</span><div><strong>${escapeHtml(b.name)} 상장</strong><p>위 사람은 ${escapeHtml(b.line)} 이에 상장을 수여합니다.</p><p class="lab-badge-sub">${escapeHtml(got.date)}${item ? ` · 소품 '${escapeHtml(item.name)}'` : ""}</p></div></li>`;
        }
        if (b.hidden) return `<li class="lab-badge"><span class="lab-badge-mark">❔</span><div><strong>???</strong><p>숨은 상장이에요. 어떤 조건일까요?</p></div></li>`;
        const p = P.progress(b);
        const prog = p ? ` (${Math.min(p.have, p.need)}/${p.need})` : "";
        return `<li class="lab-badge"><span class="lab-badge-mark">🔒</span><div><strong>${escapeHtml(b.name)} 상장</strong><p>${escapeHtml(badgeCondition(b, D))}${prog}</p></div></li>`;
      })
      .join("");
  }

  // 달력: 한 달 단위, 출석한 날에 도장. ‹ › 로 지난 달 보기
  // 달력: profile.js 공용 그리기 (홈 카드 달력 창과 같음)
  function renderCalendar(body, v, month) {
    labData().P.renderCalendar(body, month);
  }


  function completedEntries() {
    const archive = loadArchive();
    return Object.keys(archive)
      .map((testId) => {
        const r = findResult(testId, archive[testId].code);
        return r ? Object.assign({}, r, { date: archive[testId].date }) : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function cardHtml(e) {
    return `<a class="test-card live" href="${escapeHtml(e.path)}"><div class="test-card-emoji" style="background:#f1e8dd">${escapeHtml(e.emoji)}</div><div class="test-card-body"><p class="test-card-title">${escapeHtml(e.testTitle)}</p><p class="test-card-sub">${escapeHtml(e.name)}</p></div><span class="archive-card-date">${escapeHtml(e.date)}</span></a>`;
  }

  // 내 연구원 이름 = 테스트 닉네임 (dev.md #55). 보기 ↔ 바꾸기
  function renderNick(form) {
    const P = window.Profile;
    if (!form || !P) return;
    const nick = P.getNick();
    const show = (editing) => {
      form.innerHTML = "";
      if (editing || !nick) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = P.NICK_MAX;
        input.className = "me-name-input";
        input.placeholder = "연구원 이름 (테스트 닉네임)";
        input.value = nick;
        input.setAttribute("aria-label", "연구원 이름");
        const btn = document.createElement("button");
        btn.type = "submit";
        btn.className = "me-name-btn";
        btn.textContent = "저장";
        form.appendChild(input);
        form.appendChild(btn);
        form.onsubmit = (e) => {
          e.preventDefault();
          P.setNick(input.value);
          renderHead();
          if (openAction === "me") fillPanel("me", document.getElementById("room-panel-body"));
        };
        if (editing) input.focus();
      } else {
        const name = document.createElement("span");
        name.className = "lab-nick-name";
        name.textContent = "🧪 " + nick;
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "nick-change";
        edit.textContent = "이름 바꾸기";
        edit.onclick = () => show(true);
        form.appendChild(name);
        form.appendChild(edit);
        form.onsubmit = (e) => e.preventDefault();
      }
    };
    show(false);
  }

  function badgeCondition(b, D) {
    switch (b.kind) {
      case "count": return `테스트 ${b.n}개 완주`;
      case "all": return "공개된 테스트 전부 완주";
      case "group": return `${D.groups[b.group]} 묶음 테스트 전부 완주`;
      case "streak": return `${b.n}일 연속 출석`;
      case "days": return `출석 ${b.n}번`;
      default: return "";
    }
  }

  // 꾸미기: 머리 3 · 가운(레벨 해금) · 손 소품(상장 해금). onChange 로 방 캐릭터·창을 다시 그린다.
  function renderLook(box, onChange) {
    const P = window.Profile;
    const D = window.PROFILE_DATA;
    if (!box) return;
    const v = P.view();
    const owned = D.badges.filter((b) => v.earned.some((e) => e.id === b.id)).map((b) => b.item);
    const option = (label, preview, pressed, locked, onPick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "me-hair-btn" + (locked ? " locked" : "");
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.disabled = !!locked;
      btn.appendChild(P.avatarCanvas("", preview));
      const span = document.createElement("span");
      span.textContent = label;
      btn.appendChild(span);
      if (!locked) btn.onclick = onPick;
      return btn;
    };
    const rerender = () => {
      renderHead();
      if (onChange) onChange();
    };
    box.innerHTML = '<p class="lab-look-title">머리 모양</p><div class="lab-look-row" data-slot="hair"></div><p class="lab-look-title">가운 <small>레벨이 오르면 열려요</small></p><div class="lab-look-row" data-slot="coat"></div><p class="lab-look-title">손 소품 <small>상장을 받으면 열려요</small></p><div class="lab-look-row" data-slot="item"></div>';
    const row = (slot) => box.querySelector(`[data-slot="${slot}"]`);
    D.hairs.forEach((h) =>
      row("hair").appendChild(option(h.name, Object.assign({}, v.look, { hair: h.id }), v.look.hair === h.id, false, () => { P.setLook({ hair: h.id }); rerender(); }))
    );
    D.coats.forEach((c) => {
      const locked = c.level > v.level;
      row("coat").appendChild(option(locked ? `Lv.${c.level}` : c.name, Object.assign({}, v.look, { coat: c.id }), v.look.coat === c.id, locked, () => { P.setLook({ coat: c.id }); rerender(); }));
    });
    row("item").appendChild(option("없음", Object.assign({}, v.look, { item: null }), !v.look.item, false, () => { P.setLook({ item: null }); rerender(); }));
    owned.forEach((id) =>
      row("item").appendChild(option(D.items[id].name, Object.assign({}, v.look, { item: id }), v.look.item === id, false, () => { P.setLook({ item: id }); rerender(); }))
    );
    if (!owned.length) {
      const p = document.createElement("p");
      p.className = "lab-help";
      p.textContent = "아직 받은 소품이 없어요. 첫 테스트를 끝내면 '표본병'을 받아요.";
      row("item").after(p);
    }
  }

  function render() {
    renderLab();
    const root = document.getElementById("archive-app");
    if (!root) return;

    const archive = loadArchive();
    const entries = Object.keys(archive)
      .map((testId) => {
        const r = findResult(testId, archive[testId].code);
        return r ? Object.assign({}, r, { date: archive[testId].date }) : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 최근 완료순

    if (!entries.length) {
      renderEmpty(root);
      return;
    }

    const insightHtml = buildInsight(entries);

    const cardsHtml = entries
      .map(
        (e) =>
          `<a class="test-card live" href="${escapeHtml(e.path)}"><div class="test-card-emoji" style="background:#f1e8dd">${escapeHtml(e.emoji)}</div><div class="test-card-body"><p class="test-card-title">${escapeHtml(e.testTitle)}</p><p class="test-card-sub">${escapeHtml(e.name)}</p></div><span class="archive-card-date">${escapeHtml(e.date)}</span></a>`
      )
      .join("");

    root.innerHTML = `
      <div class="archive-insight" id="archive-insight">${insightHtml}</div>
      <div class="archive-list">${cardsHtml}</div>
      <div class="archive-actions">
        <button type="button" class="btn btn-primary" id="save-archive-btn">요약 카드 저장 🖼️</button>
      </div>
    `;

    const saveBtn = document.getElementById("save-archive-btn");
    if (saveBtn) saveBtn.onclick = () => saveArchiveCard(entries, insightHtml);
  }

  // ---------- 요약 카드 이미지 저장 (engine.js의 결과 카드 저장과 같은 방식) ----------
  function buildSummaryCard(entries, insightHtml) {
    const card = document.createElement("div");
    card.style.cssText = [
      "position:fixed", "left:-9999px", "top:0",
      "width:1080px", "min-height:1350px",
      "display:flex", "flex-direction:column", "align-items:center",
      "box-sizing:border-box", "padding:100px 90px",
      "background:var(--bg)",
      "font-family:'Pretendard Variable',Pretendard,'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif",
      "text-align:center",
    ].join(";");

    const emojiRow = entries
      .slice(0, 24)
      .map((e) => `<span style="font-size:44px;line-height:1;margin:6px;">${e.emoji}</span>`)
      .join("");

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;font-size:32px;font-weight:800;color:var(--accent-dark);letter-spacing:0.02em;"><img src="${SITE_LOGO_SRC}" width="52" height="52" alt="" style="display:block;" />${SITE_NAME}</div>
      <div style="font-size:28px;font-weight:700;color:var(--text-sub);margin-top:16px;">내 연구실</div>
      <div style="font-size:38px;font-weight:800;color:var(--text);line-height:1.6;margin-top:40px;max-width:840px;">${insightHtml.replace(/<\/?strong>/g, "")}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;max-width:840px;margin-top:44px;">${emojiRow}</div>
      <div style="font-size:26px;color:var(--text-sub);margin-top:60px;">${SITE_NAME}에서 나도 연구원 되기</div>
    `;
    return card;
  }

  function saveArchiveCard(entries, insightHtml) {
    if (typeof window.track === "function") window.track("save_image", { test_id: "archive", result_name: "" });
    if (typeof html2canvas === "undefined") {
      showToast("이미지 생성 기능을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.");
      return;
    }
    const btn = document.getElementById("save-archive-btn");
    const original = btn ? btn.textContent : "";
    const reset = () => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    };
    if (btn) {
      btn.disabled = true;
      btn.textContent = "카드 만드는 중...";
    }

    const card = buildSummaryCard(entries, insightHtml);
    document.body.appendChild(card);

    html2canvas(card, { scale: 1, backgroundColor: null })
      .then((canvas) => {
        if (card.parentNode) document.body.removeChild(card);
        canvas.toBlob((blob) => {
          if (!blob) {
            showToast("이미지 생성에 실패했어요. 다시 시도해주세요.");
            reset();
            return;
          }
          deliverCardImage(blob);
          reset();
        }, "image/png");
      })
      .catch(() => {
        if (card.parentNode) document.body.removeChild(card);
        showToast("이미지 생성에 실패했어요. 다시 시도해주세요.");
        reset();
      });
  }

  function deliverCardImage(blob) {
    const fileName = `${SITE_NAME}_내연구실.png`;
    let file = null;
    try {
      file = new File([blob], fileName, { type: "image/png" });
    } catch (e) {
      file = null;
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: "내 연구실" })
        .catch(() => {
          /* 사용자가 공유를 취소한 경우 등은 무시 */
        });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast("이미지가 저장됐어요! 갤러리에서 확인해보세요 🖼️");
  }

  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  // 뒤로가기: 사이트 안에서 왔으면 이전 페이지로, 아니면(주소로 바로 들어옴) 홈으로.
  function initBack() {
    const back = document.getElementById("lab-back");
    if (!back) return;
    let sameSite = false;
    try {
      sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch (e) {
      sameSite = false;
    }
    if (sameSite && history.length > 1) {
      back.addEventListener("click", (e) => {
        e.preventDefault();
        history.back();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initBack);
  document.addEventListener("DOMContentLoaded", render);
})();
