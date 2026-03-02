/**
 * DirtSheetGenerator for Mat Life: Wrestling Simulator
 * Step 4.4 of Implementation Plan
 * Generates weekly dirt sheet stories
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { randomInt } from '../core/Utils.js';

/**
 * DirtSheetGenerator - Creates wrestling news and rumors
 */
export class DirtSheetGenerator {
  /**
   * Generates weekly dirt sheet stories
   * @param {object} state - Game state
   * @returns {object[]} Array of stories
   */
  static generateWeekly(state) {
    const stories = [];
    
    // Scan for notable changes
    stories.push(...this.scanContractExpirations(state));
    stories.push(...this.scanBackstageHeat(state));
    stories.push(...this.scanInjuries(state));
    stories.push(...this.scanFreeAgents(state));
    stories.push(...this.scanTitleChanges(state));
    
    // Add some random/inaccurate stories (15% of total)
    const totalStories = stories.length;
    const inaccurateCount = Math.floor(totalStories * 0.15) + 1;
    
    for (let i = 0; i < inaccurateCount; i++) {
      stories.push(this.generateInaccurateStory(state));
    }
    
    // Shuffle and limit to 3-5 stories
    const shuffled = this.shuffleArray(stories);
    return shuffled.slice(0, randomInt(3, 5));
  }

  /**
   * Scans for contract expirations
   * @private
   */
  static scanContractExpirations(state) {
    const stories = [];
    
    for (const [entityId, entity] of state.entities) {
      const contract = entity.getComponent('contract');
      const identity = entity.getComponent('identity');
      
      if (contract && contract.remainingWeeks <= 8 && contract.remainingWeeks > 0) {
        const promotion = state.promotions.get(contract.promotionId);
        
        stories.push({
          headline: `${identity.name}'s Contract Status in Question`,
          text: `Sources indicate ${identity.name}'s deal with ${promotion?.name || 'their promotion'} expires in ${contract.remainingWeeks} weeks. No word yet on renewal talks.`,
          category: 'business',
          accurate: true
        });
      }
    }
    
    return stories;
  }

  /**
   * Scans for backstage heat
   * @private
   */
  static scanBackstageHeat(state) {
    const stories = [];
    
    for (const [key, relationship] of state.relationships) {
      if (relationship.affinity <= -50) {
        const entityA = state.entities.get(relationship.entityA);
        const entityB = state.entities.get(relationship.entityB);
        
        if (entityA && entityB) {
          const nameA = entityA.getComponent('identity').name;
          const nameB = entityB.getComponent('identity').name;
          
          stories.push({
            headline: `Backstage Heat: ${nameA} vs ${nameB}`,
            text: `Tensions are reportedly high between ${nameA} and ${nameB}. Sources say the two had a heated exchange backstage.`,
            category: 'backstage',
            accurate: true
          });
        }
      }
    }
    
    return stories;
  }

  /**
   * Scans for injuries
   * @private
   */
  static scanInjuries(state) {
    const stories = [];
    
    for (const [entityId, entity] of state.entities) {
      const condition = entity.getComponent('condition');
      const identity = entity.getComponent('identity');
      
      if (condition && condition.injuries && condition.injuries.length > 0) {
        const recentInjury = condition.injuries[condition.injuries.length - 1];
        
        if (recentInjury.severity >= 3) {
          stories.push({
            headline: `${identity.name} Suffers ${recentInjury.severity >= 4 ? 'Major' : 'Serious'} Injury`,
            text: `${identity.name} is reportedly dealing with a ${recentInjury.bodyPart.toLowerCase().replace('_', ' ')} injury. Expected to be out ${recentInjury.daysRemaining} days.`,
            category: 'injury',
            accurate: true
          });
        }
      }
    }
    
    return stories;
  }

  /**
   * Scans for free agents
   * @private
   */
  static scanFreeAgents(state) {
    const stories = [];
    
    for (const [entityId, entity] of state.entities) {
      const contract = entity.getComponent('contract');
      const identity = entity.getComponent('identity');
      const popularity = entity.getComponent('popularity');
      
      // Free agents with decent overness
      if (!contract?.promotionId && popularity?.overness >= 30) {
        stories.push({
          headline: `${identity.name} Drawing Interest as Free Agent`,
          text: `Multiple promotions are reportedly interested in signing ${identity.name}, who recently became a free agent.`,
          category: 'business',
          accurate: true
        });
      }
    }
    
    return stories;
  }

  /**
   * Scans for title changes
   * @private
   */
  static scanTitleChanges(state) {
    const stories = [];
    
    // This would check championship history for recent changes
    // For now, placeholder
    
    return stories;
  }

  /**
   * Generates an inaccurate/misleading story
   * @private
   */
  static generateInaccurateStory(state) {
    const templates = [
      {
        headline: "Major Signing Imminent?",
        text: "Rumors swirling that a big free agent is close to signing with a major promotion. Details scarce at this time.",
        category: 'rumor'
      },
      {
        headline: "Creative Changes Behind the Scenes",
        text: "Sources suggest a shakeup in the creative team could be coming. Wrestlers reportedly frustrated with recent directions.",
        category: 'backstage'
      },
      {
        headline: "Return Speculation Heating Up",
        text: "Fans are buzzing about a potential return of a former champion. Social media activity has increased speculation.",
        category: 'rumor'
      },
      {
        headline: "Merger Talks Reportedly Taking Place",
        text: "Industry insiders whisper about potential merger discussions between two major promotions. Both sides deny.",
        category: 'business'
      }
    ];

    const template = templates[randomInt(0, templates.length - 1)];
    return {
      ...template,
      accurate: false
    };
  }

  /**
   * Shuffles an array
   * @private
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Displays dirt sheet in the UI
   * @returns {object[]} Current week's stories
   */
  static checkDirtSheets() {
    const state = gameStateManager.getStateRef();
    const stories = this.generateWeekly(state);
    
    // Log the check
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: 'You read the latest dirt sheets...',
        type: 'dirt-sheet'
      }
    });
    
    return stories;
  }
}

export default DirtSheetGenerator;
