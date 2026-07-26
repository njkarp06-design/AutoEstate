import { LISTING_RECORD_HEADER_RE } from "./platform-content";

export type ListingStatusKey = "ACTIVE" | "UNDER_CONTRACT" | "SOLD";

export type ParsedListingRecord = {
  area: string;
  transactionType: string;
  rooms: number;
  sqm: number;
  floor: number | null;
  price: number | null;
  status: ListingStatusKey;
};

const FIELD_RE: Record<string, RegExp> = {
  area: /^area:\s*(.+)$/i,
  transactionType: /^type:\s*(.+)$/i,
  rooms: /^rooms:\s*(.+)$/i,
  sqm: /^size:\s*(.+)$/i,
  floor: /^floor:\s*(.+)$/i,
  price: /^price:\s*(.+)$/i,
  status: /^status:\s*(.+)$/i,
};

function parseNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * For fields backed by an `Int?` column (`Listing.floor`, `Listing.price`).
 * Returns null rather than rounding when the parse isn't a whole number.
 *
 * The case that matters is shorthand: "Price: ₪3.2M" parses to 3.2. Writing
 * that to an Int column throws, and /api/ingest's blanket catch swallows it -
 * so the reply looks perfect, the listing is silently never tracked, and only
 * a server log records it. That is the same invisible-failure shape as the
 * original footer bug. Rounding instead would store ₪3, which is worse than
 * useless: null reads as "price unknown" in the UI, and the listing is still
 * created and matched, since area/rooms/sqm/status are what identify it.
 */
function parseIntegerField(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) return null;
  return parsed;
}

function normalizeTransactionType(value: string): string {
  if (/rent/i.test(value)) return "rental";
  if (/sale/i.test(value)) return "sale";
  return value.trim();
}

function normalizeStatus(value: string): ListingStatusKey | null {
  const v = value.trim();
  if (/^active$/i.test(v)) return "ACTIVE";
  if (/under.?contract/i.test(v)) return "UNDER_CONTRACT";
  if (/^(sold|rented)$/i.test(v)) return "SOLD";
  return null;
}

/**
 * Finds every "Listing Record" footer in a raw Hermes reply and parses each
 * independently. Returns an array, not a single record, because
 * listing-to-social's v0.3.1 "Never Blend Properties" rule means one reply
 * can legitimately contain two distinguishable listings mixed into one
 * message, each answered separately with its own footer - parsing only the
 * first or last would silently drop the other listing from tracking
 * forever, unlike platform-content.ts's "last occurrence wins" convention,
 * which only affects *display* of an already-fully-recorded Run.
 */
export function parseListingRecords(raw: string): ParsedListingRecord[] {
  const lines = raw.split("\n");
  const headerIndexes: number[] = [];
  lines.forEach((line, i) => {
    if (LISTING_RECORD_HEADER_RE.test(line.trim())) headerIndexes.push(i);
  });

  const records: ParsedListingRecord[] = [];

  headerIndexes.forEach((start) => {
    // Scan only the contiguous run of labeled lines immediately after the
    // header, stopping at the first non-blank line that isn't itself a
    // recognized field. Bounding by "until the next header" instead (i.e.
    // the whole gap between this footer and the next one) would swallow an
    // entire second property's platform content in the mixed-listings case
    // - including lines like "Price: ₪X." from that OTHER property's own
    // Yad2 prose, silently overwriting this record's real fields.
    const fields: Partial<Record<keyof typeof FIELD_RE, string>> = {};
    for (let i = start + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed === "") continue;

      let matchedAnyField = false;
      for (const [key, re] of Object.entries(FIELD_RE)) {
        const match = trimmed.match(re);
        if (match) {
          fields[key as keyof typeof FIELD_RE] = match[1].trim();
          matchedAnyField = true;
        }
      }
      if (!matchedAnyField) break;
    }

    const area = fields.area?.trim();
    const rooms = fields.rooms ? parseNumber(fields.rooms) : null;
    const sqm = fields.sqm ? parseNumber(fields.sqm) : null;
    const status = fields.status ? normalizeStatus(fields.status) : null;

    // area, rooms, sqm, and status are required - status especially drives
    // real business logic (which listings count as active for the digest),
    // so an unrecognized value must never silently default. A malformed
    // record is dropped on its own; it doesn't invalidate other records
    // found in the same reply.
    if (!area || rooms === null || sqm === null || status === null) {
      return;
    }

    records.push({
      area,
      transactionType: fields.transactionType ? normalizeTransactionType(fields.transactionType) : "",
      rooms,
      sqm,
      floor: parseIntegerField(fields.floor),
      price: parseIntegerField(fields.price),
      status,
    });
  });

  return records;
}
