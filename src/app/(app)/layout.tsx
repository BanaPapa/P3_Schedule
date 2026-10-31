import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">{children}</main>
    </>
  );
}
