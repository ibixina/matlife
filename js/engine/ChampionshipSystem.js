/**
 * ChampionshipSystem for Mat Life: Wrestling Simulator
 * Phase 3.2 - Championship System
 * Manages titles, reigns, and title matches
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { generateUUID } from '../core/Utils.js';

/**
 * Championship types
 */
const CHAMPIONSHIP_TYPES = {
  world: { name: 'World Championship', prestige: 100 },
  secondary: { name: 'Secondary Championship', prestige: 70 },
  tag: { name: 'Tag Team Championship', prestige: 80 },
  womens: { name: 'Women\'s Championship', prestige: 90 },
  tertiary: { name: 'Tertiary Championship', prestige: 50 }
};

/**
 * ChampionshipSystem - Manages all championship functionality
 */
export class ChampionshipSystem {
  /**
   * Creates a new championship for a promotion
   * @param {object} promotion - Promotion object
   * @param {string} type - Championship type
   * @param {string} name - Championship name
   * @returns {object} Championship object
   */
  static createChampionship(promotion, type, name) {
    const typeInfo = CHAMPIONSHIP_TYPES[type];
    if (!typeInfo) return null;

    const championship = {
      id: generateUUID(),
      promotionId: promotion.id,
      name: name || typeInfo.name,
      type: type,
      prestige: typeInfo.prestige,
      currentChampion: null,
      reigns: [],
      createdWeek: gameStateManager.getStateRef().calendar.absoluteWeek
    };

    gameStateManager.dispatch('ADD_CHAMPIONSHIP', { championship });
    return championship;
  }

  /**
   * Initializes default championships for a promotion
   * @param {object} promotion - Promotion object
   */
  static initializePromotionChampionships(promotion) {
    const championships = [];
    const state = gameStateManager.getStateRef();

    // Sort roster by overness to pick champions
    const roster = (promotion.roster || [])
      .map(id => state.entities.get(id))
      .filter(e => e)
      .sort((a, b) => {
        const popA = a.getComponent('popularity')?.overness || 0;
        const popB = b.getComponent('popularity')?.overness || 0;
        return popB - popA;
      });

    const createAndAward = (type, name, rosterIndex) => {
      const champ = this.createChampionship(promotion, type, name);
      if (champ && roster[rosterIndex]) {
        this.awardChampionship(champ.id, roster[rosterIndex]);
      }
      return champ;
    };

    if (promotion.prestige >= 15) {
      // Secondary title (index 1 if available, otherwise 0)
      championships.push(createAndAward('secondary', `${promotion.name} National Championship`, Math.min(1, roster.length - 1)));
    }

    if (promotion.prestige >= 40) {
      // World title (index 0)
      championships.push(createAndAward('world', `${promotion.name} World Championship`, 0));
    }

    if (promotion.prestige >= 70) {
      // Tag titles (index 2-3)
      championships.push(createAndAward('tag', `${promotion.name} Tag Team Championship`, Math.min(2, roster.length - 1)));
    }

    return championships;
  }

  /**
   * Ensures championships in a promotion have champions assigned
   * @param {object} promotion - Promotion object
   */
  static ensurePromotionChampions(promotion) {
    const state = gameStateManager.getStateRef();
    const roster = (promotion.roster || [])
      .map(id => state.entities.get(id))
      .filter(e => e)
      .sort((a, b) => {
        const popA = a.getComponent('popularity')?.overness || 0;
        const popB = b.getComponent('popularity')?.overness || 0;
        return popB - popA;
      });

    if (roster.length === 0) return;

    for (const [championshipId, championship] of state.championships.entries()) {
      if (championship.promotionId !== promotion.id) continue;
      if (championship.currentChampion) continue;
      this.awardChampionship(championship.id || championshipId, roster[0]);
    }
  }

