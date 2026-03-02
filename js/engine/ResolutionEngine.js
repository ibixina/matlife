/**
 * ResolutionEngine for Mat Life: Wrestling Simulator
 * Step 1.6 of Implementation Plan
 * D20 resolution system with advantage/disadvantage and contested checks
 */

import { rollD20 } from '../core/Utils.js';

/**
 * Outcome types for resolution
 */
export const OUTCOME = {
  CRITICAL_SUCCESS: 'CRITICAL_SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  CRITICAL_FAILURE: 'CRITICAL_FAILURE'
};

/**
 * ResolutionEngine - Stateless class for resolving D20 checks
 */
export class ResolutionEngine {
  /**
   * Resolves a D20 check
   * @param {object} params - Resolution parameters
   * @param {Entity} params.actor - The entity performing the action
   * @param {string} params.action - Action label (e.g., "Aerial Move", "Cut Promo")
   * @param {Entity} [params.target] - Optional target entity
   * @param {string} params.stat - Primary stat name (e.g., "aerial", "micSkills")
   * @param {number} params.dc - Difficulty Class
   * @param {object} [params.context] - Context with advantage/disadvantage flags
   * @returns {ResolutionResult} The resolution result
   */
  static resolve({ actor, action, target, stat, dc, context = {} }) {
    const { hasAdvantage = false, hasDisadvantage = false, bonuses = [], penalties = [] } = context;

    // Get stat value from actor
    const statValue = this._getStatValue(actor, stat);

    // Calculate total modifier
    const bonusSum = bonuses.reduce((sum, b) => sum + b, 0);
    const penaltySum = penalties.reduce((sum, p) => sum + p, 0);
    const modifier = statValue + bonusSum - penaltySum;

    // Check for tag-based advantage/disadvantage
    let effectiveAdvantage = hasAdvantage;
    let effectiveDisadvantage = hasDisadvantage;

    if (actor.hasTag && actor.hasTag('[Hot_Streak]')) {
      effectiveAdvantage = true;
    }
    if (actor.hasTag && actor.hasTag('[Burned_Out]')) {
      effectiveDisadvantage = true;
    }

    // Check for injuries that affect this stat
    if (actor.hasComponent && actor.hasComponent('condition')) {
      const condition = actor.getComponent('condition');
      if (condition.injuries && condition.injuries.length > 0) {
        const injuryPenalty = this._getInjuryPenalty(actor, stat);
        if (injuryPenalty > 0) {
          effectiveDisadvantage = true;
        }
      }
    }

    // Cancel out if both advantage and disadvantage
    if (effectiveAdvantage && effectiveDisadvantage) {
      effectiveAdvantage = false;
      effectiveDisadvantage = false;
    }

    // Roll the die
    let roll;
    if (effectiveAdvantage) {
      roll = Math.max(rollD20(), rollD20());
    } else if (effectiveDisadvantage) {
      roll = Math.min(rollD20(), rollD20());
    } else {
      roll = rollD20();
    }

    // Determine outcome
    let outcome;
    if (roll === 1) {
      outcome = OUTCOME.CRITICAL_FAILURE;
    } else if (roll === 20) {
      outcome = OUTCOME.CRITICAL_SUCCESS;
    } else {
      const total = roll + modifier;
      outcome = total >= dc ? OUTCOME.SUCCESS : OUTCOME.FAILURE;
    }

    return {
      outcome,
      roll,
      modifier,
      total: roll + modifier,
      dc,
      hadAdvantage: effectiveAdvantage,
      hadDisadvantage: effectiveDisadvantage
    };
  }

