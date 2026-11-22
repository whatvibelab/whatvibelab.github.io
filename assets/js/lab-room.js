/* ==========================================================================
   lab-room.js — 내 연구실 "게임 방" (dev.md #56)

   연구소 방 안에서 내 연구원을 움직이고, 가구를 눌러 기능을 연다.
     - 바닥을 누르면 그 칸까지 걸어간다(길찾기). PC는 방향키/WASD 로 한 칸씩, Space/Enter 로 앞의 물건 사용.
     - 가구를 누르면 옆 칸까지 걸어가서 그 가구의 기능을 연다(onUse 콜백 — archive.js 가 창을 띄운다).
     - "배치 바꾸기" 모드: 가구를 누르고 → 놓을 칸을 누르면 옮겨진다. 배치는 Profile(브라우저)에 저장.
   그림은 전부 이 파일 안에서 도트로 그린다(외부 이미지 없음). 캐릭터는 Profile.drawAvatar 를 쓴다.

   LabRoom.mount(container, {
     getLook(),                 // 현재 아바타 모습
     getLayout(), saveLayout(l) // 가구 배치 {id: {x, y}}
     onUse(action, item),       // 가구 사용
     onHint(text),              // 지금 가까이 있는 물건 안내 문구
     extraItems()               // (나중) 인테리어 아이템 [{id, type, ...}]
   }) → { refresh(), setEdit(on), isEdit() }
   ========================================================================== */

