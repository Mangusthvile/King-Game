// Info panel for a Biome: name, type, description, Danger Level,
// resources with Availability, residents, notes.
import { h } from './dom.js';
import { textField, fieldSetter } from './fields.js';
import { nameAndType, discoveryFields, descriptionField, dangerField, notesField, mapScaleField } from './containerFields.js';
import { resourcesEditor } from './resourcesEditor.js';
import { infoSections } from './infoSections.js';

export function renderBiomeInfo(world, biome) {
  return [
    ...nameAndType(world, biome),
    ...discoveryFields(world, biome),
    ...descriptionField(world, biome),
    ...dangerField(world, biome, 'Environmental Danger Level'),
    h('label', {}, 'Resources'),
    resourcesEditor(world, biome),
    ...textField('Residents (notes on followers, creatures, NPCs)', biome.residentsNotes, fieldSetter(world, 'containers', biome.id, 'residentsNotes'), {
      key: `${biome.id}.residents`,
      multiline: true,
    }),
    ...infoSections(world, biome),
    ...notesField(world, biome),
    ...mapScaleField(world, biome, 'Biome Map scale (cells per Region Map cell)'),
  ];
}
