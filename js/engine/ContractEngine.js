/**
 * Contract/Negotiation Engine for Mat Life: Wrestling Simulator
 * Step 4.2 of Implementation Plan
 * Contract generation, negotiation, and management
 */

import ResolutionEngine from './ResolutionEngine.js';
import { gameStateManager } from '../core/GameStateManager.js';
import { clamp } from '../core/Utils.js';

/**
 * Maximum contract length in weeks
 */
const MAX_CONTRACT_LENGTH = 1;

/**
 * ContractEngine - Handles all contract-related operations
 */
export class ContractEngine {
  /**
   * Generates a contract offer from a promotion
   * @param {object} promotion - Promotion object
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object} Contract offer
   */
  static generateOffer(promotion, wrestler) {
    const wrestlerPop = wrestler.getComponent('popularity')?.overness || 5;
    const wrestlerStats = wrestler.getComponent('inRingStats');
    const avgStats = wrestlerStats ?
      (wrestlerStats.brawling + wrestlerStats.technical + wrestlerStats.aerial) / 3 : 10;

    // Base salary based on promotion prestige and wrestler value
    const baseSalary = this.calculateBaseSalary(promotion.prestige, wrestlerPop, avgStats);

    // Offer details
    const offer = {
      promotionId: promotion.id,
      promotionName: promotion.name,
      weeklySalary: baseSalary,
      lengthWeeks: 1,
      remainingWeeks: 1,
      hasCreativeControl: false,
      hasMerchCut: wrestlerPop >= 50 ? 5 : 0, // 5% default for popular wrestlers
      tvAppearanceBonus: Math.floor(baseSalary * 0.5),
      noCompeteWeeks: wrestlerPop >= 70 ? 12 : 4,
      position: this.calculateCardPosition(wrestlerPop, promotion),
      benefits: []
    };

    // Add benefits based on prestige
    if (promotion.prestige >= 80) {
      offer.benefits.push('Health Insurance');
      offer.benefits.push('Travel Covered');
    }

    return offer;
  }

  /**
   * Calculates base salary
   * @private
   */
  static calculateBaseSalary(promotionPrestige, wrestlerPop, avgStats) {
    // Base calculation
    let salary = 100; // Minimum indie pay

    // Promotion multiplier
    if (promotionPrestige >= 90) salary = 2000; // WWE level
    else if (promotionPrestige >= 75) salary = 1200; // AEW level
    else if (promotionPrestige >= 60) salary = 700; // NJPW level
    else if (promotionPrestige >= 40) salary = 400; // ROH level
    else if (promotionPrestige >= 20) salary = 200; // Regional indies

    // Wrestler value modifier
    const valueMod = (wrestlerPop / 100) + (avgStats / 20);
    salary = Math.floor(salary * valueMod);

    return salary;
  }

  /**
   * Calculates card position
   * @private
   */
  static calculateCardPosition(overness, promotion) {
    if (overness >= 80) return 'main_event';
    if (overness >= 60) return 'upper_mid';
    if (overness >= 40) return 'mid_card';
    if (overness >= 25) return 'opener';
    return 'dark_match';
  }

  /**
   * Normalizes card position names to keys
   * @private
   */
  static normalizePosition(position) {
    if (!position) return 'mid_card';

    const normalized = position.toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const mapping = {
      'main_event': 'main_event',
      'upper_midcard': 'upper_mid',
      'upper_mid_card': 'upper_mid',
      'upper_mid': 'upper_mid',
      'midcard': 'mid_card',
      'mid_card': 'mid_card',
      'opening_act': 'opener',
      'opener': 'opener',
      'pre_show': 'pre_show',
      'preshow': 'pre_show',
      'dark_match': 'dark_match'
    };

    return mapping[normalized] || 'mid_card';
  }

