// v1.6 pure logic — creators answer their reviews. Same cleaning and limits as the database (reply_to_review),
// which checks everything again; the app only catches mistakes early.
export const REPLY_MAX = 1000;
/** Control characters removed (line breaks kept), at most one empty line in a row, trimmed — like the database. */
export function cleanReply(t: string | null | undefined): string {
  return String(t ?? '').replace(/[\u0001-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
/** '' when the reply can be published (an empty reply removes it, which is handled separately). */
export function replyProblem(t: string): string {
  const c = cleanReply(t);
  return c.length < 2 || c.length > REPLY_MAX ? 'Your reply can be 2 to 1000 characters.' : '';
}
/** Reviews still without a reply (only when the database knows replies at all). */
export function unanswered<T extends { reply?: string | null }>(reviews: T[]): number {
  return reviews.some((r) => 'reply' in r) ? reviews.filter((r) => !r.reply).length : 0;
}
