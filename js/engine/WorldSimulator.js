/**
 * WorldSimulator for Mat Life: Wrestling Simulator
 * Step 1.11 of Implementation Plan
 * Background world tick processing
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { gameCalendar } from '../core/GameCalendar.js';
import TagEngine from './TagEngine.js';
import InjuryEngine from './InjuryEngine.js';
import FinancialEngine from './FinancialEngine.js';
import RelationshipManager from './RelationshipManager.js';
import ResolutionEngine from './ResolutionEngine.js';
import SocialMediaSystem from './SocialMediaSystem.js';
import LifestyleEngine from './LifestyleEngine.js';
import WellnessEngine from './WellnessEngine.js';
import ContractEngine from './ContractEngine.js';
import { rollD20, randomInt } from '../core/Utils.js';

/**
 * WorldSimulator - The master "advance the world" function
 */
export class WorldSimulator {
  /**
   * Advances the world by one time slot
   * @param {object} state - Current game state
   * @returns {PendingAction[]} List of pending actions requiring player input
   */
  static tick(state) {
    const pendingActions = [];

    // 1. Advance calendar
    gameCalendar.tick();

    // 2. Refresh all tags
    TagEngine.runAllEntities(state);

    // 3. Tick injuries for all entities
    this._tickAllInjuries(state);

    // 4. If new week, process weekly systems
    const calendar = state.calendar;
    if (calendar.timeOfDay === 0 && calendar.day === 0) {
      // Process finances for player
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        FinancialEngine.processWeeklyFinances(player, state);
      }

      // Process all entities' weekly systems
      for (const entity of state.entities.values()) {
        // Social media decay
        SocialMediaSystem.processWeekly(entity);
        
        // Lifestyle processing
        LifestyleEngine.processWeekly(entity);
        
        // PED effects
        WellnessEngine.processWeekly(entity);
        
        // Contract expiration
        ContractEngine.processContractExpiration(entity);
        
        // Random wellness test if under contract
        const contract = entity.getComponent('contract');
        if (contract?.promotionId) {
          const promotion = state.promotions.get(contract.promotionId);
          if (promotion) {
            WellnessEngine.randomTest(entity, promotion);
          }
        }
        
        // Reset weekly match counter
        const careerStats = entity.getComponent('careerStats');
        if (careerStats) {
          careerStats.matchesThisWeek = 0;
        }
      }

      // Drift relationships
      RelationshipManager.driftRelationships();
    }

    // 5. Check for show days and queue matches/promos
    const player = gameStateManager.getPlayerEntity();
    if (player) {
      const playerContract = player.getComponent('contract');
      if (playerContract && playerContract.promotionId) {
        const promotion = state.promotions.get(playerContract.promotionId);
        if (promotion && gameCalendar.isShowDay(promotion)) {
          // Generate show card
          const showAction = this._generateShowCard(promotion, player, state);
          if (showAction) {
            pendingActions.push(showAction);
          }
        }
      }
    }

    // 6. Check for dynamic events
    // Note: EventManager will be implemented in Step 1.12
    // For now, we'll skip event generation

    // 7. Process AI promotions
    this._processAIPromotions(state);

