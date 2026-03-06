import { Suspense } from "react";

import ShoppingListClient from "./shopping-list-client";

function ShoppingListSkeleton() {
  return (
    <main className="soft-grid min-h-screen bg-canvas bg-hero-radial px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card border-white/90 p-6 sm:p-8">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-xl bg-slate-100" />
          <div className="mt-6 grid gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className="card border-white/90 p-5">
              <div className="h-7 w-28 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-3 h-5 w-full animate-pulse rounded-xl bg-slate-100" />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

export default function ShoppingListPage() {
  return (
    <Suspense fallback={<ShoppingListSkeleton />}>
      <ShoppingListClient />
    </Suspense>
  );
}
