// Animation production register. 'ready' = existing artwork supports safe movement;
// 'needs-art' = do not pretend a rigid image transform is a new full-body animation.
export const MATE_ANIMATIONS=Object.freeze([
  {
    "group": "life",
    "label": "숨쉬기",
    "id": "idle-breathe",
    "status": "ready",
    "notes": "기본 호흡과 몸통 미세 움직임"
  },
  {
    "group": "life",
    "label": "눈 깜빡이기",
    "id": "blink",
    "status": "ready",
    "notes": "기존 눈 마스크"
  },
  {
    "group": "life",
    "label": "주변 둘러보기",
    "id": "look",
    "status": "ready",
    "notes": "시선·고개 따라가기"
  },
  {
    "group": "life",
    "label": "책 읽기",
    "id": "read",
    "status": "ready",
    "notes": "기존 독서 원화"
  },
  {
    "group": "life",
    "label": "꾸벅꾸벅 졸기",
    "id": "doze",
    "status": "ready",
    "notes": "기존 독서 포즈 활용"
  },
  {
    "group": "life",
    "label": "기지개 켜기",
    "id": "stretch",
    "status": "needs-art",
    "notes": "양팔을 든 전신 원화와 몸통 분리 필요"
  },
  {
    "group": "life",
    "label": "앉기",
    "id": "sit",
    "status": "needs-art",
    "notes": "골반·무릎·발 원화 필요"
  },
  {
    "group": "life",
    "label": "일어나기",
    "id": "stand",
    "status": "needs-art",
    "notes": "앉은 자세 전환 원화 필요"
  },
  {
    "group": "life",
    "label": "머리카락 흩날리기",
    "id": "hair-sway",
    "status": "needs-art",
    "notes": "앞·옆·뒷머리 독립 레이어 필요"
  },
  {
    "group": "life",
    "label": "하품하기",
    "id": "yawn",
    "status": "needs-art",
    "notes": "입과 얼굴 표정 원화 필요"
  },
  {
    "group": "movement",
    "label": "걷기",
    "id": "walk",
    "status": "needs-art",
    "notes": "양쪽 다리 교대 보행 프레임 필요"
  },
  {
    "group": "movement",
    "label": "달리기",
    "id": "run",
    "status": "needs-art",
    "notes": "달리기 전신 원화 필요"
  },
  {
    "group": "movement",
    "label": "폴짝 뛰기",
    "id": "hop",
    "status": "ready",
    "notes": "기존 몸통의 위치 이동"
  },
  {
    "group": "movement",
    "label": "안전하게 착지",
    "id": "land",
    "status": "ready",
    "notes": "위치 완충, 신체 이미지 왜곡 금지"
  },
  {
    "group": "movement",
    "label": "좌우 몸 돌리기",
    "id": "turn",
    "status": "needs-art",
    "notes": "옆모습·반측면 전신 원화 필요"
  },
  {
    "group": "movement",
    "label": "허리 숙여 인사",
    "id": "bow",
    "status": "ready",
    "notes": "몸통과 머리 회전 중심을 따로 사용"
  },
  {
    "group": "movement",
    "label": "팔 앞으로 뻗기",
    "id": "reach",
    "status": "needs-art",
    "notes": "손·상완·어깨 원화 필요"
  },
  {
    "group": "movement",
    "label": "공중 부유",
    "id": "float",
    "status": "ready",
    "notes": "전신 위치와 경사 미세 이동"
  },
  {
    "group": "emotion",
    "label": "활짝 웃기",
    "id": "smile",
    "status": "needs-art",
    "notes": "입·눈썹 표정 원화 필요"
  },
  {
    "group": "emotion",
    "label": "크게 웃기",
    "id": "laugh",
    "status": "needs-art",
    "notes": "눈·입 표정 원화 필요"
  },
  {
    "group": "emotion",
    "label": "깜짝 놀라기",
    "id": "surprised",
    "status": "ready",
    "notes": "현재 호기심 포즈와 몸통 반응"
  },
  {
    "group": "emotion",
    "label": "얼굴 붉히기",
    "id": "blush",
    "status": "needs-art",
    "notes": "얼굴 표정 오버레이 원화 필요"
  },
  {
    "group": "emotion",
    "label": "수줍어하기",
    "id": "shy",
    "status": "ready",
    "notes": "머리·몸통 연동"
  },
  {
    "group": "emotion",
    "label": "신나게 축하하기",
    "id": "celebrate",
    "status": "ready",
    "notes": "점프와 기울기 조합"
  },
  {
    "group": "emotion",
    "label": "곰곰이 생각하기",
    "id": "curious",
    "status": "ready",
    "notes": "호기심 포즈 활용"
  },
  {
    "group": "emotion",
    "label": "윙크하기",
    "id": "wink",
    "status": "needs-art",
    "notes": "한쪽 눈 전용 레이어 필요"
  },
  {
    "group": "special",
    "label": "마법 소환",
    "id": "summon",
    "status": "ready",
    "notes": "기존 마법구·파티클 활용"
  },
  {
    "group": "special",
    "label": "캐릭터 인사",
    "id": "greet",
    "status": "ready",
    "notes": "기존 팔꿈치·손목 인사"
  },
  {
    "group": "special",
    "label": "캐릭터에게 다가가기",
    "id": "approach",
    "status": "needs-art",
    "notes": "보행 전신 원화 선행 필요"
  },
  {
    "group": "special",
    "label": "하이파이브",
    "id": "high-five",
    "status": "needs-art",
    "notes": "손·어깨·상대 높이 원화 필요"
  },
  {
    "group": "special",
    "label": "선물 건네기",
    "id": "gift",
    "status": "needs-art",
    "notes": "소품·손 원화 필요"
  },
  {
    "group": "special",
    "label": "사진 포즈",
    "id": "photograph",
    "status": "ready",
    "notes": "머리·몸통 기울임"
  },
  {
    "group": "special",
    "label": "손 흔들며 배웅",
    "id": "farewell",
    "status": "ready",
    "notes": "팔 관절과 몸통 결합"
  },
  {
    "group": "special",
    "label": "실패에 당황하기",
    "id": "puzzled",
    "status": "ready",
    "notes": "놀람/호기심 포즈 전환"
  }
]);
export const MATE_ANIMATION_TARGET=MATE_ANIMATIONS.length;
export const availableAnimations=()=>MATE_ANIMATIONS.filter(action=>action.status==='ready');
export const pendingArtwork=()=>MATE_ANIMATIONS.filter(action=>action.status==='needs-art');
export function animationStatus(id){return MATE_ANIMATIONS.find(a=>a.id===id)?.status??'unknown';}
