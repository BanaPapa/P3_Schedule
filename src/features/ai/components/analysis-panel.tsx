"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { analyzeCostsAction, type AnalysisState } from "../actions";

/** 최근 6개월 지출을 AI 가 살펴보고 제안한다 (숫자만 보낸다) */
export function AnalysisPanel() {
  const [state, formAction, pending] = useActionState<AnalysisState, FormData>(analyzeCostsAction, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "done" ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{state.summary}</p>
          {state.highlights.length > 0 ? (
            <ul className="list-disc pl-5">
              {state.highlights.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : null}
          {state.suggestions.length > 0 ? (
            <>
              <p className="font-semibold">제안</p>
              <ul className="list-disc pl-5">
                {state.suggestions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="text-xs text-muted">AI 제안은 참고용입니다. 결정은 가족이 합니다.</p>
        </div>
      ) : null}
      {state.status === "error" ? <FormMessage state={{ status: "error", message: state.message }} /> : null}
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? "살펴보는 중…" : "AI로 최근 6개월 지출 살펴보기"}
      </Button>
    </form>
  );
}
