/**
 * Contract/Negotiation Engine for Mat Life: Wrestling Simulator
 * Step 4.2 of Implementation Plan
 * Contract generation, negotiation, and management
 */

import ResolutionEngine from './ResolutionEngine.js';
import { gameStateManager } from '../core/GameStateManager.js';
import { clamp } from '../core/Utils.js';

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
      lengthWeeks: 52, // 1 year default
      remainingWeeks: 52,
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
    if (overness >= 80) return 'Main Event';
    if (overness >= 60) return 'Upper Midcard';
    if (overness >= 40) return 'Midcard';
    if (overness >= 25) return 'Opening Act';
    return 'Dark Match';
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
    const charisma = wrestler.getComponent('entertainmentStats').charisma;
    const agent = wrestler.getComponent('financial').agent;
    
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
    if (promotion) {
      if (promotion.prestige >= 80) {
        score += 15;
        factors.push('Major promotion');
      } else if (promotion.prestige >= 50) {
        score += 8;
        factors.push('Respected promotion');
      }

      // Card position
      if (offer.position === 'Main Event') {
        score += 20;
        factors.push('Main event position');
      } else if (offer.position === 'Upper Midcard') {
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
   * @param {object} offer - Contract offer
   */
  static signContract(wrestler, offer) {
    const contract = wrestler.getComponent('contract');
    
    if (!contract) return false;

    // Update contract component
    Object.assign(contract, offer);
    
    // Add to roster
    const promotion = gameStateManager.getStateRef().promotions.get(offer.promotionId);
    if (promotion && !promotion.roster.includes(wrestler.id)) {
      promotion.roster.push(wrestler.id);
    }

    // Log
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: `Signed contract with ${offer.promotionName}: $${offer.weeklySalary}/week`,
        type: 'contract'
      }
    });

    return true;
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

    contract.remainingWeeks--;

    if (contract.remainingWeeks <= 0) {
      // Contract expired
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
