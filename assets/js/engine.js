/* ==========================================================================
   engine.js — 모든 MBTI 컨셉 테스트가 공유하는 퀴즈 엔진.
   각 테스트 폴더의 config.js가 window.QUIZ_CONFIG 를 채워주면,
   이 파일이 인트로 → 질문 → 결과 화면 전환과 MBTI 스코어링, 공유를 전부 처리한다.

   필요한 config 형태는 tests/dujjonku/config.js 의 주석을 참고.
   필요한 DOM id 계약은 tests/dujjonku/index.html 의 스켈레톤을 그대로 복사해서 쓰면 됨.
   ========================================================================== */

(function () {
  "use strict";

  const SITE_NAME = "무슨상연구소";
  const SITE_LOGO_SRC = "../../assets/img/logo.svg"; // 테스트 페이지(tests/<id>/) 기준 경로
  const NICKNAME_KEY = "musunsang_nickname";

  // 닉네임/기본값("당신")은 둘 다 받침 있는 글자로 끝나서(님/신) 뒤에
  // 어떤 조사(은/이/을)를 붙여도 항상 자연스럽다 — 매번 조사를 골라 붙이지
  // 않아도 되게 하는 트릭.
  function getDisplayName(raw) {
    const trimmed = (raw || "").trim();
    return trimmed ? trimmed + "님" : "당신";
  }

  const AXIS_PAIRS = [
    ["E", "I"],
    ["S", "N"],
    ["T", "F"],
    ["J", "P"],
  ];

  function $(id) {
    return document.getElementById(id);
  }

  // analytics.js가 없어도(또는 GA ID가 비어 있어도) 안전하게 호출할 수 있는 이벤트 헬퍼.
  // 결과는 4글자 코드 대신 결과 이름으로만 기록한다.
  function track(name, params) {
    if (typeof window.track === "function") window.track(name, params);
  }

  function showScreen(name) {
    ["intro", "quiz", "result"].forEach((s) => {
      const el = $("screen-" + s);
      if (el) el.hidden = s !== name;
    });
    // 크롤러용 정적 설명 블록(#static-info)은 퀴즈 진행 중에만 숨긴다.
    const info = $("static-info");
    if (info) info.hidden = name === "quiz";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function buildShareUrl(type, nickname) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("r", type);
    if (nickname) url.searchParams.set("n", nickname);
    return url.toString();
  }

  function computeType(answers) {
    const tally = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    answers.forEach((a) => {
      if (a) tally[a.dir] += 1;
    });
    return AXIS_PAIRS.map(([left, right]) => {
      // 동점이면 왼쪽 글자(E/S/T/J)를 기본값으로 채택
      return tally[left] >= tally[right] ? left : right;
    }).join("");
  }

  function initQuiz(config) {
    const state = {
      index: 0,
      nickname: "",
      answers: new Array(config.questions.length).fill(null),
    };

    // ---------- 인트로 ----------
    function renderIntro() {
      const intro = config.intro;
      setText("intro-kicker", intro.kicker);
      setText("intro-title", intro.title);
      setText("intro-emoji", intro.emoji || "🍪");
      setText("intro-desc", intro.description);
      setText(
        "intro-meta",
        `질문 ${config.questions.length}개 · 약 ${intro.estMinutes || 1}분`
      );
      setText("start-btn", intro.startLabel || "테스트 시작하기");
      document.title = config.meta.title;

      const nickInput = $("nickname-input");
      if (nickInput) {
        try {
          const saved = localStorage.getItem(NICKNAME_KEY);
          if (saved) nickInput.value = saved;
        } catch (e) {
          /* 시크릿 모드 등 localStorage 접근 불가 시 그냥 빈 값으로 둠 */
        }
      }
    }

    // ---------- 퀴즈 ----------
    function renderQuestion() {
      const total = config.questions.length;
      const q = config.questions[state.index];
      const pct = Math.round((state.index / total) * 100);

      $("progress-fill").style.width = pct + "%";
      setText("quiz-count", `${state.index + 1} / ${total}`);
      setText("quiz-question", q.text);

      const backBtn = $("quiz-back-btn");
      if (backBtn) backBtn.hidden = state.index === 0;

      const optionsWrap = $("quiz-options");
      optionsWrap.innerHTML = "";
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option-btn";
        btn.textContent = opt.text;
        const chosen =
          state.answers[state.index] &&
          state.answers[state.index].dir === opt.dir;
        if (chosen) btn.classList.add("selected");
        btn.addEventListener("click", () => selectOption(opt));
        optionsWrap.appendChild(btn);
      });
    }

    function selectOption(opt) {
      state.answers[state.index] = { axis: opt.axis, dir: opt.dir };
      const total = config.questions.length;
      if (state.index < total - 1) {
        state.index += 1;
        renderQuestion();
      } else {
        $("progress-fill").style.width = "100%";
        finishQuiz();
      }
    }

    function goBack() {
      if (state.index === 0) return;
      state.index -= 1;
      renderQuestion();
    }

    function finishQuiz() {
      const type = computeType(state.answers);
      const r = config.results[type];
      track("test_complete", { test_id: config.meta.id, result_name: r ? r.name : "" });
      showResult(type, { shared: false });
    }

    // ---------- 결과 ----------
    function showResult(type, opts) {
      const result = config.results[type];
      if (!result) {
        // 방어 코드: 알 수 없는 타입이면 인트로로
        showScreen("intro");
        renderIntro();
        return;
      }
      const shared = !!(opts && opts.shared);
      // 공유 링크로 들어온 경우 URL의 닉네임(보낸 사람)을, 아니면 방금
      // 입력한 내 닉네임을 결과 화면 전체에서 이어서 쓴다.
      const sharerNickname = shared ? (opts && opts.sharerNickname) || "" : "";
      const rawNickname = shared ? sharerNickname : state.nickname;
      const displayName = getDisplayName(rawNickname);

      setText(
        "result-badge",
        shared
          ? (sharerNickname ? `${displayName}이 보낸 결과예요 👀` : "친구의 결과예요 👀")
          : `${displayName}의 결과가 나왔어요 🎉`
      );
      setText("result-emoji", result.emoji);
      setText("result-name", result.name);
      setText("result-tagline", result.tagline);
      setText("result-desc", result.desc);

      const traitsEl = $("result-traits");
      traitsEl.innerHTML = "";
      (result.traits || []).forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        traitsEl.appendChild(li);
      });

      const matchEl = $("result-match");
      if (result.match && config.results[result.match]) {
        const m = config.results[result.match];
        matchEl.hidden = false;
        matchEl.innerHTML = "";
        const label = document.createElement("span");
        label.className = "result-match-label";
        label.textContent = "잘 맞는 궁합";
        const value = document.createElement("span");
        value.className = "result-match-value";
        value.textContent = `${m.emoji} ${m.name}`;
        matchEl.appendChild(label);
        matchEl.appendChild(value);
      } else if (matchEl) {
        matchEl.hidden = true;
      }

      const saveCardBtn = $("save-card-btn");
      if (saveCardBtn) {
        saveCardBtn.textContent = "이미지로 저장 🖼️";
        saveCardBtn.onclick = () => saveResultCard(result, displayName);
      }

      const shareBtn = $("share-btn");
      shareBtn.textContent = "링크 공유하기";
      shareBtn.onclick = () => shareResult(type, result, rawNickname);

      const retakeBtn = $("retake-btn");
      retakeBtn.textContent = shared ? "나도 테스트 하러가기 →" : "다시 테스트하기";
      retakeBtn.onclick = () => {
        if (shared) {
          const url = new URL(window.location.href);
          url.search = "";
          window.location.href = url.toString();
        } else {
          restart();
        }
      };

      renderRecommendations();

      showScreen("result");
    }

    // ---------- 다른 테스트 추천 ----------
    function renderRecommendations() {
      const section = $("result-recommend");
      const list = $("result-recommend-list");
      if (!section || !list) return;

      const all = Array.isArray(window.TESTS) ? window.TESTS : [];
      const currentId = config.meta && config.meta.id;
      const others = all.filter((t) => t.status === "live" && t.id !== currentId);

      if (others.length === 0) {
        section.hidden = true;
        return;
      }

      const picked = shuffle(others.slice()).slice(0, 2);

      list.innerHTML = "";
      picked.forEach((t) => {
        const a = document.createElement("a");
        a.className = "test-card live";
        a.href = "../../" + t.path;
        a.addEventListener("click", () => track("recommend_click", { from: currentId, to: t.id }));

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
        badge.textContent = "테스트 하기";

        a.appendChild(emoji);
        a.appendChild(body);
        a.appendChild(badge);
        list.appendChild(a);
      });

      section.hidden = false;
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function shareResult(type, result, rawNickname) {
      track("share_link", { test_id: config.meta.id, result_name: result.name });
      const url = buildShareUrl(type, rawNickname);
      const displayName = getDisplayName(rawNickname);
      const shareText = (config.share && config.share.textTemplate)
        ? config.share.textTemplate.replace("{name}", result.name).replace("{nickname}", displayName)
        : `${displayName}은 ${result.name}래! 너는 어떤 결과일지 궁금하지 않아?`;

      if (navigator.share) {
        navigator
          .share({ title: config.meta.title, text: shareText, url })
          .catch(() => {
            /* 사용자가 공유를 취소한 경우 등은 무시 */
          });
        return;
      }

      copyToClipboard(url);
    }

    // ---------- 결과 이미지 카드 ----------
    function saveResultCard(result, displayName) {
      track("save_image", { test_id: config.meta.id, result_name: result.name });
      if (typeof html2canvas === "undefined") {
        showToast("이미지 생성 기능을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.");
        return;
      }

      const saveBtn = $("save-card-btn");
      const originalLabel = saveBtn ? saveBtn.textContent : "";
      const resetBtn = () => {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = originalLabel;
        }
      };
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "카드 만드는 중...";
      }

      const card = buildShareCard(result, displayName);
      document.body.appendChild(card);

      html2canvas(card, { scale: 1, backgroundColor: null })
        .then((canvas) => {
          if (card.parentNode) document.body.removeChild(card);
          canvas.toBlob((blob) => {
            if (!blob) {
              showToast("이미지 생성에 실패했어요. 다시 시도해주세요.");
              resetBtn();
              return;
            }
            deliverCardImage(blob, result, displayName);
            resetBtn();
          }, "image/png");
        })
        .catch(() => {
          if (card.parentNode) document.body.removeChild(card);
          showToast("이미지 생성에 실패했어요. 다시 시도해주세요.");
          resetBtn();
        });
    }

    function buildShareCard(result, displayName) {
      const card = document.createElement("div");
      card.style.cssText = [
        "position:fixed",
        "left:-9999px",
        "top:0",
        "width:1080px",
        "height:1350px",
        "display:flex",
        "flex-direction:column",
        "align-items:center",
        "justify-content:center",
        "box-sizing:border-box",
        "padding:100px 90px",
        "background:var(--bg)",
        "font-family:'Pretendard Variable',Pretendard,'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif",
        "text-align:center",
      ].join(";");

      const traitsHtml = (result.traits || [])
        .map(
          (t) =>
            `<div style="background:var(--card-bg);border:2px solid var(--border);border-radius:20px;padding:18px 30px;font-size:28px;font-weight:700;color:var(--text);margin:10px 0;">✓ ${escapeHtml(t)}</div>`
        )
        .join("");

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;font-size:32px;font-weight:800;color:var(--accent-dark);letter-spacing:0.02em;"><img src="${SITE_LOGO_SRC}" width="52" height="52" alt="" style="display:block;" />${SITE_NAME}</div>
        <div style="font-size:28px;font-weight:700;color:var(--text-sub);margin-top:16px;">${escapeHtml(displayName)}의 결과</div>
        <div style="font-size:220px;margin:36px 0 20px;line-height:1;">${result.emoji}</div>
        <div style="font-size:76px;font-weight:800;color:var(--text);line-height:1.3;">${escapeHtml(result.name)}</div>
        <div style="font-size:36px;font-weight:700;color:var(--accent-dark);margin-top:18px;">${escapeHtml(result.tagline)}</div>
        <div style="font-size:30px;color:var(--text);line-height:1.7;margin-top:40px;max-width:840px;">${escapeHtml(result.desc)}</div>
        <div style="display:flex;flex-direction:column;align-items:stretch;width:100%;max-width:840px;margin-top:50px;">${traitsHtml}</div>
        <div style="font-size:26px;color:var(--text-sub);margin-top:60px;">${escapeHtml(config.meta.title.split("|")[0].trim())} · ${SITE_NAME}에서 나도 해보기</div>
      `;

      return card;
    }

    function deliverCardImage(blob, result, displayName) {
      const safeName = (result.name || "result").replace(/\s+/g, "");
      const fileName = `${SITE_NAME}_${safeName}.png`;
      let file = null;
      try {
        file = new File([blob], fileName, { type: "image/png" });
      } catch (e) {
        file = null;
      }

      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        const shareText = (config.share && config.share.textTemplate)
          ? config.share.textTemplate.replace("{name}", result.name).replace("{nickname}", displayName)
          : "";
        navigator
          .share({ files: [file], title: config.meta.title, text: shareText })
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

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str == null ? "" : String(str);
      return div.innerHTML;
    }

    function copyToClipboard(text) {
      const done = () => showToast("링크가 복사됐어요! 친구에게 붙여넣기 해보세요 📋");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    }

    function fallbackCopy(text, done) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        showToast("복사에 실패했어요. 직접 주소창의 링크를 복사해주세요.");
      }
      document.body.removeChild(ta);
    }

    let toastTimer = null;
    function showToast(msg) {
      const toast = $("toast");
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
    }

    function restart() {
      state.index = 0;
      state.answers = new Array(config.questions.length).fill(null);
      showScreen("intro");
      renderIntro();
    }

    // ---------- 초기 진입 ----------
    const backBtn = $("quiz-back-btn");
    if (backBtn) backBtn.addEventListener("click", goBack);

    const startBtn = $("start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const nickInput = $("nickname-input");
        state.nickname = nickInput ? nickInput.value.trim() : "";
        try {
          localStorage.setItem(NICKNAME_KEY, state.nickname);
        } catch (e) {
          /* 시크릿 모드 등 localStorage 접근 불가 시 그냥 이번 판만 기억 */
        }
        state.index = 0;
        track("test_start", { test_id: config.meta.id });
        showScreen("quiz");
        renderQuestion();
      });
    }

    const sharedType = getParam("r");
    if (sharedType && config.results[sharedType.toUpperCase()]) {
      renderIntro(); // 홈 링크 등 배경 텍스트 채워두기
      showResult(sharedType.toUpperCase(), { shared: true, sharerNickname: getParam("n") });
    } else {
      renderIntro();
      showScreen("intro");
    }
  }

  function setText(id, text) {
    const el = $(id);
    if (el && text != null) el.textContent = text;
  }

  window.MbtiEngine = { init: initQuiz };
})();
