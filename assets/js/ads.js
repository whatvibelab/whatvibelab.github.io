/* ==========================================================================
   ads.js — 페이지의 .ad-slot 자리를 window.AD_CONFIG 설정에 따라 채워주는
   공용 로더. network 가 비어있으면(기본값) 아무 것도 하지 않고 자리는
   hidden 상태 그대로 유지된다 — 광고 키 없이도 화면에 빈 박스가 보이지 않음.
   ========================================================================== */

(function () {
  "use strict";

  function loadScriptOnce(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    if (attrs) {
      Object.keys(attrs).forEach((k) => s.setAttribute(k, attrs[k]));
    }
    document.head.appendChild(s);
  }

  function renderAdsense(el, slotCfg, client) {
    if (!client || !slotCfg.adsenseSlot) return;
    loadScriptOnce(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + client,
      { crossorigin: "anonymous" }
    );
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = (slotCfg.width || 320) + "px";
    ins.style.height = (slotCfg.height || 100) + "px";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slotCfg.adsenseSlot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    el.hidden = false;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  function renderAdfit(el, slotCfg) {
    if (!slotCfg.adfitUnit) return;
    loadScriptOnce("https://t1.daumcdn.net/kas/static/ba.min.js");
    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", slotCfg.adfitUnit);
    ins.setAttribute("data-ad-width", String(slotCfg.width || 320));
    ins.setAttribute("data-ad-height", String(slotCfg.height || 100));
    el.appendChild(ins);
    el.hidden = false;
  }

  function init() {
    const config = window.AD_CONFIG;
    if (!config || !config.network) return;

    document.querySelectorAll(".ad-slot").forEach((el) => {
      const key = el.getAttribute("data-ad-slot");
      const slotCfg = config.slots && config.slots[key];
      if (!slotCfg) return;

      // 광고가 늦게 로드돼도 레이아웃이 밀리지 않도록(CLS) 슬롯 높이를 미리 예약한다.
      el.style.minHeight = (slotCfg.height || 100) + "px";

      if (config.network === "adsense") {
        renderAdsense(el, slotCfg, config.adsense && config.adsense.client);
      } else if (config.network === "adfit") {
        renderAdfit(el, slotCfg);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
