import { clamp } from "./js/core/Utils.js";

// Mock the exact logic from calculateMatchRating
function calculateMaxPossibleRating(w1Avg, w2Avg, synergyBonus) {
    const baseAvg = (w1Avg + w2Avg) / 2;
    const avgSkill = baseAvg;
    const consistency = Math.min(0.9, 0.3 + (avgSkill / 100) * 0.6);

    let rating = 0.5 + (baseAvg / 100) * 4.6;
    rating += synergyBonus * 0.6;

    // To find the MAX possible, we assume the best possible random roll
    const maxVariation = 1.2;
    const minVariation = 0.1;
    const variationRange = maxVariation - minVariation;
    const actualVariation = minVariation + variationRange * (1 - consistency);
    
    // max random roll is when Math.random() is 1. (1 * 2 - 1) = 1.
    const maxRandomFactor = 1 * actualVariation - 0.12;
    rating += maxRandomFactor;

    if (baseAvg < 88 && rating > 5.5) {
      rating = 5.5 - (88 - baseAvg) * 0.06;
    }
    if (baseAvg < 82 && rating > 5.0) {
      rating = 5.0 - (82 - baseAvg) * 0.05;
    }

    let eliteBonus = 0;
    if (w1Avg >= 95 && w1Avg < 98) eliteBonus += (w1Avg - 95) * 0.03;
    if (w2Avg >= 95 && w2Avg < 98) eliteBonus += (w2Avg - 95) * 0.03;
    rating += eliteBonus;

    let legendaryBonus = 0;
    if (w1Avg >= 98) legendaryBonus += (w1Avg - 98) * 0.05;
    if (w2Avg >= 98) legendaryBonus += (w2Avg - 98) * 0.05;
    rating += legendaryBonus;

    return clamp(rating, 0.5, 7.0);
}

// Max synergy is Brawler vs Technical (0.35) + Face vs Heel (0.25) = 0.60
const MAX_SYNERGY = 0.60;

console.log("Max possible rating with two 100-stat wrestlers:", calculateMaxPossibleRating(100, 100, MAX_SYNERGY).toFixed(2));
console.log("Max possible rating with two 99-stat wrestlers:", calculateMaxPossibleRating(99, 99, MAX_SYNERGY).toFixed(2));
console.log("Max possible rating with two 95-stat wrestlers:", calculateMaxPossibleRating(95, 95, MAX_SYNERGY).toFixed(2));
console.log("Max possible rating with two 85-stat wrestlers:", calculateMaxPossibleRating(85, 85, MAX_SYNERGY).toFixed(2));

