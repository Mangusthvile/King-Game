// Fills a Resolution Log template (CLAUDE.md, Resolution Logs). Templates
// are plain text files the Arbiter can edit, with:
//   {{name}}               the value of name
//   {{#list}}...{{/list}}  repeated for each item of list (inside it,
//                          {{field}} reads the item first, then the outer data);
//                          for a non-list value, shown once if it is truthy
//   {{^name}}...{{/name}}  shown only if name is empty, false or an empty list
//   {{@name}}              on its own line: a stop. The log is shown line by
//                          line and pauses here to ask the Arbiter something
//                          (for example {{@rollDice}}: "Roll the Work Dice? Y/N").
//                          See splitScript.
// Lines that end up empty because of a section tag are dropped, so sections
// can sit on their own lines.

const SECTION = /\{\{([#^])(\w+)\}\}\n?([\s\S]*?)\{\{\/\2\}\}\n?/g;
const VALUE = /\{\{(\w+)\}\}/g;

const isEmpty = (v) => v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && v.length === 0);

export function fillTemplate(template, data, outer = {}) {
  template = template.replace(/\r\n?/g, '\n'); // a template saved on Windows has \r\n line ends
  const lookup = (key) => (key in data ? data[key] : outer[key]);
  const withSections = template.replace(SECTION, (_, kind, key, body) => {
    const value = lookup(key);
    if (kind === '^') return isEmpty(value) ? fillTemplate(body, data, outer) : '';
    if (isEmpty(value)) return '';
    if (Array.isArray(value)) return value.map((item) => fillTemplate(body, typeof item === 'object' ? item : { item }, { ...outer, ...data })).join('');
    return fillTemplate(body, data, outer);
  });
  return withSections.replace(VALUE, (_, key) => {
    const value = lookup(key);
    return value === undefined || value === null ? '' : String(value);
  });
}

const STOP = /^\{\{@(\w+)\}\}$/;

// Splits filled template text into lines and stops: { lines, stops: [{ name, at }] }.
// at = how many lines come before the stop. Stop lines are removed, runs of
// blank lines become one, and blank lines at the start and end are dropped.
// requiredStops (in order) that the template is missing are added at the
// end, so an edited template can never skip them.
export function splitScript(text, requiredStops = []) {
  const lines = [];
  const stops = [];
  for (const raw of text.split('\n')) {
    const stop = raw.trim().match(STOP);
    if (stop) {
      stops.push({ name: stop[1], at: lines.length });
    } else if (raw.trim() !== '' || (lines.length && lines.at(-1).trim() !== '')) {
      lines.push(raw);
    }
  }
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  for (const s of stops) s.at = Math.min(s.at, lines.length);
  for (const name of requiredStops) if (!stops.some((s) => s.name === name)) stops.push({ name, at: lines.length });
  return { lines, stops };
}
