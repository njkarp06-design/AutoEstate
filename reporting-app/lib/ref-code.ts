/**
 * Per-listing reference codes and the WhatsApp deep links that carry them.
 *
 * WHY THESE EXIST. A buyer arriving from a Yad2 or Instagram ad currently has
 * to describe which property they mean, and buyer-inquiry has a whole
 * disambiguation branch for guessing - the branch that had to be rewritten in
 * v0.2.0 after it offered SOLD listings as if they were on the menu. A code
 * embedded in the ad's contact link means the bot knows the exact listing from
 * message one, so that branch mostly stops firing.
 *
 * The code is also the resolution key for a possible future shared buyer
 * number serving every customer (TODO 12c), which is why uniqueness is GLOBAL
 * rather than per-customer: a shared instance would have to resolve a code to
 * a customer before it knows which customer's data to read, so a code that is
 * only unique within a customer would be useless exactly when it is needed.
 * Nothing today depends on that - it costs nothing now and cannot be
 * retrofitted later without reissuing every code already printed in an ad.
 */

import { randomInt } from "node:crypto";

/**
 * Deliberately excludes 0/O, 1/I/L and U. A code is read off a phone screen
 * and occasionally retyped, and those are the characters people get wrong.
 * 30 chars ^ 5 = 24.3M codes, which is far more than this product will ever
 * issue - length is bounded by "reads cleanly in an ad", not by collision
 * math.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 5;

/** The stored form is bare ("K7M2P"); this prefix exists only in text. */
const PREFIX = "REF";

/**
 * Matches a code ONLY when it carries the REF prefix, tolerating the
 * separators a person or a messaging client might produce (`REF-K7M2P`,
 * `ref k7m2p`, `REF:K7M2P`).
 *
 * Requiring the prefix is a correctness decision, not tidiness. A bare
 * 5-character alphanumeric run is common in ordinary text (and in Hebrew
 * messages containing Latin fragments), so matching one unprefixed would
 * sometimes resolve a buyer to a property they never mentioned - and serving
 * confident facts about the wrong home is precisely the failure this whole
 * feature is meant to reduce. A missed code degrades to the existing
 * area-matching path, which still works; a false code does not degrade, it
 * misleads.
 */
const REF_CODE_RE = new RegExp(`\\b${PREFIX}[\\s:_-]*([${ALPHABET}]{${CODE_LENGTH}})\\b`, "gi");

/** Random code. Not checked for uniqueness here - see generateUniqueRefCode. */
export function generateRefCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** `K7M2P` -> `REF-K7M2P`. The only place the prefix is applied. */
export function formatRefCode(code: string): string {
  return `${PREFIX}-${code}`;
}

/**
 * Every distinct code mentioned in a buyer's message, normalized to stored
 * form. Returns all of them rather than the first: two codes in one message
 * is genuine ambiguity the caller must handle by asking, not by silently
 * picking one.
 */
export function extractRefCodes(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(REF_CODE_RE)) {
    found.add(match[1].toUpperCase());
  }
  return [...found];
}

/**
 * The message we want prefilled when a buyer taps the link in an ad. Kept
 * short and natural: the buyer sees this text sitting in their compose box
 * and will send it as-is or type around it, so it has to read like something
 * a person would actually write. The code is what does the work.
 */
export function buildPrefilledMessage(code: string): string {
  return `Hi, I'm interested in ${formatRefCode(code)}`;
}

/**
 * Strips a phone number to the digits wa.me expects (international, no `+`,
 * no separators). Returns null if what's left can't be a real number, so a
 * half-typed value renders as "no link yet" rather than a link that silently
 * opens a chat with nobody.
 */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

/**
 * The link an agent pastes into a Yad2/Instagram/Facebook ad. Null when the
 * customer hasn't set their buyer-facing WhatsApp number yet - the UI then
 * shows the code alone and points at Settings, rather than rendering a broken
 * link that would look like it works.
 */
export function buildBuyerDeepLink(code: string, buyerWhatsappNumber: string | null): string | null {
  if (!buyerWhatsappNumber) return null;
  const digits = normalizeWhatsappNumber(buyerWhatsappNumber);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildPrefilledMessage(code))}`;
}
