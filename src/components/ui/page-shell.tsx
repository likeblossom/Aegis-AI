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

export function BackLink({
  href = "/",
  children = "Back to dashboard"
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <Link className="text-sm font-medium text-slate-700 hover:text-ink" href={href}>
      {children}
    </Link>
  );
}
