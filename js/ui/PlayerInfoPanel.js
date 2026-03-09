/**
 * PlayerInfoPanel for Mat Life: Wrestling Simulator
 * Step 2.4 of Implementation Plan
 * Top bar with player stats and info
 */

import { gameStateManager } from "../core/GameStateManager.js";
import { gameCalendar } from "../core/GameCalendar.js";
import CardPositionSystem from "../engine/CardPositionSystem.js";
import BookerModeEngine from "../engine/BookerModeEngine.js";
import CharacterEvolution from "../engine/CharacterEvolution.js";

/**
 * PlayerInfoPanel - Renders the player info header
 */
export class PlayerInfoPanel {
  constructor() {
    this.container = document.getElementById("player-info");
    this.initEventListeners();
  }

  initEventListeners() {
    const editBtn = document.getElementById("edit-identity-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => this.openIdentityModal());
    }

    const closeBtn = document.getElementById("close-identity-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeIdentityModal());
    }

    const modal = document.getElementById("identity-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeIdentityModal();
      });
    }
  }

  openIdentityModal() {
    const state = gameStateManager.getStateRef();
    if (!state || !state.player || !state.player.entityId) return;

    const player = state.entities.get(state.player.entityId);
    if (!player || state.player.mode === "BOOKER") return;

    const identity = player.getComponent("identity");
    const physicalStats = player.getComponent("physicalStats");
    const inRingStats = player.getComponent("inRingStats");
    const entertainmentStats = player.getComponent("entertainmentStats");

    if (!identity) return;

    const alignments = CharacterEvolution.getAllAlignments();
    const gimmicks = CharacterEvolution.getAllGimmicks();
    const archetypes = Object.keys(CharacterEvolution.getAllArchetypeRequirements());

    let html = `
      <div class="identity-edit-section">
        <label>Alignment</label>
        <select id="edit-alignment">
          ${alignments.map(a => `<option value="${a}" ${a === identity.alignment ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="identity-edit-section">
        <label>Gimmick</label>
        <select id="edit-gimmick">
          ${gimmicks.map(g => `<option value="${g}" ${g === identity.gimmick ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="identity-edit-section">
        <label>Archetype (requires stats)</label>
        <select id="edit-archetype">
          ${archetypes.map(a => {
            const canChange = CharacterEvolution.canChangeArchetype(player, a).canChange;
            return `<option value="${a}" ${a === identity.archetype ? 'selected' : ''} ${!canChange ? 'disabled' : ''}>${a}${!canChange ? ' (locked)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div id="archetype-requirements" class="archetype-requirements">
        <strong>Stat Requirements for Archetype:</strong>
        ${archetypes.map(a => {
          const reqs = CharacterEvolution.getArchetypeRequirements(a);
          if (!reqs) return '';
          const canChange = CharacterEvolution.canChangeArchetype(player, a).canChange;
          let reqText = Object.entries(reqs.physical).map(([k, v]) => `${k}: ${v}`).join(', ');
          return `<div class="req-row ${canChange ? 'met' : 'unmet'}"><span>${a}:</span> <span>${reqText}</span></div>`;
        }).join('')}
      </div>
      <button id="save-identity-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--space-md);">Save Changes</button>
    `;

    const modalBody = document.getElementById("identity-modal-body");
    if (modalBody) {
      modalBody.innerHTML = html;
    }

    document.getElementById("edit-archetype")?.addEventListener("change", () => {
      this.updateRequirementHighlights();
    });

    document.getElementById("save-identity-btn")?.addEventListener("click", () => {
      this.saveIdentityChanges(player);
    });

    document.getElementById("identity-modal")?.classList.remove("hidden");
  }

  updateRequirementHighlights() {
    const state = gameStateManager.getStateRef();
    if (!state || !state.player?.entityId) return;
    const player = state.entities.get(state.player.entityId);
    if (!player) return;

    const selectedArchetype = document.getElementById("edit-archetype")?.value;
    if (!selectedArchetype) return;

    const rows = document.querySelectorAll(".req-row");
    rows.forEach(row => {
      const archetype = row.querySelector("span:first-child").textContent;
      if (archetype === selectedArchetype) {
        const canChange = CharacterEvolution.canChangeArchetype(player, archetype).canChange;
        row.classList.toggle("met", canChange);
        row.classList.toggle("unmet", !canChange);
      }
    });
  }

  saveIdentityChanges(player) {
    const newAlignment = document.getElementById("edit-alignment")?.value;
    const newGimmick = document.getElementById("edit-gimmick")?.value;
    const newArchetype = document.getElementById("edit-archetype")?.value;

    if (newAlignment) {
      CharacterEvolution.changeAlignment(player, newAlignment, gameStateManager);
    }

    if (newGimmick) {
      CharacterEvolution.changeGimmick(player, newGimmick, gameStateManager);
    }

    if (newArchetype) {
      const result = CharacterEvolution.changeArchetype(player, newArchetype, gameStateManager);
      if (!result.success) {
        alert(`Cannot change archetype: ${result.error}`);
        return;
      }
    }

    this.closeIdentityModal();
    document.getElementById("player-info-panel")?.dispatchEvent(new CustomEvent("refresh"));
  }

  closeIdentityModal() {
    document.getElementById("identity-modal")?.classList.add("hidden");
  }

  /**
   * Renders the player info panel
   * @param {object} state - Current game state
   */
  render(state) {
    if (!state || !state.player || !state.player.entityId) {
      return;
    }

    if (state.player.mode === "BOOKER") {
      this.renderBooker(state);
      return;
    }

    const player = state.entities.get(state.player.entityId);
    if (!player) {
      return;
    }

    // Get components
    const identity = player.getComponent("identity");
    const physicalStats = player.getComponent("physicalStats");
    const inRingStats = player.getComponent("inRingStats");
    const entertainmentStats = player.getComponent("entertainmentStats");
    const condition = player.getComponent("condition");
    const popularity = player.getComponent("popularity");
    const careerStats = player.getComponent("careerStats");
    const contract = player.getComponent("contract");

    // Update basic info
    if (identity) {
      this.updateElement("player-name", identity.name);
      this.updateElement("player-gimmick", identity.gimmick || "Unknown");

      const alignmentEl = document.getElementById("player-alignment");
      if (alignmentEl) {
        const alignment = identity.alignment || "Face";
        alignmentEl.textContent = alignment;
        alignmentEl.className = `alignment alignment-${alignment.toLowerCase()}`;
      }
    }

    // Update promotion info
    if (contract && contract.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      const promotionText = promotion?.name || "Unknown";
      const positionText = contract.position
        ? ` (${CardPositionSystem.getPositionInfo(contract.position).name})`
        : "";
      const isShowDay = promotion ? gameCalendar.isShowDay(promotion) : false;
      this.updateElement(
        "promotion-name",
        isShowDay
          ? `${promotionText}${positionText} 📺 LIVE SHOW!`
          : `${promotionText}${positionText}`,
      );
    } else {
      this.updateElement("promotion-name", "Independent");
    }

    // Update age display
    if (identity && identity.age) {
      const ageEl = document.getElementById("player-age");
      if (ageEl) {
        ageEl.textContent = `Age: ${identity.age}`;
      }
    }

    // Update key stats
    if (physicalStats) {
      this.updateStatPill("stat-strength", Math.round(physicalStats.strength));
      this.updateStatPill("stat-stamina", Math.round(physicalStats.stamina));
      this.updateStatPill("stat-speed", Math.round(physicalStats.speed));
      this.updateStatPill(
        "stat-resilience",
        Math.round(physicalStats.resilience),
      );
    }
    if (inRingStats) {
      this.updateStatPill("stat-brawling", Math.round(inRingStats.brawling));
      this.updateStatPill("stat-technical", Math.round(inRingStats.technical));
      this.updateStatPill("stat-aerial", Math.round(inRingStats.aerial));
      this.updateStatPill("stat-selling", Math.round(inRingStats.selling));
      this.updateStatPill(
        "stat-psychology",
        Math.round(inRingStats.psychology),
      );
    }
    if (entertainmentStats) {
      this.updateStatPill("stat-mic", Math.round(entertainmentStats.micSkills));
      this.updateStatPill(
        "stat-charisma",
        Math.round(entertainmentStats.charisma),
      );
    }

    // Update bars
    if (condition) {
      this.updateBar("health", condition.health, 100);
      this.updateBar("energy", condition.energy, 100);
    }
    if (popularity) {
      this.updateBar("momentum", popularity.momentum, 100);
    }

    // Update metrics
    if (popularity) {
      this.updateElement("metric-overness", popularity.overness);
    }
    if (careerStats) {
      const record = `${careerStats.totalWins}-${careerStats.totalLosses}-${careerStats.draws}`;
      this.updateElement("metric-record", record);
    }
  }

  renderBooker(state) {
    const player = state.entities.get(state.player.entityId);
    const promotion = BookerModeEngine.getPlayerPromotion(state);
    const identity = player?.getComponent("identity");
    const bookerStats = player?.getComponent("bookerStats");

    this.updateElement("player-name", identity?.name || "Booker");
    this.updateElement(
      "player-gimmick",
      bookerStats
        ? `Creative ${bookerStats.creativity} / Discipline ${bookerStats.strictness}`
        : "Promotion Booker",
    );

    const alignmentEl = document.getElementById("player-alignment");
    if (alignmentEl) {
      alignmentEl.textContent = "Booker";
      alignmentEl.className = "alignment";
    }

    const ageEl = document.getElementById("player-age");
    if (ageEl) {
      ageEl.textContent = promotion
        ? `${promotion.region} office`
        : "Promotion HQ";
    }

    if (promotion) {
      const showDay = BookerModeEngine.isCurrentShowDay(promotion, state);
      this.updateElement(
        "promotion-name",
        showDay ? `${promotion.name} • SHOW DAY` : promotion.name,
      );
    } else {
      this.updateElement("promotion-name", "No Promotion");
    }

    this.updateStatPill("stat-strength", promotion?.prestige || 0);
    this.updateStatPill("stat-stamina", promotion?.fanLoyalty || 0);
    this.updateStatPill("stat-speed", promotion?.bookingReputation || 0);
    this.updateStatPill("stat-resilience", promotion?.lockerRoomMorale || 0);
    this.updateStatPill("stat-brawling", promotion?.productionLevel || 0);
    this.updateStatPill("stat-technical", promotion?.marketing || 0);
    this.updateStatPill("stat-aerial", promotion?.medicalTeam || 0);
    this.updateStatPill("stat-selling", promotion?.scoutingBudget || 0);
    this.updateStatPill("stat-psychology", promotion?.trainingFacility || 0);
    this.updateStatPill("stat-mic", bookerStats?.creativity || 0);
    this.updateStatPill("stat-charisma", bookerStats?.strictness || 0);

    this.updateBar(
      "health",
      promotion?.bankBalance ? Math.min(100, promotion.bankBalance / 10000) : 0,
      100,
    );
    this.updateBar("energy", promotion?.lockerRoomMorale || 0, 100);
    this.updateBar("momentum", promotion?.momentum || 0, 100);

    this.updateElement(
      "metric-overness",
      promotion?.bankBalance
        ? `$${Math.round(promotion.bankBalance).toLocaleString()}`
        : "$0",
    );
    this.updateElement(
      "metric-record",
      promotion?.brand?.bookingStyle
        ? promotion.brand.bookingStyle.replace(/_/g, " ")
        : "booker",
    );
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
   * Updates stat value and heat color on its pill container
   * @private
   * @param {string} id - Stat value element ID
   * @param {number} value - Stat value (0-100)
   */
  updateStatPill(id, value) {
    this.updateElement(id, value);
    const el = document.getElementById(id);
    if (!el) return;
    const pill = el.closest(".stat-pill");
    if (!pill) return;
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    const hue = Math.round((clamped / 100) * 120); // 0=red, 120=green
    pill.style.setProperty("--heat-h", hue.toString());
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
