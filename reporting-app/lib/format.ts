// Every one of these timestamps is rendered in a Server Component, so without
// an explicit zone they format in the SERVER's timezone - UTC on Vercel. The
// users are estate agents in Tel Aviv, so every time would read 2-3 hours off
// and the Today/Yesterday boundary would flip at the wrong moment (a listing
// sent at 22:00 local would show as "Yesterday"). Invisible in development
// only because the dev machine happens to run in local time.
//
// Hardcoded rather than a per-customer setting: the entire product is scoped
// to independent agents in Tel Aviv. If that ever stops being true this
// becomes a Customer column, and this constant is the only caller to change.
const TIME_ZONE = "Asia/Jerusalem";

// Y/M/D *in TIME_ZONE*, not in the server's zone - comparing via getFullYear()
// and friends would reintroduce exactly the bug this constant exists to fix.
function zonedYmd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Yesterday's calendar date IN TIME_ZONE, derived from today's Y/M/D rather
// than by subtracting 24h of absolute time. An Israeli DST day is 23 or 25
// hours long, so `now - 24h` lands on the wrong calendar date during the hour
// after midnight on each transition - the same class of bug TIME_ZONE exists
// to prevent, reintroduced by the arithmetic.
//
// Not theoretical; brute-forcing all of 2026 at 15-minute resolution found
// exactly two one-hour windows, one per transition:
//   00:00-00:59 on 2026-03-28 (spring forward) - "yesterday" resolved to the
//     26th while today was the 28th, so anything sent on the 27th matched
//     neither branch and fell through to the absolute date format.
//   00:00-00:59 on 2026-10-25 (fall back) - "yesterday" resolved to the 25th,
//     i.e. today, so a listing sent this morning would be labelled "Yesterday".
// The second is the worse one: it doesn't fail to label, it mislabels.
function zonedYesterday(now: Date): string {
  const [y, m, d] = zonedYmd(now).split("-").map(Number);
  const previous = new Date(Date.UTC(y, m - 1, d));
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function formatRelativeDateTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const now = new Date();

  const time = date.toLocaleTimeString("en-GB", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  const target = zonedYmd(date);
  if (target === zonedYmd(now)) return `Today, ${time}`;
  if (target === zonedYesterday(now)) return `Yesterday, ${time}`;

  return date.toLocaleString("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: target.slice(0, 4) !== zonedYmd(now).slice(0, 4) ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

// "whatsapp" (the Baileys bridge) and "whatsapp_cloud" (the official Meta Cloud
// API) are two distinct Hermes platforms, but they are the same channel to a
// customer — both render as "WhatsApp". Use isWhatsAppSource for counting, so a
// migration between the two never splits one channel across two figures.
export function isWhatsAppSource(source: string): boolean {
  return source === "whatsapp" || source === "whatsapp_cloud";
}

export function sourceLabel(source: string): string {
  if (isWhatsAppSource(source)) return "WhatsApp";
  if (source === "telegram") return "Telegram";
  return source;
}

const ILS_FORMATTER = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return ILS_FORMATTER.format(price);
}

export function statusLabel(status: "active" | "under_contract" | "sold"): string {
  if (status === "active") return "Active";
  if (status === "under_contract") return "Under contract";
  return "Sold";
}

// transactionType is free text parsed from a skill's footer, not an enum
// (see lib/listing-record.ts) - an unrecognized value must fall back to the
// raw string rather than hard-failing, same convention as sourceLabel above.
export function transactionTypeLabel(transactionType: string): string {
  if (transactionType === "sale") return "For sale";
  if (transactionType === "rental") return "For rent";
  return transactionType;
}
