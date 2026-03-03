/**
 * TagEngine for Mat Life: Wrestling Simulator
 * Step 1.8 of Implementation Plan
 * Auto-applies and removes tags based on entity state
 */

import { gameStateManager } from '../core/GameStateManager.js';
import RelationshipManager from './RelationshipManager.js';

/**
 * Tag rules from MASTER_PLAN §10.1
 */
const TAG_RULES = [
  {
    tag: 'Champion',
    condition: (entity, state) => {
      // Check if entity holds any title
      for (const championship of state.championships.values()) {
        if (championship.currentChampion === entity.id) {
          return true;
        }
      }
      return false;
    }
  },
  {
    tag: 'Hot_Streak',
    condition: (entity) => {
      const careerStats = entity.getComponent('careerStats');
      return careerStats && careerStats.consecutiveWins >= 5;
    }
  },
  {
    tag: 'Cold',
    condition: (entity, state) => {
      // Check if no match/promo in 3+ weeks
      // This would need to be tracked in careerStats or elsewhere
      const careerStats = entity.getComponent('careerStats');
      if (!careerStats) return false;
      // For now, assume if matchesThisWeek is 0 for multiple weeks
      return careerStats.matchesThisWeek === 0 && careerStats.weeksSinceLastMatch >= 3;
    }
  },
  {
    tag: 'Contract_Expiring',
    condition: (entity) => {
      const contract = entity.getComponent('contract');
      return contract && contract.remainingWeeks > 0 && contract.remainingWeeks <= 8;
    }
  },
  {
    tag: 'Veteran',
    condition: (entity) => {
      const careerStats = entity.getComponent('careerStats');
      return careerStats && careerStats.yearsActive >= 10;
    }
  },
  {
    tag: 'Rookie',
    condition: (entity) => {
      const careerStats = entity.getComponent('careerStats');
      return careerStats && careerStats.yearsActive < 2;
    }
  },
  {
    tag: 'Over',
    condition: (entity) => {
      const popularity = entity.getComponent('popularity');
      return popularity && popularity.overness >= 70;
    }
  },
  {
    tag: 'Heat_Magnet',
    condition: (entity, state) => {
      // Check for 3+ feuds in last 6 months
      let recentFeuds = 0;
      const calendar = state.calendar;
      
      for (const feud of state.feuds.values()) {
        if (feud.participants && feud.participants.includes(entity.id)) {
          // Check if feud started in last 6 months
          const feudAge = (calendar.year - feud.startYear) * 12 + 
                          (calendar.month - feud.startMonth);
          if (feudAge <= 6) {
            recentFeuds++;
          }
        }
      }
      
      return recentFeuds >= 3;
    }
  },
  {
    tag: 'Dangerous_Worker',
    condition: (entity) => {
      const careerStats = entity.getComponent('careerStats');
      return careerStats && careerStats.injuriesCausedCount >= 3;
    }
  },
  {
    tag: 'Burned_Out',
    condition: (entity) => {
      const lifestyle = entity.getComponent('lifestyle');
      return lifestyle && lifestyle.burnout >= 80;
    }
  },
  {
    tag: 'Financial_Trouble',
    condition: (entity) => {
      const financial = entity.getComponent('financial');
      return financial && financial.bankBalance < 500;
    }
  },
  {
    tag: 'Substance_Issues',
    condition: (entity) => {
      const wellness = entity.getComponent('wellness');
      return wellness && wellness.pedUsage && wellness.wellnessStrikes >= 2;
    }
  },
  {
    tag: 'Scandal',
    condition: (entity) => {
      // This would be set by social media events
      // For now, check if scandal tag exists (set elsewhere)
      return entity.hasTag && entity.hasTag('[Scandal]');
    }
  }
];

/**
 * Perk unlock conditions from MASTER_PLAN §2.5
 */