(function () {
  "use strict";

  const T = 16; // 한 칸 = 16 도트
  // 방 크기(칸)는 화면에 맞춰 resize() 로 바뀐다. 최소 12×10 — 기본 배치는 이 안에 있다.
  let COLS = 12;
  let ROWS = 10;
  const FLOOR_TOP = 3; // 0~2행은 벽, 3~9행은 바닥
  let W = COLS * T;
  let H = ROWS * T;

  // 가구 종류. w×h = 바닥에서 차지하는 칸(벽 가구는 h 무시), vh = 그림 높이(칸).
  const TYPES = {
    wardrobe: { name: "옷장", w: 2, h: 1, vh: 2, action: "wardrobe", hint: "옷장 — 머리·장식·안경·옷·효과 꾸미기" },
    bookshelf: { name: "책장", w: 2, h: 1, vh: 2, action: "dex", hint: "책장 — 칭호 도감" },
    desk: { name: "책상", w: 2, h: 1, vh: 1.5, action: "records", hint: "책상 — 연구 기록(완료한 테스트)" },
    plant: { name: "화분", w: 1, h: 1, vh: 1.5, action: null, hint: "화분" },
    gacha: { name: "뽑기 기계", w: 1, h: 1, vh: 2, action: "gacha", hint: "뽑기 기계 — 꾸미기 아이템 뽑기" },
    rug: { name: "러그", w: 3, h: 2, vh: 0, action: null, walk: true, hint: "" },
    calendar: { name: "달력", w: 1, wall: true, action: "calendar", hint: "달력 — 출석 현황" },
    frame: { name: "상장 액자", w: 2, wall: true, action: "badges", hint: "상장 액자 — 받은 상장" },
    window: { name: "창문", w: 2, wall: true, action: null, hint: "창문" },
  };
  // 기본 배치 (사용자가 바꾸면 Profile 에 저장된 값이 우선)
  const DEFAULT_LAYOUT = {
    wardrobe: { x: 4, y: 3 },
    bookshelf: { x: 8, y: 3 },
    desk: { x: 9, y: 7 },
    plant: { x: 11, y: 3 },
    gacha: { x: 0, y: 6 },
    rug: { x: 4, y: 6 },
    calendar: { x: 3, y: 0 },
    frame: { x: 8, y: 0 },
    window: { x: 10, y: 0 },
  };
  const DOOR = { x: 0, w: 2 }; // 뒷벽 맨 왼쪽 출입문(고정, 2칸) — 바로 아래 바닥 칸에서 사용
  const START = { x: 5, y: 8 };

  const C = {
    k: "#2b2320",
    wall: "#e3f1ff",
    wallLine: "#d0e4f6",
    wallBase: "#b9cde0",
    floorA: "#efe4d6",
    floorB: "#e4d5c2",
    wood: "#b98552",
    woodD: "#8a5a32",
    woodL: "#d9a46a",
  };

  function mount(container, opts) {
    const canvas = document.createElement("canvas");
    canvas.className = "room-canvas";
    canvas.width = W;
    canvas.height = H;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "내 연구실 방. 바닥을 눌러 움직이고 물건을 눌러 사용해요. 키보드는 방향키와 스페이스.");
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    let ctx = canvas.getContext("2d"); // 테두리 만들 때 잠깐 다른 캔버스로 바꿔 그린다

    // 기본 배치는 방 크기에 맞춰 퍼뜨린다. 한 번이라도 직접 옮기면(저장값) 그 배치를 그대로 쓴다.
    function defaultsFor(c, r) {
      const mid = Math.round(r * 0.5);
      // 옷장은 출입문(0~1칸) 바로 옆에 붙이지 않는다 (2026-11-22 woody: 문 바로 옆은 답답해 보임)
      // 넓은 방: 뒷벽 왼쪽 1/4 지점. 좁은 방(휴대폰, 12~15칸): 뒷벽이 꽉 차므로 왼쪽 바닥 공간에.
      const narrow = c < 16;
      const wx = Math.max(4, Math.round(c * 0.25));
      const wardrobe = narrow ? { x: 0, y: Math.max(5, Math.round(r * 0.35)) } : { x: wx, y: 3 };
      const gachaY = Math.min(r - 1, Math.max(narrow ? wardrobe.y + 3 : 6, Math.round(r * 0.66)));
      return {
        wardrobe: wardrobe,
        bookshelf: { x: Math.min(c - 4, Math.max(9, Math.round(c * 0.7))), y: 3 },
        plant: { x: c - 1, y: 3 },
        rug: { x: Math.round(c / 2) - 2, y: Math.max(6, mid - 1) },
        desk: { x: c - 3, y: Math.max(7, mid + 1) },
        gacha: { x: 0, y: gachaY },
        calendar: { x: narrow ? 4 : Math.max(3, wx - 2), y: 0 },
        // 벽 물건은 키 큰 가구 바로 위를 피한다(말풍선이 아래로 달려서 겹치지 않게)
        frame: { x: Math.max(6, Math.round(c * 0.45)), y: 0 },
        window: { x: c - 2, y: 0 },
      };
    }
    const rawSaved = opts.getLayout ? opts.getLayout() : null;
    const savedLayout = sanitize(rawSaved);
    let custom = Object.keys(savedLayout).length > 0;
    let layout = Object.assign(defaultsFor(COLS, ROWS), savedLayout);
    // 인테리어 (dev.md #57 B): 꺼내 놓은 가구 [{uid, id, x, y, flip}], 기본 가구 좌우 반전 {id: true}, 벽지·바닥 아이템 id
    const IP = () => window.INTERIOR_PARTS;
    let placed = Array.isArray(rawSaved && rawSaved.__placed)
      ? rawSaved.__placed.filter((p) => p && typeof p.id === "string" && Number.isInteger(p.x) && Number.isInteger(p.y)).map((p) => ({ uid: String(p.uid || Math.random().toString(36).slice(2, 8)), id: p.id, x: p.x, y: p.y, flip: !!p.flip }))
      : [];
    let flips = rawSaved && rawSaved.__flip && typeof rawSaved.__flip === "object" ? Object.assign({}, rawSaved.__flip) : {};
    let wallpaper = rawSaved && typeof rawSaved.__wall === "string" ? rawSaved.__wall : null;
    let flooring = rawSaved && typeof rawSaved.__floor === "string" ? rawSaved.__floor : null;
    let placing = null; // 보관함에서 꺼내는 중인 아이템 id

    function serialize() {
      const out = custom ? Object.assign({}, layout) : {};
      out.__placed = placed.map((p) => ({ uid: p.uid, id: p.id, x: p.x, y: p.y, flip: !!p.flip }));
      out.__flip = Object.assign({}, flips);
      out.__wall = wallpaper;
      out.__floor = flooring;
      return out;
    }
    function persist() {
      opts.saveLayout && opts.saveLayout(serialize());
    }
    const player = { x: START.x, y: START.y, px: START.x * T, py: START.y * T, path: [], face: 1, moving: false, pending: null };
    let edit = false;
    let picked = null;
    let avatar = document.createElement("canvas");
    let frame = 0;
    let last = 0;
    let lastHint = "";

    function sanitize(l) {
      const out = {};
      if (!l || typeof l !== "object") return out;
      Object.keys(DEFAULT_LAYOUT).forEach((id) => {
        const p = l[id];
        if (p && Number.isInteger(p.x) && Number.isInteger(p.y)) out[id] = { x: p.x, y: p.y };
      });
      return out;
    }

    // 꺼내 놓은 가구의 모양 정보 (interior-parts.js KINDS)
    function placedProps(inst) {
      const it = IP() && IP().ITEMS[inst.id];
      if (!it) return null;
      const k = IP().KINDS[it.kindId];
      return { name: it.name, w: k.w || 1, h: k.h || 1, vh: k.vh || 1, wall: k.kind === "wall", walk: !!k.walk, action: null, hint: it.name };
    }
    function propsOf(id) {
      if (TYPES[id]) return TYPES[id];
      const inst = placed.find((p) => "p:" + p.uid === id);
      return inst ? placedProps(inst) : null;
    }
    function clampPos(id, p) {
      const t = propsOf(id);
      const x = Math.max(t.wall ? DOOR.x + DOOR.w : 0, Math.min(COLS - t.w, p.x));
      const y = t.wall ? 0 : Math.max(FLOOR_TOP, Math.min(ROWS - (t.h || 1), p.y));
      return { x: x, y: y };
    }

    function items() {
      const fixed = Object.keys(layout).map((id) => Object.assign({ id: id, type: id, flip: !!flips[id] }, TYPES[id], clampPos(id, layout[id])));
      const extra = placed
        .map((inst) => {
          const pr = placedProps(inst);
          if (!pr) return null;
          const id = "p:" + inst.uid;
          return Object.assign({ id: id, type: "interior", itemId: inst.id, flip: inst.flip, placed: true }, pr, clampPos(id, inst));
        })
        .filter(Boolean);
      return fixed.concat(extra);
    }
    function itemFull(id) {
      return items().find((it) => it.id === id) || null;
    }

    let lookCache = null;
    function refreshAvatar() {
      avatar = document.createElement("canvas");
      lookCache = opts.getLook ? opts.getLook() : null;
      if (window.Profile) window.Profile.drawAvatar(avatar, lookCache, frame);
    }

    // ---------- 충돌·길찾기 ----------
    function blockedGrid(ignoreId) {
      const g = [];
      for (let y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(y < FLOOR_TOP));
      items().forEach((it) => {
        if (it.wall || it.walk || it.id === ignoreId) return;
        for (let dy = 0; dy < it.h; dy++) for (let dx = 0; dx < it.w; dx++) {
          const yy = it.y + dy;
          const xx = it.x + dx;
          if (yy < ROWS && xx < COLS) g[yy][xx] = true;
        }
      });
      return g;
    }

    function findPath(from, to) {
      const g = blockedGrid();
      if (to.y < FLOOR_TOP || to.y >= ROWS || to.x < 0 || to.x >= COLS || g[to.y][to.x]) return null;
      const key = (p) => p.y * COLS + p.x;
      const prev = new Map();
      const q = [from];
      prev.set(key(from), null);
      while (q.length) {
        const cur = q.shift();
        if (cur.x === to.x && cur.y === to.y) {
          const path = [];
          let c = cur;
          while (c && !(c.x === from.x && c.y === from.y)) {
            path.unshift(c);
            c = prev.get(key(c));
          }
          return path;
        }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const n = { x: cur.x + dx, y: cur.y + dy };
          if (n.x < 0 || n.x >= COLS || n.y < FLOOR_TOP || n.y >= ROWS) return;
          if (g[n.y][n.x] || prev.has(key(n))) return;
          prev.set(key(n), cur);
          q.push(n);
        });
      }
      return null;
    }

    // 물건을 쓸 수 있는 칸들 (바닥 가구는 둘레, 벽 가구·문은 바로 아래 바닥 줄)
    function useSpots(it) {
      const spots = [];
      if (it.wall || it.door) {
        for (let dx = 0; dx < it.w; dx++) spots.push({ x: it.x + dx, y: FLOOR_TOP, face: "up" });
      } else {
        for (let dx = 0; dx < it.w; dx++) spots.push({ x: it.x + dx, y: it.y + it.h, face: "up" });
        for (let dy = 0; dy < it.h; dy++) {
          spots.push({ x: it.x - 1, y: it.y + dy, face: "right" });
          spots.push({ x: it.x + it.w, y: it.y + dy, face: "left" });
        }
        for (let dx = 0; dx < it.w; dx++) spots.push({ x: it.x + dx, y: it.y - 1, face: "down" });
      }
      return spots;
    }

    function walkTo(target, then) {
      const path = findPath({ x: player.x, y: player.y }, target);
      if (!path) return false;
      player.path = path;
      player.pending = then || null;
      if (!path.length && then) {
        player.pending = null;
        then();
      }
      return true;
    }

    function goUse(it) {
      const g = blockedGrid();
      // 가까운 사용 칸부터
      const spots = useSpots(it)
        .filter((s) => s.x >= 0 && s.x < COLS && s.y >= FLOOR_TOP && s.y < ROWS && !g[s.y][s.x])
        .sort((a, b) => Math.abs(a.x - player.x) + Math.abs(a.y - player.y) - (Math.abs(b.x - player.x) + Math.abs(b.y - player.y)));
      const use = () => opts.onUse && opts.onUse(it.action, it);
      for (let i = 0; i < spots.length; i++) {
        if (walkTo(spots[i], use)) return;
      }
      use(); // 갈 수 있는 칸이 없으면 바로 연다
    }

    function doorItem() {
      return { id: "door", type: "door", door: true, wall: true, x: DOOR.x, y: 0, w: DOOR.w, action: "door", name: "출입문", hint: "출입문 — 연구소 밖으로 나가기" };
    }

    function allUsable() {
      return items().filter((it) => it.action).concat([doorItem()]);
    }

    // 화면 좌표의 물건 (그림 영역 기준, 위에 그려진 것 우선)
    function itemAt(tx, ty, fx, fy) {
      const list = allUsable().concat(items().filter((it) => !it.action));
      let hit = null;
      list.forEach((it) => {
        let x0, y0, x1, y1;
        if (it.door) {
          x0 = it.x * T; x1 = x0 + it.w * T; y0 = 0; y1 = FLOOR_TOP * T;
        } else if (it.wall) {
          x0 = it.x * T; x1 = x0 + it.w * T; y0 = (it.id === "window" ? 0.4 : 0.8) * T; y1 = 2.6 * T;
        } else if (it.walk) {
          return;
        } else {
          x0 = it.x * T; x1 = x0 + it.w * T; y1 = (it.y + it.h) * T; y0 = y1 - it.vh * T;
        }
        if (fx >= x0 && fx < x1 && fy >= y0 && fy < y1) {
          if (!hit || (hit.wall && !it.wall)) hit = it;
        }
      });
      return hit;
    }

    // ---------- 입력 ----------
    function toLocal(ev) {
      const r = canvas.getBoundingClientRect();
      const fx = ((ev.clientX - r.left) / r.width) * W;
      const fy = ((ev.clientY - r.top) / r.height) * H;
      return { fx: fx, fy: fy, tx: Math.floor(fx / T), ty: Math.floor(fy / T) };
    }

    // ---------- 배치 모드: 끌어서 옮기기 + 반투명 미리보기 (dev.md #56-5) ----------
    // drag: 누른 가구를 끄는 중 { id, offX, offY, sx, sy, moved, tx, ty }
    // hover: 보관함에서 꺼내는 중일 때 미리보기 칸 { tx, ty }
    let drag = null;
    let hover = null;
    let suppressClick = false;

    // 가구 하나를 (nx, ny) 에 놓아 보기 — 놓을 수 있으면 옮기고 true
    function moveTo(id, nx, ny) {
      const cur = itemFull(id);
      if (!cur || !fits(cur, nx, ny)) return false;
      if (cur.placed) {
        const inst = placed.find((q) => "p:" + q.uid === id);
        inst.x = nx;
        inst.y = ny;
      } else {
        if (!custom) Object.keys(layout).forEach((k) => (layout[k] = clampPos(k, layout[k])));
        layout[id] = { x: nx, y: ny };
        custom = true;
      }
      persist();
      return true;
    }

    // 끄는 위치 → 가구 왼쪽 위 칸 (누른 지점이 가구의 어디였는지 유지)
    function dragTarget(it, tx, ty, d) {
      d = d || drag;
      const nx = Math.max(0, Math.min(COLS - it.w, tx - d.offX));
      const ny = it.wall ? 0 : Math.max(FLOOR_TOP, Math.min(ROWS - (it.h || 1), ty - d.offY));
      return { x: nx, y: ny };
    }

    // 보관함에서 꺼내는 가구의 정보 (미리보기·판정용)
    function placingProps() {
      const it = placing && IP() && IP().ITEMS[placing];
      if (!it) return null;
      const k = IP().KINDS[it.kindId];
      return { id: "__new", type: "interior", itemId: placing, name: it.name, w: k.w || 1, h: k.h || 1, vh: k.vh || 1, wall: k.kind === "wall", walk: !!k.walk };
    }
    function placingTarget(pp, tx, ty) {
      const nx = Math.max(0, Math.min(COLS - pp.w, tx - Math.floor((pp.w - 1) / 2)));
      const ny = pp.wall ? 0 : Math.max(FLOOR_TOP, Math.min(ROWS - pp.h, ty));
      return { x: nx, y: ny };
    }

    // 평소 모드에서 가구를 꾹(0.45초) 누르면 배치 모드로 바뀌면서 그 가구를 바로 집어 든다.
    const LONG_PRESS_MS = 450;
    let lp = null;
    function cancelLongPress() {
      if (lp) clearTimeout(lp.timer);
      lp = null;
    }
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault()); // 휴대폰 길게 누르기 메뉴 막기

    // 평소 모드에서 가구 집어 들기 — 꾹 누르기(long) 또는 누른 채 바로 끌기(2026-11-22 woody: 꾹 안 눌러도 끌면 이동)
    // 손을 떼면 그 자리에 놓이고 배치 모드도 닫힌다(endDrag 의 fromLong).
    function startQuickDrag(l, long) {
      opts.onLongPress && opts.onLongPress(); // 바깥(archive.js)에서 배치 모드 켜기 → setEdit(true)
      if (!edit) edit = true;
      player.path = [];
      player.pending = null;
      drag = { id: l.id, offX: l.offX, offY: l.offY, sx: l.sx, sy: l.sy, moved: true, tx: l.tx, ty: l.ty, fromLong: true };
      setPicked(l.id);
      opts.onDrag && opts.onDrag(true);
      suppressClick = true;
      if (long) {
        try {
          // 실제로 화면을 만진 적이 있을 때만(아니면 브라우저가 막고 콘솔 오류를 남김)
          const ua = navigator.userActivation;
          if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(15);
        } catch (e) {
          /* 무시 */
        }
      }
      try {
        canvas.setPointerCapture(l.pid);
      } catch (e) {
        /* 무시 */
      }
      hint("끌어서 원하는 자리에 놓으세요 — 손을 떼면 옮겨져요");
    }

    canvas.addEventListener("pointerdown", (ev) => {
      if (!edit) {
        const p0 = toLocal(ev);
        const it0 = itemAt(p0.tx, p0.ty, p0.fx, p0.fy) || rugAt(p0.tx, p0.ty);
        cancelLongPress();
        if (!it0 || it0.door) return;
        lp = { id: it0.id, offX: p0.tx - it0.x, offY: it0.wall ? 0 : p0.ty - it0.y, sx: ev.clientX, sy: ev.clientY, tx: p0.tx, ty: p0.ty, pid: ev.pointerId };
        lp.timer = setTimeout(() => {
          const l = lp;
          lp = null;
          if (!l) return;
          startQuickDrag(l, true);
        }, LONG_PRESS_MS);
        return;
      }
      const p = toLocal(ev);
      if (placing) {
        hover = { tx: p.tx, ty: p.ty };
        return;
      }
      const it = itemAt(p.tx, p.ty, p.fx, p.fy) || rugAt(p.tx, p.ty);
      if (!it || it.door) return;
      drag = { id: it.id, offX: p.tx - it.x, offY: it.wall ? 0 : p.ty - it.y, sx: ev.clientX, sy: ev.clientY, moved: false, tx: p.tx, ty: p.ty };
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* 무시 */
      }
    });
    canvas.addEventListener("pointermove", (ev) => {
      // 가구를 누른 채 움직이면(8px 넘게) 꾹 누르지 않아도 바로 끌기 시작
      if (lp && Math.abs(ev.clientX - lp.sx) + Math.abs(ev.clientY - lp.sy) > 8) {
        const l = lp;
        cancelLongPress();
        startQuickDrag(l, false);
      }
      if (!edit) return;
      const p = toLocal(ev);
      if (placing) {
        hover = { tx: p.tx, ty: p.ty };
        return;
      }
      if (!drag) return;
      if (!drag.moved && Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 6) {
        drag.moved = true;
        setPicked(drag.id);
        opts.onDrag && opts.onDrag(true);
      }
      drag.tx = p.tx;
      drag.ty = p.ty;
      if (drag.moved) {
        const it = itemFull(drag.id);
        const t = it && dragTarget(it, drag.tx, drag.ty);
        if (it) hint(fits(it, t.x, t.y) ? "여기에 놓을 수 있어요 — 손을 떼면 옮겨져요" : "여기는 놓을 수 없어요");
      }
    });
    const endDrag = (ev, cancel) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.moved) return; // 짧게 누름 → click 에서 고르기
      suppressClick = true;
      opts.onDrag && opts.onDrag(false);
      const it = itemFull(d.id);
      if (!cancel && it) {
        const tt = dragTarget(it, d.tx, d.ty, d);
        if (tt.x === it.x && tt.y === it.y) {
          setPicked(d.id);
          hint(`${it.name}: 끌어서 옮기거나, 아래 버튼으로 뒤집기·넣기`);
          return;
        }
        if (moveTo(d.id, tt.x, tt.y)) {
          setPicked(null);
          // 꾹 눌러 시작한 이동은 손을 떼면 끝 — 배치 모드도 바로 닫는다(확인 버튼 없이, 2026-11-22 woody)
          if (d.fromLong) {
            opts.onQuickDropEnd && opts.onQuickDropEnd();
            hint(`${it.name} 자리를 옮겼어요!`);
          } else hint("옮겼어요! 다른 가구도 끌어서 옮길 수 있어요");
          return;
        }
      }
      setPicked(null);
      if (d.fromLong) opts.onQuickDropEnd && opts.onQuickDropEnd();
      hint("거기는 놓을 수 없어서 원래 자리로 돌아갔어요");
    };
    canvas.addEventListener("pointerup", (ev) => {
      cancelLongPress();
      endDrag(ev, false);
    });
    canvas.addEventListener("pointercancel", (ev) => {
      cancelLongPress();
      endDrag(ev, true);
    });
    canvas.addEventListener("pointerleave", () => {
      if (placing) hover = null;
    });

    canvas.addEventListener("click", (ev) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const p = toLocal(ev);
      if (edit) return editClick(p);
      const it = itemAt(p.tx, p.ty, p.fx, p.fy);
      if (it && (it.action || it.door)) return goUse(it);
      if (p.ty >= FLOOR_TOP) walkTo({ x: p.tx, y: p.ty });
    });

    // 키보드: 누르고 있는 방향을 기억해 두고 step() 이 칸이 끝날 때마다 바로 다음 칸으로 이어 간다.
    // (운영체제의 키 반복 지연을 기다리지 않아 부드럽다.) 가장 최근에 누른 방향이 우선.
    const DIRS = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    const held = []; // 누르고 있는 키 (나중에 누른 게 뒤)
    function heldDir() {
      for (let i = held.length - 1; i >= 0; i--) if (DIRS[held[i]]) return DIRS[held[i]];
      return null;
    }
    function keyTarget(ev) {
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return false;
      if (opts.isBlocked && opts.isBlocked()) return false; // 가구 창이 열려 있을 때 등
      return document.body.contains(canvas);
    }
    // 한 칸 앞으로 (막혀 있으면 방향만 바꾼다)
    function tryStep(d) {
      if (d[0]) player.face = d[0];
      player.facing = d;
      const n = { x: player.x + d[0], y: player.y + d[1] };
      const g = blockedGrid();
      if (n.x >= 0 && n.x < COLS && n.y >= FLOOR_TOP && n.y < ROWS && !g[n.y][n.x]) {
        player.path = [n];
        return true;
      }
      return false;
    }
    window.addEventListener("keydown", (ev) => {
      if (!keyTarget(ev) || edit) return;
      const d = DIRS[ev.key];
      if (d) {
        ev.preventDefault();
        if (held.indexOf(ev.key) < 0) held.push(ev.key);
        if (ev.repeat) return;
        player.pending = null;
        // 걷는 중이 아니면 바로 출발, 길찾기로 가던 중이면 지금 칸까지만 가고 키 방향으로
        if (!player.path.length) tryStep(d);
        else player.path = player.path.slice(0, 1);
        return;
      }
      if (ev.key === " " || ev.key === "Enter") {
        if (ev.target && ev.target.tagName === "BUTTON") return;
        ev.preventDefault();
        const near = nearItem();
        if (near) opts.onUse && opts.onUse(near.action, near);
      }
    });
    window.addEventListener("keyup", (ev) => {
      const i = held.indexOf(ev.key);
      if (i >= 0) held.splice(i, 1);
    });
    window.addEventListener("blur", () => {
      held.length = 0;
    });

    // 지금 서 있는 칸에서 쓸 수 있는 물건 (바라보는 방향 우선)
    function nearItem() {
      const cands = allUsable().filter((it) => useSpots(it).some((s) => s.x === player.x && s.y === player.y));
      if (!cands.length) return null;
      if (player.facing && cands.length > 1) {
        const [fx, fy] = player.facing;
        const tx = player.x + fx;
        const ty = player.y + fy;
        const f = cands.find((it) => (it.wall || it.door ? fy === -1 && tx >= it.x && tx < it.x + it.w : tx >= it.x && tx < it.x + it.w && ty >= it.y && ty < it.y + it.h));
        if (f) return f;
      }
      return cands[0];
    }

    // ---------- 배치 바꾸기 ----------
    function fits(it, x, y) {
      if (it.wall) {
        if (x < 0 || x + it.w > COLS) return false;
        if (x < DOOR.x + DOOR.w) return false; // 문 자리
        return !items().some((o) => o.wall && o.id !== it.id && x < o.x + o.w && o.x < x + it.w);
      }
      if (x < 0 || y < FLOOR_TOP || x + it.w > COLS || y + it.h > ROWS) return false;
      if (it.walk) return true; // 러그는 다른 가구 밑에 깔려도 됨
      const g = blockedGrid(it.id);
      if (!g[y]) return false;
      for (let dy = 0; dy < it.h; dy++) for (let dx = 0; dx < it.w; dx++) if (g[y + dy][x + dx]) return false;
      // 문 앞 칸과 캐릭터 자리는 비워 둔다
      for (let dy = 0; dy < it.h; dy++) for (let dx = 0; dx < it.w; dx++) {
        if (x + dx >= DOOR.x && x + dx < DOOR.x + DOOR.w && y + dy === FLOOR_TOP) return false;
        if (x + dx === player.x && y + dy === player.y) return false;
      }
      return true;
    }

    function setPicked(id) {
      picked = id;
      placing = null;
      const it = id ? itemFull(id) : null;
      opts.onPick && opts.onPick(it ? { id: it.id, name: it.name, placed: !!it.placed, flip: !!it.flip } : null);
    }

    function editClick(p) {
      // 보관함에서 꺼내는 중: 누른 칸에 놓기
      if (placing) {
        const it = IP() && IP().ITEMS[placing];
        if (!it) return;
        const k = IP().KINDS[it.kindId];
        const tmp = { id: "__new", w: k.w || 1, h: k.h || 1, wall: k.kind === "wall", walk: !!k.walk };
        const nx = Math.max(0, Math.min(COLS - tmp.w, p.tx - Math.floor((tmp.w - 1) / 2)));
        const ny = tmp.wall ? 0 : Math.max(FLOOR_TOP, Math.min(ROWS - tmp.h, p.ty));
        if (fits(tmp, nx, ny)) {
          placed.push({ uid: Math.random().toString(36).slice(2, 8), id: placing, x: nx, y: ny, flip: false });
          persist();
          const name = it.name;
          placing = null;
          opts.onPlaced && opts.onPlaced();
          hint(`${name}을(를) 놓았어요!`);
        } else {
          hint("거기는 놓을 수 없어요. 빈 자리를 눌러 주세요");
        }
        return;
      }
      const it = itemAt(p.tx, p.ty, p.fx, p.fy) || rugAt(p.tx, p.ty);
      if (!picked) {
        if (it && !it.door) {
          setPicked(it.id);
          hint(`${it.name}: 놓을 자리를 누르거나, 아래 버튼으로 뒤집기·넣기`);
        }
        return;
      }
      const cur = itemFull(picked);
      if (!cur || (it && it.id === picked)) {
        setPicked(null);
        hint("옮길 가구를 눌러 주세요");
        return;
      }
      const nx = Math.max(0, Math.min(COLS - cur.w, p.tx - Math.floor((cur.w - 1) / 2)));
      const ny = cur.wall ? 0 : Math.max(FLOOR_TOP, Math.min(ROWS - (cur.h || 1), p.ty));
      if (fits(cur, nx, ny)) {
        if (cur.placed) {
          const inst = placed.find((q) => "p:" + q.uid === picked);
          inst.x = nx;
          inst.y = ny;
        } else {
          if (!custom) {
            // 처음 옮기는 순간 지금 보이는 기본 배치를 고정
            Object.keys(layout).forEach((id) => (layout[id] = clampPos(id, layout[id])));
          }
          layout[picked] = { x: nx, y: ny };
          custom = true;
        }
        persist();
        setPicked(null);
        hint("옮겼어요! 다른 가구도 눌러서 옮길 수 있어요");
      } else {
        hint("거기는 놓을 수 없어요. 빈 자리를 눌러 주세요");
      }
    }

    function rugAt(tx, ty) {
      return items().find((it) => it.walk && tx >= it.x && tx < it.x + it.w && ty >= it.y && ty < it.y + it.h) || null;
    }

    function hint(text) {
      if (text === lastHint) return;
      lastHint = text;
      opts.onHint && opts.onHint(text);
    }

    // ---------- 그리기 ----------
    function px(x, y, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function drawRoom() {
      // 벽 (벽지 아이템이 있으면 그걸로)
      const wp = wallpaper && IP() && IP().drawWallpaper(px, wallpaper, W, FLOOR_TOP * T);
      if (!wp) {
        px(0, 0, W, FLOOR_TOP * T, C.wall);
        for (let x = 7; x < W; x += 8) px(x, 0, 1, FLOOR_TOP * T, C.wallLine);
        for (let y = 7; y < FLOOR_TOP * T; y += 8) px(0, y, W, 1, C.wallLine);
      }
      px(0, FLOOR_TOP * T - 2, W, 2, C.wallBase);
      // 바닥 (바닥 아이템이 있으면 그걸로, 아니면 바둑판)
      const fl = flooring && IP() && IP().drawFlooring(px, flooring, W, FLOOR_TOP * T, H - FLOOR_TOP * T, T);
      if (!fl) for (let y = FLOOR_TOP; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          px(x * T, y * T, T / 2, T / 2, (x + y) % 2 ? C.floorA : C.floorB);
          px(x * T + T / 2, y * T, T / 2, T / 2, (x + y) % 2 ? C.floorB : C.floorA);
          px(x * T, y * T + T / 2, T / 2, T / 2, (x + y) % 2 ? C.floorB : C.floorA);
          px(x * T + T / 2, y * T + T / 2, T / 2, T / 2, (x + y) % 2 ? C.floorA : C.floorB);
        }
      // 출입문 앞 바닥: 문밖에서 들어오는 햇빛 (점점 넓어지며 옅어짐)
      const dx = DOOR.x * T;
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = "rgba(255, 236, 160, " + (0.5 - i * 0.025).toFixed(3) + ")";
        ctx.fillRect(Math.round(dx + 6 - i * 0.35), FLOOR_TOP * T + i, Math.round(20 + i * 0.7), 1);
      }
      // 발매트
      px(dx + 8, FLOOR_TOP * T + 3, 16, 5, "#2fae91");
      px(dx + 9, FLOOR_TOP * T + 4, 14, 3, "#4fc3a1");
    }

    let doorActive = false; // 캐릭터가 문 옆에 서 있으면 비상구 표지가 노랗게
    const DRAW = {
      // 출입문: 위쪽 초록 비상구 표지(달리는 사람 + 화살표) + 바깥 풍경이 보이게 열린 문
      door(it) {
        const x = it.x * T;
        const W2 = "#ffffff";
        // 비상구 표지
        px(x + 6, 0, 20, 10, doorActive ? "#ffb000" : C.k);
        px(x + 7, 1, 18, 8, "#2fae91");
        px(x + 10, 2, 2, 2, W2); // 머리
        px(x + 9, 4, 3, 2, W2); // 몸
        px(x + 8, 5, 1, 1, W2); // 팔
        px(x + 12, 4, 1, 1, W2);
        px(x + 9, 6, 1, 2, W2); // 다리
        px(x + 11, 6, 2, 1, W2);
        px(x + 12, 7, 1, 1, W2);
        px(x + 15, 4, 6, 2, W2); // 화살표 →
        px(x + 20, 3, 1, 4, W2);
        px(x + 21, 4, 1, 2, W2);
        px(x + 13, 6, 3, 1, "#9be0b0"); // 문 모양
        // 문틀
        px(x + 3, 11, 26, 37, C.k);
        px(x + 4, 12, 24, 36, C.woodD);
        // 열린 문틈으로 보이는 바깥: 하늘·해·구름·잔디·길
        px(x + 6, 14, 20, 34, "#bfe3ff");
        px(x + 6, 14, 20, 6, "#a6d8ff");
        px(x + 20, 17, 4, 4, "#ffd84a");
        px(x + 21, 16, 2, 1, "#ffd84a");
        px(x + 13, 22, 6, 2, W2);
        px(x + 15, 21, 3, 1, W2);
        px(x + 6, 36, 20, 12, "#7fd38a");
        px(x + 6, 36, 20, 2, "#9be0b0");
        px(x + 15, 36, 5, 12, "#e9d6a8");
        px(x + 14, 42, 7, 6, "#e9d6a8");
        px(x + 23, 33, 2, 3, "#3e9a5a"); // 작은 나무
        px(x + 22, 30, 4, 4, "#2fae91");
        // 안쪽으로 열린 문짝(왼쪽 경첩, 좁게 보임)
        px(x + 6, 14, 7, 34, C.k);
        px(x + 7, 15, 5, 32, "#2a86ff");
        px(x + 8, 17, 3, 9, "#6cb8f5");
        px(x + 8, 29, 3, 9, "#6cb8f5");
        px(x + 11, 30, 1, 2, "#ffd84a"); // 손잡이
      },
      window(it) {
        const x = it.x * T;
        px(x + 2, 6, it.w * T - 4, 26, C.k);
        px(x + 3, 7, it.w * T - 6, 24, "#bfe3ff");
        px(x + 6, 11, 8, 2, "#fff");
        px(x + 5, 13, 11, 2, "#fff");
        px(x + it.w * T / 2 - 1, 7, 2, 24, C.k);
        px(x + 3, 18, it.w * T - 6, 2, C.k);
        px(x + 1, 32, it.w * T - 2, 2, C.wood);
      },
      calendar(it) {
        const x = it.x * T;
        px(x + 2, 12, 12, 16, C.k);
        px(x + 3, 13, 10, 14, "#fff");
        px(x + 3, 13, 10, 4, "#e8505b");
        px(x + 5, 11, 1, 3, C.k);
        px(x + 10, 11, 1, 3, C.k);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) px(x + 4 + c * 2.4, 19 + r * 2.5, 1, 1, r === 1 && c === 2 ? "#2fae91" : "#c9c0b6");
      },
      frame(it) {
        const x = it.x * T;
        px(x + 4, 10, it.w * T - 8, 20, "#c9922a");
        px(x + 5, 11, it.w * T - 10, 18, "#ffc93c");
        px(x + 7, 13, it.w * T - 14, 14, "#fff8e1");
        px(x + 13, 15, 6, 6, "#ffc93c");
        px(x + 14, 16, 4, 4, "#ffe08a");
        px(x + 13, 21, 2, 4, "#e8505b");
        px(x + 17, 21, 2, 4, "#2a86ff");
      },
      wardrobe(it, bx, by) {
        const w = it.w * T;
        const h = 2 * T;
        px(bx, by - h, w, h, C.k);
        px(bx + 1, by - h + 1, w - 2, h - 2, C.wood);
        px(bx + 1, by - h + 1, w - 2, 3, C.woodL);
        px(bx + w / 2 - 1, by - h + 4, 1, h - 6, C.woodD);
        px(bx + w / 2 - 4, by - h / 2, 2, 2, "#ffc93c");
        px(bx + w / 2 + 2, by - h / 2, 2, 2, "#ffc93c");
        px(bx + 3, by - 4, w - 6, 2, C.woodD);
        // 문틈으로 보이는 옷 색
        px(bx + 3, by - h + 6, 2, 1, "#82cbff");
        px(bx + w - 5, by - h + 6, 2, 1, "#ff8fb1");
      },
      bookshelf(it, bx, by) {
        const w = it.w * T;
        const h = 2 * T;
        px(bx, by - h, w, h, C.k);
        px(bx + 1, by - h + 1, w - 2, h - 2, C.woodD);
        const colors = ["#ff8a3d", "#2fae91", "#2a86ff", "#ffc93c", "#ff8fb1", "#82cbff", "#e8505b", "#9be0b0"];
        for (let s = 0; s < 3; s++) {
          const sy = by - h + 2 + s * 10;
          px(bx + 2, sy + 8, w - 4, 1, C.woodL);
          for (let i = 0; i < 9; i++) {
            const bh = 5 + ((i + s) % 3);
            px(bx + 3 + i * 3, sy + 8 - bh, 2, bh, colors[(i * 3 + s) % colors.length]);
          }
        }
      },
      desk(it, bx, by) {
        const w = it.w * T;
        px(bx, by - 12, w, 4, C.k);
        px(bx + 1, by - 11, w - 2, 2, C.woodL);
        px(bx + 2, by - 8, 2, 8, C.woodD);
        px(bx + w - 4, by - 8, 2, 8, C.woodD);
        // 모니터
        px(bx + 7, by - 24, 16, 11, C.k);
        px(bx + 8, by - 23, 14, 8, "#2a86ff");
        px(bx + 10, by - 21, 6, 1, "#bfe3ff");
        px(bx + 10, by - 19, 9, 1, "#bfe3ff");
        px(bx + 14, by - 13, 2, 1, C.k);
        // 비커
        px(bx + 26, by - 17, 4, 5, "#fff");
        px(bx + 26, by - 15, 4, 3, "#9be0b0");
      },
      gacha(it, bx, by) {
        const w = T;
        // 몸통
        px(bx + 1, by - 14, w - 2, 14, C.k);
        px(bx + 2, by - 13, w - 4, 12, "#e8505b");
        px(bx + 4, by - 9, 8, 4, C.k);
        px(bx + 5, by - 8, 6, 2, "#2b2320");
        px(bx + 10, by - 12, 3, 3, "#ffc93c"); // 손잡이
        // 유리 돔 + 캡슐
        px(bx + 2, by - 30, w - 4, 16, C.k);
        px(bx + 3, by - 29, w - 6, 15, "#d6ecff");
        const caps = ["#ff8a3d", "#2fae91", "#ffc93c", "#ff8fb1", "#82cbff", "#9775fa"];
        for (let i = 0; i < 6; i++) px(bx + 4 + (i % 3) * 3, by - 20 - Math.floor(i / 3) * 4 - (i % 2), 2, 2, caps[i]);
        px(bx + 4, by - 28, 3, 1, "#fff");
        // 뽑기권이 있으면 반짝
        const t = opts.tickets ? opts.tickets() : 0;
        if (t > 0) {
          const on = Math.floor(frame / 12) % 2;
          px(bx + w - 3, by - 33, 4, 4, on ? "#ffd84a" : "#fff3a8");
          px(bx + w - 2, by - 32, 2, 2, "#e8505b");
        }
      },
      plant(it, bx, by) {
        px(bx + 4, by - 8, 8, 8, "#ff8a3d");
        px(bx + 4, by - 8, 8, 2, "#e0671f");
        px(bx + 7, by - 20, 2, 12, "#2fae91");
        px(bx + 3, by - 18, 4, 3, "#2fae91");
        px(bx + 9, by - 22, 4, 3, "#2fae91");
        px(bx + 4, by - 14, 3, 2, "#9be0b0");
        px(bx + 10, by - 16, 3, 2, "#9be0b0");
      },
      rug(it) {
        const x = it.x * T;
        const y = it.y * T;
        const w = it.w * T;
        const h = it.h * T;
        px(x + 2, y + 3, w - 4, h - 6, "#82cbff");
        px(x + 4, y + 5, w - 8, h - 10, "#e3f1ff");
        px(x + 6, y + 7, w - 12, h - 14, "#ffb8a8");
        for (let i = 0; i < 6; i++) {
          px(x + 2 + i * ((w - 6) / 5), y + 1, 2, 2, "#82cbff");
          px(x + 2 + i * ((w - 6) / 5), y + h - 3, 2, 2, "#82cbff");
        }
      },
    };

    // ---------- 쓸 수 있는 물건 표시 규칙 (dev.md #56-3) ----------
    // ① 물건 위에 떠 있는 말풍선 아이콘(기능별 그림, 둥실) ② 흰색+하늘색 도트 테두리(은은하게 깜빡)
    // ③ 캐릭터가 옆에 서면 말풍선이 노랗게 + 살짝 위로. 장식(화분·러그·창문)에는 아무 표시 없음.
    const ICON_COLORS = { k: "#2b2320", r: "#e8505b", b: "#2a86ff", g: "#2fae91", y: "#ffc93c", e: "#c9c0b6", w: "#ffffff", o: "#ff8a3d" };
    const ICONS = {
      wardrobe: ["...k...", "....k..", "...k...", "..kkk..", ".k...k.", "kkkkkkk", "......."], // 옷걸이
      calendar: [".k...k.", "rrrrrrr", "r.....r", "r.k.k.r", "r.....r", "r.k...r", "rrrrrrr"], // 달력
      dex: ["bb.gg.o", "bb.gg.o", "bb.gg.o", "bb.gg.o", "bb.gg.o", "bb.gg.o", "kkkkkkk"], // 책
      badges: ["r.....b", ".r...b.", "..r.b..", "...y...", "..yyy..", "..yyy..", "...y..."], // 메달
      records: ["kkkkkkk", "kbbbbbk", "kbwwbbk", "kbbbbbk", "kkkkkkk", "...k...", "..kkk.."], // 모니터
      gacha: ["..rrr..", ".rrrrr.", "rrrrrrr", "kkkkkkk", "eeeeeee", ".eeeee.", "..eee.."], // 캡슐
      door: ["...b...", "...bb..", "bbbbbb.", "bbbbbbb", "bbbbbb.", "...bb..", "...b..."], // 나가기 화살표
    };

    // below = true 이면 물건 아래쪽에 두고 꼬리가 위를 향한다(벽에 걸린 물건: 위쪽에 자리가 없음)
    function drawBadge(action, cx, top, active, below) {
      const icon = ICONS[action];
      if (!icon) return;
      const bob = Math.round(Math.sin(performance.now() / 380 + cx) * 1);
      const x = Math.round(cx - 5);
      const lift = active ? 2 : 0;
      const y = below ? Math.round(top + 3 + bob - lift) : Math.max(0, Math.round(top - 13 + bob - lift));
      const edge = active ? "#ffb000" : "#2a86ff";
      // 말풍선 (11×11, 모서리 깎음) + 꼬리
      px(x + 1, y, 9, 11, edge);
      px(x, y + 1, 11, 9, edge);
      px(x + 1, y + 1, 9, 9, active ? "#fff6d0" : "#ffffff");
      if (below) {
        px(x + 4, y - 1, 3, 1, edge);
        px(x + 5, y - 2, 1, 1, edge);
      } else {
        px(x + 4, y + 11, 3, 1, edge);
        px(x + 5, y + 12, 1, 1, edge);
      }
      icon.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch !== ".") px(x + 2 + rx, y + 2 + ry, 1, 1, ICON_COLORS[ch]);
        }
      });
    }

    // 물건 모양을 따라 그린 테두리(흰 1칸 + 파란 3칸). 모양별로 한 번 만들어 두고 재사용.
    const PAD = 4;
    const outlineCache = {};
    function outlineFor(it) {
      const key = it.type;
      if (outlineCache[key]) return outlineCache[key];
      const w = it.w * T + PAD * 2;
      const h = (it.wall ? FLOOR_TOP * T : Math.ceil(it.vh * T)) + PAD * 2;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d");
      const main = ctx;
      ctx = octx;
      try {
        if (it.wall) {
          ctx.translate(PAD - it.x * T, PAD);
          DRAW[it.type](it);
        } else {
          DRAW[it.type](it, PAD, h - PAD);
        }
      } finally {
        ctx = main;
      }
      const data = octx.getImageData(0, 0, w, h).data;
      const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
      const ring1 = new Set();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) ring1.add(y * w + x);
      // 흰 줄 바깥으로 파란 줄을 3겹 키운다
      const taken = new Set(ring1);
      let front = ring1;
      const blue = [];
      for (let layer = 0; layer < 3; layer++) {
        const next = new Set();
        front.forEach((k) => {
          const x = k % w;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = (k - x) / w + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
            const n = ny * w + nx;
            if (taken.has(n) || solid(nx, ny)) return;
            taken.add(n);
            next.add(n);
          });
        });
        blue.push(next);
        front = next;
      }
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const o = out.getContext("2d");
      const dot = (k, c) => {
        o.fillStyle = c;
        o.fillRect(k % w, Math.floor(k / w), 1, 1);
      };
      ring1.forEach((k) => dot(k, "#ffffff"));
      blue[0].forEach((k) => dot(k, "#2a86ff"));
      blue[1].forEach((k) => dot(k, "#2a86ff"));
      blue[2].forEach((k) => dot(k, "#82cbff"));
      outlineCache[key] = out;
      return out;
    }

    function drawOutline(it) {
      const img = outlineFor(it);
      ctx.save();
      if (it.flip) {
        ctx.translate(it.x * T * 2 + it.w * T, 0);
        ctx.scale(-1, 1);
      }
      ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 520));
      if (it.wall) ctx.drawImage(img, it.x * T - PAD, -PAD);
      else ctx.drawImage(img, it.x * T - PAD, (it.y + it.h) * T - (img.height - PAD));
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 말풍선 위치: 바닥 물건·문은 그림 맨 위 가운데, 벽 물건은 그림 바로 아래
    function badgeTop(it) {
      if (it.door) return T * 0.6;
      if (it.wall) return it.type === "calendar" ? 28 : 30;
      return (it.y + it.h) * T - it.vh * T;
    }

    // 가구 하나 그리기 — 기본 가구(DRAW) 또는 인테리어(drawItem). flip 이면 좌우 반전.
    function paintItem(it) {
      if (drag && drag.moved && it.id === drag.id && !it.__ghost) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        paintItemRaw(it);
        ctx.restore();
        return;
      }
      paintItemRaw(it);
    }
    function paintItemRaw(it) {
      const floorArgs = [it.x * T, (it.y + it.h) * T];
      const doIt = () => {
        if (it.type === "interior") {
          if (it.wall) IP().drawItem(px, it.itemId, it.x * T, 0);
          else IP().drawItem(px, it.itemId, it.x * T, (it.y + it.h) * T);
        } else if (DRAW[it.type]) {
          if (it.wall || it.walk) DRAW[it.type](it);
          else DRAW[it.type](it, floorArgs[0], floorArgs[1]);
        }
      };
      if (!it.flip) return doIt();
      ctx.save();
      ctx.translate(it.x * T * 2 + it.w * T, 0);
      ctx.scale(-1, 1);
      doIt();
      ctx.restore();
    }

    function draw(t) {
      frame++;
      if (frame % 3 === 0 && window.Profile && lookCache && lookCache.wear && lookCache.wear.effect) window.Profile.drawAvatar(avatar, lookCache, frame);
      drawRoom();
      const list = items();
      // 러그(바닥에 깔림) → 벽 가구
      list.filter((it) => it.walk).forEach((it) => paintItem(it));
      list.filter((it) => it.wall).forEach((it) => {
        if (it.action && !edit) drawOutline(it);
        paintItem(it);
      });
      const door = doorItem();
      doorActive = !edit && !player.path.length && (() => {
        const n = nearItem();
        return !!(n && n.door);
      })();
      if (!edit) drawOutline(door);
      DRAW.door(door);
      // 바닥 가구 + 캐릭터를 아래쪽 줄 순서로
      const sprites = list
        .filter((it) => !it.wall && !it.walk)
        .map((it) => ({
          z: it.y + it.h,
          draw: () => {
            if (it.action && !edit) drawOutline(it);
            paintItem(it);
          },
        }));
      const bob = player.moving ? (Math.floor(performance.now() / 160) % 2 ? -1 : 0) : 0;
      sprites.push({
        z: player.py / T + 1 + 0.01,
        draw: () => {
          px(player.px + 3, player.py + 14, 10, 2, "rgba(43,35,32,0.18)");
          ctx.save();
          if (player.face < 0) {
            ctx.translate(player.px + T, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(avatar, 0, player.py + bob - 1);
          } else {
            ctx.drawImage(avatar, player.px, player.py + bob - 1);
          }
          ctx.restore();
        },
      });
      sprites.sort((a, b) => a.z - b.z).forEach((s) => s.draw());

      // 배치 모드 표시
      if (edit) {
        ctx.fillStyle = "rgba(42, 134, 255, 0.08)";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(42, 134, 255, 0.25)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath();
          ctx.moveTo(x * T + 0.5, FLOOR_TOP * T);
          ctx.lineTo(x * T + 0.5, H);
          ctx.stroke();
        }
        for (let y = FLOOR_TOP; y <= ROWS; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * T + 0.5);
          ctx.lineTo(W, y * T + 0.5);
          ctx.stroke();
        }
        // 반투명 미리보기: 끄는 중인 가구 또는 보관함에서 꺼내는 가구
        let ghost = null;
        if (drag && drag.moved) {
          const it = itemFull(drag.id);
          if (it) {
            const t = dragTarget(it, drag.tx, drag.ty);
            ghost = Object.assign({}, it, t, { __ghost: true });
            ghost.ok = fits(it, t.x, t.y);
          }
        } else if (placing && hover) {
          const pp = placingProps();
          if (pp) {
            const t = placingTarget(pp, hover.tx, hover.ty);
            ghost = Object.assign({}, pp, t, { __ghost: true });
            ghost.ok = fits(pp, t.x, t.y);
          }
        }
        if (ghost) {
          const ok = ghost.ok;
          ctx.fillStyle = ok ? "rgba(47, 174, 145, 0.28)" : "rgba(232, 80, 91, 0.28)";
          ctx.strokeStyle = ok ? "#2fae91" : "#e8505b";
          ctx.lineWidth = 2;
          const gx = ghost.x * T;
          const gy = ghost.wall ? 1 : ghost.y * T;
          const gw = ghost.w * T;
          const gh = ghost.wall ? FLOOR_TOP * T - 3 : (ghost.h || 1) * T;
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeRect(gx + 1, gy + 1, gw - 2, gh - 2);
          ctx.save();
          ctx.globalAlpha = 0.6;
          paintItem(ghost);
          ctx.restore();
        }
        const pk = picked && !(drag && drag.moved) ? itemFull(picked) : null;
        if (placing && !hover) hint("놓을 자리를 눌러 주세요 (손가락·마우스를 올리면 미리 보여요)");
        else if (placing && ghost) hint(ghost.ok ? "여기에 놓을 수 있어요 — 누르면 놓여요" : "여기는 놓을 수 없어요");
        if (pk) {
          const it = pk;
          ctx.strokeStyle = Math.floor(frame / 15) % 2 ? "#2a86ff" : "#ff8a3d";
          ctx.lineWidth = 2;
          if (it.wall) ctx.strokeRect(it.x * T + 1, 4, it.w * T - 2, 2.4 * T);
          else ctx.strokeRect(it.x * T + 1, (it.y + it.h - (it.vh || it.h)) * T + 1, it.w * T - 2, (it.vh || it.h) * T - 2);
        }
      } else {
        const near = !player.path.length ? nearItem() : null;
        allUsable().forEach((it) => {
          if (it.door) return; // 출입문은 비상구 표지가 대신한다
          const cx = it.x * T + (it.w * T) / 2;
          drawBadge(it.action, cx, badgeTop(it), near && near.id === it.id, !!it.wall);
        });
        if (near) {
          hint(near.hint + " · 눌러서 열기");
        } else if (!player.path.length) {
          hint("바닥을 눌러 움직이고, 물건을 눌러 보세요");
        }
      }
    }

    // 시간 기준 이동: 한 칸(16도트)에 약 0.2초. 화면이 덜 자주 그려져도(탭 숨김 등) 같은 속도로 간다.
    const SPEED = 0.1; // 도트/ms — 한 칸 0.16초
    let lastStep = performance.now();
    function step() {
      const now = performance.now();
      let budget = Math.min(now - lastStep, 1500) * SPEED;
      lastStep = now;
      if (!player.path.length) {
        const d = !edit && heldDir();
        if (!d || !tryStep(d)) {
          player.moving = false;
          return;
        }
      }
      player.moving = true;
      while (budget > 0 && player.path.length) {
        const next = player.path[0];
        const tx = next.x * T;
        const ty = next.y * T;
        if (tx !== player.px) player.face = tx > player.px ? 1 : -1;
        player.facing = [Math.sign(next.x - player.x), Math.sign(next.y - player.y)];
        const dist = Math.abs(tx - player.px) + Math.abs(ty - player.py);
        const mv = Math.min(budget, dist);
        player.px += Math.sign(tx - player.px) * Math.min(mv, Math.abs(tx - player.px));
        player.py += Math.sign(ty - player.py) * Math.min(mv, Math.abs(ty - player.py));
        budget -= mv;
        if (Math.abs(player.px - tx) < 0.01 && Math.abs(player.py - ty) < 0.01) {
          player.px = tx;
          player.py = ty;
          player.x = next.x;
          player.y = next.y;
          player.path.shift();
          if (!player.path.length && player.pending) {
            const fn = player.pending;
            player.pending = null;
            fn();
          }
          // 키를 누르고 있으면 남은 이동량으로 바로 다음 칸 (멈칫하지 않게)
          if (!player.path.length && !edit) {
            const d = heldDir();
            if (d) tryStep(d);
          }
        }
      }
    }

    // 화면에 보일 때는 requestAnimationFrame(주사율에 맞춰 부드럽게), 탭이 숨겨지면 느린 타이머로.
    function loop() {
      if (!document.body.contains(canvas)) return; // 다시 그려져서 빠졌으면 멈춤
      step();
      draw(performance.now());
      schedule();
    }
    // 다음 프레임 예약: 보통은 requestAnimationFrame(부드럽게). 프레임이 안 오는 환경(숨겨진 탭·일부 앱 내 브라우저)에서는
    // 100ms 안에 안 오면 타이머가 대신 돌린다. 둘 중 먼저 온 쪽만 실행.
    function schedule() {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        loop();
      };
      if (document.visibilityState === "visible") requestAnimationFrame(go);
      setTimeout(go, document.visibilityState === "visible" ? 100 : 250);
    }

    refreshAvatar();
    draw(0);
    schedule();

    return {
      refresh() {
        refreshAvatar();
      },
      // 보관함에서 꺼내기 시작 (배치 모드에서)
      startPlacing(itemId) {
        if (!edit || !IP() || !IP().ITEMS[itemId]) return;
        picked = null;
        opts.onPick && opts.onPick(null);
        placing = itemId;
        hint("놓을 자리를 눌러 주세요");
      },
      cancelPlacing() {
        placing = null;
        hover = null;
        hint("옮길 가구를 누르거나, 아래 보관함에서 꺼내 보세요");
      },
      // 지금 고른 가구 좌우 반전
      flipPicked() {
        const it = picked && itemFull(picked);
        if (!it) return;
        if (it.placed) {
          const inst = placed.find((q) => "p:" + q.uid === picked);
          inst.flip = !inst.flip;
        } else {
          flips[picked] = !flips[picked];
          if (!flips[picked]) delete flips[picked];
        }
        persist();
        setPicked(picked);
      },
      // 지금 고른 (꺼내 놓은) 가구를 보관함에 넣기
      storePicked() {
        const it = picked && itemFull(picked);
        if (!it || !it.placed) return;
        placed = placed.filter((q) => "p:" + q.uid !== picked);
        persist();
        setPicked(null);
        opts.onPlaced && opts.onPlaced();
        hint("보관함에 넣었어요");
      },
      unpick() {
        setPicked(null);
        hint("옮길 가구를 누르거나, 아래 보관함에서 꺼내 보세요");
      },
      // 놓여 있는 개수 (보관함의 남은 개수 계산용)
      placedCount(itemId) {
        return placed.filter((q) => q.id === itemId).length;
      },
      setWallpaper(id) {
        wallpaper = id || null;
        persist();
      },
      setFlooring(id) {
        flooring = id || null;
        persist();
      },
      room() {
        return { wallpaper: wallpaper, flooring: flooring };
      },
      setEdit(on) {
        edit = !!on;
        drag = null;
        hover = null;
        canvas.style.touchAction = "none";
        placing = null;
        if (picked) setPicked(null);
        picked = null;
        player.path = [];
        hint(edit ? "옮길 가구를 누르거나, 아래 보관함에서 꺼내 보세요" : "바닥을 눌러 움직이고, 물건을 눌러 보세요");
      },
      isEdit() {
        return edit;
      },
      // 방 크기(칸) 바꾸기 — 캐릭터가 밖에 있으면 안쪽으로
      resize(cols, rows) {
        COLS = Math.max(12, cols | 0);
        ROWS = Math.max(10, rows | 0);
        W = COLS * T;
        H = ROWS * T;
        if (!custom) {
          layout = defaultsFor(COLS, ROWS);
          player.x = Math.round(COLS / 2);
          player.y = Math.min(ROWS - 2, Math.round(ROWS * 0.5) + 2);
        }
        canvas.width = W;
        canvas.height = H;
        player.path = [];
        player.pending = null;
        player.x = Math.min(player.x, COLS - 1);
        player.y = Math.min(Math.max(player.y, FLOOR_TOP), ROWS - 1);
        const g = blockedGrid();
        if (g[player.y][player.x]) {
          outer: for (let y = ROWS - 1; y >= FLOOR_TOP; y--) for (let x = 0; x < COLS; x++) if (!g[y][x]) { player.x = x; player.y = y; break outer; }
        }
        player.px = player.x * T;
        player.py = player.y * T;
        draw(0);
      },
      size() {
        return { cols: COLS, rows: ROWS };
      },
      pos() {
        return { x: player.x, y: player.y, px: player.px, py: player.py, moving: player.moving };
      },
      resetLayout() {
        layout = defaultsFor(COLS, ROWS);
        custom = false;
        flips = {};
        persist(); // 기본 가구는 저장값을 지워서 다시 화면 크기에 맞춘 기본 배치 (꺼낸 가구·벽지·바닥은 유지)
        player.path = [];
        player.x = Math.round(COLS / 2);
        player.y = Math.min(ROWS - 2, Math.round(ROWS * 0.5) + 2);
        player.px = player.x * T;
        player.py = player.y * T;
      },
      canvas: canvas,
    };
  }

  window.LabRoom = { mount: mount, TYPES: TYPES, DEFAULT_LAYOUT: DEFAULT_LAYOUT };
})();
