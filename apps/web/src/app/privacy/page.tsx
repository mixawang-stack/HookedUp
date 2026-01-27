export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-4 text-sm text-text-secondary">
          We collect only the information needed to operate the service, including
          account details, usage data, and content you choose to share.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Payments are processed by third-party providers. We do not store full payment
          details.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Questions? Contact us at <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
      </div>
    </main>
  );
}
