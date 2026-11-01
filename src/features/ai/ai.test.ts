import { describe, expect, it } from "vitest";
import { extractionSystemPrompt, extractionUserContent, costAnalysisPrompt } from "./prompts";
import { detectImageType } from "./image";
import { fakeExtraction, normalizeExtraction, type Extraction } from "./suggestions";

const CHILDREN = [
  { id: "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11", name: "하늘" },
  { id: "0b7e4f6a-2d3c-4e5f-8a9b-1c2d3e4f5a6b", name: "바다" },
];

function item(overrides: Partial<Extraction["items"][number]> = {}): Extraction["items"][number] {
  return {
    category: "school",
    schoolKind: "event",
    childName: "하늘",
    date: "2026-11-20",
    endDate: null,
    time: null,
    title: "현장체험학습",
    subject: null,
    supplies: ["도시락", " 물병 "],
    note: null,
    ...overrides,
  };
}

describe("prompts", () => {
  it("tells the model today, the children and that parents decide", () => {
    const system = extractionSystemPrompt("2026-11-04", ["하늘", "바다"]);
    expect(system).toContain("2026-11-04");
    expect(system).toContain("하늘, 바다");
    expect(system).toContain("확정하지");
  });

  it("puts an image before the text", () => {
    const content = extractionUserContent("내일 준비물: 색종이", { mediaType: "image/png", base64: "AAAA" });
    expect(content.map((block) => block.type)).toEqual(["image", "text"]);
  });

  it("sends text only when there is no image", () => {
    expect(extractionUserContent("알림장", null)).toEqual([{ type: "text", text: expect.stringContaining("알림장") }]);
  });

  it("sends only aggregated numbers for cost analysis", () => {
    const prompt = costAnalysisPrompt([
      { month: "2026-10", tuition: 600000, travel: 0, subjects: [{ label: "하늘 영어", amount: 320000 }] },
    ]);
    expect(prompt).toContain("2026-10");
    expect(prompt).toContain("600000");
    expect(prompt).toContain("하늘 영어");
  });
});

describe("normalizeExtraction", () => {
  it("matches children by name and keeps valid school items", () => {
    const result = normalizeExtraction({ items: [item()], unresolved: [] }, CHILDREN);
    expect(result.schoolItems).toEqual([
      {
        childId: CHILDREN[0].id,
        kind: "event",
        eventDate: "2026-11-20",
        endDate: null,
        title: "현장체험학습",
        subject: null,
        supplies: ["도시락", "물병"],
        note: null,
      },
    ]);
  });

  it("leaves the child empty when the name is unknown or missing, for the parent to choose", () => {
    const result = normalizeExtraction({ items: [item({ childName: "셋째" }), item({ childName: null })], unresolved: [] }, CHILDREN);
    expect(result.schoolItems.map((entry) => entry.childId)).toEqual([null, null]);
  });

  it("moves academy notices and undated items to the review list instead of the school list", () => {
    const result = normalizeExtraction(
      {
        items: [
          item({ category: "academy", schoolKind: null, title: "영어 학원 11/12 휴강" }),
          item({ date: null, title: "날짜 미정 행사" }),
          item({ date: "2026-02-30", title: "없는 날짜" }),
        ],
        unresolved: ["다음 달 상담 주간(날짜 미정)"],
      },
      CHILDREN,
    );
    expect(result.schoolItems).toEqual([]);
    expect(result.reviewItems).toEqual([
      { title: "영어 학원 11/12 휴강", date: "2026-11-20", note: null },
      { title: "날짜 미정 행사", date: null, note: null },
      { title: "없는 날짜", date: null, note: null },
      { title: "다음 달 상담 주간(날짜 미정)", date: null, note: null },
    ]);
  });

  it("drops a backwards end date and caps supplies", () => {
    const supplies = Array.from({ length: 30 }, (_, index) => `준비물${index}`);
    const [entry] = normalizeExtraction({ items: [item({ endDate: "2026-11-19", supplies })], unresolved: [] }, CHILDREN).schoolItems;
    expect(entry.endDate).toBeNull();
    expect(entry.supplies).toHaveLength(20);
  });
});

describe("fakeExtraction (tests only)", () => {
  it("turns every YYYY-MM-DD in the text into a school event", () => {
    expect(fakeExtraction("2026-11-20 현장체험학습 준비물: 도시락").items).toEqual([
      expect.objectContaining({ date: "2026-11-20", title: "현장체험학습 준비물: 도시락", category: "school" }),
    ]);
  });
});

describe("detectImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0]);

  it("recognizes images by their signature", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(detectImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects anything else, whatever the browser claimed", () => {
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7 not an image"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
