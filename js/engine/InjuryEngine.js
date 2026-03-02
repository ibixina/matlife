/**
 * InjuryEngine for Mat Life: Wrestling Simulator
 * Step 1.9 of Implementation Plan
 * Injury generation, recovery, and chronic logic
 */

import { randomInt } from '../core/Utils.js';
import { gameStateManager } from '../core/GameStateManager.js';

/**
 * Body parts list from MASTER_PLAN §7.1
 */
export const BODY_PARTS = [
  'Head', 'Neck', 'Shoulder_L', 'Shoulder_R', 'Back', 'Ribs',
  'Arm_L', 'Arm_R', 'Hand_L', 'Hand_R', 'Hip',
  'Knee_L', 'Knee_R', 'Ankle_L', 'Ankle_R', 'Foot_L', 'Foot_R'
];

/**
 * Body part weights per move type
 */
export const BODY_PART_WEIGHTS = {
  aerial: {
    Knee_L: 3, Knee_R: 3, Ankle_L: 3, Ankle_R: 3,
    Back: 1, Hip: 2, Foot_L: 1, Foot_R: 1
  },
  brawling: {
    Head: 4, Ribs: 3, Hand_L: 2, Hand_R: 2,
    Neck: 1, Shoulder_L: 1, Shoulder_R: 1
  },
  grapple: {
    Neck: 3, Back: 3, Shoulder_L: 2, Shoulder_R: 2,
    Knee_L: 1, Knee_R: 1, Arm_L: 2, Arm_R: 2
  },
  submission: {
    Shoulder_L: 2, Shoulder_R: 2, Knee_L: 3, Knee_R: 3,
    Ankle_L: 2, Ankle_R: 2, Neck: 2, Back: 1
  },
  strike: {
    Head: 3, Ribs: 2, Hand_L: 1, Hand_R: 1,
    Neck: 1, Face: 2
  }
};

/**
 * Maps body parts to affected stats
 */
export const INJURY_STAT_MAP = {
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
  Ribs: ['stamina', 'resilience'],
  Hip: ['speed', 'aerial'],
  Hand_L: ['brawling'],
  Hand_R: ['brawling'],
  Foot_L: ['speed'],
  Foot_R: ['speed']
};

/**
 * Severity to recovery days mapping
 */
const SEVERITY_RECOVERY = {
  1: { min: 7, max: 14 },      // Minor
  2: { min: 21, max: 42 },     // Moderate
  3: { min: 56, max: 112 },    // Serious
  4: { min: 168, max: 336 },   // Severe
  5: { min: 365, max: 730 }    // Career-threatening
};

/**
 * InjuryEngine - Manages injury generation and recovery
 */
export class InjuryEngine {
  /**
   * Generates an injury based on move type and severity
   * @param {string} moveType - Type of move (aerial, brawling, grapple, etc.)
   * @param {number} severity - Injury severity (1-5)
   * @returns {Injury} Generated injury object
   */
  static generateInjury(moveType, severity) {
    const weights = BODY_PART_WEIGHTS[moveType] || BODY_PART_WEIGHTS.brawling;
    const bodyPart = this._weightedRandomBodyPart(weights);
    const daysRemaining = this.calculateRecovery(severity);
    
    return {
      bodyPart,
      severity,
      daysRemaining,
      chronic: false,
      dateAcquired: { ...gameStateManager.getStateRef().calendar }
    };
  }

  /**
   * Calculates recovery time based on severity
   * @param {number} severity - Injury severity (1-5)
   * @returns {number} Days to recover
   */
  static calculateRecovery(severity) {
    const range = SEVERITY_RECOVERY[severity];
    if (!range) return 14; // Default to minor
    return randomInt(range.min, range.max);
  }

