/**
 * MatchResultProcessor for Mat Life: Wrestling Simulator
 * Phase 1.2 - Match System Activation
 * Processes match results and applies all post-match effects
 */

import { gameStateManager } from '../core/GameStateManager.js';
import RelationshipManager from './RelationshipManager.js';
import InjuryEngine from './InjuryEngine.js';
import ChampionshipSystem from './ChampionshipSystem.js';
import DynamicFeudSystem from './DynamicFeudSystem.js';
import { randomInt } from '../core/Utils.js';

/**
 * MatchResultProcessor - Handles all post-match updates
 */
export class MatchResultProcessor {
  /**
   * Processes match results for both wrestlers
   * @param {object} matchResult - Match result from MatchSimulator
   * @param {Entity} winner - Winning wrestler entity
   * @param {Entity} loser - Losing wrestler entity
   * @param {number} matchRating - Match rating (0-5.5 stars)
   */
  static processMatchResult(matchResult, winner, loser, matchRating) {
    // 1. Update career stats
    this.updateCareerStats(winner, loser, matchRating);

    // 2. Update popularity (overness and momentum)
    this.updatePopularity(winner, loser, matchRating);

    // 3. Update relationship between wrestlers
    this.updateRelationship(winner, loser, matchRating);

    // 4. Post-match injury check
    this.checkPostMatchInjuries(winner, loser);

    // 5. Track weekly match count
    this.trackWeeklyMatch(winner);
    this.trackWeeklyMatch(loser);

    // 6. Handle Championships if applicable
    if (matchResult.isTitleMatch && matchResult.titleId) {
      this.handleChampionshipMatch(matchResult.titleId, winner, loser, matchRating);
    }

    // 7. Handle Feud Escalation if this is a feud match
    if (matchResult.feudId) {
      DynamicFeudSystem.escalateAfterMatch(matchResult.feudId, matchRating, matchResult);
    } else {
      // Check if there's an active feud between these wrestlers
      const feudId = [winner.id, loser.id].sort().join('_');
      const state = gameStateManager.getStateRef();
      const feud = state.feuds.get(feudId);
      if (feud && !feud.resolved) {
        DynamicFeudSystem.escalateAfterMatch(feudId, matchRating, matchResult);
      }
    }

    // 8. Log results
    this.logMatchResults(winner, loser, matchRating, matchResult);
  }

