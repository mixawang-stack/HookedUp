export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-4 text-sm text-text-secondary">
          This website provides digital fiction and story content. Users can read free
          content and purchase access to unlock paid chapters.
        </p>
        <p className="mt-4 text-sm text-text-secondary">If you need help with:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Account issues</li>
          <li>Payment problems</li>
          <li>Refund requests</li>
          <li>Technical issues</li>
        </ul>

        <p className="mt-6 text-sm text-text-secondary">Please contact us at:</p>
        <p className="mt-2 text-sm text-text-secondary">
          Email: <span className="font-semibold">mixa.wang@gmail.com</span>
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          Typical response time: 24–48 hours.
        </p>

        <p className="mt-6 text-sm text-text-secondary">
          For payment issues, please include:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Order email</li>
          <li>Date and time of purchase</li>
          <li>Screenshot of the payment receipt (if available)</li>
        </ul>
      </div>
    </main>
  );
}
