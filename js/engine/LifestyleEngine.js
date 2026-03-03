/**
 * LifestyleEngine for Mat Life: Wrestling Simulator
 * Step 4.5 of Implementation Plan
 * Lifestyle, burnout, and mental health processing
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { clamp, randomInt } from '../core/Utils.js';

/**
 * LifestyleEngine - Manages wrestler lifestyle and burnout
 */
export class LifestyleEngine {
  /**
   * Processes weekly lifestyle updates
   * @param {Entity} entity - Wrestler entity
   */
  static processWeekly(entity) {
    const lifestyle = entity.getComponent('lifestyle');
    const condition = entity.getComponent('condition');
    const financial = entity.getComponent('financial');
    const careerStats = entity.getComponent('careerStats');

    if (!lifestyle || !condition) return;

    // Calculate burnout delta
    let burnoutDelta = 0;

    // Work rate impact
    const matchesPerWeek = careerStats?.matchesThisWeek || 0;
    if (matchesPerWeek > 3) {
      burnoutDelta += (matchesPerWeek - 3) * 5;
    }

    // Travel fatigue impact
    burnoutDelta += lifestyle.travelFatigue * 0.1;

    // Mental health impact
    if (condition.mentalHealth < 50) {
      burnoutDelta += 3;
    }

    // Financial stress impact
    if (financial?.bankBalance < 500) {
      burnoutDelta += 5;
    }

    // Side hustles impact
    if (lifestyle.sideHustles && lifestyle.sideHustles.length > 0) {
      burnoutDelta += lifestyle.sideHustles.length * 2;
    }

    // Recovery factors
    // Natural burnout decay over time (base recovery)
    burnoutDelta -= 3;

    // Rest days help recovery
    if (matchesPerWeek === 0) {
      burnoutDelta -= 5;
    }

    // High family morale helps
    if (lifestyle.familyMorale > 70) {
      burnoutDelta -= 2;
    }

    // Apply burnout change
    lifestyle.burnout = clamp(lifestyle.burnout + burnoutDelta, 0, 100);

    // Update tags based on burnout level
    this.updateBurnoutTags(entity);

    // Check for breakdown
    if (lifestyle.burnout >= 90) {
      this.triggerBreakdown(entity);
    }

    // Reset weekly counters
    lifestyle.workRate = 0;

    // Decay travel fatigue
    lifestyle.travelFatigue = Math.max(0, lifestyle.travelFatigue - 10);

    // Process side hustles income
    if (lifestyle.sideHustles) {
      lifestyle.sideHustles.forEach(hustle => {
        if (financial) {
          financial.bankBalance += hustle.income || 0;
        }
      });
    }
  }