  /**
   * Handles championship match results
   * @private
   */
  static handleChampionshipMatch(titleId, winner, loser, matchRating) {
    const state = gameStateManager.getStateRef();
    const title = state.championships.get(titleId);
    if (!title) return;

    const previousChampionId = title.currentChampion;

    // If winner is NOT the previous champion, award it
    if (winner.id !== previousChampionId) {
      const prevChamp = previousChampionId ? state.entities.get(previousChampionId) : null;
      ChampionshipSystem.awardChampionship(titleId, winner, prevChamp);

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `🏆 NEW CHAMPION! ${winner.getComponent('identity').name} has won the ${title.name}!`,
          type: 'special'
        }
      });
    } else {
      // Champion retained, record defense
      ChampionshipSystem.recordDefense(titleId, matchRating);

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `👑 AND STILL CHAMPION! ${winner.getComponent('identity').name} successfully defended the ${title.name}.`,
          type: 'match'
        }
      });
    }
  }

  /**
   * Updates career statistics for both wrestlers
   * @private
   */
  static updateCareerStats(winner, loser, matchRating) {
    const winnerCareer = winner.getComponent('careerStats');
    const loserCareer = loser.getComponent('careerStats');

    if (winnerCareer) {
      winnerCareer.totalWins++;
      winnerCareer.consecutiveWins = (winnerCareer.consecutiveWins || 0) + 1;
      winnerCareer.totalMatches = (winnerCareer.totalMatches || 0) + 1;

      // Track star ratings
      if (!winnerCareer.starRatings) winnerCareer.starRatings = [];
      winnerCareer.starRatings.push(matchRating);
      if (winnerCareer.starRatings.length > 10) winnerCareer.starRatings.shift();

      // Update average rating
      winnerCareer.averageRating = winnerCareer.starRatings.reduce((a, b) => a + b, 0) / winnerCareer.starRatings.length;
    }

    if (loserCareer) {
      loserCareer.totalLosses++;
      loserCareer.consecutiveWins = 0;
      loserCareer.totalMatches = (loserCareer.totalMatches || 0) + 1;

      // Track star ratings
      if (!loserCareer.starRatings) loserCareer.starRatings = [];
      loserCareer.starRatings.push(matchRating);
      if (loserCareer.starRatings.length > 10) loserCareer.starRatings.shift();

      // Update average rating
      loserCareer.averageRating = loserCareer.starRatings.reduce((a, b) => a + b, 0) / loserCareer.starRatings.length;
    }
  }

  /**
   * Updates popularity stats based on match result
   * @private
   */
  static updatePopularity(winner, loser, matchRating) {
    const winnerPop = winner.getComponent('popularity');
    const loserPop = loser.getComponent('popularity');

    // Calculate momentum gain based on match rating (5-15 range)
    const baseMomentum = Math.floor(5 + (matchRating / 5.5) * 10);

    if (winnerPop) {
      // Winner: +2 overness, +momentum based on match quality
      winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 2);
      winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + baseMomentum);

      // Bonus overness for high-rated matches (4+ stars)
      if (matchRating >= 4) {
        winnerPop.overness = Math.min(100, winnerPop.overness + 3);
      }

      // Bonus for 5-star classic
      if (matchRating >= 5) {
        winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 5);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 10);
      }
    }

    if (loserPop) {
      // Loser: -1 overness, small momentum loss
      loserPop.overness = Math.max(0, (loserPop.overness || 0) - 1);
      loserPop.momentum = Math.max(0, (loserPop.momentum || 0) - Math.floor(baseMomentum / 2));

      // Protect overness for good matches even in defeat
      if (matchRating >= 4) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 1); // Compensate loss
      }
    }
  }

  /**
   * Updates relationship between wrestlers based on match chemistry
   * @private
   */
  static updateRelationship(winner, loser, matchRating) {
    const winnerId = winner.id;
    const loserId = loser.id;

    // Calculate relationship change based on match rating
    let affinityChange = 0;
    if (matchRating >= 4.5) {
      affinityChange = 10; // Classic match - great chemistry
    } else if (matchRating >= 3.5) {
      affinityChange = 5; // Good match
    } else if (matchRating >= 2.5) {
      affinityChange = 2; // Decent match
    } else if (matchRating < 2) {
      affinityChange = -3; // Bad match - frustration
    }

    if (affinityChange !== 0) {
      RelationshipManager.modifyAffinity(
        winnerId,
        loserId,
        affinityChange,
        `Match chemistry (${matchRating.toFixed(1)} stars)`
      );
    }
  }

  /**
   * Checks for post-match injuries
   * @private
   */
  static checkPostMatchInjuries(winner, loser) {
    [winner, loser].forEach(wrestler => {
      const condition = wrestler.getComponent('condition');
      if (condition && condition.injuries && condition.injuries.length > 0) {
        const recentInjuries = condition.injuries.filter(i => i.daysRemaining > 0);
        if (recentInjuries.length > 0) {
          const identity = wrestler.getComponent('identity');
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'injury',
              text: `${identity?.name || 'Wrestler'} is dealing with ${recentInjuries.length} active injuries after the match.`,
              entityId: wrestler.id,
              injuries: recentInjuries
            }
          });
        }
      }
    });
  }

  /**
   * Tracks weekly match count for overtraining protection
   * @private
   */
  static trackWeeklyMatch(wrestler) {
    const weeklyStats = wrestler.getComponent('weeklyStats');
    const careerStats = wrestler.getComponent('careerStats');
    if (weeklyStats) {
      weeklyStats.matchesWrestled = (weeklyStats.matchesWrestled || 0) + 1;
    }
    if (careerStats) {
      careerStats.matchesThisWeek = (careerStats.matchesThisWeek || 0) + 1;
    }
  }

  /**
   * Logs comprehensive match results
   * @private
   */
  static logMatchResults(winner, loser, matchRating, matchResult) {
    const winnerName = winner.getComponent('identity')?.name || 'Unknown';
    const loserName = loser.getComponent('identity')?.name || 'Unknown';
    const winnerPop = winner.getComponent('popularity');
    const loserPop = loser.getComponent('popularity');

    let resultText = `${winnerName} defeated ${loserName} (${matchRating.toFixed(1)}⭐)`;

    // Add stat changes to log
    if (winnerPop) {
      const overnessChange = matchRating >= 4 ? 5 : 2;
      resultText += ` | ${winnerName}: Overness +${overnessChange}, Momentum +${Math.floor(5 + (matchRating / 5.5) * 10)}`;
    }

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'match',
        text: resultText,
        type: 'match-result',
        rating: matchRating,
        winner: winnerName,
        loser: loserName,
        duration: matchResult?.turn
      }
    });

    // Special announcement for 5-star matches
    if (matchRating >= 5) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `⭐⭐⭐ MATCH OF THE YEAR CANDIDATE! ⭐⭐⭐ ${winnerName} vs ${loserName} delivers a ${matchRating.toFixed(1)}-star classic!`,
          type: 'special'
        }
      });
    }
  }

  /**
   * Gets match summary for display
   * @param {Entity} wrestler - Wrestler to get summary for
   * @returns {object} Match summary
   */
  static getMatchSummary(wrestler) {
    const careerStats = wrestler.getComponent('careerStats');
    const weeklyStats = wrestler.getComponent('weeklyStats');

    if (!careerStats) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        averageRating: 0,
        record: '0-0-0',
        matchesThisWeek: 0
      };
    }

    return {
      totalMatches: careerStats.totalMatches || 0,
      wins: careerStats.totalWins || 0,
      losses: careerStats.totalLosses || 0,
      draws: careerStats.draws || 0,
      averageRating: careerStats.averageRating || 0,
      record: `${careerStats.totalWins || 0}-${careerStats.totalLosses || 0}-${careerStats.draws || 0}`,
      matchesThisWeek: weeklyStats?.matchesWrestled || 0,
      consecutiveWins: careerStats.consecutiveWins || 0
    };
  }
}

export default MatchResultProcessor;
