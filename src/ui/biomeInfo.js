// Info panel for a Biome: name, type, description, Danger Level,
// resources with Availability, residents, notes.
import { h } from './dom.js';
import { textField, fieldSetter } from './fields.js';
import { nameAndType, descriptionField, dangerField, notesField } from './containerFields.js';
import { resourcesEditor } from './resourcesEditor.js';

export function renderBiomeInfo(world, biome) {
  return [
    ...nameAndType(world, biome),
    ...descriptionField(world, biome),
    ...dangerField(world, biome, 'Environmental Danger Level'),
    h('label', {}, 'Resources'),
    resourcesEditor(world, biome),
    ...textField('Residents (followers, creatures, NPCs)', biome.residentsNotes, fieldSetter(world, 'containers', biome.id, 'residentsNotes'), {
      key: `${biome.id}.residents`,
      multiline: true,
    }),
    ...notesField(world, biome),
  ];
}
