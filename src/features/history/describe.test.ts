import { describe, expect, it } from "vitest";
import { describeEntry, type AuditEntry, type HistoryContext } from "./describe";

const CTX: HistoryContext = {
  children: new Map([["c1", "하늘"]]),
  academies: new Map([["a1", "튼튼영어"]]),
  enrollments: new Map([["e1", { academyName: "튼튼영어", childId: "c1" }]]),
  invoices: new Map([["i1", { enrollmentId: "e1", billingMonth: "2026-11-01" }]]),
};

function entry(
  tableName: string,
  action: AuditEntry["action"],
  newData: Record<string, unknown> | null,
  oldData: Record<string, unknown> | null = null,
): AuditEntry {
  return { id: 1, tableName, action, actorId: "u1", oldData, newData, createdAt: "2026-11-01T00:00:00Z" };
}

const SESSION = {
  enrollment_id: "e1",
  session_date: "2026-11-03",
  start_time: "16:00:00",
  status: "scheduled",
  kind: "regular",
  note: null,
  makeup_waived: false,
};

describe("describeEntry: family and children", () => {
  it.each([
    [entry("families", "insert", { name: "김씨네" }), "가족을 만들었습니다"],
    [entry("families", "update", { name: "김가네" }, { name: "김씨네" }), "가족 이름을 '김가네'(으)로 바꿨습니다"],
    [entry("family_members", "insert", { display_name: "엄마" }), "엄마님이 가족에 합류했습니다"],
    [entry("children", "insert", { name: "하늘" }), "자녀 하늘을(를) 등록했습니다"],
    [entry("children", "delete", null, { name: "바다" }), "자녀 바다을(를) 삭제했습니다"],
    [entry("academies", "update", { name: "튼튼영어" }, { name: "튼튼" }), "학원 튼튼영어 정보를 수정했습니다"],
  ])("%#", (input, expected) => {
    expect(describeEntry(input, CTX)).toBe(expected);
  });

  it("hides updates that changed nothing visible", () => {
    expect(describeEntry(entry("families", "update", { name: "김씨네" }, { name: "김씨네" }), CTX)).toBeNull();
  });
});

describe("describeEntry: classes", () => {
  it("describes enrollments with child and academy", () => {
    const base = { child_id: "c1", academy_id: "a1", subject: null, memo: null, end_date: null };
    expect(describeEntry(entry("enrollments", "insert", base), CTX)).toBe("하늘 · 튼튼영어 수강을 등록했습니다");
    expect(describeEntry(entry("enrollments", "update", { ...base, end_date: "2026-12-31" }, base), CTX)).toBe(
      "하늘 · 튼튼영어 수강 종료일을 2026. 12. 31.(으)로 정했습니다",
    );
    expect(describeEntry(entry("enrollments", "update", { ...base, memo: "토요일 보충" }, base), CTX)).toBe(
      "하늘 · 튼튼영어 비고를 수정했습니다",
    );
  });

  it("falls back to the old subject when the academy is gone", () => {
    expect(
      describeEntry(entry("enrollments", "delete", null, { child_id: "c1", academy_id: "gone", subject: "영어" }), CTX),
    ).toBe("하늘 · 영어 수강을 삭제했습니다");
  });

  it("describes session status, time, note and makeup changes", () => {
    expect(describeEntry(entry("class_sessions", "update", { ...SESSION, status: "absent" }, SESSION), CTX)).toBe(
      "하늘 · 튼튼영어 11월 3일 (화) 수업을 '결석'(으)로 바꿨습니다",
    );
    expect(
      describeEntry(entry("class_sessions", "update", { ...SESSION, start_time: "18:00:00" }, SESSION), CTX),
    ).toBe("하늘 · 튼튼영어 11월 3일 (화) 수업 시간을 18:00(으)로 바꿨습니다");
    expect(
      describeEntry(entry("class_sessions", "update", { ...SESSION, session_date: "2026-11-04" }, SESSION), CTX),
    ).toBe("하늘 · 튼튼영어 11월 3일 (화) 수업을 11월 4일 (수) 16:00(으)로 바꿨습니다");
    expect(describeEntry(entry("class_sessions", "update", { ...SESSION, note: "감기" }, SESSION), CTX)).toBe(
      "하늘 · 튼튼영어 11월 3일 (화) 수업에 메모를 남겼습니다",
    );
    expect(
      describeEntry(
        entry("class_sessions", "insert", { ...SESSION, kind: "makeup", session_date: "2026-11-06", status: "makeup_scheduled" }),
        CTX,
      ),
    ).toBe("하늘 · 튼튼영어 보강을 11월 6일 (금) 16:00에 잡았습니다");
    expect(
      describeEntry(entry("class_sessions", "insert", { ...SESSION, kind: "rescheduled", session_date: "2026-11-05" }), CTX),
    ).toBe("하늘 · 튼튼영어 수업을 11월 5일 (목) 16:00(으)로 옮겼습니다");
  });

  it("hides generated or bookkeeping changes", () => {
    expect(describeEntry(entry("class_sessions", "insert", SESSION), CTX)).toBeNull();
    expect(describeEntry(entry("class_sessions", "delete", null, SESSION), CTX)).toBeNull();
    expect(describeEntry(entry("class_rules", "insert", { enrollment_id: "e1" }), CTX)).toBeNull();
    expect(
      describeEntry(entry("class_sessions", "update", { ...SESSION, version: 3 }, { ...SESSION, version: 2 }), CTX),
    ).toBeNull();
  });

  it("falls back when the class is gone", () => {
    expect(
      describeEntry(entry("class_sessions", "update", { ...SESSION, enrollment_id: "zz", status: "absent" }, { ...SESSION, enrollment_id: "zz" }), CTX),
    ).toBe("삭제된 과목 11월 3일 (화) 수업을 '결석'(으)로 바꿨습니다");
  });
});

