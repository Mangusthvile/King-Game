// Construction stages (Empty Site, Foundation, Under Construction, Completed).
// The stage a building shows comes from its constructionProgress and its
// type's thresholds, unless the Arbiter forced a stage. Pure functions, so
// they are unit tested (tests/constructionStages.test.js).
import stageTable from './tables/constructionStages.json';

export const STAGES = stageTable.stages; // [{ id, name, defaultThreshold }]

// { emptySite: 0, foundation: 25, ... } from the table.
export function defaultThresholds() {
  return Object.fromEntries(STAGES.map((s) => [s.id, s.defaultThreshold]));
}

export function stageName(id) {
  return STAGES.find((s) => s.id === id)?.name ?? id;
}

// The stage reached at a progress percent: the stage with the highest
// threshold at or below it. Below every threshold means the lowest stage.
// A threshold missing from `thresholds` uses the table's default.
export function stageForProgress(progress, thresholds = {}) {
  const sorted = STAGES.map((s) => ({
    id: s.id,
    at: Number.isFinite(thresholds?.[s.id]) ? thresholds[s.id] : s.defaultThreshold,
  })).sort((a, b) => a.at - b.at);
  let stage = sorted[0].id;
  for (const s of sorted) if (progress >= s.at) stage = s.id;
  return stage;
}

// The stage shown for a building: the forced one, else from its progress.
// type: its building type (may be missing; then default thresholds are used).
export function shownStage(building, type) {
  if (building.forcedStage && STAGES.some((s) => s.id === building.forcedStage)) return building.forcedStage;
  return stageForProgress(building.constructionProgress, type?.stageThresholds);
}

// An empty stamp slot per stage, for Stage 9 (stamps are not used yet).
export function emptyStageStamps() {
  return Object.fromEntries(STAGES.map((s) => [s.id, '']));
}