const PERK_RULES = [
  {
    tag: 'Ring_General',
    condition: (entity) => {
      const inRingStats = entity.getComponent('inRingStats');
      const careerStats = entity.getComponent('careerStats');
      return inRingStats && careerStats && 
             inRingStats.psychology >= 16 && 
             careerStats.totalWins + careerStats.totalLosses >= 200;
    }
  },
  {
    tag: 'Iron_Man',
    condition: (entity) => {
      const physicalStats = entity.getComponent('physicalStats');
      const careerStats = entity.getComponent('careerStats');
      return physicalStats && careerStats && 
             physicalStats.stamina >= 16;
      // Note: 50+ matches > 20 mins would need additional tracking
    }
  },
  {
    tag: 'Politician',
    condition: (entity) => {
      const entertainmentStats = entity.getComponent('entertainmentStats');
      return entertainmentStats && entertainmentStats.charisma >= 14;
      // Note: 5+ successful negotiations would need tracking
    }
  },
  {
    tag: 'Spot_Monkey',
    condition: (entity) => {
      const inRingStats = entity.getComponent('inRingStats');
      return inRingStats && inRingStats.aerial >= 16;
      // Note: 10+ crit successes on high-risk spots would need tracking
    }
  },
  {
    tag: 'Locker_Room_Leader',
    condition: (entity, state) => {
      const careerStats = entity.getComponent('careerStats');
      const popularity = entity.getComponent('popularity');
      
      if (!careerStats || !popularity || careerStats.yearsActive < 10) {
        return false;
      }
      
      // Check if highest avg relationship in promotion
      const promotion = TagEngine._getEntityPromotion(entity, state);
      if (!promotion) return false;
      
      const avgAffinity = RelationshipManager.getAverageAffinity(entity.id, promotion.roster);
      if (avgAffinity < 30) return false;
      
      // Check if overness >= 50
      if (popularity.overness < 50) return false;
      
      // Check if highest in promotion
      for (const rosterId of promotion.roster) {
        if (rosterId === entity.id) continue;
        const rosterEntity = state.entities.get(rosterId);
        if (!rosterEntity) continue;
        
        const rosterPop = rosterEntity.getComponent('popularity');
        const rosterCareer = rosterEntity.getComponent('careerStats');
        
        if (rosterPop && rosterCareer && rosterCareer.yearsActive >= 10) {
          const rosterAvg = RelationshipManager.getAverageAffinity(rosterId, promotion.roster);
          if (rosterAvg > avgAffinity) return false;
          if (rosterAvg === avgAffinity && rosterPop.overness > popularity.overness) {
            return false;
          }
        }
      }
      
      return true;
    }
  },
  {
    tag: 'Fragile',
    condition: (entity) => {
      const condition = entity.getComponent('condition');
      return condition && condition.injuries && condition.injuries.filter(i => i.severity >= 4).length >= 5;
    }
  },
  {
    tag: 'Promo_God',
    condition: (entity) => {
      const entertainmentStats = entity.getComponent('entertainmentStats');
      return entertainmentStats && entertainmentStats.micSkills >= 18;
    }
  },
  {
    tag: 'Safe_Worker',
    condition: (entity) => {
      const careerStats = entity.getComponent('careerStats');
      return careerStats && 
             careerStats.totalWins + careerStats.totalLosses >= 500 &&
             careerStats.injuriesCausedCount === 0;
    }
  }
];

/**
 * TagEngine - Manages automatic tag assignment/removal
 */
export class TagEngine {
  /**
   * Evaluates and updates tags for a single entity
   * @param {Entity} entity - Entity to evaluate
   * @param {object} state - Current game state
   */
  static evaluateTags(entity, state) {
    // Evaluate dynamic tags
    for (const rule of TAG_RULES) {
      const shouldHaveTag = rule.condition(entity, state);
      const hasTag = entity.hasTag && entity.hasTag(`[${rule.tag}]`);
      
      if (shouldHaveTag && !hasTag) {
        entity.addTag(`[${rule.tag}]`);
      } else if (!shouldHaveTag && hasTag) {
        entity.removeTag(`[${rule.tag}]`);
      }
    }
    
    // Evaluate injury tags
    this._evaluateInjuryTags(entity);
  }
  
  /**
   * Evaluates and assigns perk tags
   * @param {Entity} entity - Entity to evaluate
   */
  static evaluatePerks(entity) {
    for (const rule of PERK_RULES) {
      const shouldHavePerk = rule.condition(entity, gameStateManager.getStateRef());
      const hasPerk = entity.hasTag && entity.hasTag(`[${rule.tag}]`);
      
      if (shouldHavePerk && !hasPerk) {
        entity.addTag(`[${rule.tag}]`);
      }
    }
  }
  
  /**
   * Runs tag evaluation on all entities
   * @param {object} state - Current game state
   */
  static runAllEntities(state) {
    for (const entity of state.entities.values()) {
      this.evaluateTags(entity, state);
      this.evaluatePerks(entity);
    }
  }
  
  /**
   * Evaluates injury tags based on condition component
   * @private
   * @param {Entity} entity - Entity to evaluate
   */
  static _evaluateInjuryTags(entity) {
    const condition = entity.getComponent('condition');
    if (!condition || !condition.injuries) return;
    
    // Get current injury tags
    const currentInjuryTags = entity.getTags ? entity.getTags().filter(tag => 
      tag.startsWith('[Injured_')
    ) : [];
    
    // Get expected injury tags from injuries array
    const expectedInjuryTags = condition.injuries.map(injury => 
      `[Injured_${injury.bodyPart}]`
    );
    
    // Remove tags for healed injuries
    for (const tag of currentInjuryTags) {
      if (!expectedInjuryTags.includes(tag)) {
        entity.removeTag(tag);
      }
    }
    
    // Add tags for active injuries
    for (const tag of expectedInjuryTags) {
      if (!entity.hasTag(tag)) {
        entity.addTag(tag);
      }
    }
  }
  
  /**
   * Gets the promotion an entity belongs to
   * @private
   * @param {Entity} entity - The entity
   * @param {object} state - Game state
   * @returns {object|null} Promotion or null
   */
  static _getEntityPromotion(entity, state) {
    for (const promotion of state.promotions.values()) {
      if (promotion.roster && promotion.roster.includes(entity.id)) {
        return promotion;
      }
    }
    return null;
  }
}

export default TagEngine;
