/* ==========================================================================
   ad-config.js — 광고 On/Off 스위치.
   지금은 광고 키가 없어서 network: null 상태 → 모든 광고 자리가 비어있는 채로
   화면에 아예 안 보임(레이아웃도 차지 안 함). 나중에 광고 계정이 생기면
   아래 값만 채우면 ads.js가 알아서 각 .ad-slot에 광고를 꽂아 넣는다.

   [구글 애드센스로 켜는 법]
     1) network 를 "adsense" 로 바꾸고
     2) adsense.client 에 발급받은 "ca-pub-XXXXXXXXXXXXXXXX" 입력
     3) slots 안의 각 자리별 adsenseSlot 에 애드센스에서 만든 광고 단위 ID 입력

   [카카오 애드핏으로 켜는 법]
     1) network 를 "adfit" 로 바꾸고
     2) slots 안의 각 자리별 adfitUnit 에 애드핏 광고 단위 ID(DAN-...) 입력

   새 광고 자리를 페이지에 추가하고 싶으면:
     - HTML에 <div class="ad-slot" data-ad-slot="원하는이름" hidden></div> 추가
     - 아래 slots 객체에 같은 key로 항목 추가
   ========================================================================== */

window.AD_CONFIG = {
  network: null, // null(광고 없음) | "adsense" | "adfit"

  adsense: {
    client: "", // 예: "ca-pub-1234567890123456"
  },

  slots: {
    "hub-bottom": {
      adsenseSlot: "",
      adfitUnit: "",
      width: 320,
      height: 100,
    },
    "result-bottom": {
      adsenseSlot: "",
      adfitUnit: "",
      width: 320,
      height: 100,
    },
  },
};
