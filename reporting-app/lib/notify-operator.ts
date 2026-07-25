import type { Customer } from "@/prisma/generated/prisma/client";
import { formatRelativeDateTime, sourceLabel } from "@/lib/format";

// Operator notification for a "needs-you" buyer lead (plan 1G). Fires
// best-effort from /api/inquiries when the bot's reply hands off to a human,
// with the buyer's contact attached - the #2-value piece after capturing the
// contact itself.
//
// TRANSPORT DECISION (flagged for the user - see the session handoff): a
// Telegram bot ping is the least-friction, genuinely-free option (no provider,
// no domain, no deliverability setup - unlike email; and unlike a real
// WhatsApp ping, which needs an outbound sender the buyer instance doesn't
// have). It's wired here but INERT until configured, so nothing is sent to any
// external service without the operator's own credentials:
//
//   OPERATOR_TELEGRAM_BOT_TOKEN   a notifier bot's token (BotFather)
//   OPERATOR_TELEGRAM_CHAT_ID     the operator's own Telegram chat id
//
// When either is unset, this logs and no-ops. This env-based config is a
// single-operator (dev/MVP) shape; multi-tenant production needs per-customer
// routing (a Customer.operatorTelegramChatId column or similar) - a deliberate
// follow-up, NOT done here without sign-off since it's an account/schema
// commitment.

const TELEGRAM_BOT_TOKEN = process.env.OPERATOR_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.OPERATOR_TELEGRAM_CHAT_ID;

export type LeadNotification = {
  customer: Customer;
  inquiryId: string;
  buyerContact: string | null;
  title: string | null;
  source: string;
  latestBuyerMessage: string;
};

function buildMessage(lead: LeadNotification): string {
  const when = formatRelativeDateTime(Math.floor(Date.now() / 1000));
  const contact = lead.buyerContact
    ? `Contact: ${lead.buyerContact}`
    : "Contact: not captured — reply in the chat to reach them";
  return [
    "🏠 AutoEstate — a buyer needs you",
    lead.title ? `Re: ${lead.title}` : null,
    `Via ${sourceLabel(lead.source)} · ${when}`,
    "",
    `"${lead.latestBuyerMessage.slice(0, 300)}"`,
    "",
    contact,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export async function notifyOperatorOfLead(lead: LeadNotification): Promise<void> {
  const text = buildMessage(lead);

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    // Inert-but-visible: the lead is always recorded in the dashboard
    // regardless; this only governs the active push. Log so it's obvious in
    // dev that a notification WOULD have fired.
    console.info(
      "notify-operator: no transport configured, skipping push for inquiry %s (%s)",
      lead.inquiryId,
      lead.buyerContact ?? "no contact",
    );
    return;
  }

  const resp = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    },
  );
  if (!resp.ok) {
    console.warn(
      "notify-operator: Telegram sendMessage returned %s: %s",
      resp.status,
      (await resp.text()).slice(0, 200),
    );
  }
}
