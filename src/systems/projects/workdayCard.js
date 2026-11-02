// The Project workday as a Task Card (CLAUDE.md, Task Cards): a small
// window over the Projects tab that the Arbiter can drag by its header.
//   1. Setup: the party (Stamina, relevant Skill...) shrunk into the Info
//      pane. Confirm party starts the log.
//   2. Run: the Info pane shows the member tiles, and the Resolution Log plays
//      line by line, pausing at each question (workdayPrompts.js): roll the
//      dice? Y/N, roll the Event? Y/N, effect, Workload change, Conditions,
//      notes, and finally "Accept this workday? Y/N".
// "Edit details" (the full controls) can change any value at any time.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { renderTaskCard, infoRow, dangerMeter, memberTile, progressBar, copyText } from '../../ui/taskCard.js';
import { logPlaceName, dangerAt } from '../../data/places.js';
import { dayLogText } from '../../data/dayLog.js';
import { siteBuilding, unmetRequirements, requirementText } from './projectModel.js';
import { resolveDraft } from './workdayDraft.js';
import { workdayLogScript } from './workdayLog.js';
import { acceptWorkday, acceptBlocker } from './workdayAccept.js';
import { renderParticipants, conditionReminders } from './workdayParticipants.js';
import { renderEvent } from './workdayEvent.js';
import { renderSetup } from './workdaySetup.js';
import { currentStop, renderPrompt, renderAcceptPrompt } from './workdayPrompts.js';
import { projectsView as view } from './state.js';

export const PROJECT_TASK_TYPE = { label: 'Project', icon: '⚒' };

const LINE_MS = 55; // how fast the log plays, per line
let revealTimer = null; // only one log plays at a time

const factionColor = (world, c) => world.definitions.factions?.[c?.factionId]?.color ?? '';
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

function memberTiles(world, resolved) {
  return resolved.working.map((r) =>
    memberTile({
      name: r.name,
      color: factionColor(world, r.character),
      warn: r.overspend,
      lines: [
        // e.g. "1 Stamina · d6 · Digger T1"
        [`${r.p.stamina} Stamina`, r.die ? `d${r.die}` : 'd?', r.skill ? `${r.skillName} ${r.skill.tier}` : 'No Skill'].join(' · '),
        r.work !== null && r.p.stamina > 0 ? `Work: ${r.work}` : null,
        ...conditionReminders(r.character),
        r.p.toolNote ? `Tools: ${r.p.toolNote}` : null,
      ].filter(Boolean),
    }),
  );
}

function accept(world, draft, resolved, log) {
  view.workday = null;
  dispatch(acceptWorkday(world, draft, resolved, log));
}

// The full controls (the earlier look), folded away under "Edit details".
function editDetails(world, draft, resolved, log, refresh) {
  const { project, total, after, overspend } = resolved;
  const blocker = acceptBlocker(draft, resolved);
  const unmet = unmetRequirements(project);
  const details = h(
    'details',
    { class: 'edit-details', open: view.editOpen || draft.declined },
    h('summary', {}, 'Edit details (reroll dice, change any value)'),
    renderParticipants(world, draft, refresh),
    renderEvent(world, draft, resolved, refresh),
    h('h3', {}, 'Proposed Result'),
    h(
      'div',
      { class: 'proposal' },
      h('span', {}, `Total Work Done Today: ${total ?? '?'}`),
      draft.workloadChange ? h('span', {}, `Event: ${signed(draft.workloadChange)}`) : null,
      h('strong', {}, `Current Workload: ${resolved.before} → ${after ?? '?'} / ${project.workloadRequired}`),
    ),
    unmet.length ? h('p', { class: 'small flag-text' }, `Unmet requirements (a warning only): ${unmet.map((r) => requirementText(world, r)).join(', ')}`) : null,
    overspend.length
      ? h(
          'label',
          { class: 'check-label flag-text' },
          h('input', { type: 'checkbox', checked: draft.staminaOverride, onchange: (e) => ((draft.staminaOverride = e.target.checked), refresh()) }),
          ` Override: let ${overspend.map((r) => r.name).join(', ')} spend more Stamina than they have left`,
        )
      : null,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', disabled: !!blocker, title: blocker || 'Commit this workday (Ctrl+Z undoes it)', onclick: () => accept(world, draft, resolved, log) }, 'Accept'),
      h('button', { class: 'btn danger', onclick: () => confirm('Throw away this workday? Nothing has been committed.') && ((view.workday = null), refresh()) }, 'Cancel workday'),
      blocker ? h('span', { class: 'muted small' }, blocker) : null,
    ),
  );
  details.addEventListener('toggle', () => (view.editOpen = details.open));
  return details;
}

