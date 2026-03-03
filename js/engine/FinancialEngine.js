/**
 * FinancialEngine for Mat Life: Wrestling Simulator
 * Step 1.10 of Implementation Plan
 * Income/expense processing per tick
 */

import { rollD20 } from '../core/Utils.js';
import { gameStateManager } from '../core/GameStateManager.js';

/**
 * FinancialEngine - Manages financial calculations and processing
 */
export class FinancialEngine {
  /**
   * Processes weekly finances for an entity
   * @param {Entity} entity - Entity to process
   * @param {object} state - Current game state
   * @returns {FinancialReport} Financial report for the week
   */
  static processWeeklyFinances(entity, state) {
    const financial = entity.getComponent('financial');
    const contract = entity.getComponent('contract');
    const popularity = entity.getComponent('popularity');
    const identity = entity.getComponent('identity');
    
    if (!financial) return null;

    let totalIncome = 0;
    let totalExpenses = 0;
    const incomeBreakdown = {};
    const expenseBreakdown = {};

    // 1. Contract Salary
    if (contract && contract.weeklySalary > 0) {
      const salary = contract.weeklySalary;
      totalIncome += salary;
      incomeBreakdown.salary = salary;
    }

    // 2. Merchandise Income
    if (popularity && contract) {
      const merchIncome = this.calculateMerchandiseIncome(
        popularity.overness,
        identity?.alignment || 'Face',
        contract.hasMerchCut || 0,
        100 // Default promotion reach
      );
      totalIncome += merchIncome;
      incomeBreakdown.merchandise = merchIncome;
    }

    // 3. Sponsorship Income
    const sponsorshipIncome = this.processSponsorships(financial);
    if (sponsorshipIncome > 0) {
      totalIncome += sponsorshipIncome;
      incomeBreakdown.sponsorships = sponsorshipIncome;
    }

    // 4. Side Hustles
    const sideHustleIncome = this.processSideHustles(financial);
    if (sideHustleIncome > 0) {
      totalIncome += sideHustleIncome;
      incomeBreakdown.sideHustles = sideHustleIncome;
    }

    // 5. Investment Returns
    const investmentReturns = this.processInvestments(financial);
    if (investmentReturns > 0) {
      totalIncome += investmentReturns;
      incomeBreakdown.investments = investmentReturns;
    } else if (investmentReturns < 0) {
      totalExpenses += Math.abs(investmentReturns);
      expenseBreakdown.investmentLosses = Math.abs(investmentReturns);
    }

    // 6. Weekly Expenses
    if (financial.weeklyExpenses > 0) {
      totalExpenses += financial.weeklyExpenses;
      expenseBreakdown.livingExpenses = financial.weeklyExpenses;
    }

    // 6b. Weekly road costs for contracted talent
    if (contract?.promotionId) {
      const roadCosts = 25;
      totalExpenses += roadCosts;
      expenseBreakdown.roadCosts = roadCosts;
    }

    // 7. Agent Fees (percentage of income)
    if (financial.agent && financial.agent.percentage > 0) {
      const agentFee = totalIncome * (financial.agent.percentage / 100);
      totalExpenses += agentFee;
      expenseBreakdown.agentFee = agentFee;
    }

    // 8. Investment Agent Fees
    if (financial.investmentAgent) {
      const invAgentFee = financial.investmentAgent.flatFee || 0;
      totalExpenses += invAgentFee;
      expenseBreakdown.investmentAgentFee = invAgentFee;
    }

    // 9. Medical Debt Payments
    if (financial.medicalDebt > 0) {
      const payment = Math.min(financial.medicalDebt, 100); // Minimum $100/week
      totalExpenses += payment;
      expenseBreakdown.medicalDebt = payment;
      financial.medicalDebt -= payment;
    }

    // Calculate net change
    const netChange = totalIncome - totalExpenses;
    financial.bankBalance += netChange;

    // Ensure balance doesn't go negative (bankruptcy handled elsewhere)
    if (financial.bankBalance < 0) {
      financial.bankBalance = 0;
    }

    return {
      totalIncome,
      totalExpenses,
      netChange,
      newBalance: financial.bankBalance,
      incomeBreakdown,
      expenseBreakdown
    };
  }

  /**
   * Calculates merchandise income
   * @param {number} overness - Entity's overness
   * @param {string} alignment - Face/Heel/Tweener
   * @param {number} merchCut - Merchandise cut percentage
   * @param {number} promotionReach - Promotion distribution reach
   * @returns {number} Weekly merchandise income
   */
  static calculateMerchandiseIncome(overness, alignment, merchCut, promotionReach) {
    // Alignment modifier
    let alignmentModifier = 1.0;
    if (alignment === 'Face') {
      alignmentModifier = 1.3;
    } else if (alignment === 'Tweener') {
      alignmentModifier = 1.15;
    }

    // Formula: overness * alignment * merchCut% * promotionReach / 100
    const baseIncome = overness * alignmentModifier * (merchCut / 100) * (promotionReach / 100);
    return Math.round(baseIncome);
  }

