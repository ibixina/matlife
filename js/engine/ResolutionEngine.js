/**
 * ResolutionEngine for Mat Life: Wrestling Simulator
 * Step 1.6 of Implementation Plan
 * Probability-based resolution system
 */

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
 * ResolutionEngine - Stateless class for resolving action checks
 */
export class ResolutionEngine {
  /**
   * Calculates elite score from an entity's relevant stats
   * @param {Entity} entity - The entity
   * @param {string} stat - Primary stat being used
   * @returns {number} Elite score (0-100)
   */
  static calculateEliteScore(entity, stat) {
    if (!entity || !entity.getComponent) return 50;

    const statValue = this._getStatValue(entity, stat);
    const popularity = entity.getComponent('popularity');
    const condition = entity.getComponent('condition');
    const lifestyle = entity.getComponent('lifestyle');

    // Base from stat (normalized: stat/2, so stat 100 = 50)
    const statScore = statValue / 2;

    // Overness contribution (0-30)
    const overnessScore = Math.min(30, (popularity?.overness || 5) / 3.33);

    // Momentum contribution (0-20)
    const momentumScore = Math.min(20, (popularity?.momentum || 0) / 5);

    // Burnout penalty (0-15)
    const burnoutPenalty = lifestyle?.burnout ? Math.min(15, lifestyle.burnout / 6.67) : 0;

    // Injury penalty (0-10)
    let injuryPenalty = 0;
    if (condition?.injuries && condition.injuries.length > 0) {
      injuryPenalty = Math.min(10, condition.injuries.reduce((sum, i) => sum + i.severity, 0) * 2);
    }

    // Calculate total
    const eliteScore = statScore + overnessScore + momentumScore - burnoutPenalty - injuryPenalty;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, eliteScore));
  }

  /**
   * Calculates success rate from elite score
   * @param {number} eliteScore - Elite score (0-100)
   * @returns {number} Success probability (0-100)
   */
  static getSuccessRate(eliteScore) {
    // 0 → 40%, 100 → 95%
    return 40 + (eliteScore * 0.55);
  }

  /**
   * Resolves an action check
   * @param {object} params - Resolution parameters
   * @param {Entity} params.actor - The entity performing the action
   * @param {string} params.action - Action label
   * @param {Entity} [params.target] - Optional target entity
   * @param {string} params.stat - Primary stat name
   * @param {number} params.dc - Difficulty Class (kept for compatibility, not used)
   * @param {object} [params.context] - Context with bonuses/penalties
   * @returns {ResolutionResult} The resolution result
   */
  static resolve({ actor, action, target, stat, dc, context = {} }) {
    const { bonuses = [], penalties = [] } = context;

    // Calculate elite score
    let eliteScore = this.calculateEliteScore(actor, stat);

    // Apply bonuses/penalties to elite score
    const bonusSum = bonuses.reduce((sum, b) => sum + b, 0);
    const penaltySum = penalties.reduce((sum, p) => sum + p, 0);
    eliteScore = Math.max(0, Math.min(100, eliteScore + bonusSum - penaltySum));

    // Tag-based modifiers
    if (actor.hasTag && actor.hasTag('[Hot_Streak]')) {
      eliteScore = Math.min(100, eliteScore + 10);
    }
    if (actor.hasTag && actor.hasTag('[Burned_Out]')) {
      eliteScore = Math.max(0, eliteScore - 10);
    }

    // Calculate success rate
    const successRate = this.getSuccessRate(eliteScore);

    // Roll for outcome (0-100)
    const roll = Math.random() * 100;

    // Determine outcome
    let outcome;
    if (roll < successRate) {
      outcome = OUTCOME.SUCCESS;
    } else {
      outcome = OUTCOME.FAILURE;
    }

    return {
      outcome,
      eliteScore,
      successRate,
      roll,
      dc
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

    // Calculate elite scores
    let actorElite = this.calculateEliteScore(actor, actorStat) + actorModifiers.reduce((sum, m) => sum + m, 0);
    let targetElite = this.calculateEliteScore(target, targetStat) + targetModifiers.reduce((sum, m) => sum + m, 0);

    // Clamp to 0-100
    actorElite = Math.max(0, Math.min(100, actorElite));
    targetElite = Math.max(0, Math.min(100, targetElite));

    // Get success rates
    const actorSuccessRate = this.getSuccessRate(actorElite);
    const targetSuccessRate = this.getSuccessRate(targetElite);

    // Roll for both
    const actorRoll = Math.random() * 100;
    const targetRoll = Math.random() * 100;

    // Roll for both
    const actorRoll = Math.random() * 100;
    const targetRoll = Math.random() * 100;

    // Compare distance into success zone (higher = better outcome)
    const actorScore = actorSuccessRate - actorRoll;
    const targetScore = targetSuccessRate - targetRoll;
    const winner = actorScore > targetScore ? 'actor' : 'target';

    return {
      winner,
      actorRoll,
      targetRoll,
      actorElite,
      targetElite,
      actorSuccessRate,
      targetSuccessRate,
      actorSuccess,
      targetSuccess
    };
  }

  /**
   * Gets a stat value from an entity
   * @private
   */
  static _getStatValue(entity, statName) {
    if (!entity || !entity.getComponent) return 10;

    // Physical stats
    const physicalStats = entity.getComponent('physicalStats');
    if (physicalStats && statName in physicalStats) {
      return physicalStats[statName];
    }

    // In-ring stats
    const inRingStats = entity.getComponent('inRingStats');
    if (inRingStats && statName in inRingStats) {
      return inRingStats[statName];
    }

    // Entertainment stats
    const entertainmentStats = entity.getComponent('entertainmentStats');
    if (entertainmentStats && statName in entertainmentStats) {
      return entertainmentStats[statName];
    }

    // Booker stats
    const bookerStats = entity.getComponent('bookerStats');
    if (bookerStats && statName in bookerStats) {
      return bookerStats[statName];
    }

    return 10;
  }
}

export default ResolutionEngine;
