export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Effective date: 2026-01-31
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          This service is operated by an individual developer ("we", "our", "us").
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          We collect the information you provide (such as email address and username)
          and basic usage data in order to operate and improve our service.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Payments</p>
        <p className="mt-2 text-sm text-text-secondary">
          Payments are processed by third-party payment providers. We do not store full
          payment card details on our servers.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          How we use your data
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Provide and operate the service</li>
          <li>Provide customer support</li>
          <li>Prevent fraud and abuse</li>
          <li>Comply with legal obligations</li>
        </ul>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          Sharing of data
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          We may share limited data with service providers (such as hosting, analytics,
          and payment processors) only as necessary to operate the service.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          Data retention
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          We retain personal data only as long as necessary for the purposes described
          above and for legal compliance.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Your rights</p>
        <p className="mt-2 text-sm text-text-secondary">
          You may request access to, correction of, or deletion of your personal data by
          contacting us at{" "}
          <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Contact</p>
        <p className="mt-2 text-sm text-text-secondary">
          If you have any questions about this Privacy Policy, please contact:{" "}
          <span className="font-semibold">mixa.wang@gmail.com</span>
        </p>
      </div>
    </main>
  );
}
