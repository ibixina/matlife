/**
 * AIPromotionSystem for Mat Life: Wrestling Simulator
 * Phase 2.1 - AI Promotion Simulation
 * Simulates background activity for AI promotions
 */

import { gameStateManager } from '../core/GameStateManager.js';
import MatchSimulator from './MatchSimulator.js';
import RelationshipManager from './RelationshipManager.js';
import { randomInt } from '../core/Utils.js';
import { dataManager } from '../core/DataManager.js';

/**
 * Promotion size tiers and their characteristics
 */
const PROMOTION_TIERS = {
  indie: {
    name: 'Indie',
    prestigeRange: [5, 15],
    rosterSize: [5, 12],
    salaryRange: [50, 200],
    showFrequency: 'weekly',
    stylePreferences: ['Mixed', 'Technical', 'Hardcore'],
    growthRate: 0.02
  },
  regional: {
    name: 'Regional',
    prestigeRange: [16, 40],
    rosterSize: [12, 25],
    salaryRange: [200, 500],
    showFrequency: 'weekly',
    stylePreferences: ['Mixed', 'Technical', 'Lucha', 'Strong Style'],
    growthRate: 0.015
  },
  national: {
    name: 'National',
    prestigeRange: [41, 70],
    rosterSize: [25, 40],
    salaryRange: [500, 1500],
    showFrequency: 'weekly',
    stylePreferences: ['Mixed', 'Sports Entertainment', 'Strong Style'],
    growthRate: 0.01
  },
  global: {
    name: 'Global',
    prestigeRange: [71, 100],
    rosterSize: [40, 60],
    salaryRange: [1500, 5000],
    showFrequency: 'weekly',
    stylePreferences: ['Mixed', 'Sports Entertainment'],
    growthRate: 0.005
  }
};

/**
 * AIPromotionSystem - Handles AI promotion simulation
 */
export class AIPromotionSystem {
  /**
   * Simulates a week for an AI promotion
   * @param {object} promotion - Promotion object
   * @param {object} state - Game state
   */
  static simulateWeek(promotion, state) {
    if (!promotion || promotion.isPlayerPromotion) return;

    // 1. Book shows and simulate matches
    this.simulateShows(promotion, state);

    // 2. Update promotion prestige based on recent performance
    this.updatePrestige(promotion);

    // 3. Talent scouting - sign free agents
    this.scoutTalent(promotion, state);

    // 4. Auto-generate feuds
    this.generateFeuds(promotion, state);

    // 5. Release underperformers
    this.manageRoster(promotion, state);
  }

  /**
   * Simulates shows for a promotion
   * @private
   */
  static simulateShows(promotion, state) {
    const roster = (promotion.roster || [])
      .map(id => state.entities.get(id))
      .filter(e => e && !e.isPlayer);

    if (roster.length < 2) return;

    // Simulate 3-5 matches per show
    const numMatches = randomInt(3, 5);
    let totalRating = 0;

    for (let i = 0; i < numMatches; i++) {
      // Pick two random wrestlers
      const idx1 = randomInt(0, roster.length - 1);
      let idx2 = randomInt(0, roster.length - 1);
      while (idx2 === idx1) {
        idx2 = randomInt(0, roster.length - 1);
      }

      const wrestler1 = roster[idx1];
      const wrestler2 = roster[idx2];

      // Quick-simulate match
      const result = this.quickSimMatch(wrestler1, wrestler2);
      totalRating += result.rating;

      // Update wrestler records
      this.updateWrestlerStats(wrestler1, wrestler2, result);
    }

    // Calculate show rating
    const showRating = totalRating / numMatches;

    // Store show result
    if (!promotion.recentShows) promotion.recentShows = [];
    promotion.recentShows.push({
      week: state.calendar.absoluteWeek,
      rating: showRating,
      matches: numMatches
    });

    // Keep only last 4 shows
    if (promotion.recentShows.length > 4) {
      promotion.recentShows.shift();
    }

    // Update promotion momentum
    promotion.momentum = Math.round(showRating * 20);
  }

