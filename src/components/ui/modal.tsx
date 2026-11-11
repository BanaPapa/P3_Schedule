"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 화면을 바꾸지 않고 그 위에 띄우는 대화상자. 브라우저 기본 <dialog> 의 모달 동작을 쓴다
 * (포커스 가두기, Esc 로 닫기, 뒤 화면 조작 막기). 바깥(배경)을 눌러도 닫힌다.
 * 열려 있는 동안만 그린다: 부모가 조건부로 렌더링하고 닫힐 때 onClose 에서 상태를 지운다.
 */
export function Modal({ title, description, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    // 정리할 때 close() 를 부르지 않는다: 개발 모드에서 effect 가 두 번 돌면 그 close 이벤트를
    // 다시 붙은 리스너가 받아 바로 닫혀 버린다. 부모가 지우면 <dialog> 가 DOM 에서 빠지며 함께 닫힌다.
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // 배경(dialog 자신)을 누르면 닫는다. 안쪽 내용 클릭은 target 이 다르다.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
        </div>
        {children}
      </div>
    </dialog>
  );
}