  /**
   * Ticks injury recovery for an entity (called daily)
   * @param {Entity} entity - Entity to process
   * @returns {string[]} Array of healed body parts
   */
  static tickInjuries(entity) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries || condition.injuries.length === 0) {
      return [];
    }

    const healedParts = [];
    const identity = entity.getComponent('identity');
    const age = identity ? identity.age : 25;

    // Calculate recovery multiplier based on age
    let recoveryMultiplier = 1.0;
    if (age >= 35 && age <= 39) {
      recoveryMultiplier = 1.2; // +20%
    } else if (age >= 40) {
      recoveryMultiplier = 1.5; // +50%
    }

    // Check for PED usage (speeds recovery)
    const wellness = entity.getComponent('wellness');
    if (wellness && wellness.pedUsage) {
      recoveryMultiplier *= 0.7; // 30% faster
    }

    // Process each injury
    condition.injuries = condition.injuries.filter(injury => {
      // Apply recovery multiplier
      const effectiveRecovery = 1 * recoveryMultiplier;
      injury.daysRemaining -= effectiveRecovery;

      if (injury.daysRemaining <= 0) {
        healedParts.push(injury.bodyPart);
        return false; // Remove healed injury
      }
      return true; // Keep active injury
    });

    return healedParts;
  }

  /**
   * Worsens an existing injury
   * @param {Entity} entity - Entity with injury
   * @param {string} bodyPart - Body part to worsen
   * @returns {boolean} True if injury became chronic
   */
  static worsenInjury(entity, bodyPart) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries) return false;

    const injury = condition.injuries.find(i => i.bodyPart === bodyPart);
    if (!injury) return false;

    injury.severity++;

    // If severity was 4 and is now 5, make it chronic
    if (injury.severity === 5 && !injury.chronic) {
      injury.chronic = true;
      this._applyChronicPenalty(entity, bodyPart);
      return true;
    }

    // Recalculate recovery time
    injury.daysRemaining = this.calculateRecovery(injury.severity);
    return false;
  }

  /**
   * Gets stat penalties from current injuries
   * @param {Entity} entity - Entity to check
   * @returns {object} Map of stat names to penalty values
   */
  static getInjuryPenalties(entity) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries) return {};

    const penalties = {};

    for (const injury of condition.injuries) {
      const affectedStats = INJURY_STAT_MAP[injury.bodyPart] || [];
      for (const stat of affectedStats) {
        penalties[stat] = (penalties[stat] || 0) + injury.severity;
      }
    }

    return penalties;
  }

  /**
   * Checks if entity has an injury on a specific body part
   * @param {Entity} entity - Entity to check
   * @param {string} bodyPart - Body part to check
   * @returns {boolean}
   */
  static hasInjury(entity, bodyPart) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries) return false;
    return condition.injuries.some(i => i.bodyPart === bodyPart);
  }

  /**
   * Adds an injury to an entity
   * @param {Entity} entity - Entity to injure
   * @param {string} bodyPart - Body part to injure
   * @param {number} severity - Injury severity (1-5)
   * @param {string} [cause] - Cause of injury
   */
  static addInjury(entity, bodyPart, severity, cause = '') {
    const condition = entity.getComponent('condition');
    if (!condition) return;

    if (!condition.injuries) {
      condition.injuries = [];
    }

    const injury = {
      bodyPart,
      severity,
      daysRemaining: this.calculateRecovery(severity),
      chronic: false,
      cause,
      dateAcquired: { ...gameStateManager.getStateRef().calendar }
    };

    condition.injuries.push(injury);
  }

  /**
   * Gets a weighted random body part
   * @private
   * @param {object} weights - Body part weights
   * @returns {string} Selected body part
   */
  static _weightedRandomBodyPart(weights) {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (const [bodyPart, weight] of entries) {
      random -= weight;
      if (random <= 0) {
        return bodyPart;
      }
    }
    
    return entries[entries.length - 1][0];
  }

  /**
   * Applies permanent stat penalty for chronic injury
   * @private
   * @param {Entity} entity - Entity to penalize
   * @param {string} bodyPart - Injured body part
   */
  static _applyChronicPenalty(entity, bodyPart) {
    const affectedStats = INJURY_STAT_MAP[bodyPart] || [];
    
    for (const statName of affectedStats) {
      // Determine which component contains this stat
      if (['strength', 'resilience', 'speed'].includes(statName)) {
        const physicalStats = entity.getComponent('physicalStats');
        if (physicalStats && physicalStats[statName] > 5) {
          physicalStats[statName]--;
        }
      } else if (['brawling', 'technical', 'aerial', 'psychology'].includes(statName)) {
        const inRingStats = entity.getComponent('inRingStats');
        if (inRingStats && inRingStats[statName] > 5) {
          inRingStats[statName]--;
        }
      }
    }
  }
}

/**
 * @typedef {object} Injury
 * @property {string} bodyPart - Injured body part
 * @property {number} severity - Severity (1-5)
 * @property {number} daysRemaining - Days until healed
 * @property {boolean} chronic - Whether injury is chronic/permanent
 * @property {string} [cause] - Cause of injury
 * @property {object} dateAcquired - When injury occurred
 */

export default InjuryEngine;
