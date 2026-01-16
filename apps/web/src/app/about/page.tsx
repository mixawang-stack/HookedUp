export default function AboutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">About</h1>
        <p className="mt-2 text-sm text-slate-500">
          This is an open but bounded social space. It invites conversation
          without pushing or defaulting to anything beyond the room itself.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Explore the Grand Hall, step into Rooms, and keep Private threads for
          what you choose to carry further.
        </p>
      </section>
    </main>
  );
}
