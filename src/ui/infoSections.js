// Extra sections a system can add to another system's panels, so panels
// don't need to know about every system. kind is a container kind ('region',
// 'biome', 'area') or a record kind whose panel calls infoSections:
// 'building' (Biome Map building panel) and 'character' (stat sheet).
// For example the Characters system adds "Characters here" to Areas, and
// the Projects system adds "Projects here" and a character's Project.
const sections = {}; // kind -> [(world, record) => nodes]

export function registerInfoSection(kind, render) {
  (sections[kind] ??= []).push(render);
}

export function infoSections(world, record, kind = record.kind) {
  return (sections[kind] ?? []).flatMap((render) => render(world, record));
}