  /**
   * Negotiates a contract clause
   * @param {Entity} wrestler - Wrestler entity
   * @param {string} clause - Clause to negotiate
   * @param {object} offer - Current offer
   * @param {number} targetValue - Target value
   * @returns {object} Negotiation result
   */
  static negotiateClause(wrestler, clause, offer, targetValue) {
    const charisma = wrestler.getComponent('entertainmentStats')?.charisma ?? 10;
    const agent = wrestler.getComponent('financial')?.agent;

    // Agent quality bonus
    const agentBonus = agent ? agent.quality || 0 : 0;

    // Determine DC based on request
    let dc = 12;
    const currentValue = offer[clause];
    const difference = Math.abs(targetValue - currentValue);

    if (difference > currentValue * 0.5) dc = 16;
    if (difference > currentValue) dc = 20;

    // Resolution
    const resolution = ResolutionEngine.resolve({
      actor: wrestler,
      action: 'Negotiate Contract',
      stat: 'charisma',
      dc,
      context: {
        bonuses: [Math.floor(agentBonus / 4)]
      }
    });

    let success = false;
    let resultValue = currentValue;
    let narrative = '';

    switch (resolution.outcome) {
      case 'CRITICAL_SUCCESS':
        success = true;
        resultValue = Math.floor(targetValue * 1.1);
        narrative = 'Incredible negotiation! You got even more than you asked for!';
        break;

      case 'SUCCESS':
        success = true;
        resultValue = targetValue;
        narrative = 'Negotiation successful. They agreed to your terms.';
        break;

      case 'FAILURE':
        success = false;
        resultValue = Math.floor((currentValue + targetValue) / 2);
        narrative = 'They wouldn\'t budge that far. Counter-offer made.';
        break;

      case 'CRITICAL_FAILURE':
        success = false;
        resultValue = currentValue;
        narrative = 'The negotiation backfired. They\'re losing interest.';
        break;
    }

    return {
      success,
      clause,
      resultValue,
      narrative,
      resolution
    };
  }

  /**
   * Evaluates an offer for AI wrestlers
   * @param {Entity} wrestler - Wrestler entity
   * @param {object} offer - Contract offer
   * @returns {object} Evaluation result
   */
  static evaluateOffer(wrestler, offer) {
    const currentContract = wrestler.getComponent('contract');
    const popularity = wrestler.getComponent('popularity');

    let score = 0;
    const factors = [];

    // Salary comparison
    if (currentContract && currentContract.weeklySalary > 0) {
      const salaryDiff = offer.weeklySalary - currentContract.weeklySalary;
      if (salaryDiff > 0) {
        score += Math.floor(salaryDiff / 50);
        factors.push('Higher salary');
      } else if (salaryDiff < 0) {
        score -= Math.floor(Math.abs(salaryDiff) / 50);
        factors.push('Lower salary');
      }
    } else {
      // No current contract - any offer is good
      score += 10;
      factors.push('First contract offer');
    }

    // Prestige check
    const promotion = gameStateManager.getStateRef().promotions.get(offer.promotionId);
    const normalizedPosition = this.normalizePosition(offer.position);
    if (promotion) {
      if (promotion.prestige >= 80) {
        score += 15;
        factors.push('Major promotion');
      } else if (promotion.prestige >= 50) {
        score += 8;
        factors.push('Respected promotion');
      }

      // Card position
      if (normalizedPosition === 'main_event') {
        score += 20;
        factors.push('Main event position');
      } else if (normalizedPosition === 'upper_mid') {
        score += 10;
        factors.push('Upper midcard push');
      }
    }

    // Creative control
    if (offer.hasCreativeControl) {
      score += 10;
      factors.push('Creative control');
    }

    // Merch cut
    if (offer.hasMerchCut >= 10) {
      score += 5;
      factors.push('Good merchandise deal');
    }

    // Decision
    const willAccept = score >= 15;

    return {
      willAccept,
      score,
      factors,
      confidence: Math.min(100, Math.abs(score) * 5)
    };
  }

