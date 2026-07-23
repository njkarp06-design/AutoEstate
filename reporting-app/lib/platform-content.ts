export type PlatformKey = "instagram" | "facebook" | "yad2";

export const PLATFORM_KEYS: readonly PlatformKey[] = ["instagram", "facebook", "yad2"];

const PLATFORM_DISPLAY_NAMES: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook group",
  yad2: "Yad2",
};

export function platformDisplayName(key: PlatformKey): string {
  return PLATFORM_DISPLAY_NAMES[key];
}

export type ParsedPlatformContent =
  | { matched: true; sections: Record<PlatformKey, string>; multipleListingsDetected: boolean }
  | { matched: false; raw: string };

const HEADER_KEYWORDS: Record<PlatformKey, RegExp> = {
  instagram: /instagram/i,
  facebook: /facebook/i,
  yad2: /yad ?2/i,
};

// Both listing-to-social and listing-status-update append a "Listing Record"
// footer after the Yad2 section (see lib/listing-record.ts). Without capping
// the Yad2 slice at this header, the footer's raw labels would leak into the
// customer-facing Yad2 caption shown/edited/posted in the app.
export const LISTING_RECORD_HEADER_RE = /^\*\*listing record:?\*\*:?\s*$/i;

// A header line is either an ATX heading ("## ...") or a line that is
// *entirely* one bold span ("**...**"). Deliberately conservative: matching
// any line that merely contains the word "Instagram" would false-positive on
// body text (e.g. a contact-info line mentioning an Instagram handle).
function isHeaderLine(line: string): boolean {
  const t = line.trim();
  return /^#{1,6}\s+\S/.test(t) || /^\*\*[^*]+\*\*:?\s*$/.test(t);
}

/**
 * Splits Hermes's raw listing-to-social markdown into its three platform
 * sections. The skill's output spec asks for exactly 3 bold-numbered headers
 * in order (Instagram, Facebook, Yad2), but that's an LLM-compliance
 * convention, not a guarantee - this tolerates heading-style drift (ATX vs.
 * bold, with or without numbering) but requires all three, in order, before
 * trusting the split. Anything else falls back to the raw, unmodified text.
 *
 * Takes the LAST occurrence of each header, not the first. In practice a
 * single message can contain more than one complete triple: Hermes's
 * busy_input_mode: interrupt can merge a rapid follow-up listing into the
 * turn that's still generating a reply (a documented, accepted quirk - see
 * CLAUDE.md), and the skill then answers for both listings in one response,
 * each under its own "# Listing N" block. The run's own turn_id/messages
 * belong to whichever turn actually completed - the LAST block - so using
 * the last occurrence of each header reliably lands on the content that
 * actually matches this run's own input, not a stale earlier listing.
 */
export function splitPlatformContent(raw: string): ParsedPlatformContent {
  const lines = raw.split("\n");
  const at: Partial<Record<PlatformKey, number>> = {};
  const matchCount: Record<PlatformKey, number> = { instagram: 0, facebook: 0, yad2: 0 };

  lines.forEach((line, i) => {
    if (!isHeaderLine(line)) return;
    for (const key of PLATFORM_KEYS) {
      if (HEADER_KEYWORDS[key].test(line)) {
        at[key] = i; // keep overwriting - last match wins
        matchCount[key]++;
      }
    }
  });

  const { instagram, facebook, yad2 } = at;
  if (
    instagram === undefined ||
    facebook === undefined ||
    yad2 === undefined ||
    !(instagram < facebook && facebook < yad2)
  ) {
    return { matched: false, raw };
  }

  const slice = (start: number, end: number) =>
    lines.slice(start + 1, end).join("\n").trim();

  // Cap the Yad2 section at the Listing Record footer, if present, so its
  // labeled lines don't leak into the customer-facing Yad2 caption. Absent
  // for older messages and for weekly-digest's footer-less output, in which
  // case the Yad2 section still runs to the end of the string as before.
  let footerAt: number | undefined;
  for (let i = yad2 + 1; i < lines.length; i++) {
    if (LISTING_RECORD_HEADER_RE.test(lines[i].trim())) {
      footerAt = i;
      break;
    }
  }

  return {
    matched: true,
    multipleListingsDetected: matchCount.instagram > 1 || matchCount.facebook > 1 || matchCount.yad2 > 1,
    sections: {
      instagram: slice(instagram, facebook),
      facebook: slice(facebook, yad2),
      yad2: slice(yad2, footerAt ?? lines.length),
    },
  };
}

const HEBREW_CHAR_RE = /[֐-׿]/;
const ENGLISH_WORD_RE = /english/i;

export type LanguageSplit =
  | { matched: true; hebrew: string; english: string }
  | { matched: false };

/**
 * Splits a platform section's content into its Hebrew and English halves,
 * keyed off Hermes's own "Hebrew version first... English version second,
 * clearly labeled" convention (real output labels these "**🇮🇱 עברית:**" /
 * "**🇬🇧 English:**") - NOT per-paragraph script-majority voting, which
 * mis-files a mixed-script hashtag line (real Hermes hashtag lines mix
 * Hebrew and English tags) into the wrong half whenever that particular
 * line happens to have more Latin characters than Hebrew ones. Falls back
 * to unmatched if a confident Hebrew-then-English marker pair isn't found.
 */
export function splitByLanguage(text: string): LanguageSplit {
  const lines = text.split("\n");
  let heAt: number | undefined;
  let enAt: number | undefined;

  lines.forEach((line, i) => {
    if (!isHeaderLine(line)) return;
    if (heAt === undefined && HEBREW_CHAR_RE.test(line)) heAt = i;
    if (enAt === undefined && ENGLISH_WORD_RE.test(line)) enAt = i;
  });

  if (heAt === undefined || enAt === undefined || !(heAt < enAt)) {
    return { matched: false };
  }

  return {
    matched: true,
    hebrew: lines.slice(heAt + 1, enAt).join("\n").trim(),
    english: lines.slice(enAt + 1).join("\n").trim(),
  };
}

const MAX_TITLE_LENGTH = 70;

/**
 * A clean one-line listing title (e.g. "3-room apartment for sale in
 * Florentin, Tel Aviv.") derived from a completed listing's Yad2 content -
 * the skill's most consistently factual platform, whose first line is
 * always "location and property type" per listing-to-social's SKILL.md
 * Output Format spec (same convention in listing-status-update). Prefers
 * this over the raw first line of whatever the agent originally typed,
 * which is often a long comma-separated fact dump or, when a photo was
 * sent, a multi-paragraph auto-generated image description.
 *
 * Returns null if the Yad2 content doesn't split into Hebrew/English halves
 * (unexpected format drift) - callers should fall back to a raw-derived
 * title in that case rather than show a garbled or Hebrew-first line.
 */
export function deriveListingTitle(yad2Content: string): string | null {
  const split = splitByLanguage(yad2Content);
  if (!split.matched) return null;

  const firstLine = split.english
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;

  const title = firstLine.replace(/\.$/, "");
  return title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…"
    : title;
}
