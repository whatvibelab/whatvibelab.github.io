/* ==========================================================================
   analytics.js — GA4 로더 + 이벤트 헬퍼(window.track).
   ANALYTICS_CONFIG.gaId 가 비어 있으면 외부 요청 없이 track()이 아무 일도
   하지 않는다. 엔진(engine.js)은 항상 track()을 호출해도 안전하다.

   측정 이벤트 (marketing.md §8 KPI 용):
     test_start / test_complete / share_link / save_image / recommend_click
   ========================================================================== */

(function () {
  "use strict";

  const cfg = window.ANALYTICS_CONFIG || {};
  const enabled = typeof cfg.gaId === "string" && /^G-[A-Z0-9]+$/i.test(cfg.gaId.trim());

  window.track = function (name, params) {
    if (!enabled || typeof window.gtag !== "function") return;
    try {
      window.gtag("event", name, params || {});
    } catch (e) {
      /* 분석 실패가 서비스 동작에 영향을 주면 안 됨 */
    }
  };

  if (!enabled) return;

  const id = cfg.gaId.trim();
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
})();
