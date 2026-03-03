/**
 * PlayerInfoPanel for Mat Life: Wrestling Simulator
 * Step 2.4 of Implementation Plan
 * Top bar with player stats and info
 */

import { gameCalendar } from '../core/GameCalendar.js';
import CardPositionSystem from '../engine/CardPositionSystem.js';

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
        const alignment = identity.alignment || 'Face';
        alignmentEl.textContent = alignment;
        alignmentEl.className = `alignment alignment-${alignment.toLowerCase()}`;
      }
    }

    // Update promotion info
    if (contract && contract.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      const promotionText = promotion?.name || 'Unknown';
      const positionText = contract.position ? ` (${CardPositionSystem.getPositionInfo(contract.position).name})` : '';
      const isShowDay = promotion ? gameCalendar.isShowDay(promotion) : false;
      this.updateElement('promotion-name', isShowDay ? `${promotionText}${positionText} 📺 LIVE SHOW!` : `${promotionText}${positionText}`);
    } else {
      this.updateElement('promotion-name', 'Independent');
    }

    // Update age display
    if (identity && identity.age) {
      const ageEl = document.getElementById('player-age');
      if (ageEl) {
        ageEl.textContent = `Age: ${identity.age}`;
      }
    }

    // Update key stats
    if (physicalStats) {
      this.updateElement('stat-strength', Math.round(physicalStats.strength));
    }
    if (inRingStats) {
      this.updateElement('stat-aerial', Math.round(inRingStats.aerial));
    }
    if (entertainmentStats) {
      this.updateElement('stat-mic', Math.round(entertainmentStats.micSkills));
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
