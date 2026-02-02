export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Effective date: 2026-01-31
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Service</p>
        <p className="mt-2 text-sm text-text-secondary">
          We provide access to digital fiction and story content. Users may purchase
          access to unlock paid chapters or content.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Accounts</p>
        <p className="mt-2 text-sm text-text-secondary">
          You are responsible for maintaining the security of your account and login
          credentials.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Digital goods</p>
        <p className="mt-2 text-sm text-text-secondary">
          All purchases unlock digital content that is delivered immediately after
          payment.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Refunds</p>
        <p className="mt-2 text-sm text-text-secondary">
          Due to the nature of instant digital delivery, purchases are generally
          non-refundable, except where required by law or in cases of accidental or
          duplicate charges.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          For refund requests, please contact:{" "}
          <span className="font-semibold">support@hookedup.me</span>.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Prohibited use</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Misuse the service</li>
          <li>Attempt unauthorized access</li>
          <li>Scrape or copy content</li>
          <li>Infringe intellectual property rights</li>
        </ul>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          Intellectual property
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          All content provided on this service is protected by copyright and other
          intellectual property laws. You may not copy, redistribute, or resell content
          without permission.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          Limitation of liability
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          The service is provided "as is" to the extent permitted by law. We are not
          liable for any indirect or consequential damages.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">
          Changes to terms
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          We may update these terms from time to time. Continued use of the service
          means you accept the updated terms.
        </p>

        <p className="mt-6 text-sm font-semibold text-text-primary">Contact</p>
        <p className="mt-2 text-sm text-text-secondary">
          If you have any questions about these Terms, please contact:{" "}
          <span className="font-semibold">support@hookedup.me</span>
        </p>
      </div>
    </main>
  );
}
