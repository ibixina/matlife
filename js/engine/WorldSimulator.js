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
import TrainingSystem from './TrainingSystem.js';
import AIPromotionSystem from './AIPromotionSystem.js';
import DynamicFeudSystem from './DynamicFeudSystem.js';
import CardPositionSystem from './CardPositionSystem.js';
import ChampionshipSystem from './ChampionshipSystem.js';
import StorylineManager from './StorylineManager.js';
import PerkSystem from './PerkSystem.js';
import AgingEngine from './AgingEngine.js';
import EntityFactory from '../core/EntityFactory.js';
import { rollD20, randomInt } from '../core/Utils.js';

/**
 * WorldSimulator - The master "advance the world" function
 */
export class WorldSimulator {
  /**
   * Advances the world by one day
   * @param {object} state - Current game state
   * @returns {PendingAction[]} List of pending actions requiring player input
   */
  static tick(state) {
    const pendingActions = [];

    // 1. Advance calendar
    gameCalendar.tick();

    // 2. Refresh all tags
    TagEngine.runAllEntities(state);

    // 3. Tick injuries for all entities (once per day)
    this._tickAllInjuries(state);

    // Process no-compete clauses daily
    this._processNoCompeteClauses(state);

    // 4. If new week, process weekly systems
    const calendar = state.calendar;
    if (calendar.day === 0) {
      // Process finances for player
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        const financialReport = FinancialEngine.processWeeklyFinances(player, state);

        // Log financial summary
        if (financialReport) {
          const netChangeText = financialReport.netChange >= 0 ?
            `+$${financialReport.netChange}` : `-$${Math.abs(financialReport.netChange)}`;

          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'system',
              text: `Weekly Financial Summary: Income $${financialReport.totalIncome}, Expenses $${financialReport.totalExpenses}, Net ${netChangeText}. Balance: $${financialReport.newBalance}`,
              type: 'financial',
              financialReport
            }
          });
        }
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

        // Reset weekly training counter
        TrainingSystem.resetWeeklyCounter(entity);

        // Random wellness test if under contract
        const contract = entity.getComponent('contract');
        if (contract?.promotionId) {
          const promotion = state.promotions.get(contract.promotionId);
          if (promotion) {
            WellnessEngine.randomTest(entity, promotion);
          }
        }

        // Check for perk unlocks
        PerkSystem.checkAndUnlockPerks(entity);

        // Reset weekly match counter
        const careerStats = entity.getComponent('careerStats');
        if (careerStats) {
          careerStats.matchesThisWeek = 0;
        }
      }

      // Drift relationships
      RelationshipManager.driftRelationships();

      // Tick feuds
      DynamicFeudSystem.tickAllFeuds();

      // Tick storylines
      StorylineManager.tickAllStorylines();

      // Check for new year (aging)
      if (state.calendar.week === 1 && state.calendar.month === 1) {
        AgingEngine.ageOneYear();
      }

      // Evaluate card positions monthly
      if (state.calendar.week === 2) {
        CardPositionSystem.evaluateAllRosters(state);
      }

      // Process AI promotions (weekly, not every day)
      this._processAIPromotions(state);
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


    // 6. Log the day passage
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
   * Processes no-compete clauses for all entities (daily)
   * @private
   * @param {object} state - Game state
   */
  static _processNoCompeteClauses(state) {
    for (const entity of state.entities.values()) {
      ContractEngine.processNoCompeteDaily(entity);
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
    const rosterIds = promotion.roster || [];

    if (!rosterIds.includes(player.id)) {
      return null;
    }

    // Find opponents from roster
    let opponents = rosterIds
      .filter(id => id !== player.id)
      .map(id => state.entities.get(id))
      .filter(e => e);

    // If no opponents on roster, generate one
    if (opponents.length === 0) {
      const npc = EntityFactory.generateRandomIndie(promotion.region || 'USA');
      gameStateManager.dispatch('ADD_ENTITY', { entity: npc });
      const npcContract = npc.getComponent('contract');
      if (npcContract) {
        npcContract.promotionId = promotion.id;
        npcContract.weeklySalary = 100;
        npcContract.remainingWeeks = 1;
      }
      promotion.roster.push(npc.id);
      opponents = [npc];
    }

    let opponent = opponents[randomInt(0, opponents.length - 1)];

    // Pick match type based on card position and randomness
    const matchTypes = ['Standard Singles', 'No DQ', 'Submission Match', 'Falls Count Anywhere', 'Iron Man'];
    const matchType = matchTypes[randomInt(0, Math.min(1, matchTypes.length - 1))]; // mostly standard

    // Determine booked winner (Scripted outcome)
    const playerOverness = player.getComponent('popularity')?.overness || 0;
    const opponentOverness = opponent.getComponent('popularity')?.overness || 0;
    const winChance = 0.5 + (playerOverness - opponentOverness) / 200;
    const bookedWinnerId = Math.random() < winChance ? player.id : opponent.id;

    const contract = player.getComponent('contract');
    let isTitleMatch = false;
    let titleId = null;

    if (contract?.pendingTitleShot) {
      // Find a championship to contest
      const championships = ChampionshipSystem.getPromotionChampionships(promotion.id);
      if (championships.length > 0) {
        // Find best championship (most prestigious) where current champion is not player
        const stateRef = gameStateManager.getStateRef();
        const availableTitles = championships
          .filter(c => c && (!c.currentChampionId || c.currentChampionId !== player.id))
          .sort((a, b) => b.prestige - a.prestige);

        if (availableTitles.length > 0) {
          const title = availableTitles[0];
          let champ = null;

          if (title.currentChampionId) {
            champ = stateRef.entities.get(title.currentChampionId);
          }

          if (!champ) {
            const rosterOpponents = (promotion.roster || [])
              .filter(id => id !== player.id)
              .map(id => stateRef.entities.get(id))
              .filter(e => e);

            if (rosterOpponents.length > 0) {
              champ = rosterOpponents[randomInt(0, rosterOpponents.length - 1)];
            }
          }

          if (champ) {
            opponent = champ;
          }

          isTitleMatch = true;
          titleId = title.id;
          contract.pendingTitleShot = false; // Shot consumed
        }
      }
    }

    return {
      type: 'match',
      player,
      opponent,
      promotion,
      matchType,
      bookedWinner: bookedWinnerId === player.id ? 'wrestler1' : 'wrestler2',
      isTitleMatch,
      titleId
    };
  }

  /**
   * Processes AI promotions in the background
   * @private
   * @param {object} state - Game state
   */
  static _processAIPromotions(state) {
    for (const promotion of state.promotions.values()) {
      // Skip player's promotion
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        const playerContract = player.getComponent('contract');
        if (playerContract?.promotionId === promotion.id) continue;
      }

      // Use AIPromotionSystem for comprehensive simulation
      AIPromotionSystem.simulateWeek(promotion, state);
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
