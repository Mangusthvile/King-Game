// The Resolution Log template filler (src/rules/logTemplate.js).
import { describe, it, expect } from 'vitest';
import { fillTemplate, splitScript } from '../src/rules/logTemplate.js';

describe('fillTemplate', () => {
  it('fills values and leaves missing ones blank', () => {
    expect(fillTemplate('Day {{day}}: {{name}}{{missing}}', { day: 8, name: 'Dig' })).toBe('Day 8: Dig');
  });

  it('repeats a list section per item, reading outer values too', () => {
    const t = 'Rolls:\n{{#people}}\n{{name}} rolled {{die}} on day {{day}}\n{{/people}}\nEnd';
    const out = fillTemplate(t, { day: 8, people: [{ name: 'King', die: 6 }, { name: 'Kie', die: 4 }] });
    expect(out).toBe('Rolls:\nKing rolled 6 on day 8\nKie rolled 4 on day 8\nEnd');
  });

  it('shows a value section once when set, and drops it when empty', () => {
    const t = 'A\n{{#effect}}\nEffect: {{effect}}\n{{/effect}}\nB';
    expect(fillTemplate(t, { effect: 'Lost tools' })).toBe('A\nEffect: Lost tools\nB');
    expect(fillTemplate(t, { effect: '' })).toBe('A\nB');
  });

  it('nests sections and supports inverted sections', () => {
    const t = '{{#has}}\nList:\n{{#items}}\n- {{item}}\n{{/items}}\n{{/has}}\n{{^items}}\nNone\n{{/items}}';
    expect(fillTemplate(t, { has: true, items: ['a', 'b'] })).toBe('List:\n- a\n- b\n');
    expect(fillTemplate(t, { has: false, items: [] })).toBe('None\n');
  });
});

describe('splitScript', () => {
  it('turns {{@stop}} lines into stops at the right line', () => {
    const { lines, stops } = splitScript(['A', 'B', '{{@roll}}', 'C', '', '', 'D', '{{@notes}}', ''].join('\n'));
    expect(lines).toEqual(['A', 'B', 'C', '', 'D']);
    expect(stops).toEqual([
      { name: 'roll', at: 2 },
      { name: 'notes', at: 5 },
    ]);
  });

  it('adds required stops the template is missing at the end', () => {
    expect(splitScript(['A', '{{@roll}}', 'B'].join('\n'), ['roll', 'event']).stops).toEqual([
      { name: 'roll', at: 1 },
      { name: 'event', at: 2 },
    ]);
  });
});
