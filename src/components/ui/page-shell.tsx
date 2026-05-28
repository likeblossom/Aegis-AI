import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
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
