export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">Effective date: YYYY-MM-DD</p>
        <p className="mt-4 text-sm text-text-secondary">
          We collect the information you provide (account info such as email, username),
          and usage data to provide and improve our service.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Payments: Payments are processed by third-party payment providers. We do not
          store full payment card details.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          How we use data: to operate the service, provide customer support, prevent
          fraud, and comply with legal obligations.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Sharing: We may share data with service providers (hosting, analytics, payment)
          strictly to operate the service.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Data retention: We retain data as long as necessary for the purposes above and
          legal compliance.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Your rights: You may request access, correction, or deletion of your data by
          contacting us at{" "}
          <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Contact: <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
      </div>
    </main>
  );
}
