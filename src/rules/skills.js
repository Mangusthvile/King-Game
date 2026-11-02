// Theories and Skill Tiers (RULES.md, "Skills, Traits, and Theories").
// Pure functions: they take a character's theories and skills and return
// new lists. They never decide for the Arbiter: which items are "related"
// and which Skill a Theory becomes are always the Arbiter's choice.
//   theory: { name, percent }
//   skill entry: { skillId, tier, level }   tier is "T1" to "T5", or a special
//                tier such as "Inner Monster" that has no Tier-up path
import table from './tables/skillTiers.json';

export const COMBINE_COUNT = table.combineCount;
export const MAX_TIER = table.maxTier;

// "T2" -> 2. A special tier ("Inner Monster") -> null.
export function tierNumber(tier) {
  const m = String(tier ?? '').match(/^T\s*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

export function tierLabel(n) {
  return `T${n}`;
}

// RULES.md: the Level bonus starts at +0 at Lv1 and rises by +1 per Level
// (+9 at Lv10). Display only for now.
export function skillBonus(level) {
  const n = Number(level);
  return Number.isFinite(n) ? Math.max(0, n - 1) : 0;
}

// True when a Theory is complete and can become a T1 Skill.
export function isTheoryComplete(theory) {
  return Number(theory.percent) >= table.theoryCompletePercent;
}

// What a Skill of this Tier combines to reach the next Tier:
//   { kind: 'theory' } or { kind: 'skill', tier } or null (top Tier, special tier).
export function tierUpSource(tier) {
  const source = table.tierUpSources[String(tierNumber(tier))];
  return source ? { kind: source.kind, tier: source.tier } : null;
}

// The items the Arbiter may pick from to tier up skills[skillIndex]:
// [{ kind: 'theory' | 'skill', index, item }]. The Skill itself is never offered.
export function tierUpCandidates(theories, skills, skillIndex) {
  const source = tierUpSource(skills[skillIndex]?.tier);
  if (!source) return [];
  if (source.kind === 'theory') {
    return theories.map((item, index) => ({ kind: 'theory', index, item })).filter((c) => isTheoryComplete(c.item));
  }
  return skills
    .map((item, index) => ({ kind: 'skill', index, item }))
    .filter((c) => c.index !== skillIndex && tierNumber(c.item.tier) === source.tier);
}

// Turns theories[theoryIndex] into a new T1 Skill at Lv1 (newSkill gives the
// rest of the entry, for example { skillId }).
// removeTheory: RULES.md says the Theory "becomes" the Skill, so this is
// normally true; the Arbiter can keep it (for example to combine it later).
// Returns { theories, skills }.
export function convertTheoryToSkill(theories, skills, theoryIndex, newSkill, removeTheory = true) {
  return {
    theories: removeTheory ? theories.filter((_, i) => i !== theoryIndex) : [...theories],
    skills: [...skills, { ...newSkill, tier: tierLabel(1), level: 1 }],
  };
}

// Raises skills[skillIndex] one Tier, combining the picked items
// (picks: [{ kind, index }] from tierUpCandidates).
// RULE NEEDED: whether the combined Theories or Skills are consumed, and
// what happens to the Skill's Level, are open rules. The Arbiter chooses
// removeCombined each time, and the Level is kept as it is.
// Returns { theories, skills }.
export function tierUpSkill(theories, skills, skillIndex, picks, removeCombined = false) {
  const skill = skills[skillIndex];
  const raised = { ...skill, tier: tierLabel(Math.min(MAX_TIER, tierNumber(skill.tier) + 1)) };
  const dropTheories = new Set(removeCombined ? picks.filter((p) => p.kind === 'theory').map((p) => p.index) : []);
  const dropSkills = new Set(removeCombined ? picks.filter((p) => p.kind === 'skill').map((p) => p.index) : []);
  return {
    theories: theories.filter((_, i) => !dropTheories.has(i)),
    skills: skills.map((s, i) => (i === skillIndex ? raised : s)).filter((_, i) => !dropSkills.has(i)),
  };
}