// Plays the log one line at a time up to `target`, then redraws to show
// the question waiting there.
function playLog(pre, draft, lines, target, refresh) {
  let idle = 0;
  revealTimer = setInterval(() => {
    if (!pre.isConnected) {
      if (++idle > 40) clearInterval(revealTimer); // the tab was left
      return;
    }
    draft.revealed += 1;
    pre.textContent = lines.slice(0, draft.revealed).join('\n');
    pre.scrollTop = pre.scrollHeight;
    if (draft.revealed >= target) {
      clearInterval(revealTimer);
      refresh();
    }
  }, LINE_MS);
}

function logContent(world, draft, resolved, script, refresh) {
  if (draft.phase === 'setup') {
    return { content: h('div', { class: 'log-screen muted' }, '> Set up the party in Info, then press Confirm party.'), text: '' };
  }
  const generated = script.lines.join('\n');
  const stop = currentStop(script, draft);
  const target = stop ? stop.at : script.lines.length;
  if (draft.revealed > script.lines.length) draft.revealed = script.lines.length;

  // Every question answered and every line shown: the finished, editable log.
  if (!stop && draft.revealed >= script.lines.length) {
    const log = draft.logText ?? generated;
    const area = h('textarea', { class: 'task-log-text', value: log, readOnly: view.playerView, 'data-key': 'taskcard.log', spellcheck: false });
    area.addEventListener('change', () => ((draft.logText = area.value === generated ? null : area.value), refresh()));
    const blocker = acceptBlocker(draft, resolved);
    return {
      text: log,
      edited: draft.logText !== null,
      onReset: draft.logText !== null ? () => ((draft.logText = null), refresh()) : null,
      content: [area, h('div', { class: 'arbiter-only' }, renderAcceptPrompt(draft, blocker, () => accept(world, draft, resolved, log), refresh))],
    };
  }

  const shown = script.lines.slice(0, draft.revealed).join('\n');
  const pre = h('pre', { class: 'log-screen', title: 'Click to skip ahead' }, shown);
  const playing = draft.revealed < target;
  pre.addEventListener('click', () => {
    if (draft.revealed < target) ((draft.revealed = target), refresh());
  });
  if (playing) playLog(pre, draft, script.lines, target, refresh);
  // Keep the newest line in view after a redraw.
  requestAnimationFrame(() => (pre.scrollTop = pre.scrollHeight));
  return {
    text: shown,
    content: [pre, !playing && stop ? h('div', { class: 'arbiter-only' }, renderPrompt(world, draft, resolved, stop, refresh)) : h('p', { class: 'muted small' }, 'Click the log to skip ahead.')],
  };
}

export function renderWorkdayCard(world, refresh) {
  clearInterval(revealTimer);
  const draft = view.workday;
  const resolved = resolveDraft(world, draft);
  const { project } = resolved;
  const building = siteBuilding(world, project);
  const script = workdayLogScript(world, draft, resolved);
  const danger = dangerAt(world, project.locationContainerId);
  const day = world.meta.currentDay;
  const setup = draft.phase === 'setup';
  const log = logContent(world, draft, resolved, script, refresh);

  const card = renderTaskCard({
    type: PROJECT_TASK_TYPE,
    name: project.name,
    members: resolved.working.map((r) => ({ name: r.name, color: factionColor(world, r.character) })),
    bannerText: building ? `${building.name}, Day ${day}` : `Day ${day}`,
    info: [
      infoRow('👥', 'Party', String(resolved.working.length)),
      infoRow('📍', 'Location', logPlaceName(world, project.locationContainerId)),
      infoRow('⚠', 'Danger', dangerMeter(danger)),
      infoRow('🏠', 'Site', building?.name ?? 'None'),
    ],
    infoBody: setup ? renderSetup(world, draft, refresh) : null,
    typeInfo: [
      h('div', { class: 'task-pane-sub' }, 'Workload'),
      progressBar(project.workloadCurrent, project.workloadRequired),
      resolved.total !== null && draft.answered.rollDice
        ? h('p', { class: 'small ok-text' }, `Today: ${signed(resolved.total)}${draft.workloadChange ? ` ${signed(draft.workloadChange)} (Event)` : ''} → ${resolved.after} / ${project.workloadRequired}`)
        : null,
    ],
    memberTiles: memberTiles(world, resolved),
    log: {
      title: `Log: Day ${day}`,
      ...log,
      onCopyDay: (button) => copyText([dayLogText(world, day), log.text].filter(Boolean).join('\n\n'), button),
    },
    controls: setup ? null : editDetails(world, draft, resolved, draft.logText ?? script.lines.join('\n'), refresh),
    position: view.cardPos,
    onMove: (pos) => (view.cardPos = pos),
    playerView: view.playerView,
    onTogglePlayerView: () => ((view.playerView = !view.playerView), refresh()),
    onClose: () => ((view.cardOpen = false), refresh()),
  });
  // Put the cursor in the question's answer box, so Y / N can just be typed.
  setTimeout(() => card.isConnected && !card.contains(document.activeElement) && card.querySelector('[data-autofocus]')?.focus(), 0);
  return card;
}
