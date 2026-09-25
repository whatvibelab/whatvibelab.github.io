/* ==========================================================================
   archive.js — "무슨상 아카이브"(archive.html) 전용 스크립트. (dev.md #35)
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

  function render() {
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
      <div style="font-size:28px;font-weight:700;color:var(--text-sub);margin-top:16px;">무슨상 아카이브</div>
      <div style="font-size:38px;font-weight:800;color:var(--text);line-height:1.6;margin-top:40px;max-width:840px;">${insightHtml.replace(/<\/?strong>/g, "")}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;max-width:840px;margin-top:44px;">${emojiRow}</div>
      <div style="font-size:26px;color:var(--text-sub);margin-top:60px;">${SITE_NAME}에서 나도 아카이브 만들기</div>
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
    const fileName = `${SITE_NAME}_아카이브.png`;
    let file = null;
    try {
      file = new File([blob], fileName, { type: "image/png" });
    } catch (e) {
      file = null;
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: "무슨상 아카이브" })
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

  document.addEventListener("DOMContentLoaded", render);
})();
