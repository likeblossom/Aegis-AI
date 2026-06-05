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
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/90">
        <div className="mx-auto flex min-h-14 max-w-[1880px] flex-col gap-3 px-5 py-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <Link className="flex w-fit items-center gap-3" href="/">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 bg-slate-900 text-sm font-semibold text-white">
              A
            </span>
            <span>
              <span className="block text-sm font-semibold leading-5 text-ink">
                Aegis-AI
              </span>
              <span className="block text-xs leading-4 text-muted">
                Governance console
              </span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium text-slate-700">
            <NavLink href="/">Review queue</NavLink>
            <NavLink href="/discovery">Discovery</NavLink>
            <NavLink href="/portfolio">Portfolio</NavLink>
            <Link className="btn btn-primary min-h-9 px-3 py-1.5 text-xs" href="/use-cases/new">
              New proposal
            </Link>
          </nav>
        </div>
      </header>
      <main className="px-5 py-7 sm:px-8 sm:py-8">
        <div className={`mx-auto w-full ${widthClass}`}>{children}</div>
      </main>
    </div>
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

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="rounded-md px-3 py-2 hover:bg-panel hover:text-ink"
      href={href}
    >
      {children}
    </Link>
  );
}
