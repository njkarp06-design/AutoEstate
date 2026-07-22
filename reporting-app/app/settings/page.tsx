import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customer";
import { updateInstagramPostModeAction } from "./actions";

export const dynamic = "force-dynamic";

const INSTAGRAM_OPTIONS: {
  value: "MANUAL" | "AUTO_IMMEDIATE" | "AUTO_AFTER_EDIT";
  label: string;
  description: string;
}[] = [
  {
    value: "MANUAL",
    label: "Manual",
    description: "Hermes drafts the caption; you copy and post it yourself.",
  },
  {
    value: "AUTO_AFTER_EDIT",
    label: "Auto-post after I edit (coming soon)",
    description:
      "You review and edit the caption here, then it posts to Instagram automatically. Requires connecting Instagram - not available yet.",
  },
  {
    value: "AUTO_IMMEDIATE",
    label: "Auto-post immediately (coming soon)",
    description:
      "Hermes posts to Instagram as soon as content is generated, no review step. Requires connecting Instagram - not available yet.",
  },
];

export default async function SettingsPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← All activity
        </Link>
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← All activity
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Settings</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Instagram posting
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Applies to every future listing&apos;s Instagram caption.
        </p>

        <form action={updateInstagramPostModeAction} className="mt-4 space-y-3">
          {INSTAGRAM_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-card-border bg-card p-4"
            >
              <input
                type="radio"
                name="instagramPostMode"
                value={option.value}
                defaultChecked={customer.instagramPostMode === option.value}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-sm text-gray-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Facebook group &amp; Yad2 posting
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Always manual - copy the generated caption and post it yourself. Meta
          retired third-party posting to Facebook groups in 2024, and Yad2 has
          no posting API for agents, so there&apos;s no automated option for
          either.
        </p>
      </section>
    </main>
  );
}
