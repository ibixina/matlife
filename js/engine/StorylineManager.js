/**
 * StorylineManager for Mat Life: Wrestling Simulator
 * Phase 3.3 - Storyline/Angle System
 * Manages narrative storylines with multiple participants
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { generateUUID } from '../core/Utils.js';

/**
 * Storyline types
 */
const STORYLINE_TYPES = {
  feud: {
    name: 'Feud',
    description: 'Classic rivalry between two or more wrestlers',
    minParticipants: 2,
    maxParticipants: 6
  },
  alliance: {
    name: 'Alliance',
    description: 'Partnership or faction working together',
    minParticipants: 2,
    maxParticipants: 5
  },
  betrayal: {
    name: 'Betrayal',
    description: 'Unexpected turn from ally to enemy',
    minParticipants: 2,
    maxParticipants: 3
  },
  mystery: {
    name: 'Mystery',
    description: 'Unknown attacker or secret identity angle',
    minParticipants: 2,
    maxParticipants: 4
  },
  redemption: {
    name: 'Redemption',
    description: 'Heel turning face or comeback story',
    minParticipants: 1,
    maxParticipants: 3
  },
  championship_chase: {
    name: 'Championship Chase',
    description: 'Quest to win a title',
    minParticipants: 2,
    maxParticipants: 4
  }
};

/**
 * StorylineManager - Manages narrative storylines
 */
