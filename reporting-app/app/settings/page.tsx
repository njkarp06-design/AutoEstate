import Link from "next/link";
import { getCurrentCustomer, type InstagramPostMode } from "@/lib/customer";
import { TelegramChatIdForm } from "./telegram-chat-id-form";
import { BuyerNumberForm } from "./buyer-number-form";
import { InstagramModeForm } from "./instagram-mode-form";

export const dynamic = "force-dynamic";

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

        <InstagramModeForm
          defaultValue={customer.instagramPostMode as InstagramPostMode}
        />
      </section>

      <section className="mt-10 border-t border-card-border pt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-brand">
          Buyer-lead alerts
        </h2>
        <p className="mt-1.5 text-sm text-status-muted">
          When a buyer asks something that needs you (a viewing, an offer, or a
          detail the agent doesn&apos;t have), we can ping you on Telegram with
          their contact attached. Ask your AutoEstate operator for the alert
          bot to message, then paste the Telegram chat ID it gives you here.
          Leave blank to get leads only on the dashboard.
        </p>

        <TelegramChatIdForm defaultValue={customer.operatorTelegramChatId ?? ""} />
      </section>

      <section className="mt-10 border-t border-card-border pt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-brand">
          Your buyer WhatsApp number
        </h2>
        <p className="mt-1.5 text-sm text-status-muted">
          The number buyers message when they tap the link in your ad. Add it
          and every listing gets a ready-to-paste ad link that opens WhatsApp
          with its reference code already filled in, so the assistant knows
          exactly which property they&apos;re asking about. Leave blank and
          your listings still show their code, just without a link.
        </p>

        <BuyerNumberForm defaultValue={customer.buyerWhatsappNumber ?? ""} />
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
