// Info panel for a Biome: name, type, description, Danger Level,
// resources with Availability, residents, notes.
import { undiscoveredPanel } from './playerView.js';
import { h } from './dom.js';
import { textField, fieldSetter } from './fields.js';
import { claimField, nameAndType, discoveryFields, descriptionField, dangerField, notesField, mapScaleField } from './containerFields.js';
import { resourcesEditor } from './resourcesEditor.js';
import { infoSections } from './infoSections.js';

export function renderBiomeInfo(world, biome) {
  const hidden = undiscoveredPanel(world, biome); // Player View: an undiscovered place shows only [???]
  if (hidden) return hidden;
  return [
    ...nameAndType(world, biome),
    ...claimField(world, biome),
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