    // 8. Log the day passage
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'system',
        text: `Advanced to ${gameCalendar.getCurrentDate()}`,
        type: 'time'
      }
    });

    return pendingActions;
  }

  /**
   * Simulates a simplified match between two NPCs
   * @param {Entity} wrestler1 - First wrestler
   * @param {Entity} wrestler2 - Second wrestler
   * @param {string} matchType - Type of match
   * @returns {object} Match result
   */
  static simulateNPCMatch(wrestler1, wrestler2, matchType = 'Standard Singles') {
    // Get highest relevant stat for each wrestler
    const getHighestStat = (wrestler) => {
      const inRingStats = wrestler.getComponent('inRingStats');
      if (!inRingStats) return 10;
      
      return Math.max(
        inRingStats.brawling,
        inRingStats.technical,
        inRingStats.aerial
      );
    };

    const stat1 = getHighestStat(wrestler1);
    const stat2 = getHighestStat(wrestler2);

    // Contested roll
    const contestedResult = ResolutionEngine.resolveContested({
      actor: wrestler1,
      actorStat: 'brawling',
      target: wrestler2,
      targetStat: 'brawling'
    });

    const winner = contestedResult.winner === 'actor' ? wrestler1 : wrestler2;
    const loser = winner === wrestler1 ? wrestler2 : wrestler1;

    // Update records
    this._updateMatchRecords(winner, loser);

    // Generate simplified match rating (1-5 stars)
    const baseRating = (stat1 + stat2) / 10;
    const randomFactor = randomInt(-5, 5) / 10;
    const matchRating = Math.max(0.5, Math.min(5, baseRating + randomFactor));

    return {
      winner,
      loser,
      matchRating,
      duration: randomInt(5, 25),
      contestedResult
    };
  }

  /**
   * Ticks injuries for all entities
   * @private
   * @param {object} state - Game state
   */
  static _tickAllInjuries(state) {
    for (const entity of state.entities.values()) {
      const healedParts = InjuryEngine.tickInjuries(entity);
      
      // Log healed injuries
      for (const bodyPart of healedParts) {
        const identity = entity.getComponent('identity');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'injury',
            text: `${identity?.name || 'Unknown'} has recovered from their ${bodyPart} injury`,
            entityId: entity.id
          }
        });
      }
    }
  }

  /**
   * Generates a show card for a promotion
   * @private
   * @param {object} promotion - Promotion object
   * @param {Entity} player - Player entity
   * @param {object} state - Game state
   * @returns {PendingAction|null} Show action or null
   */
  static _generateShowCard(promotion, player, state) {
    // Simple implementation: check if player is booked
    const rosterIds = promotion.roster || [];
    
    if (!rosterIds.includes(player.id)) {
      return null;
    }

    // Find an opponent from roster
    const opponents = rosterIds
      .filter(id => id !== player.id)
      .map(id => state.entities.get(id))
      .filter(e => e);

    if (opponents.length === 0) {
      return null;
    }

    // Random opponent
    const opponent = opponents[randomInt(0, opponents.length - 1)];

    return {
      type: 'match',
      player,
      opponent,
      promotion,
      matchType: 'Standard Singles'
    };
  }

  /**
   * Processes AI promotions in the background
   * @private
   * @param {object} state - Game state
   */
  static _processAIPromotions(state) {
    for (const promotion of state.promotions.values()) {
      // Check if this is a show day for the promotion
      if (gameCalendar.isShowDay(promotion)) {
        // Simulate matches for this promotion
        const roster = (promotion.roster || [])
          .map(id => state.entities.get(id))
          .filter(e => e);

        // Simulate 3-5 random matches
        const numMatches = randomInt(3, 5);
        for (let i = 0; i < numMatches && roster.length >= 2; i++) {
          const idx1 = randomInt(0, roster.length - 1);
          let idx2 = randomInt(0, roster.length - 1);
          while (idx2 === idx1) {
            idx2 = randomInt(0, roster.length - 1);
          }

          const wrestler1 = roster[idx1];
          const wrestler2 = roster[idx2];

          // Skip if either is the player (handled separately)
          if (wrestler1 === gameStateManager.getPlayerEntity() ||
              wrestler2 === gameStateManager.getPlayerEntity()) {
            continue;
          }

          this.simulateNPCMatch(wrestler1, wrestler2);
        }

        // Update promotion prestige slightly
        const prestigeChange = randomInt(-2, 3);
        promotion.prestige = Math.max(0, Math.min(100, 
          (promotion.prestige || 50) + prestigeChange
        ));
      }
    }
  }

  /**
   * Updates win/loss records after a match
   * @private
   * @param {Entity} winner - Winning wrestler
   * @param {Entity} loser - Losing wrestler
   */
  static _updateMatchRecords(winner, loser) {
    // Update winner
    const winnerCareer = winner.getComponent('careerStats');
    if (winnerCareer) {
      winnerCareer.totalWins++;
      winnerCareer.consecutiveWins = (winnerCareer.consecutiveWins || 0) + 1;
    }

    // Update loser
    const loserCareer = loser.getComponent('careerStats');
    if (loserCareer) {
      loserCareer.totalLosses++;
      loserCareer.consecutiveWins = 0;
    }
  }
}

/**
 * @typedef {object} PendingAction
 * @property {string} type - Action type (match, promo, event, etc.)
 * @property {Entity} player - Player entity
 * @property {any} [opponent] - Opponent entity (for matches)
 * @property {object} [promotion] - Promotion object
 * @property {string} [matchType] - Type of match
 */

export default WorldSimulator;
