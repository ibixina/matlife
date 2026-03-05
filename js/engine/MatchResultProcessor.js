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

    // 8. Update promotion prestige for high-rated matches
    this.updatePromotionPrestige(winner, matchRating);

    // 9. Log results
    this.logMatchResults(winner, loser, matchRating, matchResult);
  }

  /**
   * Updates promotion prestige based on match quality
   * @private
   */
  static updatePromotionPrestige(wrestler, matchRating) {
    if (matchRating < 5) return; // Only 5+ star matches boost prestige

    const state = gameStateManager.getStateRef();
    const contract = wrestler.getComponent('contract');
    if (!contract || !contract.promotionId) return;

    const promotion = state.promotions.get(contract.promotionId);
    if (!promotion) return;

    let prestigeBoost = 0;
    let announcement = '';

    if (matchRating >= 7.0) {
      prestigeBoost = 8;
      announcement = `🏆🏆🏆 ${promotion.name}'s prestige skyrockets after hosting a PERFECT match!`;
    } else if (matchRating >= 6.5) {
      prestigeBoost = 5;
      announcement = `🌟 ${promotion.name} gains massive prestige from a legendary ${matchRating.toFixed(1)}-star match!`;
    } else if (matchRating >= 6.0) {
      prestigeBoost = 3;
      announcement = `👑 ${promotion.name}'s reputation grows after an elite ${matchRating.toFixed(1)}-star performance!`;
    } else if (matchRating >= 5.5) {
      prestigeBoost = 2;
      announcement = `⭐ ${promotion.name} benefits from a perfect ${matchRating.toFixed(1)}-star match!`;
    } else if (matchRating >= 5.0) {
      prestigeBoost = 1;
    }

    if (prestigeBoost > 0) {
      promotion.prestige = Math.min(100, promotion.prestige + prestigeBoost);

      if (announcement) {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'match',
            text: announcement + ` (+${prestigeBoost} prestige)`,
            type: 'special'
          }
        });
      }
    }
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

      // Bonus for 4.5+ star matches
      if (matchRating >= 4.5) {
        winnerPop.overness = Math.min(100, winnerPop.overness + 4);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 8);
      }

      // Bonus for 5-star classic
      if (matchRating >= 5) {
        winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 6);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 15);
      }

      // Major bonus for 5.5-star perfect matches
      if (matchRating >= 5.5) {
        winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 10);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 25);
        
        // Dispatch special announcement for perfect matches
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'match',
            text: `🏆 PERFECT MATCH! A truly legendary performance that will be remembered forever!`,
            type: 'special'
          }
        });
      }
      
      // ELITE TIER: 6.0-6.4 star matches - Once in a lifetime
      if (matchRating >= 6.0 && matchRating < 6.5) {
        winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 15);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 35);
        
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'match',
            text: `👑 ELITE CLASS! ${winnerPop.overness >= 90 ? 'Two masters at their peak!' : 'A career-defining performance!'} Overness +15!`,
            type: 'special'
          }
        });
      }
      
      // LEGENDARY TIER: 6.5-6.9 star matches - Hall of Fame worthy
      if (matchRating >= 6.5 && matchRating < 7.0) {
        winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 20);
        winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 50);
        
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'match',
            text: `🌟 LEGENDARY! This match will be talked about for decades! Overness +20!`,
            type: 'special'
          }
        });
      }
      
      // PERFECT TIER: 7.0 star matches - The greatest of all time
      if (matchRating >= 7.0) {
        winnerPop.overness = 100; // Max out overness
        winnerPop.momentum = 100; // Max out momentum
        
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'match',
            text: `⭐⭐⭐ GREATEST OF ALL TIME! ⭐⭐⭐ This is wrestling perfection! Overness MAXED!`,
            type: 'special'
          }
        });
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

      // Bonus for excellent matches even in defeat
      if (matchRating >= 4.5) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 2);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 5);
      }

      // Even losing in a 5-star match is good for your career
      if (matchRating >= 5) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 3);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 10);
      }

      // Perfect match participation is career-defining regardless of outcome
      if (matchRating >= 5.5) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 5);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 20);
      }
      
      // ELITE TIER bonuses for loser too
      if (matchRating >= 6.0 && matchRating < 6.5) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 8);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 25);
      }
      
      // LEGENDARY TIER bonuses for loser
      if (matchRating >= 6.5 && matchRating < 7.0) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 12);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 35);
      }
      
      // PERFECT TIER - even the loser benefits
      if (matchRating >= 7.0) {
        loserPop.overness = Math.min(100, (loserPop.overness || 0) + 15);
        loserPop.momentum = Math.min(100, (loserPop.momentum || 0) + 50);
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
      // Exponential overness gain based on match rating
      let overnessChange = 2; // Base overness gain
      if (matchRating >= 7.0) overnessChange = 100; // Max out
      else if (matchRating >= 6.5) overnessChange = 50;
      else if (matchRating >= 6.0) overnessChange = 35;
      else if (matchRating >= 5.5) overnessChange = 25;
      else if (matchRating >= 5) overnessChange = 17;
      else if (matchRating >= 4.5) overnessChange = 11;
      else if (matchRating >= 4) overnessChange = 5;
      
      resultText += ` | ${winnerName}: Overness +${overnessChange}, Momentum +${Math.floor(5 + (matchRating / 7.0) * 10)}`;
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

    // Special announcement for high-star matches
    if (matchRating >= 7.0) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `⭐⭐⭐ GREATEST OF ALL TIME! ⭐⭐⭐ ${winnerName} vs ${loserName} achieves WRESTLING PERFECTION with a ${matchRating.toFixed(1)}-star match! Overness MAXED!`,
          type: 'special'
        }
      });
    } else if (matchRating >= 6.5) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `🌟 LEGENDARY CLASS! ${winnerName} vs ${loserName} creates a ${matchRating.toFixed(1)}-star masterpiece! This will be remembered for decades! Overness +50!`,
          type: 'special'
        }
      });
    } else if (matchRating >= 6.0) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `👑 ELITE CLASS! ${winnerName} vs ${loserName} delivers a ${matchRating.toFixed(1)}-star classic! Two masters at their absolute peak! Overness +35!`,
          type: 'special'
        }
      });
    } else if (matchRating >= 5.5) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `🏆 PERFECT MATCH! ${winnerName} vs ${loserName} delivers a ${matchRating.toFixed(1)}-star PERFECT match! Overness boost +25!`,
          type: 'special'
        }
      });
    } else if (matchRating >= 5) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `⭐⭐⭐ MATCH OF THE YEAR CANDIDATE! ⭐⭐⭐ ${winnerName} vs ${loserName} delivers a ${matchRating.toFixed(1)}-star classic! Overness boost +17!`,
          type: 'special'
        }
      });
    } else if (matchRating >= 4.5) {
      gameStateManager.dispatch('ADDD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `🌟 EXCELLENT MATCH! ${winnerName} vs ${loserName} puts on a ${matchRating.toFixed(1)}-star show! Overness boost +11!`,
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