  /**
   * Resolves a contested check between two entities
   * @param {object} params - Contested check parameters
   * @param {Entity} params.actor - The initiating entity
   * @param {string} params.actorStat - Actor's primary stat
   * @param {Entity} params.target - The opposing entity
   * @param {string} params.targetStat - Target's primary stat
   * @param {object} [params.context] - Context with modifiers
   * @returns {ContestedResult} The contested result
   */
  static resolveContested({ actor, actorStat, target, targetStat, context = {} }) {
    const { actorModifiers = [], targetModifiers = [] } = context;

    // Get stat values
    const actorStatValue = this._getStatValue(actor, actorStat);
    const targetStatValue = this._getStatValue(target, targetStat);

    // Calculate modifiers
    const actorMod = actorModifiers.reduce((sum, m) => sum + m, 0);
    const targetMod = targetModifiers.reduce((sum, m) => sum + m, 0);

    // Roll for both sides
    const actorRoll = rollD20();
    const targetRoll = rollD20();

    // Calculate totals
    const actorTotal = actorRoll + actorStatValue + actorMod;
    const targetTotal = targetRoll + targetStatValue + targetMod;

    // Determine winner
    const winner = actorTotal >= targetTotal ? 'actor' : 'target';
    const margin = Math.abs(actorTotal - targetTotal);

    // Determine margin category
    let marginCategory;
    if (margin <= 3) {
      marginCategory = 'narrow';
    } else if (margin <= 7) {
      marginCategory = 'clear';
    } else {
      marginCategory = 'dominant';
    }

    return {
      winner,
      margin,
      marginCategory,
      actorTotal,
      targetTotal,
      actorRoll,
      targetRoll
    };
  }

  /**
   * Gets a stat value from an entity
   * @private
   * @param {Entity} entity - The entity
   * @param {string} statName - Stat name
   * @returns {number} Stat value
   */
  static _getStatValue(entity, statName) {
    if (!entity || !entity.getComponent) return 10; // Default stat value

    // Map stat names to components
    const statMappings = {
      // Physical stats
      stamina: 'physicalStats',
      strength: 'physicalStats',
      resilience: 'physicalStats',
      speed: 'physicalStats',
      
      // In-ring stats
      brawling: 'inRingStats',
      technical: 'inRingStats',
      aerial: 'inRingStats',
      selling: 'inRingStats',
      psychology: 'inRingStats',
      
      // Entertainment stats
      charisma: 'entertainmentStats',
      micSkills: 'entertainmentStats',
      acting: 'entertainmentStats',
      
      // Booker stats
      creativity: 'bookerStats',
      strictness: 'bookerStats'
    };

    const componentName = statMappings[statName];
    if (!componentName) return 10;

    const component = entity.getComponent(componentName);
    if (!component) return 10;

    return component[statName] ?? 10;
  }

  /**
   * Gets injury penalty for a specific stat
   * @private
   * @param {Entity} entity - The entity
   * @param {string} statName - Stat name
   * @returns {number} Penalty value
   */
  static _getInjuryPenalty(entity, statName) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries) return 0;

    // Map body parts to affected stats
    const injuryStatMap = {
      Knee_L: ['aerial', 'speed'],
      Knee_R: ['aerial', 'speed'],
      Ankle_L: ['aerial', 'speed'],
      Ankle_R: ['aerial', 'speed'],
      Back: ['strength', 'resilience'],
      Neck: ['brawling', 'resilience'],
      Shoulder_L: ['strength', 'aerial'],
      Shoulder_R: ['strength', 'aerial'],
      Arm_L: ['strength'],
      Arm_R: ['strength'],
      Head: ['psychology', 'micSkills'],
      Ribs: ['stamina', 'resilience']
    };

    let penalty = 0;
    for (const injury of condition.injuries) {
      const affectedStats = injuryStatMap[injury.bodyPart] || [];
      if (affectedStats.includes(statName)) {
        penalty += injury.severity; // Severity 1-5 adds penalty
      }
    }

    return penalty;
  }
}

/**
 * @typedef {object} ResolutionResult
 * @property {string} outcome - One of OUTCOME values
 * @property {number} roll - The D20 roll
 * @property {number} modifier - Total modifier applied
 * @property {number} total - Roll + modifier
 * @property {number} dc - Difficulty class
 * @property {boolean} hadAdvantage - Whether advantage was applied
 * @property {boolean} hadDisadvantage - Whether disadvantage was applied
 */

/**
 * @typedef {object} ContestedResult
 * @property {string} winner - 'actor' or 'target'
 * @property {number} margin - Difference in totals
 * @property {string} marginCategory - 'narrow', 'clear', or 'dominant'
 * @property {number} actorTotal - Actor's final total
 * @property {number} targetTotal - Target's final total
 * @property {number} actorRoll - Actor's D20 roll
 * @property {number} targetRoll - Target's D20 roll
 */

export default ResolutionEngine;
