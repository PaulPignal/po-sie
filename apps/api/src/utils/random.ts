export function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: number) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = Math.imul(current ^ (current >>> 15), current | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(items: T[], rng: () => number) {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("Impossible de tirer un élément dans une liste vide.");
  }
  return item;
}

export function shuffle<T>(items: T[], rng: () => number) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = clone[index];
    const swap = clone[swapIndex];
    if (current === undefined || swap === undefined) {
      continue;
    }
    [clone[index], clone[swapIndex]] = [swap, current];
  }
  return clone;
}
