// Construction stage lookup (src/systems/buildings/stages.js). Thresholds and
// stages are the Arbiter's Stage 3 spec: Empty Site 0, Foundation 25,
// Under Construction 50, Completed 100, all editable per building type.
import { describe, it, expect } from 'vitest';
import { stageForProgress, shownStage, defaultThresholds } from '../src/systems/buildings/stages.js';

describe('stageForProgress with the default thresholds', () => {
  it.each([
    [0, 'emptySite'],
    [24, 'emptySite'],
    [25, 'foundation'],
    [49.5, 'foundation'],
    [50, 'underConstruction'],
    [99, 'underConstruction'],
    [100, 'completed'],
  ])('%s%% is %s', (progress, stage) => {
    expect(stageForProgress(progress, defaultThresholds())).toBe(stage);
  });

  it('uses the defaults when no thresholds are given', () => {
    expect(stageForProgress(30)).toBe('foundation');
  });
});

describe('stageForProgress with edited thresholds', () => {
  const thresholds = { emptySite: 0, foundation: 10, underConstruction: 20, completed: 80 };

  it('follows the new numbers', () => {
    expect(stageForProgress(9, thresholds)).toBe('emptySite');
    expect(stageForProgress(10, thresholds)).toBe('foundation');
    expect(stageForProgress(79, thresholds)).toBe('underConstruction');
    expect(stageForProgress(80, thresholds)).toBe('completed');
  });

  it('fills a missing threshold from the defaults', () => {
    expect(stageForProgress(60, { completed: 60 })).toBe('completed');
    expect(stageForProgress(30, { completed: 60 })).toBe('foundation');
  });

  it('gives the lowest stage below every threshold', () => {
    expect(stageForProgress(5, { emptySite: 10, foundation: 25, underConstruction: 50, completed: 100 })).toBe('emptySite');
  });
});

describe('shownStage', () => {
  const type = { stageThresholds: defaultThresholds() };

  it('comes from progress when no stage is forced', () => {
    expect(shownStage({ constructionProgress: 60, forcedStage: '' }, type)).toBe('underConstruction');
  });

  it('uses the forced stage whatever the progress', () => {
    expect(shownStage({ constructionProgress: 0, forcedStage: 'completed' }, type)).toBe('completed');
  });

  it('ignores an unknown forced stage', () => {
    expect(shownStage({ constructionProgress: 25, forcedStage: 'ruined' }, type)).toBe('foundation');
  });

  it('works for a building without a type', () => {
    expect(shownStage({ constructionProgress: 100, forcedStage: '' }, undefined)).toBe('completed');
  });
});
