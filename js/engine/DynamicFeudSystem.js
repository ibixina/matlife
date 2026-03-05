/**
 * DynamicFeudSystem for Mat Life: Wrestling Simulator
 * Phase 2.5 - Dynamic Feud System
 * Manages feuds between wrestlers with phases and escalating heat
 */

import { gameStateManager } from '../core/GameStateManager.js';
import RelationshipManager from './RelationshipManager.js';
import { randomInt } from '../core/Utils.js';

/**
 * Feud phases - escalating intensity
 */
const FEUD_PHASES = {
  tension: {
    name: 'Tension',
    duration: [2, 4],
    activities: ['trash_talk', 'backstage_confrontation', 'social_media_war', 'dirty_look', 'ignored_handshake'],
    matchTypes: ['Standard Singles', 'Promo Battle'],
    escalationEvents: [
      { type: 'confrontation', description: 'A heated verbal exchange in the locker room', heatGain: 15 },
      { type: 'disrespect', description: 'One wrestler refused to shake hands', heatGain: 10 },
      { type: 'mockery', description: 'Mocking interview on local TV', heatGain: 12 },
      { type: 'sneer', description: 'Intimidating staredown during entrance', heatGain: 8 }
    ]
  },
  heat: {
    name: 'Heat',
    duration: [4, 8],
    activities: ['interference', 'attack', 'betrayal', 'stipulation_challenge', 'property_damage', 'family_mention'],
    matchTypes: ['Standard Singles', 'No DQ', 'Tables Match', 'Backstage Brawl', 'Parking Lot Brawl', 'Falls Count Anywhere'],
    escalationEvents: [
      { type: 'brawl', description: 'A violent backstage brawl left both wrestlers bloodied', heatGain: 25 },
      { type: 'ambush', description: 'Cowardly attack after the match with a steel chair', heatGain: 30 },
      { type: 'mockery', description: 'Despicable promo bringing up family members', heatGain: 35 },
      { type: 'destruction', description: 'Trashed the opponent locker room and gear', heatGain: 28 },
      { type: 'interference', description: 'Cost them the title match with a vicious beatdown', heatGain: 32 }
    ]
  },
  blowoff: {
    name: 'Blowoff',
    duration: [1, 2],
    activities: ['final_confrontation', 'contract_signing', 'career_threat', 'hospital_visit'],
    matchTypes: ['Standard Singles', 'No DQ', 'Steel Cage', 'Last Man Standing', 'Hell in a Cell', 'Death Match', 'Loser Leaves Town', 'I Quit'],
    escalationEvents: [
      { type: 'threat', description: 'Vicious threat to end their career', heatGain: 40 },
      { type: 'injury', description: 'Brutal attack sent them to the hospital', heatGain: 50 },
      { type: 'desecration', description: 'Burned their gear and spit on their legacy', heatGain: 45 },
      { type: 'ultimatum', description: 'This ends TONIGHT - one of us is leaving in an ambulance', heatGain: 55 }
    ]
  },
  bloodfeud: {
    name: 'Blood Feud',
    duration: [1, 3],
    activities: ['wanton_destruction', 'personal_vendetta', 'legacy_destruction'],
    matchTypes: ['Death Match', 'Hell in a Cell', 'Loser Leaves Town', 'Retirement Match', 'Buried Alive', 'Last Man Standing'],
    escalationEvents: [
      { type: 'bloodshed', description: 'The hatred is personal. Blood has been spilled.', heatGain: 100 },
      { type: 'vengeance', description: 'This isn\'t about wrestling anymore. It\'s about destruction.', heatGain: 100 },
      { type: 'endgame', description: 'Only one will survive this war.', heatGain: 100 }
    ]
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
    const prevPhaseName = FEUD_PHASES[feud.phase].name;
    feud.phase = nextPhase;
    feud.phaseStartWeek = state.calendar.absoluteWeek;
    feud.heat += 25;

    // Generate escalation event
    const event = this.generateEscalationEvent(feud);
    feud.activities.push(event);

    // Log with escalating intensity
    const entityA = state.entities.get(feud.entityA);
    const entityB = state.entities.get(feud.entityB);
    const identityA = entityA?.getComponent('identity');
    const identityB = entityB?.getComponent('identity');
    const nameA = identityA?.name || 'Wrestler A';
    const nameB = identityB?.name || 'Wrestler B';

    let escalationText = '';
    if (nextPhase === 'heat') {
      escalationText = `🩸 BLOOD BOILING: ${nameA} vs ${nameB} enters HEAT PHASE! ${event.description}`;
    } else if (nextPhase === 'blowoff') {
      escalationText = `🔥🔥🔥 WAR DECLARED: ${nameA} vs ${nameB} enters BLOWOFF PHASE! ${event.description} THIS ENDS NOW!`;
    } else if (nextPhase === 'bloodfeud') {
      escalationText = `💀💀💀 BLOOD FEUD ACTIVATED: ${nameA} vs ${nameB} has become a LEGENDARY HATRED! ${event.description} THERE ARE NO RULES! THERE IS NO MERCY!`;
    } else {
      escalationText = `🔥 FEUD ESCALATES: ${nameA} vs ${nameB} enters ${FEUD_PHASES[nextPhase].name} phase! ${event.description}`;
    }

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: escalationText,
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
   * Generates an escalation event based on phase - INTENSE & VENOMOUS
   * @private
   */
  static generateEscalationEvent(feud) {
    const phase = FEUD_PHASES[feud.phase];
    const escalationEvents = phase.escalationEvents;
    const event = escalationEvents[randomInt(0, escalationEvents.length - 1)];
    const state = gameStateManager.getStateRef();
    
    const entityA = state.entities.get(feud.entityA);
    const entityB = state.entities.get(feud.entityB);
    const identityA = entityA?.getComponent('identity');
    const identityB = entityB?.getComponent('identity');
    
    const nameA = identityA?.name || 'Wrestler A';
    const nameB = identityB?.name || 'Wrestler B';

    // Build intense description based on event type and phase
    let description = '';
    
    if (feud.phase === 'tension') {
      const tensionEvents = [
        `${nameA} cut a vicious promo, calling ${nameB} a "pathetic excuse for a wrestler"`,
        `${nameA} intentionally bumped into ${nameB} during entrance, igniting tempers`,
        `${nameA} mocked ${nameB}'s entire career on live television`,
        `${nameA} refused to shake ${nameB}'s hand, calling them "beneath contempt"`,
        `${nameA} posted compromising photos of ${nameB} training failures`,
        `${nameA} questioned ${nameB}'s manhood in front of the entire locker room`
      ];
      description = tensionEvents[randomInt(0, tensionEvents.length - 1)];
    } else if (feud.phase === 'heat') {
      const heatEvents = [
        `${nameA} BLASTED ${nameB} with a steel chair from behind - COWARD!`,
        `${nameA} jumped ${nameB} in the parking lot and left them BLEEDING`,
        `${nameA} brought up ${nameB}'s DEAD MOTHER in a promo - UNFORGIVABLE`,
        `${nameA} DESTROYED ${nameB}'s gear and spit on their family photo`,
        `${nameA} cost ${nameB} the title match with a vicious post-match assault`,
        `${nameA} threatened ${nameB}'s family: "I know where you live"`,
        `${nameA} cut a promo DESPISING everything ${nameB} stands for`,
        `${nameA} laid out ${nameB}'s tag partner to send a MESSAGE`,
        `${nameA} powerbombed ${nameB} through a table in catering`,
        `${nameA} slapped ${nameB}'s wife at ringside during their match`
      ];
      description = heatEvents[randomInt(0, heatEvents.length - 1)];
    } else if (feud.phase === 'blowoff') {
      const blowoffEvents = [
        `${nameA} PUT ${nameB} IN THE HOSPITAL with a brutal locker room attack`,
        `${nameA} BURNED ${nameB}'s gear and threatened to end their career`,
        `${nameA} revealed ${nameB}'s personal medical history on LIVE TV - SICK!`,
        `${nameA} promised to make ${nameB} retire in a wheelchair`,
        `${nameA} held ${nameB}'s child hostage metaphorically in promo - DEGENERATE`,
        `${nameA} attacked ${nameB} during their title celebration - DESPICABLE`,
        `${nameA} cut the most VICIOUS promo in history, wishing death on ${nameB}`,
        `${nameA} drove a car into ${nameB}'s locker room door - PSYCHOPATH`,
        `${nameA} hired goons to jump ${nameB} before the match`,
        `${nameA} promised this ends with ${nameB} BEGGING for mercy`
      ];
      description = blowoffEvents[randomInt(0, blowoffEvents.length - 1)];
    } else if (feud.phase === 'bloodfeud') {
      const bloodFeudEvents = [
        `BLOOD HAS BEEN SPILLED. ${nameA} vs ${nameB} is now WAR.`,
        `${nameA} tried to BLIND ${nameB} with a fireball - SADISTIC!`,
        `${nameA} hospitalized ${nameB}'s training partner - NO LIMITS`,
        `The hatred between ${nameA} and ${nameB} has become DEMONIC`,
        `${nameA} put a BOUNTY on ${nameB}'s head`,
        `This isn't wrestling anymore. This is SURVIVAL between ${nameA} and ${nameB}.`
      ];
      description = bloodFeudEvents[randomInt(0, bloodFeudEvents.length - 1)];
    }

    return {
      type: event.type,
      week: state.calendar.absoluteWeek,
      description: description,
      heatGenerated: event.heatGain
    };
  }

  /**
   * Automatically escalates a feud after a match
   * @param {string} feudId - Feud ID
   * @param {number} matchRating - Rating of the match (1-5.5)
   * @param {object} matchResult - Full match result object
   * @returns {object} Escalation result
   */
  static escalateAfterMatch(feudId, matchRating, matchResult = null) {
    const state = gameStateManager.getStateRef();
    const feud = state.feuds.get(feudId);

    if (!feud || feud.resolved) {
      return { error: 'Feud not found or already resolved' };
    }

    const entityA = state.entities.get(feud.entityA);
    const entityB = state.entities.get(feud.entityB);
    const identityA = entityA?.getComponent('identity');
    const identityB = entityB?.getComponent('identity');

    // Add heat based on match quality
    const heatGain = matchRating >= 4 ? 30 : matchRating >= 3 ? 20 : 15;
    feud.heat = Math.min(100, feud.heat + heatGain);
    feud.matches = feud.matches || [];
    feud.matches.push({
      week: state.calendar.absoluteWeek,
      rating: matchRating
    });

    // Generate post-match escalation
    const phase = FEUD_PHASES[feud.phase];
    const escalationEvents = phase.escalationEvents;
    const event = escalationEvents[randomInt(0, escalationEvents.length - 1)];

    let postMatchEvent = '';
    if (feud.phase === 'tension') {
      postMatchEvent = matchRating >= 3.5 
        ? `After their match, ${identityA?.name} ATTACKED ${identityB?.name}, proving this is far from over!`
        : `${identityA?.name} confronted ${identityB?.name} after the bell - tensions boiling over!`;
    } else if (feud.phase === 'heat') {
      postMatchEvent = matchRating >= 4
        ? `A BRUTAL post-match beatdown by ${identityA?.name} left ${identityB?.name} BLOODIED and broken!`
        : `${identityA?.name} jumped ${identityB?.name} after the match with a steel chair!`;
    } else if (feud.phase === 'blowoff') {
      postMatchEvent = matchRating >= 4.5
        ? `This WAR continues! ${identityA?.name} assaulted ${identityB?.name} after the match, demanding a REMATCH!`
        : `${identityA?.name} destroyed ${identityB?.name} after the bell - this isn't ending anytime soon!`;
    } else if (feud.phase === 'bloodfeud') {
      postMatchEvent = `${identityA?.name} tried to END ${identityB?.name}'s career after the match - PURE SAVAGERY!`;
    }

    // Log the escalation
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🔥 FEUD ESCALATION: ${postMatchEvent}`,
        type: 'feud'
      }
    });

    // Check if we should auto-advance phase or END the feud
    const phaseKeys = Object.keys(FEUD_PHASES);
    const currentIndex = phaseKeys.indexOf(feud.phase);
    const matchesInPhase = feud.matches.filter(m => m.week >= (feud.phaseStartWeek || feud.startWeek)).length;
    
    // Auto-escalate after 2 matches or if match was 4+ stars
    if (currentIndex < phaseKeys.length - 1 && (matchesInPhase >= 2 || matchRating >= 4)) {
      return this.escalateFeud(feudId);
    }
    
    // Check if feud should END (blowoff or bloodfeud with enough matches)
    const totalMatches = feud.matches.length;
    if ((feud.phase === 'blowoff' || feud.phase === 'bloodfeud') && totalMatches >= 3) {
      // Determine winner based on recent match (the one who just won)
      const winner = entityA; // The winner is the one who won the last match
      return this.resolveFeud(feudId, winner, matchRating);
    }
    
    // Also end if this is a career-ending match type
    if (matchResult && (matchResult.matchType === 'Retirement Match' || matchResult.matchType === 'Loser Leaves Town')) {
      const winner = entityA;
      const result = this.resolveFeud(feudId, winner, matchRating);
      
      // Add dramatic ending text
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `💀 ${matchResult.matchType.toUpperCase()} CONCLUDES THE WAR! The feud between ${identityA?.name} and ${identityB?.name} is FINISHED!`,
          type: 'feud-resolved'
        }
      });
      
      return result;
    }

    return {
      feud,
      heatGained: heatGain,
      message: postMatchEvent
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
