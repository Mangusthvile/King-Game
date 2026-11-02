// Equipment (weapons, armor or shield, other gear, inventory) and the manual
// combat profile. The combat system is still being tested by the Arbiter,
// so the profile is plain text: nothing here is calculated.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField } from '../../commands/recordCommands.js';
import { refOptions } from './libraryEditor.js';
import { listEditor } from './listEditor.js';
import { COMBAT_FIELDS } from './characterModel.js';

let combatOpen = false; // remembered between redraws

export function renderGear(world, c) {
  const equipment = world.definitions.equipment;
  const armor = h(
    'select',
    { 'data-key': `${c.id}.armor`, onchange: (e) => dispatch(setField(world, 'characters', c.id, 'armorId', e.target.value, c.name)) },
    h('option', { value: '' }, '(none)'),
    refOptions(world, 'equipment').map((o) => h('option', { value: o.value }, o.label)),
    c.armorId && !equipment[c.armorId] ? h('option', { value: c.armorId }, '(deleted)') : null,
  );
  armor.value = c.armorId ?? '';
  const equipTip = (id) => {
    const e = equipment[id];
    return e ? `${e.grade}${e.ex ? ' EX' : ''}${e.max ? ' Max' : ''} ${e.type}. AP ${e.attackPower ?? '-'}, Dmg ${e.damage ?? '-'}, Def ${e.defense ?? '-'}\n${e.special ?? ''}\n${e.description ?? ''}` : '';
  };

  const combat = c.combat ?? {};
  const details = h(
    'details',
    { class: 'combat-profile', open: combatOpen },
    h('summary', { class: 'small' }, 'Combat profile (manual, combat system not implemented)'),
    h(
      'div',
      { class: 'field-grid' },
      COMBAT_FIELDS.map((f) => [
        h('label', {}, f.label),
        h('input', {
          type: 'text',
          value: combat[f.key] ?? '',
          'data-key': `${c.id}.combat.${f.key}`,
          onchange: (e) => dispatch(setField(world, 'characters', c.id, 'combat', { ...combat, [f.key]: e.target.value }, c.name)),
        }),
      ]),
    ),
  );
  details.addEventListener('toggle', () => (combatOpen = details.open));

  return [
    h('h3', {}, 'Equipment'),
    h('label', {}, 'Weapons'),
    listEditor(
      world,
      c,
      'weapons',
      [
        { key: 'equipmentId', label: 'Weapon', type: 'select', wide: true, options: [{ value: '', label: '(choose)' }, ...refOptions(world, 'equipment')] },
        { key: 'qty', label: 'Qty', type: 'number' },
      ],
      {
        newItem: () => ({ equipmentId: '', qty: 1 }),
        addLabel: '+ Weapon slot',
        extras: (w) => (equipment[w.equipmentId] ? h('span', { class: 'info-chip', title: equipTip(w.equipmentId) }, 'i') : null),
      },
    ),
    h('div', { class: 'field-grid' }, h('label', {}, 'Armor or shield'), armor),
    h('label', {}, 'Other gear'),
    h('textarea', { rows: 2, value: c.otherGear ?? '', 'data-key': `${c.id}.otherGear`, onchange: (e) => dispatch(setField(world, 'characters', c.id, 'otherGear', e.target.value, c.name)) }),
    h('label', {}, 'Inventory'),
    listEditor(world, c, 'inventory', [{ key: 'name', label: 'Item', wide: true }, { key: 'quantity', label: 'Qty', type: 'number' }, { key: 'notes', label: 'Notes', wide: true }], {
      newItem: () => ({ name: 'Item', quantity: 1, notes: '' }),
      addLabel: '+ Item',
    }),
    details,
  ];
}
