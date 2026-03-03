/**
 * CharacterCreation for Mat Life: Wrestling Simulator
 * Step 2.8 of Implementation Plan
 * New game / character creation screens
 */

import { gameStateManager } from '../core/GameStateManager.js';
import EntityFactory from '../core/EntityFactory.js';
import { capitalize } from '../core/Utils.js';
import AIPromotionSystem from '../engine/AIPromotionSystem.js';
import ChampionshipSystem from '../engine/ChampionshipSystem.js';

/**
 * CharacterCreation - Handles the character creation flow
 */
export class CharacterCreation {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.currentStep = 1;
    this.totalSteps = 6;
    this.formData = {
      mode: 'WRESTLER',
      archetype: 'High-Flyer',
      bonusPoints: {},
      pointsRemaining: 10
    };

    this.steps = [
      'step-mode',
      'step-basic-info',
      'step-archetype',
      'step-gimmick',
      'step-stats',
      'step-confirmation'
    ];

    this.statNames = {
      physical: ['strength', 'resilience', 'speed'],
      inRing: ['brawling', 'technical', 'aerial', 'selling', 'psychology'],
      entertainment: ['charisma', 'micSkills', 'acting']
    };
  }

  /**
   * Initializes the character creation flow
   */
  init() {
    this.setupEventListeners();
    this.showStep(1);
  }

  /**
   * Sets up event listeners
   * @private
   */
  setupEventListeners() {
    // Mode selection
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.formData.mode = card.dataset.mode;
      });
    });

    // Archetype selection
    document.querySelectorAll('.archetype-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.formData.archetype = card.dataset.archetype;
      });
    });

    // Age range slider
    const ageSlider = document.getElementById('wrestler-age');
    const ageValue = document.querySelector('.range-value');
    if (ageSlider && ageValue) {
      ageSlider.addEventListener('input', (e) => {
        ageValue.textContent = e.target.value;
      });
    }

    // Navigation buttons
    const nextBtn = document.getElementById('next-step');
    const prevBtn = document.getElementById('prev-step');
    const startBtn = document.getElementById('start-career-btn');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep());
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevStep());
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => this.startCareer());
    }
  }

  /**
   * Shows a specific step
   * @private
   * @param {number} stepNum - Step number to show
   */
  showStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => {
      step.classList.add('hidden');
    });

    // Show current step
    const stepId = this.steps[stepNum - 1];
    const currentStepEl = document.getElementById(stepId);
    if (currentStepEl) {
      currentStepEl.classList.remove('hidden');
    }

    // Update navigation buttons
    const prevBtn = document.getElementById('prev-step');
    const nextBtn = document.getElementById('next-step');

    if (prevBtn) {
      prevBtn.classList.toggle('hidden', stepNum === 1);
    }

    if (nextBtn) {
      if (stepNum === this.totalSteps) {
        nextBtn.classList.add('hidden');
      } else {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = stepNum === this.totalSteps - 1 ? 'Review' : 'Next';
      }
    }

    // Special handling for specific steps
    if (stepNum === 5) {
      this.renderStatAllocation();
    } else if (stepNum === 6) {
      this.renderCharacterSummary();
    }

    this.currentStep = stepNum;
  }

  /**
   * Goes to the next step
   * @private
   */
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      // Validate current step
      if (!this.validateStep(this.currentStep)) {
        return;
      }

      this.saveStepData(this.currentStep);
      this.showStep(this.currentStep + 1);
    }
  }

  /**
   * Goes to the previous step
   * @private
   */
  prevStep() {
    if (this.currentStep > 1) {
      this.showStep(this.currentStep - 1);
    }
  }

  /**
   * Validates current step data
   * @private
   * @param {number} stepNum - Step number
   * @returns {boolean} True if valid
   */
  validateStep(stepNum) {
    switch (stepNum) {
      case 1:
        if (!this.formData.mode) {
          alert('Please select a game mode');
          return false;
        }
        break;
      case 2:
        const name = document.getElementById('wrestler-name')?.value;
        if (!name) {
          alert('Please enter a ring name');
          return false;
        }
        break;
      case 3:
        if (!this.formData.archetype) {
          alert('Please select a wrestling style');
          return false;
        }
        break;
    }
    return true;
  }

  /**
   * Saves data from current step
   * @private
   * @param {number} stepNum - Step number
   */
  saveStepData(stepNum) {
    switch (stepNum) {
      case 2:
        this.formData.name = document.getElementById('wrestler-name')?.value;
        this.formData.age = parseInt(document.getElementById('wrestler-age')?.value) || 20;
        this.formData.gender = document.getElementById('wrestler-gender')?.value || 'Male';
        this.formData.hometown = document.getElementById('wrestler-hometown')?.value || 'Parts Unknown';
        break;
      case 4:
        this.formData.alignment = document.querySelector('input[name="alignment"]:checked')?.value || 'Face';
        this.formData.gimmick = document.getElementById('gimmick-template')?.value || 'Underdog';
        this.formData.catchphrase = document.getElementById('catchphrase')?.value || '';
        this.formData.entranceStyle = document.getElementById('entrance-style')?.value || 'Simple';
        break;
    }
  }

  /**
   * Renders the stat allocation step
   * @private
   */
  renderStatAllocation() {
    const container = document.getElementById('stat-allocation');
    if (!container) return;

    container.innerHTML = '';

    // Get base stats from archetype
    const archetypeStats = this.getArchetypeStats(this.formData.archetype);

    // Create stat rows for each category
    Object.entries(this.statNames).forEach(([category, stats]) => {
      const categoryHeader = document.createElement('h4');
      categoryHeader.textContent = capitalize(category);
      categoryHeader.style.margin = '1rem 0 0.5rem';
      container.appendChild(categoryHeader);

      stats.forEach(stat => {
        const baseValue = archetypeStats[category]?.[stat] || 10;
        const currentBonus = this.formData.bonusPoints[stat] || 0;

        const row = document.createElement('div');
        row.className = 'stat-row';

        const statName = document.createElement('span');
        statName.className = 'stat-name';
        statName.textContent = capitalize(stat);

        const controls = document.createElement('div');
        controls.className = 'stat-controls';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'stat-btn';
        minusBtn.textContent = '-';
        minusBtn.disabled = currentBonus <= 0;
        minusBtn.addEventListener('click', () => this.adjustStat(stat, -1));

        const currentEl = document.createElement('span');
        currentEl.className = 'stat-current';
        currentEl.textContent = baseValue + currentBonus;

        const plusBtn = document.createElement('button');
        plusBtn.className = 'stat-btn';
        plusBtn.textContent = '+';
        plusBtn.disabled = this.formData.pointsRemaining <= 0 || currentBonus >= 5;
        plusBtn.addEventListener('click', () => this.adjustStat(stat, 1));

        controls.appendChild(minusBtn);
        controls.appendChild(currentEl);
        controls.appendChild(plusBtn);

        row.appendChild(statName);
        row.appendChild(controls);
        container.appendChild(row);
      });
    });

    // Update points remaining
    const pointsEl = document.getElementById('points-remaining');
    if (pointsEl) {
      pointsEl.textContent = this.formData.pointsRemaining;
    }
  }

  /**
   * Adjusts a stat value
   * @private
   * @param {string} stat - Stat name
   * @param {number} delta - Change amount
   */
  adjustStat(stat, delta) {
    const current = this.formData.bonusPoints[stat] || 0;

    if (delta > 0 && this.formData.pointsRemaining > 0 && current < 5) {
      this.formData.bonusPoints[stat] = current + 1;
      this.formData.pointsRemaining--;
    } else if (delta < 0 && current > 0) {
      this.formData.bonusPoints[stat] = current - 1;
      this.formData.pointsRemaining++;
    }

    this.renderStatAllocation();
  }

  /**
   * Gets base stats for an archetype
   * @private
   * @param {string} archetype - Archetype name
   * @returns {object} Base stats
   */
  getArchetypeStats(archetype) {
    const stats = {
      'Technical': {
        physical: { strength: 10, resilience: 12, speed: 12 },
        inRing: { brawling: 10, technical: 16, aerial: 8, selling: 14, psychology: 14 },
        entertainment: { charisma: 10, micSkills: 12, acting: 10 }
      },
      'High-Flyer': {
        physical: { strength: 8, resilience: 10, speed: 16 },
        inRing: { brawling: 8, technical: 10, aerial: 16, selling: 12, psychology: 10 },
        entertainment: { charisma: 12, micSkills: 10, acting: 10 }
      },
      'Brawler': {
        physical: { strength: 14, resilience: 14, speed: 10 },
        inRing: { brawling: 16, technical: 8, aerial: 6, selling: 12, psychology: 10 },
        entertainment: { charisma: 14, micSkills: 10, acting: 8 }
      },
      'Powerhouse': {
        physical: { strength: 18, resilience: 16, speed: 8 },
        inRing: { brawling: 14, technical: 10, aerial: 4, selling: 10, psychology: 10 },
        entertainment: { charisma: 10, micSkills: 8, acting: 10 }
      },
      'Strong Style': {
        physical: { strength: 14, resilience: 14, speed: 12 },
        inRing: { brawling: 16, technical: 14, aerial: 6, selling: 12, psychology: 12 },
        entertainment: { charisma: 10, micSkills: 10, acting: 10 }
      },
      'Lucha Libre': {
        physical: { strength: 10, resilience: 10, speed: 16 },
        inRing: { brawling: 8, technical: 12, aerial: 16, selling: 10, psychology: 12 },
        entertainment: { charisma: 14, micSkills: 8, acting: 12 }
      }
    };

    return stats[archetype] || stats['High-Flyer'];
  }

  /**
   * Renders the character summary
   * @private
   */
  renderCharacterSummary() {
    const container = document.getElementById('character-summary');
    if (!container) return;

    const archetypeStats = this.getArchetypeStats(this.formData.archetype);

    container.innerHTML = `
      <div class="summary-section">
        <h4>Identity</h4>
        <div class="summary-row">
          <span class="summary-label">Name</span>
          <span class="summary-value">${this.formData.name}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Age</span>
          <span class="summary-value">${this.formData.age}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Hometown</span>
          <span class="summary-value">${this.formData.hometown}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Gender</span>
          <span class="summary-value">${this.formData.gender}</span>
        </div>
      </div>
      
      <div class="summary-section">
        <h4>Gimmick</h4>
        <div class="summary-row">
          <span class="summary-label">Archetype</span>
          <span class="summary-value">${this.formData.archetype}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Alignment</span>
          <span class="summary-value">${this.formData.alignment}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Style</span>
          <span class="summary-value">${this.formData.gimmick}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Entrance</span>
          <span class="summary-value">${this.formData.entranceStyle}</span>
        </div>
      </div>
      
      <div class="summary-section">
        <h4>Key Stats</h4>
        <div class="summary-row">
          <span class="summary-label">Strength</span>
          <span class="summary-value">${archetypeStats.physical.strength + (this.formData.bonusPoints.strength || 0)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Aerial</span>
          <span class="summary-value">${archetypeStats.inRing.aerial + (this.formData.bonusPoints.aerial || 0)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Technical</span>
          <span class="summary-value">${archetypeStats.inRing.technical + (this.formData.bonusPoints.technical || 0)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Starts the career
   * @private
   */
  startCareer() {
    // Create player entity
    const player = EntityFactory.createPlayerWrestler(this.formData);
    player.isPlayer = true;

    // Initialize game state
    gameStateManager.initializeState({
      playerId: player.id,
      mode: this.formData.mode,
      startYear: 1,
      startMonth: 1,
      startWeek: 1
    });

    // Add player to state
    gameStateManager.dispatch('ADD_ENTITY', { entity: player });

    // Create the wrestling world with multiple promotions
    if (this.formData.mode === 'WRESTLER') {
      this.createWrestlingWorld(player);
    }

    // Log start
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'system',
        text: `Welcome to Mat Life! Your wrestling career begins...`,
        type: 'start'
      }
    });

    // Switch to game screen
    if (this.uiManager) {
      this.uiManager.showScreen('game-screen');
    }
  }

  /**
   * Creates the wrestling world with multiple promotions
   * @private
   */
  createWrestlingWorld(player) {
    const state = gameStateManager.getStateRef();

    // Generate 6 promotions across different tiers
    AIPromotionSystem.generateInitialPromotions(state, 6);

    // Assign player to an indie promotion
    const indiePromo = Array.from(state.promotions.values())
      .find(p => p.prestige <= 20);

    if (indiePromo) {
      indiePromo.roster.push(player.id);

      // Give player a basic contract
      const contract = player.getComponent('contract');
      if (contract) {
        contract.promotionId = indiePromo.id;
        contract.weeklySalary = 100;
        contract.remainingWeeks = 8;
        contract.position = 'opener';
      }

      // Generate NPC roster for all promotions
      this.generateNPCRosters(state);
    }

    // Initialize championships for all promotions
    for (const promotion of state.promotions.values()) {
      ChampionshipSystem.initializePromotionChampionships(promotion);
    }
  }

  /**
   * Generates NPC rosters for all promotions
   * @private
   */
  generateNPCRosters(state) {
    for (const promotion of state.promotions.values()) {
      // Calculate how many wrestlers needed
      const targetSize = promotion.prestige <= 15 ? 6 :
        promotion.prestige <= 40 ? 15 :
          promotion.prestige <= 70 ? 30 : 50;

      const needed = targetSize - promotion.roster.length;

      for (let i = 0; i < needed; i++) {
        const npc = EntityFactory.generateRandomIndie(promotion.region);
        gameStateManager.dispatch('ADD_ENTITY', { entity: npc });

        // Give them a contract
        const contract = npc.getComponent('contract');
        if (contract) {
          contract.promotionId = promotion.id;
          contract.weeklySalary = 50 + Math.floor(Math.random() * 150);
          contract.remainingWeeks = 8;
        }

        promotion.roster.push(npc.id);
      }
    }
  }
}

export default CharacterCreation;
