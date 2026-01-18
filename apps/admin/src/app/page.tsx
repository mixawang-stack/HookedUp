import Link from "next/link";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    title: "Users",
    description: "Segment users, review activity, and manage compliance.",
    href: "/users"
  },
  {
    title: "Novels",
    description: "Publish, tag, feature, and control visibility for content.",
    href: "/novels"
  }
];

const OPERATIONS = [
  { label: "Verifications", href: "/verifications" },
  { label: "Reports", href: "/reports" }
];

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Operations Console</h1>
        <p className="text-sm text-slate-400">
          Control publishing, visibility, and user operations from one place.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {MODULES.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 transition hover:border-white/30"
          >
            <h2 className="text-lg font-semibold">{module.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{module.description}</p>
            <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Open module
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
          Operations
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          {OPERATIONS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-xs text-slate-200 hover:border-white/30"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
