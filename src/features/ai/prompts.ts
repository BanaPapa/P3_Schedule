import type Anthropic from "@anthropic-ai/sdk";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

/** 일정 추출 지시. 오늘 날짜와 자녀 이름을 주어 "다음 주 화요일" 같은 표현을 풀게 한다. */
export function extractionSystemPrompt(today: string, childNames: readonly string[]): string {
  return [
    "너는 한국 가정의 학교 가정통신문, 알림장, 학원 공지에서 일정 정보를 뽑아내는 도우미다.",
    `오늘은 ${today} (Asia/Seoul) 이다. 이 가족의 자녀: ${childNames.length > 0 ? childNames.join(", ") : "(등록된 자녀 없음)"}.`,
    "",
    "규칙:",
    "- 글이나 사진에 분명히 적힌 일정만 뽑는다. 추측해서 만들지 않는다.",
    "- 날짜는 YYYY-MM-DD 로 쓴다. '다음 주 화요일', '11/20' 처럼 상대적이거나 연도가 없는 날짜는 오늘을 기준으로 가장 가까운 앞으로의 날짜로 풀어 쓴다. 날짜를 정할 수 없으면 date 를 null 로 두고 unresolved 에도 적는다.",
    "- 학교 일정은 category=school, schoolKind 를 academic(학사일정)/event(행사)/homework(과제)/exam(시험)/holiday(휴업·방학) 중 하나로. 여러 날이면 endDate.",
    "- 학원 휴강·보강·시간 변경·수강료 안내는 category=academy. 학원비나 수업 일정을 확정하지 않는다. 부모가 확인할 수 있게 title 에 요점만 적는다.",
    "- 자녀 이름이 글에 나오면 childName 에 위 자녀 이름 중 하나를 그대로 쓴다. 모르면 null.",
    "- 준비물은 supplies 에 하나씩. 제목(title)은 짧은 한국어로.",
    "- 너의 결과는 제안일 뿐이며 부모가 검토한 뒤 등록한다. 아무것도 확정하지 않는다.",
  ].join("\n");
}

export function extractionUserContent(text: string, image: ImageInput | null): Anthropic.Beta.BetaContentBlockParam[] {
  const prompt = text.trim()
    ? `다음 안내문에서 일정을 뽑아 줘.\n\n<notice>\n${text.trim()}\n</notice>`
    : "사진 속 안내문에서 일정을 뽑아 줘.";
  const textBlock: Anthropic.Beta.BetaContentBlockParam = { type: "text", text: prompt };
  if (!image) return [textBlock];
  return [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
    textBlock,
  ];
}

export interface MonthCost {
  /** "YYYY-MM" */
  month: string;
  tuition: number;
  travel: number;
  subjects: { label: string; amount: number }[];
}

export const COST_ANALYSIS_SYSTEM = [
  "너는 한국 가정의 교육비·여행비 지출을 함께 살펴보는 도우미다.",
  "주어진 월별 숫자만 근거로, 변화와 눈에 띄는 점을 짧게 설명하고 실천할 수 있는 제안을 한다.",
  "숫자를 지어내지 않는다. 학원을 그만두라거나 바꾸라고 단정하지 말고, 부모가 판단할 거리를 준다.",
  "금액은 '원' 단위로, 문장은 짧은 한국어로.",
].join("\n");

/** 월별 합계와 "자녀 이름 과목" 표시만 보낸다 */
export function costAnalysisPrompt(months: readonly MonthCost[]): string {
  const lines = months.map((month) => {
    const subjects = month.subjects.map((subject) => `${subject.label} ${subject.amount}`).join(", ");
    return `${month.month}: 교육비 ${month.tuition}, 여행비 ${month.travel}${subjects ? ` (과목별: ${subjects})` : ""}`;
  });
  return `최근 월별 지출(원):\n${lines.join("\n")}\n\n요약, 눈에 띄는 점, 제안을 알려 줘.`;
}
