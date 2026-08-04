/**
 * The Instagram posting-mode union and its one runtime list.
 *
 * ITS OWN MODULE, and that is load-bearing rather than tidiness: these are
 * imported by a CLIENT component (app/settings/instagram-mode-form.tsx) as
 * well as by server code. They previously lived in lib/customer.ts, which
 * imports @clerk/nextjs/server and the Prisma client - so the client bundle
 * pulled server-only modules in and `next build` failed with "the chunking
 * context does not support external modules (request: node:module)". Neither
 * `tsc --noEmit` nor eslint sees that; only the build does. Keep this file
 * free of any server import.
 *
 * One list, not three hand-copied literals: the settings action validates
 * against it and the settings form renders from it, so a renamed or added
 * mode is a type error rather than a radio that silently no-ops.
 */
export type InstagramPostMode = "MANUAL" | "AUTO_IMMEDIATE" | "AUTO_AFTER_EDIT";

export const INSTAGRAM_POST_MODES: readonly InstagramPostMode[] = [
  "MANUAL",
  "AUTO_IMMEDIATE",
  "AUTO_AFTER_EDIT",
];
