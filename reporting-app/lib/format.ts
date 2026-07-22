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

export function sourceDotClass(source: string): string {
  if (source === "whatsapp") return "bg-emerald-500";
  if (source === "telegram") return "bg-sky-500";
  return "bg-gray-400";
}