  /**
   * Processes sponsorships and returns weekly income
   * @param {FinancialComponent} financial - Financial component
   * @returns {number} Weekly sponsorship income
   */
  static processSponsorships(financial) {
    if (!financial.sponsorships || financial.sponsorships.length === 0) {
      return 0;
    }

    let totalIncome = 0;
    const activeSponsorships = [];

    for (const sponsorship of financial.sponsorships) {
      if (sponsorship.weeksRemaining > 0) {
        totalIncome += sponsorship.weeklyPay;
        sponsorship.weeksRemaining--;
        
        // Keep active sponsorships
        if (sponsorship.weeksRemaining > 0) {
          activeSponsorships.push(sponsorship);
        }
      }
    }

    // Update sponsorships list (remove expired)
    financial.sponsorships = activeSponsorships;

    return totalIncome;
  }

  /**
   * Processes side hustles and returns weekly income
   * @param {FinancialComponent} financial - Financial component
   * @returns {number} Weekly side hustle income
   */
  static processSideHustles(financial) {
    if (!financial.sideHustles || financial.sideHustles.length === 0) {
      return 0;
    }

    return financial.sideHustles.reduce((total, hustle) => {
      return total + (hustle.income || 0);
    }, 0);
  }

  /**
   * Processes investments and returns returns
   * @param {FinancialComponent} financial - Financial component
   * @returns {number} Net investment returns (positive or negative)
   */
  static processInvestments(financial) {
    if (!financial.investments || financial.investments.length === 0) {
      return 0;
    }

    let totalReturns = 0;
    const agentQuality = financial.investmentAgent?.quality || 10;

    for (const investment of financial.investments) {
      // Roll for investment success
      const roll = rollD20();
      const total = roll + agentQuality;
      const dc = 10;

      if (total >= dc) {
        // Success - earn return
        const returnAmount = investment.principal * (investment.returnRate || 0.05);
        totalReturns += returnAmount;
        investment.principal += returnAmount; // Compound
      } else {
        // Failure - lose money
        const lossAmount = investment.principal * 0.05;
        investment.principal -= lossAmount;
        totalReturns -= lossAmount;
      }
    }

    return Math.round(totalReturns);
  }

  /**
   * Calculates travel cost between regions
   * @param {string} fromRegion - Starting region
   * @param {string} toRegion - Destination region
   * @returns {number} Travel cost in dollars
   */
  static calculateTravelCost(fromRegion, toRegion) {
    if (fromRegion === toRegion) {
      return 50; // Same region
    }

    // Domestic travel
    if (this._isSameCountry(fromRegion, toRegion)) {
      return 200;
    }

    // International travel
    return 800;
  }

  /**
   * Adds a sponsorship
   * @param {Entity} entity - Entity to add sponsorship to
   * @param {object} sponsorship - Sponsorship details
   */
  static addSponsorship(entity, sponsorship) {
    const financial = entity.getComponent('financial');
    if (!financial) return;

    if (!financial.sponsorships) {
      financial.sponsorships = [];
    }

    financial.sponsorships.push({
      name: sponsorship.name,
      weeklyPay: sponsorship.weeklyPay,
      weeksRemaining: sponsorship.weeksRemaining
    });
  }

  /**
   * Adds an investment
   * @param {Entity} entity - Entity to add investment to
   * @param {object} investment - Investment details
   */
  static addInvestment(entity, investment) {
    const financial = entity.getComponent('financial');
    if (!financial) return;

    if (!financial.investments) {
      financial.investments = [];
    }

    // Deduct principal from balance
    if (financial.bankBalance >= investment.principal) {
      financial.bankBalance -= investment.principal;
      financial.investments.push({
        name: investment.name,
        principal: investment.principal,
        returnRate: investment.returnRate || 0.05
      });
      return true;
    }

    return false;
  }

  /**
   * Adds medical debt
   * @param {Entity} entity - Entity to add debt to
   * @param {number} amount - Debt amount
   */
  static addMedicalDebt(entity, amount) {
    const financial = entity.getComponent('financial');
    if (financial) {
      financial.medicalDebt += amount;
    }
  }

  /**
   * Checks if two regions are in the same country
   * @private
   * @param {string} region1 - First region
   * @param {string} region2 - Second region
   * @returns {boolean}
   */
  static _isSameCountry(region1, region2) {
    // Simple heuristic - check if they share country indicators
    const usRegions = ['USA', 'East Coast', 'West Coast', 'Midwest', 'South'];
    const japanRegions = ['Japan', 'Tokyo', 'Osaka'];
    const ukRegions = ['UK', 'England', 'Scotland', 'Wales'];
    
    const regionSets = [usRegions, japanRegions, ukRegions];
    
    for (const set of regionSets) {
      if (set.includes(region1) && set.includes(region2)) {
        return true;
      }
    }
    
    return false;
  }
}

/**
 * @typedef {object} FinancialReport
 * @property {number} totalIncome - Total income for the week
 * @property {number} totalExpenses - Total expenses for the week
 * @property {number} netChange - Net financial change
 * @property {number} newBalance - New bank balance
 * @property {object} incomeBreakdown - Breakdown by source
 * @property {object} expenseBreakdown - Breakdown by category
 */

export default FinancialEngine;
