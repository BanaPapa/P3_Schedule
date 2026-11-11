"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ROUTES } from "@/lib/routes";
import type { CalendarSession } from "../queries";
import { SessionDeleteModal } from "./session-delete-modal";
import { SessionEditModal, type EditDraft } from "./session-edit-modal";

export interface ChildOption {
  id: string;
  name: string;
  color: string;
}

/** 끌고 있는 수업과, 잡은 위치가 칸 위쪽에서 얼마나 내려와 있는지(px) */
export interface DragInfo {
  session: CalendarSession;
  grabOffsetPx: number;
}

type EditorState =
  | { kind: "edit"; session: CalendarSession; draft?: EditDraft; fromDrag: boolean }
  | { kind: "delete"; session: CalendarSession }
  | { kind: "menu"; session: CalendarSession; x: number; y: number }
  | null;

interface EditorApi {
  openEdit: (session: CalendarSession, draft?: EditDraft) => void;
  openDelete: (session: CalendarSession) => void;
  openMenu: (session: CalendarSession, x: number, y: number) => void;
  /** 끌기 시작·끝, 지금 끌고 있는 수업(놓을 자리 계산용) */
  startDrag: (info: DragInfo) => void;
  endDrag: () => void;
  currentDrag: () => DragInfo | null;
}

/** 수업 칸의 조작 안내 문구 id (aria-describedby) */
export const EDIT_HINT_ID = "timetable-edit-hint";

const EditorContext = createContext<EditorApi | null>(null);

export function useTimetableEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error("useTimetableEditor 는 TimetableEditorProvider 안에서만 쓴다");
  return api;
}

interface ProviderProps {
  childOptions: readonly ChildOption[];
  children: ReactNode;
}

/**
 * PC 주간 격자에서 화면 전환 없이 바로 고치기: 더블클릭 편집, 끌어 옮기기, 우클릭 메뉴(삭제).
 * 상태는 한 곳(여기)에 두고 모달과 메뉴를 그린다.
 */
export function TimetableEditorProvider({ childOptions, children }: ProviderProps) {
  const [state, setState] = useState<EditorState>(null);
  const dragging = useRef<DragInfo | null>(null);
  const close = useCallback(() => setState(null), []);

  const api = useMemo<EditorApi>(
    () => ({
      openEdit: (session, draft) => setState({ kind: "edit", session, draft, fromDrag: Boolean(draft) }),
      openDelete: (session) => setState({ kind: "delete", session }),
      openMenu: (session, x, y) => setState({ kind: "menu", session, x, y }),
      startDrag: (info) => {
        dragging.current = info;
      },
      endDrag: () => {
        dragging.current = null;
      },
      currentDrag: () => dragging.current,
    }),
    [],
  );

  return (
    <EditorContext.Provider value={api}>
      {children}
      {state?.kind === "menu" ? (
        <SessionMenu
          session={state.session}
          x={state.x}
          y={state.y}
          onClose={close}
          onEdit={() => setState({ kind: "edit", session: state.session, fromDrag: false })}
          onDelete={() => setState({ kind: "delete", session: state.session })}
        />
      ) : null}
      {state?.kind === "edit" ? (
        <SessionEditModal
          key={`${state.session.id}-${state.draft?.date ?? ""}-${state.draft?.startTime ?? ""}-${state.draft?.childId ?? ""}`}
          session={state.session}
          draft={state.draft}
          fromDrag={state.fromDrag}
          childOptions={childOptions}
          onClose={close}
        />
      ) : null}
      {state?.kind === "delete" ? (
        <SessionDeleteModal key={state.session.id} session={state.session} onClose={close} />
      ) : null}
    </EditorContext.Provider>
  );
}

const MENU_WIDTH = 176;
const MENU_HEIGHT = 140;

/** 우클릭 메뉴. 바깥을 누르거나 Esc·스크롤이면 닫는다 */
function SessionMenu({
  session,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
}: {
  session: CalendarSession;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const handlePointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // 화면 밖으로 나가지 않게
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - MENU_HEIGHT - 8);
  const item =
    "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold outline-none hover:bg-surface-2 focus-visible:bg-surface-2";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${session.child.name} ${session.academyName} 메뉴`}
      className="fixed z-50 flex flex-col rounded-xl border border-border bg-surface p-1 shadow-lift"
      style={{ left, top, width: MENU_WIDTH }}
      onKeyDown={(event) => {
        // 위아래 화살표로 항목 사이를 움직인다
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "ArrowDown" ? index + 1 : index - 1;
        items[(next + items.length) % items.length]?.focus();
      }}
    >
      <button type="button" role="menuitem" className={item} onClick={onEdit}>
        편집
      </button>
      <Link href={ROUTES.session(session.id)} role="menuitem" className={item} onClick={onClose}>
        자세히 보기
      </Link>
      <div className="my-1 h-px bg-border" aria-hidden />
      <button type="button" role="menuitem" className={`${item} text-danger`} onClick={onDelete}>
        삭제
      </button>
    </div>
  );
}
