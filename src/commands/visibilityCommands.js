// Player View: marking a field Arbiter-only (or shown to players) with the
// eye toggle next to it (ui/playerView.js). world.fieldVisibility holds the
// Arbiter's choices by field key; a key that is not there follows the
// default list (meta.settings.arbiterOnlyFields).
import { registerCommand, createCommand } from './registry.js';

const describe = (value) => (value === undefined ? 'the default' : value ? 'Arbiter-only' : 'shown to players');

registerCommand('setFieldVisibility', {
  label: (p) => `Made ${p.label || p.key} ${describe(p.newValue)}`,
  doFn: (world, p) => apply(world, p.key, p.newValue),
  undoFn: (world, p) => apply(world, p.key, p.oldValue),
});

// undefined removes the key, so the field follows the default list again.
function apply(world, key, value) {
  world.fieldVisibility ??= {};
  if (value === undefined) delete world.fieldVisibility[key];
  else world.fieldVisibility[key] = value;
}

// arbiterOnly: true, false, or undefined (back to the default).
export function setFieldVisibility(world, key, arbiterOnly, label = '') {
  return createCommand('setFieldVisibility', { key, oldValue: world.fieldVisibility?.[key], newValue: arbiterOnly, label });
}
