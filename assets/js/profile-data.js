/* ==========================================================================
   profile-data.js — "내 연구원"(dev.md #52, planning/ideas.md §8) 데이터.
   칭호(유형상·레벨 형용사), 경험치 규칙, 상장, 꾸미기(가운·소품), 도트 그림.
   로직은 profile.js. 문구는 콘텐츠 세션 확정 전 초안(ideas.md §8-3·§8-5).

   주의: 유형상 키(ISTJ 등)는 내부용이다. 화면에는 이름만 나오고 4글자 코드·"MBTI"는 절대 보이지 않게.
   ========================================================================== */

window.PROFILE_DATA = {
  // 유형상 — 가장 최근에 직접 끝낸 결과의 유형으로 정한다. 형용사와 붙으므로 명사형.
  types: {
    ISTJ: { title: "기록관상", line: "한 번 정한 건 빈틈없이 지켜 내는" },
    ISFJ: { title: "등불지기상", line: "곁의 사람을 조용히 밝혀 주는" },
    INFJ: { title: "별지기상", line: "보이지 않는 마음까지 읽어 내는" },
    INTJ: { title: "설계자상", line: "큰 그림을 먼저 그려 두는" },
    ISTP: { title: "해결사상", line: "말보다 손이 먼저 답을 찾는" },
    ISFP: { title: "화가상", line: "지금 이 순간의 색을 아는" },
    INFP: { title: "몽상가상", line: "나만의 세계를 품고 사는" },
    INTP: { title: "발명가상", line: "궁금하면 끝까지 파고드는" },
    ESTP: { title: "승부사상", line: "일단 부딪혀 보고 길을 내는" },
    ESFP: { title: "무대체질상", line: "있는 곳마다 무대가 되는" },
    ENFP: { title: "탐험가상", line: "새로운 것에 먼저 눈이 반짝이는" },
    ENTP: { title: "재치꾼상", line: "엉뚱한 질문으로 판을 뒤집는" },
    ESTJ: { title: "지휘자상", line: "흩어진 일을 한 박자로 맞추는" },
    ESFJ: { title: "반장상", line: "모두를 빠짐없이 챙기는" },
    ENFJ: { title: "응원단장상", line: "옆 사람을 더 빛나게 하는" },
    ENTJ: { title: "개척자상", line: "없던 길을 먼저 내는" },
  },
  // 도감 표시 순서
  typeOrder: ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"],

  // 레벨 형용사 — from 레벨 이상이면 그 말을 쓴다(위에서부터 처음 맞는 것).
  adjectives: [
    { from: 50, word: "불멸의" },
    { from: 40, word: "신화 속" },
    { from: 30, word: "전설적인" },
    { from: 25, word: "고귀한" },
    { from: 20, word: "찬란한" },
    { from: 16, word: "위풍당당한" },
    { from: 13, word: "눈부신" },
    { from: 10, word: "노련한" },
    { from: 7, word: "자신만만한" },
    { from: 5, word: "반짝이는" },
    { from: 3, word: "호기심 가득한" },
    { from: 1, word: "풋풋한" },
  ],
  noTitle: "견습 연구원",

  // 경험치 규칙 (ideas.md §8-4)
  xp: {
    firstTest: 100,
    newestBonus: 50, // 최신 테스트(tests-data.js live 중 마지막 2개) 첫 완료
    newestCount: 2,
    retake: 20, // 같은 테스트는 하루 1번
    retakeDailyCap: 100,
    attendance: 30,
    streakStep: 10, // 연속 출석 보너스 = step × (연속일 − 1), 최대 streakMax
    streakMax: 50,
    badge: 50,
  },
  // 레벨 L → L+1 필요 경험치 = levelBase + levelStep × (L − 1)
  levelBase: 100,
  levelStep: 50,

  groups: {
    food: "미식",
    life: "생활",
    relation: "관계",
    mood: "감성",
    outside: "바깥",
  },

  // 상장 — kind: count(완주 n개) · all(공개 테스트 전부) · group(묶음 전부) · streak(연속 출석 n일)
  //        · days(누적 출석 n일) · result(그 테스트에서 codes 중 하나) · test(그 테스트 완주) · dex(칭호 도감 16칸)
  // hidden: true 면 받기 전까지 이름·조건 비공개("???"). item: 해금되는 손 소품.
  badges: [
    { id: "first", name: "첫 표본 채집", kind: "count", n: 1, item: "vial", line: "첫 번째 표본을 정성껏 채집하였기에" },
    { id: "regular", name: "연구소 단골", kind: "count", n: 5, item: "mug", line: "연구소를 다섯 번이나 찾아 표본을 채웠기에" },
    { id: "walking-dex", name: "걸어다니는 도감", kind: "count", n: 10, item: "book", line: "열 가지 표본을 모아 걸어다니는 도감이 되었기에" },
    { id: "doctor", name: "표본 박사", kind: "count", n: 20, item: "lens", line: "스무 가지 표본을 모아 박사의 경지에 올랐기에" },
    { id: "honorary", name: "명예 연구원", kind: "all", item: "trophy", line: "연구소의 모든 표본을 빠짐없이 모았기에" },

    { id: "g-food", name: "미식 탐구", kind: "group", group: "food", item: "riceball", line: "미식 테스트를 모두 맛보았기에" },
    { id: "g-life", name: "생활 달인", kind: "group", group: "life", item: "clock", line: "생활 테스트를 모두 해냈기에" },
    { id: "g-relation", name: "관계 박사", kind: "group", group: "relation", item: "heart", line: "관계 테스트를 모두 살펴보았기에" },
    { id: "g-mood", name: "감성 수집가", kind: "group", group: "mood", item: "camera", line: "감성 테스트를 모두 모았기에" },
    { id: "g-outside", name: "바깥 탐험가", kind: "group", group: "outside", item: "flag", line: "바깥 테스트를 모두 다녀왔기에" },

    { id: "streak-3", name: "사흘 연속", kind: "streak", n: 3, item: "sprout", line: "사흘 내리 연구소에 출석하였기에" },
    { id: "streak-7", name: "개근 일주일", kind: "streak", n: 7, item: "star", line: "일주일 동안 하루도 빠짐없이 출석하였기에" },
    { id: "streak-30", name: "한 달 개근", kind: "streak", n: 30, item: "moon", line: "한 달 동안 하루도 빠짐없이 출석하였기에" },
    { id: "days-100", name: "백일 출석", kind: "days", n: 100, item: "cake", line: "연구소에 백 번째 출석 도장을 찍었기에" },
    { id: "days-365", name: "일 년 출석", kind: "days", n: 365, item: "medal", line: "연구소에 삼백예순다섯 번 출석하였기에" },

    { id: "h-coffee", name: "모닝커피마니아", kind: "result", testId: "cafedrink", codes: ["ISTJ", "INTJ", "ISTP", "INTP", "ESTP", "ESTJ", "ENTJ"], hidden: true, item: "coffee", line: "커피 한 잔으로 하루를 여는 사람임을 증명하였기에" },
    { id: "h-cat", name: "최고의 고양이집사", kind: "test", testId: "cat-type", hidden: true, item: "cat", line: "고양이의 마음을 들여다보았기에" },
    { id: "h-dex", name: "열여섯 가지 얼굴", kind: "dex", hidden: true, item: "prism", line: "열여섯 가지 칭호를 모두 경험하였기에" },
  ],

  // 가운 색 — 레벨로 해금. w = 가운, g = 가운 그림자. rainbow 는 줄마다 다른 색.
  coats: [
    { id: "white", name: "흰 가운", level: 1, w: "#ffffff", g: "#ced8e4" },
    { id: "sky", name: "하늘 가운", level: 5, w: "#d6ecff", g: "#8cc6f2" },
    { id: "mint", name: "민트 가운", level: 10, w: "#d2f2e6", g: "#86d3b8" },
    { id: "coral", name: "코랄 가운", level: 20, w: "#ffdccf", g: "#ffa489" },
    { id: "gold", name: "황금 가운", level: 30, w: "#fff0bf", g: "#efbd45" },
    { id: "rainbow", name: "무지개 가운", level: 50, rows: ["#ff9e8a", "#ffc27a", "#ffe08a", "#a6e3c4", "#9fd2ff", "#ffffff", "#ffffff"] },
  ],

  hairs: [
    { id: "short", name: "짧은 머리" },
    { id: "bob", name: "단발" },
    { id: "bun", name: "똥머리" },
  ],
  defaultHair: "bob",

  // ---------- 도트 그림 (16×16, planning/art/village-claude 원본과 같은 격자) ----------
  palette: {
    k: "#2b2320", s: "#f5c9a8", h: "#6e4830", w: "#ffffff", g: "#ced8e4", b: "#2a86ff", l: "#82cbff",
    p: "#4a5568", r: "#ff9e8a", c: "#ff7a59", d: "#6b4226", m: "#c8c0b8", y: "#ffc93c", u: "#c9922a",
    n: "#2fae91", v: "#9be0b0", o: "#ffa94d", f: "#ff8fb1", z: "#34406b", a: "#e8f4ff", x: "#e8505b", e: "#9696a0",
  },
  // 머리(0~8행). 몸(9~15행)은 body, 단발만 어깨 바깥선이 넓다(bodyBob).
  head: {
    short: [
      "................",
      ".....kkkkkk.....",
      "....khhhhhhk....",
      "...khhhhhhhhk...",
      "...khhhhhhhhk...",
      "...khsssssshk...",
      "...kskssssksk...",
      "...krssssssrk...",
      "....kssssssk....",
    ],
    bob: [
      "................",
      ".....kkkkkk.....",
      "....khhhhhhk....",
      "...khhhhhhhhk...",
      "..khhhhhhhhhhk..",
      "..khh" + "ssss" + "hhhhk..",
      "..khs" + "k" + "ssss" + "k" + "shk..",
      "..khr" + "ssssss" + "rhk..",
      "..khk" + "ssssss" + "khk..",
    ],
    bun: [
      "......kkkk......",
      ".....khhhhk.....",
      "....kkhhhhkk....",
      "...khhhhhhhhk...",
      "...khhhhhhhhk...",
      "...khhsssshhk...",
      "...kskssssksk...",
      "...krssssssrk...",
      "....kssssssk....",
    ],
  },
  body: [
    "....kgwwwwgk....",
    "...kwwwwwwbwk...",
    "..kswwwwwwwwsk..",
    "..kswwwwwwwwsk..",
    "...kgwwwwwwgk...",
    "....kppkkppk....",
    "....kkk..kkk....",
  ],
  bodyBob: [
    "..kkgwwwwgkk....",
    "...kwwwwwwbwk...",
    "..kswwwwwwwwsk..",
    "..kswwwwwwwwsk..",
    "...kgwwwwwwgk...",
    "....kppkkppk....",
    "....kkk..kkk....",
  ],
  // 손 소품: y = 시작 행, 각 줄은 11번째 칸부터 5칸. 오른손(12, 11)이 's'.
  items: {
    vial: { name: "표본병", y: 6, rows: ["..kk.", "..ak.", ".kvvk", ".kvvk", ".kvvk", ".skkk"] },
    mug: { name: "연구소 머그", y: 8, rows: [".kkkk", ".kbwk", ".kwwk", ".swwk", ".kkkk"] },
    book: { name: "도감", y: 7, rows: [".kkkk", ".kcck", ".kyyk", ".kcck", ".scck", ".kkkk"] },
    lens: { name: "돋보기", y: 5, rows: ["..kkk", "..kak", "..kkk", "..d..", "..d..", ".d...", ".s..."] },
    trophy: { name: "트로피", y: 7, rows: [".kkkk", ".kyyk", ".kyyk", "..ku.", ".skk.", ".kkkk"] },
    riceball: { name: "주먹밥", y: 8, rows: ["..kk.", ".kwwk", ".kwwk", ".szzk", ".kkkk"] },
    clock: { name: "알람시계", y: 7, rows: [".x..x", ".xkkx", ".kwdk", ".kwwk", ".skkk"] },
    heart: { name: "하트 편지", y: 7, rows: [".k.k.", "kfkfk", "kfffk", ".kfk.", ".sk.."] },
    camera: { name: "필름 카메라", y: 8, rows: ["...k.", ".kkkk", ".kplk", ".spkk", ".kkkk"] },
    flag: { name: "탐험 깃발", y: 4, rows: ["..knn", "..knn", "..k..", "..d..", "..d..", "..d..", "..d..", ".sd.."] },
    sprout: { name: "새싹 화분", y: 7, rows: [".v.v.", "..n..", ".kkkk", ".kook", ".sook", ".kkkk"] },
    star: { name: "별", y: 7, rows: ["..u..", ".uyu.", "uyyyu", ".uyu.", ".s.u."] },
    moon: { name: "초승달", y: 6, rows: ["..uy.", ".uy..", ".uy..", ".uy..", "..uy.", ".s..."] },
    cake: { name: "백일 케이크", y: 7, rows: ["..x..", "..f..", ".kkkk", ".kffk", ".swwk", ".kkkk"] },
    medal: { name: "금메달", y: 7, rows: [".bbx.", "..kk.", ".kyyk", ".kyyk", ".skk."] },
    coffee: { name: "모닝커피", y: 5, rows: ["...m.", "..m..", "...m.", ".kkkk", ".kddk", ".kcck", ".scck", ".kcck", ".kkkk"] },
    cat: { name: "고양이 인형", y: 7, rows: [".o..o", ".oooo", ".okok", ".oooo", ".s..."] },
    prism: { name: "무지개 결정", y: 7, rows: ["..kk.", ".kxok", ".kynk", ".kblk", ".skk."] },
  },
};
