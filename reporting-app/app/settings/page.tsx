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
        <Link href="/" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
          ← All activity
        </Link>
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-status-muted">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
        ← All activity
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold italic tracking-tight">
        Settings
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-brand">
          Instagram posting
        </h2>
        <p className="mt-1.5 text-sm text-status-muted">
          Applies to every future listing&apos;s Instagram caption.
        </p>

        <form action={updateInstagramPostModeAction} className="mt-5">
          {INSTAGRAM_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 border-t border-card-border py-4 first:border-t-0"
            >
              <input
                type="radio"
                name="instagramPostMode"
                value={option.value}
                defaultChecked={customer.instagramPostMode === option.value}
                className="mt-1.5 accent-brand"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-sm text-status-muted">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
          <button
            type="submit"
            className="mt-4 border-b border-line-strong font-mono text-xs uppercase tracking-wide"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-10 border-t border-card-border pt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-secondary">
          Facebook group &amp; Yad2 posting
        </h2>
        <p className="mt-1.5 text-sm text-status-muted">
          Always manual - copy the generated caption and post it yourself. Meta
          retired third-party posting to Facebook groups in 2024, and Yad2 has
          no posting API for agents, so there&apos;s no automated option for
          either.
        </p>
      </section>
    </main>
  );
}
