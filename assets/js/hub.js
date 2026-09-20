/* ==========================================================================
   hub.js — 메인 페이지에서 window.TESTS 목록을 카드로 렌더링.
   ========================================================================== */

(function () {
  "use strict";

  function render() {
    const list = document.getElementById("card-list");
    if (!list || !window.TESTS) return;

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
    select(0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    initTabs();
  });
})();
