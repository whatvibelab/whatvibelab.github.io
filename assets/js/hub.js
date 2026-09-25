/* ==========================================================================
   hub.js — 메인 페이지에서 window.TESTS 목록을 카드로 렌더링.
   ========================================================================== */

(function () {
  "use strict";

  function render() {
    const list = document.getElementById("card-list");
    if (!list || !window.TESTS) return;
    // 생성기(tools/build-static.js)가 카드를 이미 HTML에 넣어 둔 경우엔 다시 그리지 않는다.
    if (list.children.length) return;

    // 표시 순서: pin 이 있는 테스트를 번호 순으로 맨 앞에, 나머지는 배열에서 나중에 추가한 것부터(최신순).
    // (tools/build-static.js 의 sortForDisplay 와 같은 규칙)
    const pinned = window.TESTS.filter((t) => typeof t.pin === "number").sort((a, b) => a.pin - b.pin);
    const rest = window.TESTS.filter((t) => typeof t.pin !== "number").reverse();
    pinned.concat(rest).forEach((t) => {
      const isLive = t.status === "live";
      const card = document.createElement(isLive ? "a" : "div");
      card.className = "test-card " + (isLive ? "live" : "soon");
      if (isLive) card.href = t.path;

      const emoji = document.createElement("div");
      emoji.className = "test-card-emoji";
      emoji.style.background = t.color || "#f1e8dd";
      emoji.textContent = t.emoji;

      const body = document.createElement("div");
      body.className = "test-card-body";

      const title = document.createElement("p");
      title.className = "test-card-title";
      title.textContent = t.title;

      const sub = document.createElement("p");
      sub.className = "test-card-sub";
      sub.textContent = t.subtitle;

      body.appendChild(title);
      body.appendChild(sub);

      const badge = document.createElement("span");
      badge.className = "test-card-badge";
      badge.textContent = isLive ? "테스트 하기" : "준비중";

      card.appendChild(emoji);
      card.appendChild(body);
      card.appendChild(badge);

      list.appendChild(card);
    });
  }

  // 하단 안내 탭 — 마크업(#hub-tabs)은 tools/build-static.js가 만든다.
  // 이 함수가 실행돼야 탭 바가 보이고 패널이 하나씩만 보인다(JS 없으면 전부 펼쳐진 채 유지).
  function initTabs() {
    const root = document.getElementById("hub-tabs");
    if (!root) return;
    const tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    if (!tabs.length || panels.some((p) => !p)) return;

    function select(index, focus) {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i));
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          select(next, true);
        }
      });
    });

    root.classList.add("js-tabs");
    // 처음에 열어 둘 탭은 마크업의 aria-selected="true" (현재 "테스트 모아보기")
    const initial = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    select(initial >= 0 ? initial : 0);
  }

  // 테스트 검색 — 카드의 data-search(제목·부제·소개 문구·결과 이름, tools/build-static.js가 만든다)를
  // 브라우저 안에서만 걸러 보여 준다. 검색어는 어디로도 전송하지 않는다.
  // - 띄어쓰기로 나눈 낱말은 모두 들어 있어야 하고(AND), 공백 없이 붙여 써도 찾는다.
  // - 초성만 써도(ㅁㄹㅌ) 찾고, 초성과 글자를 섞어도("마라ㅌ") 찾는다.
  // - 한글은 입력하는 도중에 글자가 바뀌므로(타→탕, 말→마라) 검색어의 마지막 글자는 느슨하게 맞춘다.
  const CHOSUNG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const JUNGSUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
  const JONGSUNG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const ONLY_CHOSUNG = /^[ㄱ-ㅎ]+$/;
  const ONE_JAMO = /^[ㄱ-ㅎ]$/;
  // 초성 자모 U+1100~U+1112 (소스에 눈에 안 보이는 글자를 두지 않으려고 코드값으로 만든다)
  const CONJOINING_CHOSUNG = new RegExp("[" + String.fromCharCode(0x1100) + "-" + String.fromCharCode(0x1112) + "]", "g");

  // 겹받침 자모: 한글 자판에서 초성 ㄹ, ㅌ을 연달아 치면 입력기가 "ㄾ" 하나로 합쳐 버린다(ㅁㄹㅌ → ㅁㄾ).
  // 검색에서는 이런 자모를 다시 두 초성으로 풀어서 다룬다.
  const CLUSTER = { "ㄳ": "ㄱㅅ", "ㄵ": "ㄴㅈ", "ㄶ": "ㄴㅎ", "ㄺ": "ㄹㄱ", "ㄻ": "ㄹㅁ", "ㄼ": "ㄹㅂ", "ㄽ": "ㄹㅅ", "ㄾ": "ㄹㅌ", "ㄿ": "ㄹㅍ", "ㅀ": "ㄹㅎ", "ㅄ": "ㅂㅅ" };
  const CLUSTER_JAMO = /[ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ]/g;

  // 입력기에 따라 초성이 '초성 자모'(U+1100~1112)로 들어오기도 한다 → 호환 자모(ㄱㄲㄴ…)로 통일하고,
  // 합쳐진 겹받침 자모는 두 자음으로 푼다.
  function normalizeText(text) {
    return text
      .normalize("NFC")
      .replace(CONJOINING_CHOSUNG, (c) => CHOSUNG[c.charCodeAt(0) - 0x1100])
      .replace(CLUSTER_JAMO, (c) => CLUSTER[c]);
  }

  function syllable(ch) {
    const s = ch.charCodeAt(0) - 0xac00;
    if (s < 0 || s > 11171) return null;
    return { l: Math.floor(s / 588), v: Math.floor((s % 588) / 28), t: s % 28 };
  }

  // 받침 자모(겹받침이면 두 자음으로 풀어서) — 예: "ㄾ" → "ㄹㅌ"
  function finalOf(t) {
    const f = JONGSUNG[t];
    return CLUSTER[f] || f;
  }

  function decompose(ch) {
    const p = syllable(ch);
    return p ? CHOSUNG[p.l] + JUNGSUNG[p.v] + finalOf(p.t) : ch;
  }

  function choseongOf(ch) {
    const p = syllable(ch);
    return p ? CHOSUNG[p.l] : ch;
  }

  // 검색어 글자 q 가 본문 chars[i] 와 맞는가. last 는 q 가 검색어의 마지막 글자인지.
  function charMatches(q, chars, i, last) {
    const h = chars[i];
    if (q === h) return true;
    if (ONE_JAMO.test(q)) return choseongOf(h) === q; // 초성 하나 = 그 초성으로 시작하는 아무 글자
    if (!last) return false;
    const p = syllable(q);
    if (!p) return false;
    if (decompose(h).indexOf(decompose(q)) === 0) return true; // 입력 중인 글자: 타 → 탕
    // 받침이 뒤따르는 글자들의 초성일 수 있다: 말 → 마 + 라(ㄹ...), 맅 → 마 + 라(ㄹ) + 탕(ㅌ)
    const fin = finalOf(p.t);
    if (!fin) return false;
    const base = String.fromCharCode(0xac00 + p.l * 588 + p.v * 28);
    if (base !== h) return false;
    for (let k = 0; k < fin.length; k += 1) {
      const nx = chars[i + 1 + k];
      if (nx === undefined || choseongOf(nx) !== fin[k]) return false;
    }
    return true;
  }

  function textMatches(chars, q) {
    for (let s = 0; s + q.length <= chars.length; s += 1) {
      let ok = true;
      for (let k = 0; k < q.length; k += 1) {
        if (!charMatches(q[k], chars, s + k, k === q.length - 1)) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  function initSearch() {
    const form = document.getElementById("hub-search");
    const input = document.getElementById("hub-search-input");
    const list = document.getElementById("card-list");
    if (!form || !input || !list) return;
    const clearBtn = document.getElementById("hub-search-clear");
    const status = document.getElementById("hub-search-status");
    const empty = document.getElementById("hub-search-empty");

    // 초성만 있는 낱말은 낱말 단위로만 맞춘다(전체 글을 이어 붙여 찾으면 엉뚱한 글자 사이에서도 걸리므로).
    // 다만 제목은 붙여서도 맞춰 "ㅁㄹㅌㅌㅍ"처럼 여러 낱말을 이어 쓴 초성도 찾는다.
    const items = Array.prototype.slice.call(list.querySelectorAll(".test-card")).map((card) => {
      const raw = normalizeText((card.getAttribute("data-search") || card.textContent || "").toLowerCase());
      const titleEl = card.querySelector(".test-card-title");
      const title = normalizeText(((titleEl && titleEl.textContent) || "").toLowerCase()).replace(/\s+/g, "");
      return {
        card,
        chars: Array.from(raw.replace(/\s+/g, "")),
        titleChars: Array.from(title),
        words: raw.split(/\s+/).map((w) => Array.from(w)),
      };
    });

    function matches(it, token) {
      const q = Array.from(token);
      if (!ONLY_CHOSUNG.test(token)) return textMatches(it.chars, q);
      return textMatches(it.titleChars, q) || it.words.some((w) => textMatches(w, q));
    }

    function run() {
      const raw = normalizeText(input.value).trim().toLowerCase();
      const tokens = raw ? raw.split(/\s+/) : [];
      let shown = 0;
      items.forEach((it) => {
        const ok = tokens.every((tk) => matches(it, tk));
        it.card.classList.toggle("is-filtered", !ok);
        if (ok) shown += 1;
      });
      clearBtn.hidden = !raw;
      if (!raw) {
        status.textContent = "";
        empty.hidden = true;
      } else if (shown) {
        status.textContent = "테스트 " + shown + "개를 찾았어요";
        empty.hidden = true;
      } else {
        status.textContent = "";
        empty.textContent = "'" + input.value.trim() + "' 검색 결과가 없어요. 다른 단어로 검색해 보세요. (예: 음식, 아침, 여행, 카페)";
        empty.hidden = false;
      }
    }

    form.hidden = false;
    form.addEventListener("submit", (e) => e.preventDefault());
    input.addEventListener("input", run);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        input.value = "";
        run();
      }
    });
    clearBtn.addEventListener("click", () => {
      input.value = "";
      run();
      input.focus();
    });

    // 주소의 ?q=검색어 로 들어오면 미리 채워 둔다 (예: index.html?q=마라탕)
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) {
        input.value = q.slice(0, 40);
        run();
      }
    } catch (e) {
      /* 주소를 읽지 못하면 그냥 빈 검색창으로 둔다 */
    }
  }

  // "오늘의 무슨상"(dev.md #36) — 열 때마다 384개 결과 중 하나를 새로 무작위로 뽑아 보여준다.
  // 빌드 시점에 미리 하나(날짜 기반) 넣어 둔 카드를 여기서 다시 무작위로 바꿔 끼우는 것.
  function initTodayPick() {
    const el = document.getElementById("today-pick");
    const list = window.RESULTS_INDEX;
    if (!el || !list || !list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    const emoji = el.querySelector(".today-pick-emoji");
    const text = el.querySelector(".today-pick-text strong");
    const tagline = el.querySelector(".today-pick-tagline");
    const link = el.querySelector(".today-pick-link");
    if (emoji) emoji.textContent = pick.emoji;
    if (text) text.textContent = "'" + pick.name + "'";
    if (tagline) tagline.textContent = pick.tagline;
    if (link) {
      link.href = pick.path;
      link.textContent = pick.testTitle + " 해보기 →";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    initTabs();
    initSearch();
    initTodayPick();
  });
})();
