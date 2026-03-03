/**
 * AgingEngine for Mat Life: Wrestling Simulator
 * Phase 3.5 - Aging & Career Decline
 * Handles age-related stat decline and retirement
 */

import { gameStateManager } from '../core/GameStateManager.js';

const AGE_THRESHOLDS = {
  prime: { min: 20, max: 35 },
  decline: { min: 36, max: 42 },
  veteran: { min: 43, max: 50 }
};

export class AgingEngine {
  static processAging(entity) {
    const identity = entity.getComponent('identity');
    if (!identity || !identity.age) return null;

    const age = identity.age;
    const effects = this.calculateAgeEffects(age);
    
    if (effects.decline.length > 0) {
      this.applyDecline(entity, effects);
      
      if (age % 5 === 0) {
        const identity = entity.getComponent('identity');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `🎂 ${identity?.name} turned ${age}. ${effects.message}`,
            type: 'birthday'
          }
        });
      }
    }

    return effects;
  }

  static calculateAgeEffects(age) {
    const decline = [];
    let message = '';

    if (age >= 30 && age <= 35) {
      // Prime - no penalties
      message = 'In your prime!';
    } else if (age >= 36 && age <= 38) {
      // Early decline
      decline.push({ stat: 'speed', amount: -1 });
      message = 'Slight decline in speed.';
    } else if (age >= 39 && age <= 42) {
      // Mid decline
      decline.push({ stat: 'speed', amount: -1 });
      decline.push({ stat: 'stamina', amount: -2 });
      decline.push({ stat: 'aerial', amount: -1 });
      message = 'Physical decline becoming noticeable.';
    } else if (age >= 43) {
      // Veteran decline
      decline.push({ stat: 'speed', amount: -1 });
      decline.push({ stat: 'stamina', amount: -2 });
      decline.push({ stat: 'aerial', amount: -2 });
      decline.push({ stat: 'resilience', amount: -1 });
      message = 'Significant physical decline. Consider retirement?';
    }

    return { decline, message };
  }

  static applyDecline(entity, effects) {
    const physicalStats = entity.getComponent('physicalStats');
    const inRingStats = entity.getComponent('inRingStats');
    const condition = entity.getComponent('condition');

    for (const { stat, amount } of effects.decline) {
      if (stat === 'speed' && physicalStats) {
        physicalStats.speed = Math.max(1, physicalStats.speed + amount);
      } else if (stat === 'stamina' && condition) {
        condition.maxStamina = Math.max(50, (condition.maxStamina || 100) + amount);
      } else if (stat === 'aerial' && inRingStats) {
        inRingStats.aerial = Math.max(1, inRingStats.aerial + amount);
      } else if (stat === 'resilience' && physicalStats) {
        physicalStats.resilience = Math.max(1, physicalStats.resilience + amount);
      }
    }
  }

  static increaseInjuryRisk(entity) {
    const identity = entity.getComponent('identity');
    if (!identity || !identity.age) return 0;

    const age = identity.age;
    let riskMultiplier = 1.0;

    if (age >= 35 && age <= 38) {
      riskMultiplier = 1.1;
    } else if (age >= 39 && age <= 42) {
      riskMultiplier = 1.25;
    } else if (age >= 43) {
      riskMultiplier = 1.5;
    }

    return riskMultiplier;
  }

  static checkRetirement(entity) {
    const identity = entity.getComponent('identity');
    const condition = entity.getComponent('condition');
    const careerStats = entity.getComponent('careerStats');

    if (!identity || !identity.age) return { shouldRetire: false };

    const age = identity.age;
    
    // Auto-suggest retirement at 45+
    if (age >= 45) {
      return {
        shouldRetire: true,
        reason: 'Age 45+ - Time to consider retirement',
        options: ['full_retirement', 'part_time', 'legends_contract']
      };
    }

    // Suggest if many serious injuries
    if (condition?.injuries?.length > 3) {
      return {
        shouldRetire: true,
        reason: 'Multiple serious injuries',
        options: ['full_retirement', 'part_time']
      };
    }

    return { shouldRetire: false };
  }

  static ageOneYear() {
    const state = gameStateManager.getStateRef();
    
    for (const entity of state.entities.values()) {
      const identity = entity.getComponent('identity');
      if (identity && identity.age) {
        identity.age++;
        this.processAging(entity);
      }
    }
  }
}

export default AgingEngine;
