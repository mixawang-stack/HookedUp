export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="ui-page">
      <div className="ui-container max-w-3xl py-12 text-text-primary">
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Digital content is provided as-is for personal use. Your account is your
          responsibility; keep credentials secure.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          All content, trademarks, and intellectual property remain the property of
          their respective owners.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Refunds are handled according to the payment provider&apos;s policy unless
          otherwise required by law.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          We are not liable for indirect or consequential damages to the extent
          permitted by law.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Contact: <span className="font-semibold">mixa.wang@gmail.com</span>
        </p>
      </div>
    </main>
  );
}
