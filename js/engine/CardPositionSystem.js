/**
 * CardPositionSystem for Mat Life: Wrestling Simulator
 * Phase 3.1 - Card Position System
 * Manages wrestler positioning on the show card
 */

import { gameStateManager } from '../core/GameStateManager.js';

/**
 * Card positions from lowest to highest
 */
const CARD_POSITIONS = [
  { key: 'dark_match', name: 'Dark Match', salaryMod: 0.5, matchTypes: ['Standard Singles'] },
  { key: 'pre_show', name: 'Pre-Show', salaryMod: 0.7, matchTypes: ['Standard Singles'] },
  { key: 'opener', name: 'Opening Act', salaryMod: 0.85, matchTypes: ['Standard Singles', 'Tag Team'] },
  { key: 'mid_card', name: 'Mid-Card', salaryMod: 1.0, matchTypes: ['Standard Singles', 'Tag Team', 'Triple Threat'] },
  { key: 'upper_mid', name: 'Upper Mid-Card', salaryMod: 1.3, matchTypes: ['Standard Singles', 'Tag Team', 'Triple Threat', 'Fatal Four Way'] },
  { key: 'main_event', name: 'Main Event', salaryMod: 2.0, matchTypes: ['Standard Singles', 'Tag Team', 'No DQ', 'Steel Cage', 'Last Man Standing'] }
];

/**
 * Thresholds for position advancement
 */
const POSITION_THRESHOLDS = {
  dark_match: { overness: 0, momentum: 0 },
  pre_show: { overness: 15, momentum: 10 },
  opener: { overness: 25, momentum: 20 },
  mid_card: { overness: 40, momentum: 30 },
  upper_mid: { overness: 60, momentum: 50 },
  main_event: { overness: 80, momentum: 70 }
};

/**
 * Evaluation period in weeks
 */
const EVALUATION_PERIOD = 4;

/**
 * CardPositionSystem - Manages card positioning and advancement
 */
export class CardPositionSystem {
  /**
   * Ensures champions are not kept in low card positions.
   * World champions are at least Main Event; other champions at least Upper Mid-Card.
   * @param {object} state - Game state
   * @param {string|null} [promotionId] - Optional promotion filter
   */
  static syncChampionPositions(state, promotionId = null) {
    if (!state?.championships) return;

    const ensureAtLeast = (entity, minPositionKey) => {
      const contract = entity?.getComponent('contract');
      if (!contract?.promotionId) return;
      const currentKey = contract.position || 'dark_match';
      const currentIdx = CARD_POSITIONS.findIndex(p => p.key === currentKey);
      const minIdx = CARD_POSITIONS.findIndex(p => p.key === minPositionKey);
      if (minIdx === -1 || currentIdx >= minIdx) return;
      contract.position = minPositionKey;
    };

    for (const championship of state.championships.values()) {
      if (!championship?.currentChampion) continue;
      if (promotionId && championship.promotionId !== promotionId) continue;

      const champion = state.entities.get(championship.currentChampion);
      if (!champion) continue;

      const minPosition = championship.type === 'world' ? 'main_event' : 'upper_mid';
      ensureAtLeast(champion, minPosition);
    }
  }

  /**
   * Evaluates a wrestler's performance and potentially changes position
   * @param {Entity} wrestler - Wrestler entity
   * @param {object} promotion - Promotion object
   * @returns {object} Evaluation result
   */
  static evaluatePosition(wrestler, promotion) {
    const contract = wrestler.getComponent('contract');
    const popularity = wrestler.getComponent('popularity');
    const careerStats = wrestler.getComponent('careerStats');

    if (!contract || !popularity) {
      return { error: 'Missing required components' };
    }

    const currentPosition = contract.position || 'dark_match';
    const currentIndex = CARD_POSITIONS.findIndex(p => p.key === currentPosition);

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(wrestler);

    // Check for promotion
    const nextPosition = CARD_POSITIONS[currentIndex + 1];
    if (nextPosition) {
      const threshold = POSITION_THRESHOLDS[nextPosition.key];
      if (popularity.overness >= threshold.overness && 
          popularity.momentum >= threshold.momentum &&
          performanceScore >= 70) {
        return this.promoteWrestler(wrestler, promotion, nextPosition.key);
      }
    }

    // Check for demotion (poor performance over evaluation period)
    if (performanceScore < 30 && currentIndex > 0) {
      const prevPosition = CARD_POSITIONS[currentIndex - 1];
      return this.demoteWrestler(wrestler, promotion, prevPosition.key);
    }

    return {
      changed: false,
      position: currentPosition,
      positionName: CARD_POSITIONS[currentIndex].name,
      performanceScore
    };
  }

