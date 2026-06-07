import { describe, expect, it } from "vitest";
import {
  buildLearningUnits,
  cleanWhitespace,
  estimateDifficulty,
  scoreTextAnswer,
  splitVerses
} from "../src/utils/text";

describe("text utils", () => {
  it("normalise les sauts de ligne et compte les vers utiles", () => {
    const text = cleanWhitespace("Un vers \n\n\nDeuxième vers\n  \nTroisième vers");
    expect(splitVerses(text)).toEqual(["Un vers", "Deuxième vers", "Troisième vers"]);
  });

  it("découpe en strophes si des paragraphes existent", () => {
    const units = buildLearningUnits("Vers 1\nVers 2\n\nVers 3\nVers 4");
    expect(units).toHaveLength(2);
    expect(units[0]?.unitType).toBe("strophe");
    expect(units[1]?.startVerse).toBe(3);
  });

  it("évalue une réponse proche sans exiger l’exactitude totale", () => {
    expect(scoreTextAnswer("La cigale ayant chante", "La Cigale, ayant chanté")).toBeGreaterThan(70);
    expect(scoreTextAnswer("Complètement faux", "La Cigale, ayant chanté")).toBeLessThan(40);
  });

  it("dérive une difficulté cohérente", () => {
    expect(estimateDifficulty(10)).toBe("facile");
    expect(estimateDifficulty(24)).toBe("intermédiaire");
    expect(estimateDifficulty(48)).toBe("avancée");
  });
});

