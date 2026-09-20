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

  document.addEventListener("DOMContentLoaded", render);
})();