describe("describeEntry: tuition", () => {
  const INVOICE = { enrollment_id: "e1", billing_month: "2026-11-01", base_amount: 320000 };

  it("describes confirmation, adjustment, items and payments", () => {
    expect(describeEntry(entry("tuition_invoices", "insert", INVOICE), CTX)).toBe(
      "하늘 · 튼튼영어 11월 청구를 확정했습니다 (320,000원)",
    );
    expect(
      describeEntry(entry("tuition_invoices", "update", { ...INVOICE, base_amount: 280000 }, INVOICE), CTX),
    ).toBe("하늘 · 튼튼영어 11월 확정액을 280,000원(으)로 조정했습니다");
    expect(describeEntry(entry("tuition_invoices", "update", { ...INVOICE, version: 2 }, INVOICE), CTX)).toBeNull();
    expect(
      describeEntry(entry("tuition_invoice_items", "insert", { invoice_id: "i1", kind: "extra", label: "교재비", amount: 20000 }), CTX),
    ).toBe("하늘 · 튼튼영어 11월 청구에 추가 '교재비' 20,000원을 넣었습니다");
    expect(
      describeEntry(entry("tuition_payments", "insert", { invoice_id: "i1", amount: 100000 }), CTX),
    ).toBe("하늘 · 튼튼영어 11월 학원비 100,000원 납부를 기록했습니다");
    expect(describeEntry(entry("tuition_policies", "insert", { enrollment_id: "e1" }), CTX)).toBe(
      "하늘 · 튼튼영어 요금 정책을 바꿨습니다",
    );
  });

  it("ignores unknown tables", () => {
    expect(describeEntry(entry("something_new", "insert", {}), CTX)).toBeNull();
  });
});

describe("describeEntry: travel", () => {
  const TRIP = { title: "제주 여행", start_date: "2027-07-20", end_date: "2027-07-23", version: 1 };

  it("describes trips, itinerary, budgets and expenses", () => {
    expect(describeEntry(entry("trips", "insert", TRIP), CTX)).toBe("여행 '제주 여행'을(를) 만들었습니다");
    expect(describeEntry(entry("trips", "update", { ...TRIP, end_date: "2027-07-24" }, TRIP), CTX)).toBe(
      "여행 '제주 여행' 정보를 수정했습니다",
    );
    expect(describeEntry(entry("trips", "delete", null, TRIP), CTX)).toBe("여행 '제주 여행'을(를) 지웠습니다");
    expect(describeEntry(entry("trip_items", "insert", { title: "성산일출봉" }), CTX)).toBe(
      "여행 일정 '성산일출봉'을(를) 넣었습니다",
    );
    expect(describeEntry(entry("trip_budgets", "insert", { category: "food", planned_amount: 400000 }), CTX)).toBe(
      "여행 예산(식비)을 400,000원으로 정했습니다",
    );
    expect(
      describeEntry(entry("trip_expenses", "insert", { category: "food", amount: 85000, description: "흑돼지" }), CTX),
    ).toBe("여행 지출 85,000원(흑돼지)을 기록했습니다");
  });

  it("hides trip updates that only bumped the version", () => {
    expect(describeEntry(entry("trips", "update", { ...TRIP, version: 2 }, TRIP), CTX)).toBeNull();
  });
});

describe("describeEntry: school and study", () => {
  it("describes school events, supplies, scores and study logs", () => {
    const EXAM = { child_id: "c1", kind: "exam", title: "중간고사", event_date: "2027-04-20", done: false, score: null };
    expect(describeEntry(entry("school_events", "insert", EXAM), CTX)).toBe("하늘 시험 '중간고사'을(를) 등록했습니다");
    expect(describeEntry(entry("school_events", "update", { ...EXAM, score: 92 }, EXAM), CTX)).toBe(
      "하늘 '중간고사' 점수를 기록했습니다",
    );
    expect(
      describeEntry(entry("school_events", "update", { ...EXAM, kind: "homework", done: true }, { ...EXAM, kind: "homework" }), CTX),
    ).toBe("하늘 과제 '중간고사'을(를) 끝냈습니다");
    expect(describeEntry(entry("school_event_items", "update", { label: "사인펜", checked: true }, { label: "사인펜", checked: false }), CTX)).toBe(
      "준비물 '사인펜'을(를) 챙겼습니다",
    );
    expect(describeEntry(entry("school_event_items", "insert", { label: "사인펜" }), CTX)).toBeNull();
    expect(describeEntry(entry("study_subjects", "insert", { child_id: "c1", name: "수학" }), CTX)).toBe(
      "하늘 학습 과목 '수학'을(를) 추가했습니다",
    );
    expect(describeEntry(entry("study_logs", "insert", { unit: "3단원", minutes: 40 }), CTX)).toBe(
      "학습 기록을 남겼습니다 (3단원, 40분)",
    );
  });
});
