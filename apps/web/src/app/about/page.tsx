export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <main className="ui-page flex min-h-screen items-center justify-center px-4 py-8">
      <section className="ui-card w-full max-w-xl p-8">
        <h1 className="text-2xl font-semibold text-text-primary">About</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This is an open but bounded social space. It invites conversation
          without pushing or defaulting to anything beyond the room itself.
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          Explore the Grand Hall, step into Rooms, and keep Private threads for
          what you choose to carry further.
        </p>
      </section>
    </main>
  );
}
