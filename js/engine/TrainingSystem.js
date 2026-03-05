/**
 * TrainingSystem for Mat Life: Wrestling Simulator
 * Phase 1.1 - Training System
 * Handles training sessions with stat gains, diminishing returns, injury risk, and burnout
 */

import { gameStateManager } from '../core/GameStateManager.js';
import InjuryEngine from './InjuryEngine.js';
import { randomInt, rollD20 } from '../core/Utils.js';

/**
 * Training categories and their affected stats
 */
const TRAINING_CATEGORIES = {
  gym: {
    name: 'Gym Training',
    description: 'Strength and conditioning work',
    stats: [
      { component: 'physicalStats', stat: 'strength', baseGain: 10.0 },
      { component: 'physicalStats', stat: 'resilience', baseGain: 10.0 }
    ],
    injuryRisk: 0.02,
    burnoutCost: 3,
    staminaCost: 10
  },
  ring: {
    name: 'Ring Practice',
    description: 'Technical in-ring work',
    stats: [
      { component: 'inRingStats', stat: 'technical', baseGain: 10.0 },
      { component: 'inRingStats', stat: 'selling', baseGain: 6.0 }
    ],
    injuryRisk: 0.04,
    burnoutCost: 4,
    staminaCost: 15
  },
  promo: {
    name: 'Promo Practice',
    description: 'Microphone and character work',
    stats: [
      { component: 'entertainmentStats', stat: 'charisma', baseGain: 10.0 },
      { component: 'entertainmentStats', stat: 'micSkills', baseGain: 10.0 }
    ],
    injuryRisk: 0,
    burnoutCost: 2,
    staminaCost: 5
  },
  sparring: {
    name: 'Sparring Session',
    description: 'Brawling and psychology practice',
    stats: [
      { component: 'inRingStats', stat: 'brawling', baseGain: 10.0 },
      { component: 'inRingStats', stat: 'psychology', baseGain: 8.0 }
    ],
    injuryRisk: 0.06,
    burnoutCost: 5,
    staminaCost: 20
  },
  aerial: {
    name: 'Aerial Drills',
    description: 'High-flying technique practice',
    stats: [
      { component: 'inRingStats', stat: 'aerial', baseGain: 12 },
      { component: 'physicalStats', stat: 'speed', baseGain: 6 }
    ],
    injuryRisk: 0.05,
    burnoutCost: 4,
    staminaCost: 18
  }
};

/**
 * Maximum training sessions per week before penalties
 */
const MAX_WEEKLY_SESSIONS = 5;

/**
 * Penalty for exceeding weekly training cap
 */
const OVERTRAINING_PENALTY = {
  burnoutIncrease: 10,
  injuryRiskMultiplier: 2.0,
  statGainReduction: 0.75
};

/**
 * TrainingSystem - Manages training mechanics
 */
