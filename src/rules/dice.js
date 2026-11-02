// Dice. rng is a function returning a number in [0, 1) (Math.random by
// default), so tests can pass a fixed sequence.

export function rollDie(sides, rng = Math.random) {
  return 1 + Math.floor(rng() * sides);
}

export function rollDice(count, sides, rng = Math.random) {
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

// A rolled or typed-in result is a whole number from 1 to sides.
export function isValidRoll(value, sides) {
  return Number.isInteger(value) && value >= 1 && value <= sides;
}