  /**
   * Calculates performance score (0-100)
   * @private
   */
  static calculatePerformanceScore(wrestler) {
    const careerStats = wrestler.getComponent('careerStats');
    const popularity = wrestler.getComponent('popularity');

    if (!careerStats) return 50;

    let score = 50;

    // Win/loss ratio (last 10 matches)
    if (careerStats.starRatings && careerStats.starRatings.length > 0) {
      const recentMatches = careerStats.starRatings.slice(-10);
      const avgRating = recentMatches.reduce((a, b) => a + b, 0) / recentMatches.length;
      score += (avgRating - 2.5) * 10; // 2.5★ is neutral
    }

    // Momentum factor
    if (popularity) {
      score += (popularity.momentum - 50) * 0.3;
    }

    // Consecutive wins bonus
    if (careerStats.consecutiveWins > 3) {
      score += careerStats.consecutiveWins * 2;
    }

    // Consecutive losses penalty
    if (careerStats.consecutiveWins < 0) {
      score += careerStats.consecutiveWins * 3;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Promotes a wrestler to a higher card position
   * @private
   */
  static promoteWrestler(wrestler, promotion, newPositionKey) {
    const contract = wrestler.getComponent('contract');
    const identity = wrestler.getComponent('identity');
    const newPosition = CARD_POSITIONS.find(p => p.key === newPositionKey);

    if (!contract || !newPosition) return { error: 'Invalid promotion' };

    const oldPosition = contract.position;
    contract.position = newPositionKey;

    // Increase salary with promotion
    const oldSalary = contract.weeklySalary;
    contract.weeklySalary = Math.floor(contract.weeklySalary * newPosition.salaryMod);

    // Log promotion
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `📈 PROMOTION! ${identity?.name} moved from ${CARD_POSITIONS.find(p => p.key === oldPosition)?.name} to ${newPosition.name}! Salary increased to $${contract.weeklySalary}/week.`,
        type: 'promotion',
        oldPosition,
        newPosition: newPositionKey
      }
    });

    return {
      changed: true,
      direction: 'up',
      oldPosition,
      newPosition: newPositionKey,
      newPositionName: newPosition.name,
      salaryIncrease: contract.weeklySalary - oldSalary
    };
  }

  /**
   * Demotes a wrestler to a lower card position
   * @private
   */
  static demoteWrestler(wrestler, promotion, newPositionKey) {
    const contract = wrestler.getComponent('contract');
    const identity = wrestler.getComponent('identity');
    const newPosition = CARD_POSITIONS.find(p => p.key === newPositionKey);

    if (!contract || !newPosition) return { error: 'Invalid demotion' };

    const oldPosition = contract.position;
    contract.position = newPositionKey;

    // Decrease salary with demotion
    const oldSalary = contract.weeklySalary;
    contract.weeklySalary = Math.max(50, Math.floor(contract.weeklySalary * newPosition.salaryMod));

    // Log demotion
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `📉 DEMOTION. ${identity?.name} moved from ${CARD_POSITIONS.find(p => p.key === oldPosition)?.name} to ${newPosition.name}. Salary reduced to $${contract.weeklySalary}/week.`,
        type: 'demotion',
        oldPosition,
        newPosition: newPositionKey
      }
    });

    return {
      changed: true,
      direction: 'down',
      oldPosition,
      newPosition: newPositionKey,
      newPositionName: newPosition.name,
      salaryDecrease: oldSalary - contract.weeklySalary
    };
  }

  /**
   * Gets available match types for current position
   * @param {Entity} wrestler - Wrestler entity
   * @returns {string[]} Available match types
   */
  static getAvailableMatchTypes(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract?.position) return ['Standard Singles'];

    const position = CARD_POSITIONS.find(p => p.key === contract.position);
    return position?.matchTypes || ['Standard Singles'];
  }

  /**
   * Gets card position info
   * @param {string} positionKey - Position key
   * @returns {object} Position info
   */
  static getPositionInfo(positionKey) {
    return CARD_POSITIONS.find(p => p.key === positionKey) || CARD_POSITIONS[0];
  }

  /**
   * Gets next promotion requirements
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object} Requirements
   */
  static getNextPromotionRequirements(wrestler) {
    const contract = wrestler.getComponent('contract');
    const currentIndex = CARD_POSITIONS.findIndex(p => p.key === (contract?.position || 'dark_match'));
    const nextPosition = CARD_POSITIONS[currentIndex + 1];

    if (!nextPosition) {
      return { canPromote: false, reason: 'Already at top position' };
    }

    const threshold = POSITION_THRESHOLDS[nextPosition.key];
    const popularity = wrestler.getComponent('popularity');

    return {
      canPromote: true,
      nextPosition: nextPosition.name,
      requirements: {
        overness: { current: popularity?.overness || 0, needed: threshold.overness },
        momentum: { current: popularity?.momentum || 0, needed: threshold.momentum }
      }
    };
  }

  /**
   * Evaluates all wrestlers in a promotion
   * @param {object} promotion - Promotion object
   * @param {object} state - Game state
   */
  static evaluateAllRosters(state) {
    // Keep champions near the top of the card before normal evaluations.
    this.syncChampionPositions(state);

    for (const promotion of state.promotions.values()) {
      if (!promotion.roster) continue;

      for (const wrestlerId of promotion.roster) {
        const wrestler = state.entities.get(wrestlerId);
        if (wrestler && !wrestler.isPlayer) {
          this.evaluatePosition(wrestler, promotion);
        }
      }
    }
  }
}

export default CardPositionSystem;
