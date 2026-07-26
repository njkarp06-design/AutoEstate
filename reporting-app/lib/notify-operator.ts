import type { Customer } from "@/prisma/generated/prisma/client";
import { formatRelativeDateTime, sourceLabel } from "@/lib/format";

// Operator notification for a "needs-you" buyer lead (plan 1G). Fires
// best-effort from /api/inquiries when the bot's reply hands off to a human,
// with the buyer's contact attached - the #2-value piece after capturing the
// contact itself.
//
// TRANSPORT: a Telegram bot ping - the least-friction, genuinely-free option
// (no provider, no domain, no deliverability setup unlike email; and unlike a
// real WhatsApp ping, which needs an outbound sender the buyer instance
// doesn't have). Two pieces, and it stays INERT (dashboard-only) until both
// are present, so nothing is ever sent without real credentials:
//
//   OPERATOR_TELEGRAM_BOT_TOKEN     app-level env: one shared notifier bot
//                                   (BotFather) that delivers to every
//                                   customer's chat.
//   Customer.operatorTelegramChatId per-customer: THIS customer's own chat,
//                                   set on the Settings page. This is the
//                                   multi-tenant routing - each customer's
//                                   leads go only to their own chat.
//
// OPERATOR_TELEGRAM_CHAT_ID (env) remains as a single-operator fallback for
// dev, used only when a customer has no chat id of their own configured.

const TELEGRAM_BOT_TOKEN = process.env.OPERATOR_TELEGRAM_BOT_TOKEN;
const FALLBACK_CHAT_ID = process.env.OPERATOR_TELEGRAM_CHAT_ID;

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
  const chatId = lead.customer.operatorTelegramChatId ?? FALLBACK_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    // Inert-but-visible: the lead is always recorded in the dashboard
    // regardless; this only governs the active push. Log so it's obvious in
    // dev that a notification WOULD have fired.
    console.info(
      "notify-operator: no transport configured (bot token or customer chat id missing), skipping push for inquiry %s (%s)",
      lead.inquiryId,
      lead.buyerContact ?? "no contact",
    );
    return;
  }

  // Timed out deliberately, and deliberately below the sync plugin's own 5s
  // client timeout. This call is awaited on /api/inquiries' request path, so
  // without a timeout a slow Telegram API stalls the response past the point
  // where the plugin gives up - and since the plugin's retry budget is finite,
  // a hang here can cost the very lead this notification is about. Better to
  // lose the push (the lead is already recorded in the dashboard) than the turn.
  const resp = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(4000),
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
