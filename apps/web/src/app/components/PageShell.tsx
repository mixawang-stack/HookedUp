"use client";

import { ReactNode } from "react";

type PageShellProps = {
  title?: string;
  stage: ReactNode;
  panel?: ReactNode;
};

export default function PageShell({ title, stage, panel }: PageShellProps) {
  const hasPanel = Boolean(panel);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <div className={`grid gap-6 ${hasPanel ? "lg:grid-cols-[1fr_360px]" : ""}`}>
          <div data-page-shell-stage className="space-y-6">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {title}
              </h1>
            )}
            <div className="space-y-4">{stage}</div>
          </div>
          {hasPanel && (
            <aside className="sticky top-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.6)] backdrop-blur">
              {panel}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