  /**
   * Signs a contract
   * @param {Entity} wrestler - Wrestler entity
   * @param {object} offerOrPromotion - Contract offer or promotion
   * @param {string} [position] - Card position (if promotion provided)
   * @param {number} [lengthWeeks] - Contract length (if promotion provided)
   * @param {number} [weeklySalary] - Weekly salary (if promotion provided)
   */
  static signContract(wrestler, offerOrPromotion, position = 'mid_card', lengthWeeks = 8, weeklySalary = null) {
    const contract = wrestler.getComponent('contract');
    if (!contract) return { success: false, error: 'No contract component' };

    // Check for no-compete clause
    if (contract.noCompeteActive && contract.noCompeteWeeksRemaining > 0) {
      return {
        success: false,
        error: `Cannot sign new contract: No-compete clause active (${contract.noCompeteWeeksRemaining} weeks remaining)`
      };
    }

    const state = gameStateManager.getStateRef();

    let offer = offerOrPromotion;
    if (offerOrPromotion && !offerOrPromotion.promotionId && offerOrPromotion.id) {
      const promotion = offerOrPromotion;
      const resolvedLength = Math.min(lengthWeeks ?? 8, MAX_CONTRACT_LENGTH);
      const resolvedSalary = weeklySalary ?? contract.weeklySalary ?? 0;
      const resolvedPosition = this.normalizePosition(position);

      offer = {
        promotionId: promotion.id,
        promotionName: promotion.name,
        weeklySalary: resolvedSalary,
        lengthWeeks: resolvedLength,
        remainingWeeks: resolvedLength,
        hasCreativeControl: contract.hasCreativeControl ?? false,
        hasMerchCut: contract.hasMerchCut ?? 0,
        tvAppearanceBonus: contract.tvAppearanceBonus ?? 0,
        noCompeteWeeks: contract.noCompeteWeeks ?? 0,
        position: resolvedPosition
      };
    }

    if (!offer) return { success: false, error: 'Invalid contract offer' };

    offer.position = this.normalizePosition(offer.position);

    if (!offer.promotionName && offer.promotionId) {
      const promotion = state.promotions.get(offer.promotionId);
      if (promotion) {
        offer.promotionName = promotion.name;
      }
    }

    // Cap contract length to maximum
    if (offer.lengthWeeks != null) {
      offer.lengthWeeks = Math.min(offer.lengthWeeks, MAX_CONTRACT_LENGTH);
      if (offer.remainingWeeks == null) {
        offer.remainingWeeks = offer.lengthWeeks;
      }
    }

    // Store old promotion ID before updating
    const oldPromotionId = contract.promotionId;

    // Update contract component via dispatch to trigger UI refresh
    gameStateManager.dispatch('UPDATE_COMPONENT', {
      entityId: wrestler.id,
      componentName: 'contract',
      updates: {
        promotionId: offer.promotionId,
        promotionName: offer.promotionName,
        weeklySalary: offer.weeklySalary,
        lengthWeeks: offer.lengthWeeks,
        remainingWeeks: offer.remainingWeeks,
        hasCreativeControl: offer.hasCreativeControl,
        hasMerchCut: offer.hasMerchCut,
        tvAppearanceBonus: offer.tvAppearanceBonus,
        noCompeteWeeks: offer.noCompeteWeeks,
        position: offer.position
      }
    });

    // Remove from old promotion roster if switching
    if (oldPromotionId && oldPromotionId !== offer.promotionId) {
      const oldPromotion = state.promotions.get(oldPromotionId);
      if (oldPromotion) {
        oldPromotion.roster = oldPromotion.roster.filter(id => id !== wrestler.id);
      }
    }

    // Add to new roster
    const promotion = state.promotions.get(offer.promotionId);
    if (promotion && !promotion.roster.includes(wrestler.id)) {
      promotion.roster.push(wrestler.id);
    }

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `Signed contract with ${offer.promotionName}: $${offer.weeklySalary}/week`,
        type: 'contract'
      }
    });

    return { success: true, offer };
  }

  /**
   * Releases a wrestler from contract
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object} Release result
   */
  static releaseWrestler(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract || !contract.promotionId) {
      return { error: 'No contract to release' };
    }

    const promotion = gameStateManager.getStateRef().promotions.get(contract.promotionId);
    const buyoutCost = contract.remainingWeeks * contract.weeklySalary;

    // Remove from roster
    if (promotion) {
      promotion.roster = promotion.roster.filter(id => id !== wrestler.id);
    }

    // Apply no-compete
    contract.noCompeteActive = true;
    contract.noCompeteWeeksRemaining = contract.noCompeteWeeks;

    // Clear contract
    const oldPromotion = contract.promotionId;
    contract.promotionId = null;
    contract.weeklySalary = 0;

    return {
      success: true,
      buyoutCost,
      noCompeteWeeks: contract.noCompeteWeeks,
      oldPromotion
    };
  }

  /**
   * Processes contract expiration
   * @param {Entity} wrestler - Wrestler entity
   */
  static processContractExpiration(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract) return;

    if (!contract.promotionId || contract.remainingWeeks <= 0) {
      return { expired: false, weeksRemaining: contract.remainingWeeks };
    }

    contract.remainingWeeks--;

    if (contract.remainingWeeks <= 0) {
      if (!wrestler.isPlayer) {
        // NPCs auto-renew to keep rosters populated
        contract.remainingWeeks = MAX_CONTRACT_LENGTH;
        return { expired: false, renewed: true };
      }

      // Player contract expired
      const promotion = gameStateManager.getStateRef().promotions.get(contract.promotionId);
      if (promotion) {
        promotion.roster = promotion.roster.filter(id => id !== wrestler.id);
      }

      contract.promotionId = null;
      contract.weeklySalary = 0;

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: 'Contract has expired. You are now a free agent.',
          type: 'contract'
        }
      });

      return { expired: true };
    }

    return { expired: false, weeksRemaining: contract.remainingWeeks };
  }

  /**
   * Processes no-compete clause daily (decrements counter)
   * Should be called once per day for all entities
   * @param {Entity} wrestler - Wrestler entity
   */
  static processNoCompeteDaily(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract) return;

    if (contract.noCompeteActive && contract.noCompeteWeeksRemaining > 0) {
      contract.noCompeteWeeksRemaining--;

      if (contract.noCompeteWeeksRemaining <= 0) {
        contract.noCompeteActive = false;

        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: 'Your no-compete clause has expired. You are now free to sign with any promotion.',
            type: 'contract'
          }
        });
      }
    }
  }

  /**
   * Checks if wrestler is under no-compete restriction
   * @param {Entity} wrestler - Wrestler entity
   * @returns {boolean} True if no-compete is active
   */
  static hasNoCompete(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract) return false;

    return contract.noCompeteActive === true && contract.noCompeteWeeksRemaining > 0;
  }

  /**
   * Renews a contract
   * @param {Entity} wrestler - Wrestler entity
   * @param {object} terms - New terms
   */
  static renewContract(wrestler, terms) {
    const contract = wrestler.getComponent('contract');
    if (!contract || !contract.promotionId) {
      return { error: 'No active contract to renew' };
    }

    // Apply new terms
    Object.assign(contract, terms);
    contract.remainingWeeks = contract.lengthWeeks;

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `Contract renewed with ${contract.promotionName}`,
        type: 'contract'
      }
    });

    return { success: true };
  }

  /**
   * Gets contract summary for display
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object} Contract summary
   */
  static getContractSummary(wrestler) {
    const contract = wrestler.getComponent('contract');
    if (!contract || !contract.promotionId) {
      return { hasContract: false };
    }

    const promotion = gameStateManager.getStateRef().promotions.get(contract.promotionId);

    return {
      hasContract: true,
      promotionName: promotion?.name || 'Unknown',
      weeklySalary: contract.weeklySalary,
      remainingWeeks: contract.remainingWeeks,
      position: contract.position,
      hasCreativeControl: contract.hasCreativeControl,
      hasMerchCut: contract.hasMerchCut,
      isExpiringSoon: contract.remainingWeeks <= 8
    };
  }
}

export default ContractEngine;
