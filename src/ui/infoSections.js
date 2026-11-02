// Extra sections a system can add to the Region, Biome or Area info panels
// (for example the Followers system's "Followers here"), so the panels
// don't need to know about every system.
const sections = {}; // container kind -> [(world, container) => nodes]

export function registerInfoSection(kind, render) {
  (sections[kind] ??= []).push(render);
}

export function infoSections(world, container) {
  return (sections[container.kind] ?? []).flatMap((render) => render(world, container));
}
