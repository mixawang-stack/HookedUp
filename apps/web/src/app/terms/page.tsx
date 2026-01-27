export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-text-secondary">Effective date: YYYY-MM-DD</p>
        <p className="mt-4 text-sm text-text-secondary">
          Service: We provide access to digital fiction/story content. Users may
          purchase access to unlock paid chapters/content.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Accounts: You are responsible for your account and keeping your login
          credentials secure.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Digital goods: Purchases unlock digital content delivered immediately.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Refund policy: Due to the nature of instant digital delivery, purchases are
          generally non-refundable, except where required by law or in cases of
          accidental duplicate charges. Contact{" "}
          <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Prohibited use: Do not misuse the service, attempt unauthorized access,
          scrape content, or infringe intellectual property.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Intellectual property: Content is protected. You may not copy, redistribute,
          or resell without permission.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Limitation of liability: Service is provided “as is” to the extent permitted
          by law.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Changes: We may update these terms; continued use means acceptance.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Contact: <span className="font-semibold">mixa.wang@gmail.com</span>.
        </p>
      </div>
    </main>
  );
}
