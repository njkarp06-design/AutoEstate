import { getRuns } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/customer";
import { RunList } from "./run-list";

// Always read the live database - this dashboard must never serve a stale
// build-time snapshot of agent activity.
export const dynamic = "force-dynamic";

export default async function Home() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Recent activity
        </h1>
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  const runs = await getRuns(customer);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <RunList runs={runs} />
    </main>
  );
}
