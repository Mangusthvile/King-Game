// Unique ids for every record. The prefix makes ids readable in JSON exports
// (for example "follower_..." is clearly a follower).
export function newId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}
