// Info panel for a selected building on the Biome Map: name, type, Area,
// footprint, construction stage and progress, Project (Stage 5), storage,
// properties and notes. The map panel adds the action buttons, map
// placement and custom fields around it.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, batch } from '../../commands/recordCommands.js';
import { textField, selectField, fieldSetter } from '../../ui/fields.js';
import { navigate } from '../../ui/navigation.js';
import { STAGES, stageName, stageForProgress, shownStage } from './stages.js';
import { keyValueEditor, storageEditor } from './listEditors.js';

export function renderBuildingPanel(world, obj, view) {
  const b = world.buildings[obj.refId];
  if (!b) return [h('p', { class: 'message error small' }, "This building's record is missing.")];
  const types = world.definitions.buildingTypes;
  const type = types[b.buildingTypeId];
  const category = world.definitions.buildingCategories?.[type?.categoryId];
  const set = (field) => fieldSetter(world, 'buildings', b.id, field);
  const key = (field) => `${b.id}.${field}`;

  // Areas on this Biome's map, to link the building to.
  const areas = Object.values(world.containers).filter((c) => c.kind === 'area' && c.parentId === obj.containerId);

  return [
    ...textField('Name', b.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...selectField(
      'Type',
      b.buildingTypeId,
      [{ value: '', label: '(no type)' }, ...Object.values(types).map((t) => ({ value: t.id, label: t.name }))],
      (typeId) => typeId !== b.buildingTypeId && dispatch(changeBuildingType(world, b, typeId)),
      { key: key('type'), missingLabel: () => '(deleted type)' },
    ),
    h(
      'div',
      { class: 'row small' },
      h('span', { class: 'muted' }, `Category: ${category?.name ?? 'none'}`),
      h('button', { class: 'btn small', onclick: () => navigate({ tab: 'buildings' }) }, 'Edit types'),
    ),
    ...selectField(
      'Area',
      b.areaId,
      [{ value: '', label: '(none: stands alone)' }, ...areas.map((a) => ({ value: a.id, label: a.name }))],
      set('areaId'),
      { key: key('areaId'), missingLabel: () => '(removed Area)' },
    ),
    h('p', { class: 'muted small' }, 'Placing or moving it inside an Area links it to that Area. You can change the link here.'),
    h('label', {}, 'Footprint'),
    h(
      'div',
      { class: 'row' },
      h('span', {}, `${obj.w} x ${obj.h} cells`),
      obj.w !== obj.h ? h('button', { class: 'btn small', title: 'Quarter turn (R)', onclick: () => view.rotateSelected() }, 'Rotate') : null,
    ),
    ...constructionFields(world, b, type),
    h('label', {}, 'Project'),
    // Stage 5 (Projects) will set projectId and drive the progress.
    h('p', { class: 'muted small' }, b.projectId ? `Project ${b.projectId}` : 'None. Projects come in Stage 5.'),
    h('h3', {}, 'Storage'),
    storageEditor(world, b),
    h('h3', {}, 'Properties'),
    keyValueEditor(world, 'buildings', b.id, 'properties'),
    ...textField('Notes', b.notes, set('notes'), { key: key('notes'), multiline: true }),
  ];
}

// Construction stage (auto or forced) and progress percent.
function constructionFields(world, b, type) {
  const message = h('p', { class: 'message error small' });
  const auto = stageForProgress(b.constructionProgress, type?.stageThresholds);
  const setProgress = (value) => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n) || n < 0 || n > 100) return (message.textContent = 'Progress must be a number from 0 to 100.');
    if (n !== b.constructionProgress) dispatch(setField(world, 'buildings', b.id, 'constructionProgress', n, b.name));
  };
  const shown = shownStage(b, type);

  return [
    h('h3', {}, 'Construction'),
    h(
      'p',
      { class: 'small' },
      'Shown stage: ',
      h('span', { class: 'label-tag stage-tag' }, stageName(shown)),
      b.forcedStage ? h('span', { class: 'muted' }, ' (forced)') : null,
    ),
    ...selectField(
      'Stage',
      b.forcedStage,
      [{ value: '', label: `Auto from progress (${stageName(auto)})` }, ...STAGES.map((s) => ({ value: s.id, label: `Force: ${s.name}` }))],
      fieldSetter(world, 'buildings', b.id, 'forcedStage'),
      { key: `${b.id}.forcedStage` },
    ),
    h('label', {}, 'Progress (%)'),
    h(
      'div',
      { class: 'row progress-row' },
      h('input', { type: 'range', min: 0, max: 100, step: 1, value: b.constructionProgress, onchange: (e) => setProgress(e.target.value) }),
      h('input', { type: 'number', min: 0, max: 100, step: 'any', value: b.constructionProgress, 'data-key': `${b.id}.progress`, onchange: (e) => setProgress(e.target.value) }),
    ),
    message,
  ];
}

// Changing the type is one undo step: set the type and add the new type's
// default properties that the building doesn't have yet (matched by name).
// Its size, name and existing properties are kept.
export function changeBuildingType(world, b, typeId) {
  const type = world.definitions.buildingTypes[typeId];
  const have = new Set(b.properties.map((p) => p.key.toLowerCase()));
  const missing = (type?.defaultProperties ?? []).filter((p) => !have.has(p.key.toLowerCase()));
  return batch(`Set type of "${b.name}" to ${type?.name ?? 'none'}`, [
    setField(world, 'buildings', b.id, 'buildingTypeId', typeId, b.name),
    missing.length ? setField(world, 'buildings', b.id, 'properties', [...b.properties, ...structuredClone(missing)], b.name) : null,
  ]);
}