export class TrainingSystem {
  /**
   * Performs a training session
   * @param {Entity} entity - Entity training
   * @param {string} category - Training category ('gym', 'ring', 'promo', 'sparring', 'aerial')
   * @param {boolean} [highIntensity] - Whether to train at high intensity
   * @returns {TrainingResult} Training result
   */
  static train(entity, category, highIntensity = false) {
    const config = TRAINING_CATEGORIES[category];
    if (!config) {
      return { error: `Unknown training category: ${category}` };
    }

    // Check if entity has required components
    const condition = entity.getComponent('condition');
    const physicalStats = entity.getComponent('physicalStats');
    const lifestyle = entity.getComponent('lifestyle');

    if (!condition || !physicalStats) {
      return { error: 'Entity missing required components' };
    }

    // Check for active injuries that prevent training
    if (condition.injuries && condition.injuries.length > 0) {
      const seriousInjuries = condition.injuries.filter(i => i.severity >= 3);
      if (seriousInjuries.length > 0) {
        return {
          error: `Cannot train with serious injuries: ${seriousInjuries.map(i => i.bodyPart).join(', ')}`,
          blocked: true
        };
      }
    }

    // Check stamina
    const staminaCost = highIntensity ? config.staminaCost * 1.5 : config.staminaCost;
    if (physicalStats.stamina < staminaCost) {
      return {
        error: `Not enough stamina. Need ${staminaCost}, have ${physicalStats.stamina}`,
        blocked: true
      };
    }

    // Get weekly session count
    const weeklyStats = entity.getComponent('weeklyStats') || { trainingSessions: 0 };
    const sessionCount = weeklyStats.trainingSessions || 0;
    const isOvertraining = sessionCount >= MAX_WEEKLY_SESSIONS;

    // Check for trainer bonus
    const hasTrainer = entity.hasTag('[Has_Trainer]');
    const trainerBonus = hasTrainer ? 1.0 : 0;

    // Calculate stat gains
    const gains = [];
    for (const statConfig of config.stats) {
      const component = entity.getComponent(statConfig.component);
      if (!component) continue;

      const currentValue = component[statConfig.stat] || 10;

      // Diminishing returns formula: harder to gain at higher values (cap at 100)
      const diminishingFactor = Math.max(0.1, (100 - currentValue) / 100);

      // Base gain with randomization
      let baseGain = statConfig.baseGain + (Math.random() * 1.0);

      // Apply diminishing returns
      let actualGain = baseGain * diminishingFactor;

      // Apply trainer bonus
      actualGain += trainerBonus * diminishingFactor;

      // Apply overtraining penalty
      if (isOvertraining) {
        actualGain *= OVERTRAINING_PENALTY.statGainReduction;
      }

      // High intensity gives 100% more gain but costs more
      if (highIntensity) {
        actualGain *= 2.0;
      }

      // Round to nearest 0.1
      actualGain = Math.round(actualGain * 10) / 10;

      if (actualGain > 0) {
        const newValue = Math.min(100, currentValue + actualGain);
        const realGain = Math.round((newValue - currentValue) * 10) / 10;
        component[statConfig.stat] = newValue;
        gains.push({
          stat: statConfig.stat,
          gain: realGain,
          newValue: newValue
        });
      }
    }

    // Consume stamina
    physicalStats.stamina = Math.max(0, physicalStats.stamina - staminaCost);

    // Calculate burnout cost
    let burnoutCost = highIntensity ? config.burnoutCost + 1 : config.burnoutCost;
    if (isOvertraining) {
      burnoutCost += OVERTRAINING_PENALTY.burnoutIncrease;
    }

    if (lifestyle) {
      lifestyle.burnout = Math.min(100, (lifestyle.burnout || 0) + burnoutCost);
    }

    // Check for injury
    let injury = null;
    let injuryRisk = config.injuryRisk;
    if (isOvertraining) {
      injuryRisk *= OVERTRAINING_PENALTY.injuryRiskMultiplier;
    }

    if (Math.random() < injuryRisk) {
      const severity = randomInt(1, 3);
      const bodyParts = ['head', 'neck', 'shoulder', 'arm', 'back', 'knee', 'leg'];
      const bodyPart = bodyParts[randomInt(0, bodyParts.length - 1)];

      injury = {
        bodyPart,
        severity,
        daysRemaining: severity * 7
      };

      InjuryEngine.addInjury(entity, bodyPart, severity, `Training injury during ${config.name}`);
    }

    // Update weekly stats
    if (!entity.getComponent('weeklyStats')) {
      entity.addComponent('weeklyStats', { trainingSessions: 0, matchesWrestled: 0 });
    }
    entity.getComponent('weeklyStats').trainingSessions = sessionCount + 1;

    // Log the training
    const identity = entity.getComponent('identity');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `${identity?.name || 'Wrestler'} completed ${config.name}${highIntensity ? ' (High Intensity)' : ''}. ` +
          `${gains.map(g => `${g.stat} +${g.gain.toFixed(1)}`).join(', ')}. ` +
          `Burnout +${burnoutCost}${isOvertraining ? ' (Overtraining!)' : ''}${injury ? ` INJURY: ${injury.bodyPart}!` : ''}`,
        type: 'training',
        gains,
        burnoutCost,
        injury
      }
    });

    return {
      success: true,
      category: config.name,
      gains,
      burnoutCost,
      staminaCost,
      injury,
      isOvertraining,
      sessionCount: sessionCount + 1,
      narrative: this.generateTrainingNarrative(config.name, gains, injury, isOvertraining)
    };
  }

  /**
   * Gets available training categories
   * @returns {object[]} Array of training categories
   */
  static getTrainingCategories() {
    return Object.entries(TRAINING_CATEGORIES).map(([key, config]) => ({
      key,
      name: config.name,
      description: config.description,
      stats: config.stats.map(s => s.stat),
      injuryRisk: config.injuryRisk,
      burnoutCost: config.burnoutCost,
      staminaCost: config.staminaCost
    }));
  }

  /**
   * Gets training summary for an entity
   * @param {Entity} entity - Entity to check
   * @returns {object} Training summary
   */
  static getTrainingSummary(entity) {
    const weeklyStats = entity.getComponent('weeklyStats') || { trainingSessions: 0 };
    const lifestyle = entity.getComponent('lifestyle');
    const condition = entity.getComponent('condition');
    const physicalStats = entity.getComponent('physicalStats');

    const sessionsThisWeek = weeklyStats.trainingSessions || 0;
    const remainingSessions = Math.max(0, MAX_WEEKLY_SESSIONS - sessionsThisWeek);

    return {
      sessionsThisWeek,
      maxSessions: MAX_WEEKLY_SESSIONS,
      remainingSessions,
      canTrain: remainingSessions > 0,
      overtraining: sessionsThisWeek >= MAX_WEEKLY_SESSIONS,
      burnout: lifestyle?.burnout || 0,
      stamina: physicalStats?.stamina || 0,
      hasTrainer: entity.hasTag('[Has_Trainer]')
    };
  }

  /**
   * Resets weekly training counter (called at start of new week)
   * @param {Entity} entity - Entity to reset
   */
  static resetWeeklyCounter(entity) {
    const weeklyStats = entity.getComponent('weeklyStats');
    if (weeklyStats) {
      weeklyStats.trainingSessions = 0;
      weeklyStats.matchesWrestled = 0;
    }
  }

  /**
   * Generates a narrative for training
   * @private
   */
  static generateTrainingNarrative(categoryName, gains, injury, isOvertraining) {
    const templates = {
      success: [
        `You put in solid work during ${categoryName}. The gains are showing.`,
        `A productive ${categoryName} session. You're improving every day.`,
        `${categoryName} went well today. Hard work pays off.`
      ],
      overtraining: [
        `You pushed too hard today. Your body is screaming for rest.`,
        `${categoryName} was tough - you're feeling the overtraining effects.`,
        `Training through fatigue. Be careful not to burn out.`
      ],
      injury: [
        `Training was going well until... Ouch! That's gonna hurt.`,
        `A painful mishap during ${categoryName}. You'll need to heal up.`,
        `${categoryName} ended early with an injury. Time to recover.`
      ]
    };

    if (injury) {
      return templates.injury[Math.floor(Math.random() * templates.injury.length)];
    } else if (isOvertraining) {
      return templates.overtraining[Math.floor(Math.random() * templates.overtraining.length)];
    } else {
      return templates.success[Math.floor(Math.random() * templates.success.length)];
    }
  }
}

/**
 * @typedef {object} TrainingResult
 * @property {boolean} success - Whether training succeeded
 * @property {string} [error] - Error message if failed
 * @property {string} [category] - Training category name
 * @property {object[]} [gains] - Array of stat gains
 * @property {number} [burnoutCost] - Burnout increase
 * @property {number} [staminaCost] - Stamina consumed
 * @property {object} [injury] - Injury info if injured
 * @property {boolean} [isOvertraining] - Whether overtraining penalty applied
 * @property {number} [sessionCount] - Current week's session count
 * @property {string} [narrative] - Flavor text
 */

export default TrainingSystem;