  /**
   * Quick-simulates a match between two NPCs
   * @private
   */
  static quickSimMatch(wrestler1, wrestler2) {
    const stats1 = wrestler1.getComponent('inRingStats');
    const stats2 = wrestler2.getComponent('inRingStats');
    const pop1 = wrestler1.getComponent('popularity');
    const pop2 = wrestler2.getComponent('popularity');

    // Calculate effective stats
    const effective1 = this.calculateEffectiveStats(stats1, pop1);
    const effective2 = this.calculateEffectiveStats(stats2, pop2);

    // Determine winner based on stats + momentum
    const score1 = effective1 + (pop1?.momentum || 0) * 0.1 + randomInt(-10, 10);
    const score2 = effective2 + (pop2?.momentum || 0) * 0.1 + randomInt(-10, 10);

    const winner = score1 > score2 ? wrestler1 : wrestler2;
    const loser = winner === wrestler1 ? wrestler2 : wrestler1;

    // Calculate match rating
    const baseRating = (effective1 + effective2) / 20;
    const randomFactor = randomInt(-5, 5) / 10;
    const chemistry = this.getChemistry(wrestler1, wrestler2);
    const rating = Math.max(0.5, Math.min(5, baseRating + randomFactor + chemistry));

    return { winner, loser, rating };
  }

  /**
   * Calculates effective stats for a wrestler
   * @private
   */
  static calculateEffectiveStats(stats, popularity) {
    if (!stats) return 50;

    const overness = popularity?.overness || 50;
    const avgStats = (stats.brawling + stats.technical + stats.aerial + stats.psychology) / 4;

    return (avgStats * 0.7) + (overness * 0.3);
  }

  /**
   * Gets chemistry bonus between two wrestlers
   * @private
   */
  static getChemistry(wrestler1, wrestler2) {
    const relationship = RelationshipManager.getRelationship(wrestler1.id, wrestler2.id);
    if (!relationship) return 0;

    // High affinity = better chemistry
    return relationship.affinity / 50;
  }

  /**
   * Updates wrestler stats after a match
   * @private
   */
  static updateWrestlerStats(winner, loser, result) {
    const winnerCareer = winner.getComponent('careerStats');
    const loserCareer = loser.getComponent('careerStats');
    const winnerPop = winner.getComponent('popularity');
    const loserPop = loser.getComponent('popularity');

    if (winnerCareer) {
      winnerCareer.totalWins = (winnerCareer.totalWins || 0) + 1;
      winnerCareer.consecutiveWins = (winnerCareer.consecutiveWins || 0) + 1;
    }

    if (loserCareer) {
      loserCareer.totalLosses = (loserCareer.totalLosses || 0) + 1;
      loserCareer.consecutiveWins = 0;
    }

    // Update popularity
    if (winnerPop) {
      winnerPop.overness = Math.min(100, (winnerPop.overness || 0) + 1);
      winnerPop.momentum = Math.min(100, (winnerPop.momentum || 0) + 5);
    }

    if (loserPop) {
      loserPop.momentum = Math.max(0, (loserPop.momentum || 0) - 2);
    }

    // Update relationship
    RelationshipManager.modifyAffinity(
      winner.id,
      loser.id,
      result.rating >= 3 ? 2 : -1,
      `AI Match (${result.rating.toFixed(1)} stars)`
    );
  }

  /**
   * Updates promotion prestige based on recent performance
   * @private
   */
  static updatePrestige(promotion) {
    if (!promotion.recentShows || promotion.recentShows.length === 0) return;

    const avgRating = promotion.recentShows.reduce((a, b) => a + b.rating, 0) / promotion.recentShows.length;

    // Prestige change based on show ratings
    let prestigeChange = 0;
    if (avgRating >= 4) prestigeChange = 2;
    else if (avgRating >= 3) prestigeChange = 1;
    else if (avgRating < 2) prestigeChange = -1;

    // Apply tier-based growth rate
    const tier = this.getPromotionTier(promotion.prestige);
    prestigeChange += Math.floor(promotion.prestige * tier.growthRate);

    promotion.prestige = Math.max(5, Math.min(100, promotion.prestige + prestigeChange));
  }

