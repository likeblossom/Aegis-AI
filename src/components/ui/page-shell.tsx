import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: "default" | "wide";
};

export function PageShell({ children, maxWidth = "default" }: PageShellProps) {
  const widthClass =
    maxWidth === "wide" ? "max-w-[1880px]" : "max-w-6xl";

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className={`mx-auto w-full ${widthClass}`}>{children}</div>
    </main>
  );
}

export function BackLink() {
  return (
    <Link className="text-sm font-medium text-slate-700 hover:text-ink" href="/">
      Back to dashboard
    </Link>
  );
}
