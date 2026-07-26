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

export function formatRelativeDateTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const now = new Date();

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const time = date.toLocaleTimeString("en-GB", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  const target = zonedYmd(date);
  if (target === zonedYmd(now)) return `Today, ${time}`;
  if (target === zonedYmd(yesterday)) return `Yesterday, ${time}`;

  return date.toLocaleString("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: target.slice(0, 4) !== zonedYmd(now).slice(0, 4) ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sourceLabel(source: string): string {
  if (source === "whatsapp") return "WhatsApp";
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
