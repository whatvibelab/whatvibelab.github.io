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

    window.TESTS.forEach((t) => {
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
  // 띄어쓰기로 나눈 낱말은 모두 들어 있어야 하고(AND), 공백 없이 붙여 써도 찾고, 초성만 써도(예: ㅁㄹㅌ) 찾는다.
  const CHOSUNG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const ONLY_CHOSUNG = /^[ㄱ-ㅎ]+$/;

  function toChosung(text) {
    let out = "";
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      out += code >= 0xac00 && code <= 0xd7a3 ? CHOSUNG[Math.floor((code - 0xac00) / 588)] : ch;
    }
    return out;
  }

  function initSearch() {
    const form = document.getElementById("hub-search");
    const input = document.getElementById("hub-search-input");
    const list = document.getElementById("card-list");
    if (!form || !input || !list) return;
    const clearBtn = document.getElementById("hub-search-clear");
    const status = document.getElementById("hub-search-status");
    const empty = document.getElementById("hub-search-empty");

    // 초성 검색은 낱말 단위로만 맞춘다(전체 글을 이어 붙여 찾으면 엉뚱한 글자 사이에서도 걸리므로).
    // 다만 제목은 붙여서도 맞춰 "ㅁㄹㅌㅌㅍ"처럼 여러 낱말을 이어 쓴 초성도 찾는다.
    const items = Array.prototype.slice.call(list.querySelectorAll(".test-card")).map((card) => {
      const raw = (card.getAttribute("data-search") || card.textContent || "").toLowerCase();
      const titleEl = card.querySelector(".test-card-title");
      const title = ((titleEl && titleEl.textContent) || "").toLowerCase().replace(/\s+/g, "");
      return {
        card,
        text: raw.replace(/\s+/g, ""),
        titleCho: toChosung(title),
        wordsCho: raw.split(/\s+/).map(toChosung),
      };
    });

    function matches(it, tk) {
      if (!ONLY_CHOSUNG.test(tk)) return it.text.indexOf(tk) !== -1;
      return it.titleCho.indexOf(tk) !== -1 || it.wordsCho.some((w) => w.indexOf(tk) !== -1);
    }

    function run() {
      const raw = input.value.trim().toLowerCase();
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

  document.addEventListener("DOMContentLoaded", () => {
    render();
    initTabs();
    initSearch();
  });
})();
