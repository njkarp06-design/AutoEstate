export function formatRelativeDateTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const now = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSameDay(date, now)) return `Today, ${time}`;
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`;

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
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
