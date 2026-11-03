// Screenshot file names (src/ui/shotName.js).
import { describe, it, expect } from 'vitest';
import { namePart, screenshotFileName } from '../src/ui/shotName.js';

describe('screenshot file names', () => {
  it('matches the example from the Stage 7 brief', () => {
    expect(screenshotFileName({ faction: 'Apollyon', day: 8, subject: 'Jade Garden' })).toBe('Apollyon_Day8_JadeGarden.png');
  });

  it('drops apostrophes, symbols and undiscovered names', () => {
    expect(namePart("Kie's Grove")).toBe('KiesGrove');
    expect(screenshotFileName({ faction: 'Vulture Pack', day: 12, subject: '[???]' })).toBe('VulturePack_Day12.png');
  });

  it('names a shot of every faction', () => {
    expect(screenshotFileName({ faction: '', day: 3, subject: 'Day Log' })).toBe('AllFactions_Day3_DayLog.png');
  });
});
