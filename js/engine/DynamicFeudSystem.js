/**
 * DynamicFeudSystem for Mat Life: Wrestling Simulator
 * Phase 2.5 - Dynamic Feud System
 * Manages feuds between wrestlers with phases and escalating heat
 */

import { gameStateManager } from '../core/GameStateManager.js';
import RelationshipManager from './RelationshipManager.js';
import { randomInt } from '../core/Utils.js';

/**
 * Feud phases
 */
const FEUD_PHASES = {
  tension: {
    name: 'Tension',
    duration: [2, 4],
    activities: ['trash_talk', 'backstage_confrontation', 'social_media_war'],
    matchTypes: ['Standard Singles']
  },
  heat: {
    name: 'Heat',
    duration: [4, 8],
    activities: ['interference', 'attack', 'betrayal', 'stipulation_challenge'],
    matchTypes: ['Standard Singles', 'No DQ', 'Tables Match']
  },
  blowoff: {
    name: 'Blowoff',
    duration: [1, 2],
    activities: ['final_confrontation', 'contract_signing'],
    matchTypes: ['Standard Singles', 'No DQ', 'Steel Cage', 'Last Man Standing']
  }
};

/**
 * DynamicFeudSystem - Manages wrestling feuds
 */
export class DynamicFeudSystem {
  /**
   * Starts a new feud between two entities
   * @param {Entity} entityA - First wrestler
   * @param {Entity} entityB - Second wrestler
   * @param {string} cause - What caused the feud
   * @returns {object} Feud object
   */
  static startFeud(entityA, entityB, cause) {
    const state = gameStateManager.getStateRef();
    const feudId = [entityA.id, entityB.id].sort().join('_');

    // Check if feud already exists
    if (state.feuds.has(feudId)) {
      return { error: 'Feud already exists between these wrestlers' };
    }

    const feud = {
      id: feudId,
      entityA: entityA.id,
      entityB: entityB.id,
      phase: 'tension',
      heat: 0,
      startWeek: state.calendar.absoluteWeek,
      currentWeek: state.calendar.absoluteWeek,
      cause: cause,
      matches: [],
      activities: [],
      resolved: false,
      winner: null
    };

    gameStateManager.dispatch('ADD_FEUD', { feud });

    // Set relationship to rival
    RelationshipManager.setRelationshipType(entityA.id, entityB.id, 'rival');

    // Log
    const identityA = entityA.getComponent('identity');
    const identityB = entityB.getComponent('identity');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🥊 NEW FEUD: ${identityA?.name} vs ${identityB?.name} - ${cause}`,
        type: 'feud'
      }
    });

    return feud;
  }

  /**
   * Escalates a feud to the next phase
   * @param {string} feudId - Feud ID
   * @returns {object} Feud event result
   */
  static escalateFeud(feudId) {
    const state = gameStateManager.getStateRef();
    const feud = state.feuds.get(feudId);

    if (!feud || feud.resolved) {
      return { error: 'Feud not found or already resolved' };
    }

    const currentPhase = FEUD_PHASES[feud.phase];
    const phaseKeys = Object.keys(FEUD_PHASES);
    const currentIndex = phaseKeys.indexOf(feud.phase);

    if (currentIndex >= phaseKeys.length - 1) {
      return { error: 'Feud already at maximum phase' };
    }

    // Advance to next phase
    const nextPhase = phaseKeys[currentIndex + 1];
    feud.phase = nextPhase;
    feud.heat += 25;

    // Generate escalation event
    const event = this.generateEscalationEvent(feud);
    feud.activities.push(event);

    // Log
    const entityA = state.entities.get(feud.entityA);
    const entityB = state.entities.get(feud.entityB);
    const identityA = entityA?.getComponent('identity');
    const identityB = entityB?.getComponent('identity');

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🔥 FEUD ESCALATES: ${identityA?.name} vs ${identityB?.name} enters ${FEUD_PHASES[nextPhase].name} phase! ${event.description}`,
        type: 'feud'
      }
    });

    return {
      feud,
      event,
      newPhase: nextPhase
    };
  }

  /**
   * Generates an escalation event
   * @private
   */
  static generateEscalationEvent(feud) {
    const phase = FEUD_PHASES[feud.phase];
    const activities = phase.activities;
    const activity = activities[randomInt(0, activities.length - 1)];

    const eventTemplates = {
      trash_talk: [
        ' cuts a scathing promo on ',
        ' tears into ',
        ' delivers a blistering verbal assault on '
      ],
      backstage_confrontation: [
        ' and  had a heated exchange backstage',
        ' confronted  in the locker room',
        ' got in  face backstage'
      ],
      social_media_war: [
        ' went on a Twitter tirade against ',
        ' blasted  on Instagram',
        ' and  exchanged heated messages online'
      ],
      interference: [
        ' interfered in \'s match',
        ' cost  the victory',
        ' attacked  during their match'
      ],
      attack: [
        ' jumped  in the parking lot',
        ' laid out  with a steel chair',
        ' ambushed  before the show'
      ],
      betrayal: [
        ' turned on their partner ',
        ' betrayed  in shocking fashion',
        ' showed their true colors, attacking '
      ],
      stipulation_challenge: [
        ' challenged  to a No DQ match',
        ' wants  inside a Steel Cage',
        ' issued a Tables Match challenge to '
      ],
      final_confrontation: [
        ' and  came to blows in the ring',
        ' had to be pulled apart from ',
        ' and  brawled throughout the arena'
      ],
      contract_signing: [
        ' signed the contract for the blowoff match with ',
        ' made it official against ',
        ' and  signed on the dotted line'
      ]
    };

    const templates = eventTemplates[activity] || [' confronted '];
    const template = templates[randomInt(0, templates.length - 1)];

    return {
      type: activity,
      week: gameStateManager.getStateRef().calendar.absoluteWeek,
      description: template,
      heatGenerated: 10
    };
  }

  /**
   * Resolves a feud after a match
   * @param {string} feudId - Feud ID
   * @param {Entity} winner - Winning wrestler
   * @param {number} matchRating - Match rating
   * @returns {object} Feud resolution result
   */
  static resolveFeud(feudId, winner, matchRating) {
    const state = gameStateManager.getStateRef();
    const feud = state.feuds.get(feudId);

    if (!feud || feud.resolved) {
      return { error: 'Feud not found or already resolved' };
    }

    // Mark as resolved
    feud.resolved = true;
    feud.winner = winner.id;
    feud.endWeek = state.calendar.absoluteWeek;
    feud.finalMatchRating = matchRating;

    // Determine outcome type
    let outcome = 'standard';
    if (matchRating >= 4.5) outcome = 'classic';
    else if (matchRating >= 3.5) outcome = 'good';
    else if (matchRating < 2) outcome = 'disappointing';

    // Update relationship
    const loserId = winner.id === feud.entityA ? feud.entityB : feud.entityA;
    RelationshipManager.modifyAffinity(
      winner.id,
      loserId,
      matchRating >= 3 ? 10 : -5,
      `Feud blowoff (${matchRating.toFixed(1)} stars)`
    );

    // Update popularity
    const winnerPop = winner.getComponent('popularity');
    if (winnerPop) {
      const momentumGain = matchRating >= 4 ? 20 : matchRating >= 3 ? 15 : 10;
      winnerPop.momentum = Math.min(100, winnerPop.momentum + momentumGain);
      
      // Overness bonus for great feud endings
      if (matchRating >= 4) {
        winnerPop.overness = Math.min(100, winnerPop.overness + 3);
      }
    }

    // Update feud in state
    gameStateManager.dispatch('UPDATE_FEUD', {
      feudId,
      updates: { resolved: true, winner: winner.id }
    });

    // Log resolution
    const identity = winner.getComponent('identity');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'match',
        text: `🏆 FEUD RESOLVED: ${identity?.name} wins the blowoff match (${matchRating.toFixed(1)} stars)! The feud is over.`,
        type: 'feud-resolved'
      }
    });

    return {
      feud,
      outcome,
      winner: identity?.name,
      matchRating
    };
  }

  /**
   * Advances all active feuds by one week
   * Called during world tick
   */
  static tickAllFeuds() {
    const state = gameStateManager.getStateRef();

    for (const [feudId, feud] of state.feuds) {
      if (feud.resolved) continue;

      feud.currentWeek = state.calendar.absoluteWeek;

      const currentPhase = FEUD_PHASES[feud.phase];
      const phaseDuration = currentPhase.duration;
      const weeksInPhase = state.calendar.absoluteWeek - feud.currentWeek;

      // Check if we should escalate
      if (weeksInPhase >= phaseDuration[1]) {
        this.escalateFeud(feudId);
      } else if (weeksInPhase >= phaseDuration[0] && Math.random() < 0.3) {
        // 30% chance to escalate early
        this.escalateFeud(feudId);
      }

      // Random activity during heat phase
      if (feud.phase === 'heat' && Math.random() < 0.4) {
        const event = this.generateEscalationEvent(feud);
        feud.activities.push(event);
        feud.heat += event.heatGenerated;

        // Log occasional activities
        if (Math.random() < 0.25) {
          const entityA = state.entities.get(feud.entityA);
          const entityB = state.entities.get(feud.entityB);
          const identityA = entityA?.getComponent('identity');
          const identityB = entityB?.getComponent('identity');

          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'backstage',
              text: `📢 FEUD UPDATE: ${identityA?.name}${event.description}${identityB?.name}`,
              type: 'feud-activity'
            }
          });
        }
      }
    }
  }

  /**
   * Gets feud summary for display
   * @param {string} entityId - Entity ID
   * @returns {object[]} Array of feud summaries
   */
  static getEntityFeuds(entityId) {
    const state = gameStateManager.getStateRef();
    const feuds = [];

    for (const [feudId, feud] of state.feuds) {
      if (feud.entityA === entityId || feud.entityB === entityId) {
        const opponentId = feud.entityA === entityId ? feud.entityB : feud.entityA;
        const opponent = state.entities.get(opponentId);
        const identity = opponent?.getComponent('identity');

        feuds.push({
          id: feudId,
          opponent: identity?.name || 'Unknown',
          opponentId,
          phase: feud.phase,
          phaseName: FEUD_PHASES[feud.phase].name,
          heat: feud.heat,
          resolved: feud.resolved,
          winner: feud.winner,
          duration: feud.currentWeek - feud.startWeek,
          cause: feud.cause
        });
      }
    }

    return feuds;
  }

  /**
   * Checks if two entities are in an active feud
   * @param {string} entityA - First entity ID
   * @param {string} entityB - Second entity ID
   * @returns {boolean}
   */
  static areInFeud(entityA, entityB) {
    const state = gameStateManager.getStateRef();
    const feudId = [entityA, entityB].sort().join('_');
    const feud = state.feuds.get(feudId);
    
    return feud && !feud.resolved;
  }

  /**
   * Gets available match types for a feud
   * @param {string} feudId - Feud ID
   * @returns {string[]} Array of match types
   */
  static getFeudMatchTypes(feudId) {
    const state = gameStateManager.getStateRef();
    const feud = state.feuds.get(feudId);
    
    if (!feud) return ['Standard Singles'];
    
    return FEUD_PHASES[feud.phase].matchTypes;
  }
}

export default DynamicFeudSystem;
