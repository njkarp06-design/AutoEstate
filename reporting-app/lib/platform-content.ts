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

  return {
    matched: true,
    multipleListingsDetected: matchCount.instagram > 1 || matchCount.facebook > 1 || matchCount.yad2 > 1,
    sections: {
      instagram: slice(instagram, facebook),
      facebook: slice(facebook, yad2),
      yad2: slice(yad2, lines.length),
    },
  };
}
