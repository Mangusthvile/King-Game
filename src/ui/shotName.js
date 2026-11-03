// Screenshot file names, e.g. "Apollyon_Day8_JadeGarden.png": the faction,
// the day and what is shown, each part with its spaces and symbols removed.

// "Jade Garden" -> "JadeGarden", "Kie's Grove" -> "KiesGrove", "[???]" -> "".
export function namePart(text) {
  return String(text ?? '')
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function screenshotFileName({ faction, day, subject }) {
  const parts = [namePart(faction) || 'AllFactions', `Day${day}`, namePart(subject)].filter(Boolean);
  return `${parts.join('_')}.png`;
}