  /**
   * Awards a championship to a wrestler
   * @param {string} championshipId - Championship ID
   * @param {Entity} wrestler - New champion
   * @param {Entity} [previousChampion] - Previous champion (if any)
   * @returns {object} Award result
   */
  static awardChampionship(championshipId, wrestler, previousChampion = null) {
    const state = gameStateManager.getStateRef();
    const championship = state.championships.get(championshipId);

    if (!championship) return { error: 'Championship not found' };

    const currentWeek = state.calendar.absoluteWeek;
    const identity = wrestler.getComponent('identity');

    // End previous reign if exists
    if (championship.currentChampion && previousChampion) {
      const currentReign = championship.reigns[championship.reigns.length - 1];
      if (currentReign && !currentReign.endWeek) {
        currentReign.endWeek = currentWeek;
        currentReign.duration = currentWeek - currentReign.startWeek;
      }
    }

    // Start new reign
    const newReign = {
      championId: wrestler.id,
      championName: identity?.name || 'Unknown',
      startWeek: currentWeek,
      endWeek: null,
      duration: 0,
      defenses: 0,
      quality: 0
    };

    championship.reigns.push(newReign);
    championship.currentChampion = wrestler.id;

    // Update wrestler's career stats
    const careerStats = wrestler.getComponent('careerStats');
    if (careerStats) {
      if (!careerStats.titleReigns) careerStats.titleReigns = [];
      careerStats.titleReigns.push({
        championshipId,
        championshipName: championship.name,
        wonWeek: currentWeek
      });
      careerStats.totalTitleReigns = (careerStats.totalTitleReigns || 0) + 1;
    }

    // Update popularity
    const popularity = wrestler.getComponent('popularity');
    if (popularity) {
      popularity.overness = Math.min(100, popularity.overness + 10);
      popularity.momentum = Math.min(100, popularity.momentum + 20);
    }

    // Log
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'match',
        text: `🏆 NEW CHAMPION! ${identity?.name} wins the ${championship.name}!`,
        type: 'title-change',
        championship: championship.name
      }
    });

    return {
      success: true,
      championship: championship.name,
      champion: identity?.name
    };
  }

  /**
   * Records a title defense
   * @param {string} championshipId - Championship ID
   * @param {number} matchRating - Match rating
   */
  static recordDefense(championshipId, matchRating) {
    const state = gameStateManager.getStateRef();
    const championship = state.championships.get(championshipId);

    if (!championship || !championship.reigns.length) return;

    const currentReign = championship.reigns[championship.reigns.length - 1];
    if (currentReign && !currentReign.endWeek) {
      currentReign.defenses++;

      // Track average quality
      if (!currentReign.totalQuality) currentReign.totalQuality = 0;
      currentReign.totalQuality += matchRating;
      currentReign.quality = currentReign.totalQuality / currentReign.defenses;
    }
  }

  /**
   * Reassigns any titles held by a departing champion within a promotion
   * @param {string} promotionId - Promotion ID
   * @param {string} departingId - Wrestler ID leaving the promotion
   */
  static reassignTitlesForDeparture(promotionId, departingId) {
    const state = gameStateManager.getStateRef();
    const promotion = state.promotions.get(promotionId);
    if (!promotion) return;

    for (const [championshipId, championship] of state.championships.entries()) {
      if (championship.promotionId !== promotionId) continue;
      if (championship.currentChampion !== departingId) continue;

      // End the previous reign before assigning new champion
      const currentReign = championship.reigns[championship.reigns.length - 1];
      if (currentReign && !currentReign.endWeek) {
        currentReign.endWeek = state.calendar.absoluteWeek;
        currentReign.duration = state.calendar.absoluteWeek - currentReign.startWeek;
      }

      const roster = (promotion.roster || [])
        .filter(id => id !== departingId)
        .map(id => state.entities.get(id))
        .filter(e => e);

      if (roster.length === 0) {
        this.vacateChampionship(championship.id || championshipId, 'Champion left promotion');
        continue;
      }

      roster.sort((a, b) => {
        const popA = a.getComponent('popularity')?.overness || 0;
        const popB = b.getComponent('popularity')?.overness || 0;
        return popB - popA;
      });

      // Award with previousChampion flag to properly end old reign
      this.awardChampionship(championship.id || championshipId, roster[0], departingId);
    }
  }

  /**
   * Vacates a championship
   * @param {string} championshipId - Championship ID
   * @param {string} reason - Reason for vacation
   */
  static vacateChampionship(championshipId, reason = 'Vacated') {
    const state = gameStateManager.getStateRef();
    const championship = state.championships.get(championshipId);

    if (!championship || !championship.currentChampion) return;

    const currentWeek = state.calendar.absoluteWeek;
    const currentReign = championship.reigns[championship.reigns.length - 1];

    if (currentReign && !currentReign.endWeek) {
      currentReign.endWeek = currentWeek;
      currentReign.duration = currentWeek - currentReign.startWeek;
      currentReign.vacated = true;
      currentReign.vacationReason = reason;
    }

    const oldChampionId = championship.currentChampion;
    championship.currentChampion = null;

    // Log
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'match',
        text: `🏆 ${championship.name} has been vacated. ${reason}`,
        type: 'title-vacated'
      }
    });

    return { success: true };
  }

  /**
   * Gets championship info for display
   * @param {string} championshipId - Championship ID
   * @returns {object} Championship info
   */
  static getChampionshipInfo(championshipId) {
    const state = gameStateManager.getStateRef();
    const championship = state.championships.get(championshipId);

    if (!championship) return null;

    const currentReign = championship.reigns[championship.reigns.length - 1];
    let currentChampion = null;

    if (championship.currentChampion) {
      const champEntity = state.entities.get(championship.currentChampion);
      if (champEntity) {
        const identity = champEntity.getComponent('identity');
        currentChampion = {
          name: identity?.name || 'Unknown',
          reignLength: currentReign ? state.calendar.absoluteWeek - currentReign.startWeek : 0,
          defenses: currentReign?.defenses || 0
        };
      }
    }

    return {
      id: championship.id || championshipId,
      promotionId: championship.promotionId,
      name: championship.name,
      type: championship.type,
      prestige: championship.prestige,
      currentChampionId: championship.currentChampion,
      currentChampion,
      totalReigns: championship.reigns.length,
      history: championship.reigns.slice(-5) // Last 5 reigns
    };
  }

  /**
   * Gets all championships for a promotion
   * @param {string} promotionId - Promotion ID
   * @returns {object[]} Array of championships
   */
  static getPromotionChampionships(promotionId) {
    const state = gameStateManager.getStateRef();
    const championships = [];

    for (const [championshipId, championship] of state.championships.entries()) {
      if (championship.promotionId === promotionId) {
        const info = this.getChampionshipInfo(championship.id || championshipId);
        if (info) championships.push(info);
      }
    }

    return championships;
  }

  /**
   * Gets wrestler's championship history
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object[]} Championship history
   */
  static getWrestlerChampionships(wrestler) {
    const state = gameStateManager.getStateRef();
    const championships = [];

    for (const championship of state.championships.values()) {
      const reigns = championship.reigns.filter(r => r.championId === wrestler.id);

      if (reigns.length > 0) {
        championships.push({
          name: championship.name,
          reigns: reigns.map(r => ({
            startWeek: r.startWeek,
            endWeek: r.endWeek,
            duration: r.duration || (state.calendar.absoluteWeek - r.startWeek),
            defenses: r.defenses,
            quality: r.quality
          })),
          totalReigns: reigns.length,
          totalDefenses: reigns.reduce((sum, r) => sum + r.defenses, 0),
          isCurrent: championship.currentChampion === wrestler.id
        });
      }
    }

    return championships;
  }

  /**
   * Determines if a wrestler deserves a title shot
   * @param {Entity} wrestler - Wrestler entity
   * @param {object} promotion - Promotion object
   * @returns {object} Title shot eligibility
   */
  static checkTitleShotEligibility(wrestler, promotion) {
    const contract = wrestler.getComponent('contract');
    const popularity = wrestler.getComponent('popularity');
    const careerStats = wrestler.getComponent('careerStats');

    if (!contract || contract.promotionId !== promotion.id) {
      return { eligible: false, reason: 'Not under contract' };
    }

    const championships = this.getPromotionChampionships(promotion.id);
    if (championships.length === 0) {
      return { eligible: false, reason: 'No championships available' };
    }

    // Find best championship to challenge for
    const availableTitles = championships.filter(c => {
      if (!c) return false;
      if (!c.currentChampionId) return true;
      return c.currentChampionId !== wrestler.id;
    });

    if (availableTitles.length === 0) {
      return { eligible: false, reason: 'Already champion or no challengable titles' };
    }

    // Calculate eligibility score
    let score = 0;

    if (popularity) {
      score += popularity.overness * 0.4;
      score += popularity.momentum * 0.3;
    }

    if (careerStats) {
      score += (careerStats.consecutiveWins || 0) * 3;
      score += (careerStats.averageRating || 0) * 5;
    }

    const eligible = score >= 60;

    return {
      eligible,
      score,
      reason: eligible ? 'Title shot earned!' : 'Need more wins or momentum',
      availableTitles: availableTitles.map(t => t.name)
    };
  }

  /**
   * Gets longest reigns for a championship
   * @param {string} championshipId - Championship ID
   * @param {number} limit - Number of reigns to return
   * @returns {object[]} Top reigns
   */
  static getLongestReigns(championshipId, limit = 5) {
    const state = gameStateManager.getStateRef();
    const championship = state.championships.get(championshipId);

    if (!championship) return [];

    const sortedReigns = [...championship.reigns]
      .filter(r => r.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);

    return sortedReigns.map(r => ({
      champion: r.championName,
      duration: r.duration,
      defenses: r.defenses,
      quality: r.quality
    }));
  }
}

export default ChampionshipSystem;
