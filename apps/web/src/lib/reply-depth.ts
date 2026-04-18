/**
 * How verbose and structured chat replies should be.
 * - quick: dense bullets, ~120 words
 * - layered: TL;DR for newbies + expert block (default)
 * - full: TL;DR first, then long multi-section memo when the question asks for every angle
 */
export type ReplyDepth = "quick" | "layered" | "full";

export const REPLY_DEPTH_CHOICES: { value: ReplyDepth; title: string; oneLiner: string }[] = [
  {
    value: "quick",
    title: "Quick scan",
    oneLiner: "Short bullets only — best when you already know the domain.",
  },
  {
    value: "layered",
    title: "Balanced (recommended)",
    oneLiner: "TL;DR anyone can skim, then facts and risks for experts.",
  },
  {
    value: "full",
    title: "Full depth",
    oneLiner:
      "TL;DR first, but the model may expand into a long multi-section memo when you clearly want every angle.",
  },
];