  /**
   * Gets promotion tier based on prestige
   * @private
   */
  static getPromotionTier(prestige) {
    if (prestige <= 15) return PROMOTION_TIERS.indie;
    if (prestige <= 40) return PROMOTION_TIERS.regional;
    if (prestige <= 70) return PROMOTION_TIERS.national;
    return PROMOTION_TIERS.global;
  }

  /**
   * Scouts and signs free agent talent
   * @private
   */
  static scoutTalent(promotion, state) {
    // Only scout if roster isn't full
    const tier = this.getPromotionTier(promotion.prestige);
    if (promotion.roster.length >= tier.rosterSize[1]) return;

    // Find free agents with decent overness
    const freeAgents = [];
    for (const entity of state.entities.values()) {
      const contract = entity.getComponent('contract');
      const popularity = entity.getComponent('popularity');

      if (!contract?.promotionId && !entity.isPlayer && popularity?.overness >= 20) {
        freeAgents.push({ entity, overness: popularity.overness });
      }
    }

    if (freeAgents.length === 0) return;

    // Sort by overness and pick top candidates
    freeAgents.sort((a, b) => b.overness - a.overness);

    // 30% chance to sign someone if we found candidates
    if (Math.random() < 0.3 && freeAgents.length > 0) {
      const candidate = freeAgents[0];
      const contract = candidate.entity.getComponent('contract');

      if (contract) {
        contract.promotionId = promotion.id;
        contract.weeklySalary = tier.salaryRange[0] + Math.floor(Math.random() * (tier.salaryRange[1] - tier.salaryRange[0]));
        contract.lengthWeeks = 52;
        contract.remainingWeeks = 52;
        promotion.roster.push(candidate.entity.id);

        // Log signing
        const identity = candidate.entity.getComponent('identity');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'business',
            text: `${promotion.name} signs ${identity?.name || 'a new wrestler'} to their roster.`,
            type: 'contract'
          }
        });
      }
    }
  }

  /**
   * Generates feuds between roster members
   * @private
   */
  static generateFeuds(promotion, state) {
    if (!promotion.roster || promotion.roster.length < 4) return;

    // 20% chance to generate a new feud
    if (Math.random() > 0.2) return;

    // Find pairs with extreme affinity (high or low)
    const roster = promotion.roster.map(id => state.entities.get(id)).filter(e => e);

    for (let i = 0; i < roster.length; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const relationship = RelationshipManager.getRelationship(roster[i].id, roster[j].id);

        // Start feud if affinity is very negative
        if (relationship && relationship.affinity <= -50) {
          if (!state.feuds.has(`${roster[i].id}_${roster[j].id}`)) {
            this.startFeud(roster[i], roster[j], promotion, state);
          }
        }
      }
    }
  }

  /**
   * Starts a new feud
   * @private
   */
  static startFeud(wrestler1, wrestler2, promotion, state) {
    const feudId = [wrestler1.id, wrestler2.id].sort().join('_');

    const feud = {
      id: feudId,
      entityA: wrestler1.id,
      entityB: wrestler2.id,
      promotionId: promotion.id,
      phase: 'tension',
      heat: 0,
      startWeek: state.calendar.absoluteWeek,
      matches: []
    };

    gameStateManager.dispatch('ADD_FEUD', { feud });

    // Log
    const id1 = wrestler1.getComponent('identity');
    const id2 = wrestler2.getComponent('identity');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🥊 NEW FEUD: ${id1?.name} vs ${id2?.name} in ${promotion.name}!`,
        type: 'feud'
      }
    });
  }

  /**
   * Manages roster - releases underperformers
   * @private
   */
  static manageRoster(promotion, state) {
    // Only manage if roster is too large
    const tier = this.getPromotionTier(promotion.prestige);
    if (promotion.roster.length <= tier.rosterSize[1]) return;

    // Find underperformers (low overness)
    const underperformers = [];
    for (const entityId of promotion.roster) {
      const entity = state.entities.get(entityId);
      if (!entity) continue;

      const popularity = entity.getComponent('popularity');
      const career = entity.getComponent('careerStats');

      // Criteria: low overness OR consecutive losses
      if (popularity?.overness < 15 || career?.consecutiveWins < -5) {
        underperformers.push({ entity, score: popularity?.overness || 0 });
      }
    }

    if (underperformers.length > 0) {
      // Release lowest performer
      underperformers.sort((a, b) => a.score - b.score);
      const toRelease = underperformers[0].entity;

      const contract = toRelease.getComponent('contract');
      if (contract) {
        contract.promotionId = null;
        promotion.roster = promotion.roster.filter(id => id !== toRelease.id);

        const identity = toRelease.getComponent('identity');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'business',
            text: `${promotion.name} releases ${identity?.name || 'a wrestler'} from their roster.`,
            type: 'contract'
          }
        });
      }
    }
  }

  /**
   * Generates initial promotions for a new game
   * @param {object} state - Game state
   * @param {number} count - Number of promotions to generate
   */
  static generateInitialPromotions(state, count = 6) {
    // Check for real-life data
    const realLife = dataManager.getRealLife();

    if (realLife && realLife.promotions) {
      realLife.promotions.forEach((pData, i) => {
        const tierKey = pData.tier || 'regional';
        const promotion = {
          id: pData.id || `promo_${i}`,
          name: pData.name,
          shortName: pData.shortName,
          region: pData.region || 'USA',
          prestige: pData.prestige || 50,
          roster: [], // Will be populated in generateNPCRosters
          shows: this.generateShowSchedule(tierKey),
          stylePreference: pData.stylePreference || 'Mixed',
          momentum: 50,
          isPlayerPromotion: false,
          realData: pData // Keep reference for roster generation
        };
        state.promotions.set(promotion.id, promotion);
      });
      return;
    }

    const tiers = ['indie', 'regional', 'national', 'global', 'regional', 'indie'];
    const names = [
      'Extreme Wrestling Alliance',
      'Technical Wrestling Showcase',
      'Hardcore Combat Federation',
      'Lucha Libre International',
      'Strong Style Pro',
      'Sports Entertainment Network'
    ];
    const regions = ['USA', 'Japan', 'Mexico', 'UK', 'Canada', 'Europe'];
    const styles = ['Mixed', 'Technical', 'Hardcore', 'Lucha', 'Strong Style', 'Sports Entertainment'];

    for (let i = 0; i < count; i++) {
      const tierKey = tiers[i];
      const tier = PROMOTION_TIERS[tierKey];

      const prestige = randomInt(tier.prestigeRange[0], tier.prestigeRange[1]);

      const promotion = {
        id: `promo_${i}`,
        name: names[i],
        region: regions[i],
        prestige,
        roster: [],
        shows: this.generateShowSchedule(tierKey),
        stylePreference: styles[i],
        momentum: 50,
        isPlayerPromotion: false
      };

      state.promotions.set(promotion.id, promotion);
    }
  }

  /**
   * Generates show schedule for a promotion
   * @private
   */
  static generateShowSchedule(tier) {
    if (tier === 'global' || tier === 'national') {
      return [
        { day: 5 }, // Saturday
      ];
    } else if (tier === 'regional') {
      return [
        { day: 5 }, // Saturday
        { day: 6 }, // Sunday
      ];
    } else {
      // Indie - shows multiple times a week
      return [
        { day: 2 }, // Wednesday
        { day: 5 }, // Saturday
        { day: 6 }, // Sunday
      ];
    }
  }
}

export default AIPromotionSystem;
