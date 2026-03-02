/**
 * PlayerInfoPanel for Mat Life: Wrestling Simulator
 * Step 2.4 of Implementation Plan
 * Top bar with player stats and info
 */

import { capitalize } from '../core/Utils.js';

/**
 * PlayerInfoPanel - Renders the player info header
 */
export class PlayerInfoPanel {
  constructor() {
    this.container = document.getElementById('player-info');
  }

  /**
   * Renders the player info panel
   * @param {object} state - Current game state
   */
  render(state) {
    if (!state || !state.player || !state.player.entityId) {
      return;
    }

    const player = state.entities.get(state.player.entityId);
    if (!player) {
      return;
    }

    // Get components
    const identity = player.getComponent('identity');
    const physicalStats = player.getComponent('physicalStats');
    const inRingStats = player.getComponent('inRingStats');
    const entertainmentStats = player.getComponent('entertainmentStats');
    const condition = player.getComponent('condition');
    const popularity = player.getComponent('popularity');
    const careerStats = player.getComponent('careerStats');
    const contract = player.getComponent('contract');

    // Update basic info
    if (identity) {
      this.updateElement('player-name', identity.name);
      this.updateElement('player-gimmick', identity.gimmick || 'Unknown');
      
      const alignmentEl = document.getElementById('player-alignment');
      if (alignmentEl) {
        alignmentEl.textContent = identity.alignment;
        alignmentEl.className = `alignment alignment-${identity.alignment.toLowerCase()}`;
      }
    }

    // Update promotion info
    if (contract && contract.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      this.updateElement('promotion-name', promotion?.name || 'Unknown');
    } else {
      this.updateElement('promotion-name', 'Independent');
    }

    // Update key stats
    if (physicalStats) {
      this.updateElement('stat-strength', physicalStats.strength);
    }
    if (inRingStats) {
      this.updateElement('stat-aerial', inRingStats.aerial);
    }
    if (entertainmentStats) {
      this.updateElement('stat-mic', entertainmentStats.micSkills);
    }

    // Update bars
    if (condition) {
      this.updateBar('health', condition.health, 100);
      this.updateBar('energy', condition.energy, 100);
    }
    if (popularity) {
      this.updateBar('momentum', popularity.momentum, 100);
    }

    // Update metrics
    if (popularity) {
      this.updateElement('metric-overness', popularity.overness);
    }
    if (careerStats) {
      const record = `${careerStats.totalWins}-${careerStats.totalLosses}-${careerStats.draws}`;
      this.updateElement('metric-record', record);
    }
  }

  /**
   * Updates a text element
   * @private
   * @param {string} id - Element ID
   * @param {string} value - Value to set
   */
  updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  /**
   * Updates a progress bar
   * @private
   * @param {string} type - Bar type (health, energy, momentum)
   * @param {number} current - Current value
   * @param {number} max - Maximum value
   */
  updateBar(type, current, max) {
    const fill = document.getElementById(`${type}-fill`);
    const value = document.getElementById(`${type}-value`);
    
    if (fill) {
      const percentage = Math.max(0, Math.min(100, (current / max) * 100));
      fill.style.width = `${percentage}%`;
    }
    
    if (value) {
      value.textContent = `${Math.round(current)}/${max}`;
    }
  }
}

export default PlayerInfoPanel;
