// Chronicle: what happened. Day Log (By Day: every entry of a day,
// editable, with narration; Copy Day: the whole day as one text), Notes
// (Stage 8, a placeholder until then) and History (the undo and redo
// Action Log, plus Reverse Day, Set Day and the end-of-day snapshots).
import { h, restoreFocus } from '../../ui/dom.js';
import { dayLog, copyDayPage, actionLog } from '../../ui/logTab.js';
import { renderTimeControls } from '../time/timeControls.js';

// A page that redraws itself for view changes (picking a day).
const page = (build) => (world, { detailPanel }) => {
  detailPanel.replaceChildren(h('h2', {}, 'Chronicle'), h('p', { class: 'muted small' }, 'The Day Log follows the faction selector: one faction, or every faction under its own heading.'));
  const root = h('div', { class: 'tab-page' });
  const refresh = () => {
    root.replaceChildren(build(world, refresh));
    if (root.isConnected) restoreFocus(root);
  };
  refresh();
  return root;
};

export default {
  id: 'chronicle',
  name: 'Chronicle',
  places: [
    { path: 'chronicle/dayLog/byDay', render: page(dayLog) },
    { path: 'chronicle/dayLog/copyDay', render: page(copyDayPage) },
    { path: 'chronicle/history', render: page((world) => h('div', {}, renderTimeControls(world), actionLog(world))) },
  ],
};
