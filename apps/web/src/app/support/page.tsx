export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Email us at <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Typical response time: within 1–2 business days.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          For payment issues, include your account email, the story name, and the
          payment reference from the provider.
        </p>
      </div>
    </main>
  );
}
