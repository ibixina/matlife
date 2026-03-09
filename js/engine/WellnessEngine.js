/**
 * WellnessEngine for Mat Life: Wrestling Simulator
 * Step 4.6 of Implementation Plan
 * PED usage and wellness policy system
 */

import { gameStateManager } from '../core/GameStateManager.js';
import ResolutionEngine from './ResolutionEngine.js';
import { randomInt, clamp } from '../core/Utils.js';
import DynamicFeudSystem from './DynamicFeudSystem.js';

/**
 * WellnessEngine - Manages PED usage and drug testing
 */
export class WellnessEngine {
  /**
   * Toggles PED usage
   * @param {Entity} entity - Wrestler entity
   * @param {boolean} use - Whether to use PEDs
   */
  static togglePEDUse(entity, use) {
    const wellness = entity.getComponent('wellness');
    if (!wellness) return { error: 'No wellness component' };

    if (use && !wellness.pedUsage) {
      // Start using
      wellness.pedUsage = true;
      wellness.pedDetectionRisk = 5;
      
      // Apply initial stat boosts
      const physicalStats = entity.getComponent('physicalStats');
      if (physicalStats) {
        physicalStats.strength += 3;
        physicalStats.stamina += 2;
      }

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: 'Started using performance enhancing substances...',
          type: 'ped',
          secret: true
        }
      });

      return {
        success: true,
        started: true,
        statBoosts: { strength: 3, stamina: 2 }
      };
    } else if (!use && wellness.pedUsage) {
      // Stop using
      wellness.pedUsage = false;
      
      // Stat penalties for coming off
      const physicalStats = entity.getComponent('physicalStats');
      if (physicalStats) {
        physicalStats.strength = Math.max(5, physicalStats.strength - 3);
        physicalStats.stamina = Math.max(5, physicalStats.stamina - 2);
      }

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: 'Stopped using PEDs. Feeling withdrawal effects...',
          type: 'ped'
        }
      });

      return {
        success: true,
        stopped: true
      };
    }

    return { error: 'No change needed' };
  }

  /**
   * Processes weekly PED effects
   * @param {Entity} entity - Wrestler entity
   */
  static processWeekly(entity) {
    const wellness = entity.getComponent('wellness');
    if (!wellness || !wellness.pedUsage) return;

    // Increase detection risk
    wellness.pedDetectionRisk = Math.min(100, wellness.pedDetectionRisk + 5);

    // Faster injury recovery
    const condition = entity.getComponent('condition');
    if (condition && condition.injuries) {
      condition.injuries.forEach(injury => {
        injury.daysRemaining = Math.max(0, injury.daysRemaining - 2);
      });
    }

    // Random side effects at high detection risk
    if (wellness.pedDetectionRisk > 70 && randomInt(1, 20) === 1) {
      this.triggerSideEffect(entity);
    }
  }

  /**
   * Triggers a side effect from PED usage
   * @private
   */
  static triggerSideEffect(entity) {
    const condition = entity.getComponent('condition');
    const identity = entity.getComponent('identity');
    
    if (!condition) return;

    const effects = [
      { type: 'health', value: -5, text: 'Experiencing health complications from substance use.' },
      { type: 'mental', value: -10, text: 'Mood swings and aggression affecting mental health.' },
      { type: 'injury', severity: 1, text: 'Joint pain making it harder to perform.' }
    ];

    const effect = effects[randomInt(0, effects.length - 1)];

    if (effect.type === 'health') {
      condition.health = Math.max(0, condition.health + effect.value);
    } else if (effect.type === 'mental') {
      condition.mentalHealth = Math.max(0, condition.mentalHealth + effect.value);
    }

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'injury',
        text: `${identity.name}: ${effect.text}`,
        type: 'ped-side-effect'
      }
    });
  }

  /**
   * Administers a wellness test
   * @param {Entity} entity - Wrestler entity
   * @param {object} promotion - Promotion administering the test
   * @returns {object} Test result
   */
  static administerTest(entity, promotion) {
    const wellness = entity.getComponent('wellness');
    if (!wellness) return { error: 'No wellness component' };

    // Check if promotion has wellness policy
    if (!promotion?.wellnessPolicy?.enabled) {
      return { tested: false, reason: 'No wellness policy' };
    }

    // If not using PEDs, pass automatically
    if (!wellness.pedUsage) {
      return {
        tested: true,
        passed: true,
        result: 'clean'
      };
    }

    // Resolution check
    const resolution = ResolutionEngine.resolve({
      actor: entity,
      action: 'Wellness Test',
      stat: 'psychology',
      dc: 15,
      context: {
        penalties: [Math.floor(wellness.pedDetectionRisk / 10)]
      }
    });

    const passed = resolution.outcome === 'SUCCESS' || resolution.outcome === 'CRITICAL_SUCCESS';

    if (!passed) {
      wellness.wellnessStrikes++;
      
      const consequence = this.applyStrikeConsequences(entity, wellness.wellnessStrikes, promotion);
      
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: `FAILED wellness test! Strike ${wellness.wellnessStrikes}/3. ${consequence.text}`,
          type: 'wellness-failure'
        }
      });

      // Remove stat boosts
      this.removePEDBoosts(entity);
      wellness.pedUsage = false;
      wellness.pedDetectionRisk = 0;

      return {
        tested: true,
        passed: false,
        strikes: wellness.wellnessStrikes,
        consequence
      };
    }

    return {
      tested: true,
      passed: true,
      closeCall: wellness.pedDetectionRisk > 50
    };
  }

  /**
   * Applies consequences for wellness strikes
   * @private
   */
  static applyStrikeConsequences(entity, strikes, promotion) {
    const contract = entity.getComponent('contract');
    
    switch (strikes) {
      case 1:
        return {
          text: '30-day suspension and warning.',
          suspension: 30,
          fine: 0
        };
        
      case 2:
        // Fine and longer suspension
        if (contract) {
          contract.weeklySalary = Math.floor(contract.weeklySalary * 0.9);
        }
        return {
          text: '60-day suspension and 10% pay cut.',
          suspension: 60,
          fine: 10
        };
        
      case 3:
        // Termination
        if (contract && promotion) {
          promotion.roster = promotion.roster.filter(id => id !== entity.id);
          contract.promotionId = null;
          contract.weeklySalary = 0;
          DynamicFeudSystem.endAllFeudsForEntity(
            entity.id,
            "Contract terminated",
          );
        }
        entity.addTag('[Released]');
        return {
          text: 'CONTRACT TERMINATED.',
          suspension: 0,
          fine: 100,
          terminated: true
        };
        
      default:
        return { text: 'Disciplinary action taken.' };
    }
  }

  /**
   * Removes PED stat boosts
   * @private
   */
  static removePEDBoosts(entity) {
    const physicalStats = entity.getComponent('physicalStats');
    if (physicalStats) {
      physicalStats.strength = Math.max(5, physicalStats.strength - 3);
      physicalStats.stamina = Math.max(5, physicalStats.stamina - 2);
    }
  }

  /**
   * Random wellness test trigger
   * Called weekly for promotions with wellness policies
   * @param {Entity} entity - Wrestler entity
   * @param {object} promotion - Promotion
   */
  static randomTest(entity, promotion) {
    if (!promotion?.wellnessPolicy?.enabled) return null;

    // Higher chance if using PEDs
    const wellness = entity.getComponent('wellness');
    let testChance = promotion.wellnessPolicy.testFrequency || 5;
    
    if (wellness?.pedUsage) {
      testChance += wellness.pedDetectionRisk * 0.5;
    }

    if (randomInt(1, 100) <= testChance) {
      return this.administerTest(entity, promotion);
    }

    return null;
  }

  /**
   * Gets wellness summary
   * @param {Entity} entity - Wrestler entity
   * @returns {object} Summary
   */
  static getSummary(entity) {
    const wellness = entity.getComponent('wellness');
    if (!wellness) return null;

    return {
      pedUsage: wellness.pedUsage,
      detectionRisk: wellness.pedDetectionRisk,
      strikes: wellness.wellnessStrikes,
      atRisk: wellness.wellnessStrikes >= 2,
      status: wellness.wellnessStrikes === 3 ? 'TERMINATED' : 
               wellness.wellnessStrikes === 2 ? 'FINAL WARNING' :
               wellness.wellnessStrikes === 1 ? 'WARNING' : 'CLEAN'
    };
  }

  /**
   * Reports PED usage (whistleblower)
   * @param {Entity} reporter - Entity reporting
   * @param {Entity} target - Entity being reported
   * @param {object} promotion - Promotion
   */
  static reportPEDUse(reporter, target, promotion) {
    const targetWellness = target.getComponent('wellness');
    
    if (!targetWellness || !targetWellness.pedUsage) {
      // False report
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: 'False report of PED usage. Heat gained with target.',
          type: 'backstage'
        }
      });
      return { success: false, falseReport: true };
    }

    // Force test on target
    const result = this.administerTest(target, promotion);
    
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `${reporter.getComponent('identity').name} reported suspected PED usage.`,
        type: 'backstage'
      }
    });

    return result;
  }
}

export default WellnessEngine;
