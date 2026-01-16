export default function RulesPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Rules</h1>
        <ul className="mt-4 space-y-3 text-sm text-slate-500">
          <li>Keep it respectful and restrained in Hall / Rooms / Private.</li>
          <li>Intent and boundaries are personal; the system does not push.</li>
          <li>Share only what you mean to leave, and don’t pressure replies.</li>
          <li>If something feels off, mute or leave instead of piling on.</li>
        </ul>
      </section>
    </main>
  );
}
