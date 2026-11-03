// A short summary of what a world (or a backup or snapshot of one) holds,
// shown before restoring it, so the Arbiter can tell versions apart.
const count = (obj, test = () => true) => Object.values(obj ?? {}).filter(test).length;

export function worldPreview(world) {
  const containers = world.containers ?? {};
  const kind = (k) => count(containers, (c) => c.kind === k);
  const characters = world.characters ?? {};
  const living = count(characters, (c) => c.alive !== false);
  const projects = world.projects ?? {};
  const done = count(projects, (p) => p.status === 'complete');
  const days = Object.keys(world.dayLogs ?? {}).length;
  return [
    `${world.meta?.name ?? '(no name)'}, Day ${world.meta?.currentDay ?? '?'}`,
    world.meta?.modified ? `Last changed ${new Date(world.meta.modified).toLocaleString()}` : null,
    `${kind('region')} Region(s), ${kind('biome')} Biome(s), ${kind('area')} Area(s)`,
    `${living} living character(s)${Object.keys(characters).length - living ? `, ${Object.keys(characters).length - living} dead` : ''}`,
    `${count(world.buildings)} building(s), ${count(projects)} Project(s)${done ? ` (${done} complete)` : ''}, ${count(world.tasks)} task(s)`,
    `${count(world.definitions?.factions)} faction(s), Day Log for ${days} day(s)`,
    world.schemaVersion ? `Schema version ${world.schemaVersion}` : null,
  ].filter(Boolean);
}