  /**
   * Updates burnout-related tags
   * @private
   */
  static updateBurnoutTags(entity) {
    const lifestyle = entity.getComponent('lifestyle');
    if (!lifestyle) return;

    // Burned_Out tag
    if (lifestyle.burnout >= 80) {
      if (!entity.hasTag('[Burned_Out]')) {
        entity.addTag('[Burned_Out]');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: 'Warning: You are showing signs of severe burnout. Consider taking time off.',
            type: 'warning'
          }
        });
      }
    } else if (lifestyle.burnout < 50 && entity.hasTag('[Burned_Out]')) {
      entity.removeTag('[Burned_Out]');
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: 'You are feeling refreshed and recovered.',
          type: 'recovery'
        }
      });
    }
  }

  /**
   * Triggers a breakdown event
   * @private
   */
  static triggerBreakdown(entity) {
    const identity = entity.getComponent('identity');
    const condition = entity.getComponent('condition');
    const lifestyle = entity.getComponent('lifestyle');

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `${identity.name} has suffered a breakdown from exhaustion! Forced time off required.`,
        type: 'breakdown'
      }
    });

    // Apply penalties
    if (condition) {
      condition.mentalHealth -= 20;
    }

    // Force rest
    lifestyle.burnout = 50;

    // Add forced vacation effect
    entity.addTag('[On_Vacation]');
  }

  /**
   * Takes a vacation
   * @param {Entity} entity - Wrestler entity
   * @param {number} weeks - Vacation length
   */
  static takeVacation(entity, weeks = 1) {
    const lifestyle = entity.getComponent('lifestyle');
    const condition = entity.getComponent('condition');
    const financial = entity.getComponent('financial');

    if (!lifestyle) return { error: 'No lifestyle component' };

    // Cost
    const cost = weeks * 500;
    if (financial && financial.bankBalance < cost) {
      return { error: 'Cannot afford vacation' };
    }

    // Deduct cost
    if (financial) {
      financial.bankBalance -= cost;
    }

    // Apply benefits
    lifestyle.burnout = Math.max(0, lifestyle.burnout - (weeks * 20));
    if (condition) {
      condition.mentalHealth = Math.min(100, condition.mentalHealth + (weeks * 15));
      condition.health = Math.min(100, condition.health + (weeks * 10));
      condition.energy = Math.min(100, condition.energy + (weeks * 15));
    }

    // Add tag
    entity.addTag('[Vacation]');

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `Took a ${weeks}-week vacation. Feeling refreshed!`,
        type: 'vacation'
      }
    });

    return {
      success: true,
      cost,
      burnoutReduction: weeks * 20,
      weeks
    };
  }

  /**
   * Sees a therapist
   * @param {Entity} entity - Wrestler entity
   */
  static seeTherapist(entity) {
    const condition = entity.getComponent('condition');
    const financial = entity.getComponent('financial');

    if (!condition) return { error: 'No condition component' };

    const cost = 100;
    if (financial && financial.bankBalance < cost) {
      return { error: 'Cannot afford therapy' };
    }

    if (financial) {
      financial.bankBalance -= cost;
    }

    // Apply mental health improvement
    const improvement = randomInt(5, 15);
    condition.mentalHealth = Math.min(100, condition.mentalHealth + improvement);

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `Therapy session helped. Mental health improved by ${improvement}.`,
        type: 'therapy'
      }
    });

    return {
      success: true,
      cost,
      improvement
    };
  }

  /**
   * Adds travel fatigue
   * @param {Entity} entity - Wrestler entity
   * @param {string} fromRegion - Starting region
   * @param {string} toRegion - Destination region
   */
  static addTravelFatigue(entity, fromRegion, toRegion) {
    const lifestyle = entity.getComponent('lifestyle');
    if (!lifestyle) return;

    let fatigue = 0;

    if (fromRegion === toRegion) {
      fatigue = 2; // Same city
    } else if (this.isSameCountry(fromRegion, toRegion)) {
      fatigue = 15; // Cross-country
    } else {
      fatigue = 25; // International
    }

    lifestyle.travelFatigue = Math.min(100, lifestyle.travelFatigue + fatigue);
  }

  /**
   * Checks if regions are same country
   * @private
   */
  static isSameCountry(region1, region2) {
    const usRegions = ['USA', 'East Coast', 'West Coast', 'Midwest', 'South'];
    return usRegions.includes(region1) && usRegions.includes(region2);
  }

  /**
   * Gets lifestyle summary
   * @param {Entity} entity - Wrestler entity
   * @returns {object} Summary
   */
  static getSummary(entity) {
    const lifestyle = entity.getComponent('lifestyle');
    const condition = entity.getComponent('condition');

    if (!lifestyle) return null;

    return {
      burnout: lifestyle.burnout,
      burnoutLevel: this.getBurnoutLevel(lifestyle.burnout),
      mentalHealth: condition?.mentalHealth || 75,
      travelFatigue: lifestyle.travelFatigue,
      familyMorale: lifestyle.familyMorale,
      sideHustles: lifestyle.sideHustles || [],
      needsRest: lifestyle.burnout > 70,
      isBurnedOut: lifestyle.burnout >= 80
    };
  }

  /**
   * Gets burnout level description
   * @private
   */
  static getBurnoutLevel(burnout) {
    if (burnout >= 90) return 'CRITICAL';
    if (burnout >= 80) return 'SEVERE';
    if (burnout >= 60) return 'HIGH';
    if (burnout >= 40) return 'MODERATE';
    if (burnout >= 20) return 'LOW';
    return 'MINIMAL';
  }
}

export default LifestyleEngine;
