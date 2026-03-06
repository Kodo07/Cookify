import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <SiteNav />
        <header className="card p-6">
          <Link
            href="/"
            className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Back
          </Link>
          <h1 className="text-4xl text-ink">Account</h1>
          <p className="mt-3 text-sm text-slate-600">
            Account management is coming soon. This page is reserved for profile,
            plan details, and billing controls.
          </p>
        </header>

        <section className="card p-6">
          <h2 className="mb-3 text-2xl text-ink">Planned Features</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="rounded-xl bg-slate-100 px-3 py-2">Subscription status</li>
            <li className="rounded-xl bg-slate-100 px-3 py-2">Invoice and billing history</li>
            <li className="rounded-xl bg-slate-100 px-3 py-2">Saved recipe collections</li>
            <li className="rounded-xl bg-slate-100 px-3 py-2">Team and household sharing</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