export class StorylineManager {
  /**
   * Creates a new storyline
   * @param {string} type - Storyline type
   * @param {Entity[]} participants - Storyline participants
   * @param {object} config - Storyline configuration
   * @returns {object} Storyline object
   */
  static createStoryline(type, participants, config = {}) {
    const typeInfo = STORYLINE_TYPES[type];
    if (!typeInfo) return { error: 'Invalid storyline type' };

    if (participants.length < typeInfo.minParticipants || 
        participants.length > typeInfo.maxParticipants) {
      return { 
        error: `Storyline type ${type} requires ${typeInfo.minParticipants}-${typeInfo.maxParticipants} participants` 
      };
    }

    const state = gameStateManager.getStateRef();
    const currentWeek = state.calendar.absoluteWeek;

    const storyline = {
      id: generateUUID(),
      type,
      name: config.name || this.generateStorylineName(type, participants),
      participants: participants.map(p => p.id),
      beats: this.generateStorylineBeats(type, participants, config),
      currentBeat: 0,
      quality: 0,
      startWeek: currentWeek,
      estimatedDuration: config.duration || this.estimateDuration(type),
      active: true,
      playerChoice: null,
      matches: []
    };

    gameStateManager.dispatch('ADD_STORYLINE', { storyline });

    // Log storyline start
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🎬 NEW STORYLINE: ${storyline.name} begins!`,
        type: 'storyline-start',
        storylineId: storyline.id
      }
    });

    return storyline;
  }

  /**
   * Generates storyline beats based on type
   * @private
   */
  static generateStorylineBeats(type, participants, config) {
    const beats = [];
    const identities = participants.map(p => p.getComponent('identity'));
    const names = identities.map(i => i?.name || 'Unknown');

    switch (type) {
      case 'feud':
        beats.push({
          week: 0,
          type: 'confrontation',
          description: `${names[0]} and ${names[1]} have a heated exchange`,
          choices: [
            { text: 'Get physical', effect: 'heat+10' },
            { text: 'Walk away', effect: 'professional' }
          ]
        });
        beats.push({
          week: 2,
          type: 'match',
          description: `First match in the feud`,
          required: true
        });
        beats.push({
          week: 4,
          type: 'escalation',
          description: 'The conflict intensifies',
          choices: [
            { text: 'Accept stipulation match', effect: 'quality+10' },
            { text: 'Keep it standard', effect: 'neutral' }
          ]
        });
        beats.push({
          week: 6,
          type: 'blowoff',
          description: 'The final confrontation',
          required: true,
          isFinale: true
        });
        break;

      case 'championship_chase':
        beats.push({
          week: 0,
          type: 'challenge',
          description: `${names[0]} issues a title challenge`,
          choices: [
            { text: 'Cut intense promo', effect: 'overness+5' },
            { text: 'Let actions speak', effect: 'momentum+5' }
          ]
        });
        beats.push({
          week: 2,
          type: 'match',
          description: 'Title match #1',
          required: true
        });
        beats.push({
          week: 4,
          type: 'rematch',
          description: 'Title rematch with stipulations',
          required: true,
          isFinale: true
        });
        break;

      case 'betrayal':
        beats.push({
          week: 0,
          type: 'betrayal',
          description: `${names[1]} turns on ${names[0]}!`,
          choices: [
            { text: 'Seek revenge immediately', effect: 'heat+15' },
            { text: 'Plot long-term revenge', effect: 'quality+10' }
          ]
        });
        beats.push({
          week: 1,
          type: 'promo',
          description: 'The betrayer explains their actions',
          required: true
        });
        beats.push({
          week: 3,
          type: 'match',
          description: 'Revenge match',
          required: true,
          isFinale: true
        });
        break;

      default:
        // Generic storyline
        beats.push({
          week: 0,
          type: 'setup',
          description: 'Storyline begins',
          choices: config.initialChoices || []
        });
        beats.push({
          week: 3,
          type: 'development',
          description: 'Storyline develops'
        });
        beats.push({
          week: 6,
          type: 'climax',
          description: 'Storyline climax',
          isFinale: true
        });
    }

    return beats;
  }

  /**
   * Generates a storyline name
   * @private
   */
  static generateStorylineName(type, participants) {
    const identities = participants.map(p => p.getComponent('identity'));
    const names = identities.map(i => i?.name || 'Unknown');

    switch (type) {
      case 'feud':
        return `${names[0]} vs ${names[1]}`;
      case 'alliance':
        return `The ${names[0]} & ${names[1]} Alliance`;
      case 'betrayal':
        return `The Betrayal of ${names[0]}`;
      case 'mystery':
        return 'The Mystery Attacker';
      case 'redemption':
        return `${names[0]}'s Redemption`;
      case 'championship_chase':
        return `${names[0]}'s Title Quest`;
      default:
        return 'Untitled Storyline';
    }
  }

  /**
   * Estimates storyline duration
   * @private
   */
  static estimateDuration(type) {
    const durations = {
      feud: [6, 10],
      alliance: [8, 16],
      betrayal: [4, 8],
      mystery: [6, 12],
      redemption: [8, 14],
      championship_chase: [4, 8]
    };
    
    const range = durations[type] || [4, 8];
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  }

  /**
   * Advances a storyline to the next beat
   * @param {string} storylineId - Storyline ID
   * @param {object} matchResult - Result of any required match
   */
  static advanceStoryline(storylineId, matchResult = null) {
    const state = gameStateManager.getStateRef();
    const storyline = state.storylines.get(storylineId);

    if (!storyline || !storyline.active) return;

    const currentBeat = storyline.beats[storyline.currentBeat];
    
    // Update quality based on match result
    if (matchResult && currentBeat?.type === 'match') {
      storyline.quality += matchResult.rating * 2;
      storyline.matches.push({
        beat: storyline.currentBeat,
        rating: matchResult.rating,
        winner: matchResult.winner
      });
    }

    storyline.currentBeat++;

    // Check if storyline is complete
    if (storyline.currentBeat >= storyline.beats.length) {
      this.completeStoryline(storylineId);
    } else {
      // Log beat advancement
      const nextBeat = storyline.beats[storyline.currentBeat];
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: `🎬 Storyline Update: ${storyline.name} - ${nextBeat.description}`,
          type: 'storyline-update'
        }
      });
    }
  }

  /**
   * Makes a player choice in a storyline
   * @param {string} storylineId - Storyline ID
   * @param {number} choiceIndex - Choice index
   */
  static makeChoice(storylineId, choiceIndex) {
    const state = gameStateManager.getStateRef();
    const storyline = state.storylines.get(storylineId);

    if (!storyline) return { error: 'Storyline not found' };

    const currentBeat = storyline.beats[storyline.currentBeat];
    if (!currentBeat?.choices || choiceIndex >= currentBeat.choices.length) {
      return { error: 'Invalid choice' };
    }

    const choice = currentBeat.choices[choiceIndex];
    storyline.playerChoice = choice;

    // Apply effects
    this.applyChoiceEffects(storyline, choice);

    return { success: true, choice };
  }

  /**
   * Applies choice effects
   * @private
   */
  static applyChoiceEffects(storyline, choice) {
    const effect = choice.effect;
    
    if (effect === 'heat+10') storyline.quality += 10;
    else if (effect === 'heat+15') storyline.quality += 15;
    else if (effect === 'quality+10') storyline.quality += 10;
    else if (effect === 'overness+5') {
      // Apply to all participants
      storyline.participants.forEach(id => {
        const entity = gameStateManager.getStateRef().entities.get(id);
        if (entity) {
          const pop = entity.getComponent('popularity');
          if (pop) pop.overness = Math.min(100, pop.overness + 5);
        }
      });
    }
    else if (effect === 'momentum+5') {
      storyline.participants.forEach(id => {
        const entity = gameStateManager.getStateRef().entities.get(id);
        if (entity) {
          const pop = entity.getComponent('popularity');
          if (pop) pop.momentum = Math.min(100, pop.momentum + 5);
        }
      });
    }
  }

  /**
   * Completes a storyline
   * @param {string} storylineId - Storyline ID
   */
  static completeStoryline(storylineId) {
    const state = gameStateManager.getStateRef();
    const storyline = state.storylines.get(storylineId);

    if (!storyline) return;

    storyline.active = false;
    storyline.endWeek = state.calendar.absoluteWeek;
    storyline.duration = storyline.endWeek - storyline.startWeek;

    // Calculate final quality
    const avgMatchQuality = storyline.matches.length > 0
      ? storyline.matches.reduce((sum, m) => sum + m.rating, 0) / storyline.matches.length
      : 0;
    
    storyline.finalQuality = (storyline.quality + (avgMatchQuality * 10)) / 2;

    // Apply rewards to participants
    storyline.participants.forEach(id => {
      const entity = state.entities.get(id);
      if (entity) {
        const pop = entity.getComponent('popularity');
        if (pop) {
          const overnessGain = Math.floor(storyline.finalQuality / 10);
          pop.overness = Math.min(100, pop.overness + overnessGain);
        }
      }
    });

    // Log completion
    const qualityText = storyline.finalQuality >= 70 ? 'OUTSTANDING' :
                       storyline.finalQuality >= 50 ? 'Good' :
                       storyline.finalQuality >= 30 ? 'Average' : 'Poor';

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🎬 STORYLINE COMPLETE: ${storyline.name} (${qualityText} - ${storyline.finalQuality.toFixed(0)}/100)`,
        type: 'storyline-complete',
        quality: storyline.finalQuality
      }
    });
  }

  /**
   * Gets all active storylines for an entity
   * @param {string} entityId - Entity ID
   * @returns {object[]} Active storylines
   */
  static getEntityStorylines(entityId) {
    const state = gameStateManager.getStateRef();
    const storylines = [];

    for (const storyline of state.storylines.values()) {
      if (storyline.participants.includes(entityId) && storyline.active) {
        storylines.push({
          id: storyline.id,
          name: storyline.name,
          type: storyline.type,
          currentBeat: storyline.currentBeat,
          totalBeats: storyline.beats.length,
          quality: storyline.quality,
          hasChoice: !!storyline.beats[storyline.currentBeat]?.choices
        });
      }
    }

    return storylines;
  }

  /**
   * Gets storyline details
   * @param {string} storylineId - Storyline ID
   * @returns {object} Storyline details
   */
  static getStorylineDetails(storylineId) {
    const state = gameStateManager.getStateRef();
    const storyline = state.storylines.get(storylineId);

    if (!storyline) return null;

    return {
      ...storyline,
      participants: storyline.participants.map(id => {
        const entity = state.entities.get(id);
        return entity?.getComponent('identity')?.name || 'Unknown';
      }),
      currentBeatDetails: storyline.beats[storyline.currentBeat] || null
    };
  }

  /**
   * Ticks all active storylines
   * Called during WorldSimulator.tick()
   */
  static tickAllStorylines() {
    const state = gameStateManager.getStateRef();
    const currentWeek = state.calendar.absoluteWeek;

    for (const storyline of state.storylines.values()) {
      if (!storyline.active) continue;

      const currentBeat = storyline.beats[storyline.currentBeat];
      if (!currentBeat) continue;

      const beatWeek = storyline.startWeek + currentBeat.week;
      
      // Auto-advance if past beat week and not waiting for match
      if (currentWeek >= beatWeek && !currentBeat.required) {
        this.advanceStoryline(storyline.id);
      }
    }
  }
}

export default StorylineManager;
