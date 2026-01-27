export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Email: <span className="font-semibold">mixa.wang@gmail.com</span>
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Typical response time: 24–48 hours
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          For payment issues, include: order email, date/time, and a screenshot of the
          payment receipt.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          For refunds/duplicate charges: contact us and we will review promptly.
        </p>
      </div>
    </main>
  );
}
