/**
 * ActionPanel for Mat Life: Wrestling Simulator
 * Step 2.6 of Implementation Plan
 * Right panel with choices and actions
 */

import { gameStateManager } from '../core/GameStateManager.js';
import WorldSimulator from '../engine/WorldSimulator.js';
import eventManager from '../engine/EventManager.js';
import MatchView from './MatchView.js';
import PromoEngine from '../engine/PromoEngine.js';
import SocialMediaSystem from '../engine/SocialMediaSystem.js';
import DirtSheetGenerator from '../engine/DirtSheetGenerator.js';
import LifestyleEngine from '../engine/LifestyleEngine.js';
import WellnessEngine from '../engine/WellnessEngine.js';

/**
 * ActionPanel - Renders the action panel
 */
export class ActionPanel {
  constructor() {
    this.container = document.getElementById('action-content');
    this.titleEl = document.getElementById('action-title');
    this.currentEvent = null;
    this.matchView = new MatchView();
    this.inMatch = false;
  }

  /**
   * Renders the action panel
   * @param {object} state - Current game state
   * @param {string} currentTab - Current tab name
   */
  render(state, currentTab) {
    if (!this.container) {
      return;
    }

    // If there's a pending event, show it
    if (this.currentEvent) {
      this.renderEvent(this.currentEvent);
      return;
    }

    // Update title
    if (this.titleEl) {
      const titles = {
        match: 'Match/Promo',
        backstage: 'Backstage',
        actions: 'Actions',
        people: 'People'
      };
      this.titleEl.textContent = titles[currentTab] || 'Actions';
    }

    // Clear container
    this.container.innerHTML = '';

    // Render based on tab
    switch (currentTab) {
      case 'match':
        this.renderMatchTab(state);
        break;
      case 'backstage':
        this.renderBackstageTab(state);
        break;
      case 'actions':
        this.renderActionsTab(state);
        break;
      case 'people':
        this.renderPeopleTab(state);
        break;
      default:
        this.renderMatchTab(state);
    }
  }

  /**
   * Renders the Match/Promo tab
   * @private
   */
  renderMatchTab(state) {
    const player = gameStateManager.getPlayerEntity();
    if (!player) return;

    // Check if player has upcoming matches
    const contract = player.getComponent('contract');
    
    if (contract && contract.promotionId) {
      const actionCard = this.createActionCard(
        'Advance Time',
        'Move forward to the next time slot',
        () => {
          const pendingActions = WorldSimulator.tick(state);
          
          // Check for events
          const event = eventManager.generateEvents(player, state);
          if (event) {
            this.displayEvent(event);
          }

          // Process pending match if any
          if (pendingActions && pendingActions.length > 0) {
            const match = pendingActions.find(a => a.type === 'match');
            if (match) {
              this.renderMatchPreparation(match);
            }
          }
        }
      );
      this.container.appendChild(actionCard);
    } else {
      // No contract - indie wrestler
      const actionCard = this.createActionCard(
        'Look for Bookings',
        'Search for indie wrestling opportunities',
        () => {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'system',
              text: 'You search for indie bookings...',
              type: 'action'
            }
          });
        }
      );
      this.container.appendChild(actionCard);
    }

    // Training option
    const trainingCard = this.createActionCard(
      'Train',
      'Improve your wrestling skills',
      () => this.renderTrainingOptions()
    );
    this.container.appendChild(trainingCard);

    // Promo option
    const promoCard = this.createActionCard(
      'Cut Promo',
      'Speak to the crowd and build hype',
      () => this.renderPromoOptions(player)
    );
    this.container.appendChild(promoCard);
  }

  /**
   * Renders promo options
   * @private
   */
  renderPromoOptions(player) {
    this.container.innerHTML = '';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'match');
    });
    this.container.appendChild(backBtn);

    // Title
    const title = document.createElement('h4');
    title.textContent = '🎤 Cut a Promo';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    // Get available tones
    const tones = PromoEngine.getAvailableTones(player);

    tones.forEach(tone => {
      const card = this.createActionCard(
        tone.name,
        tone.description,
        () => {
          const result = PromoEngine.runPromo(player, tone.key);
          
          if (result.error) {
            alert(result.error);
          } else {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'backstage',
                text: result.narrative,
                type: 'promo',
                momentum: result.momentumGained
              }
            });
          }
          this.render(gameStateManager.getStateRef(), 'match');
        }
      );
      this.container.appendChild(card);
    });
  }

  /**
   * Renders the Backstage tab
   * @private
   */
  renderBackstageTab(state) {
    const actions = [
      { name: "Visit Booker's Office", desc: 'Discuss your position on the card', icon: '📋', action: 'booker' },
      { name: 'Hang out in Locker Room', desc: 'Build relationships with other wrestlers', icon: '🗣️', action: 'locker' },
      { name: 'Check Dirt Sheets', desc: 'Read the latest wrestling news and rumors', icon: '📰', action: 'dirt' },
      { name: 'Faction Meeting', desc: 'Meet with your stable members', icon: '👥', action: 'faction' }
    ];

    actions.forEach(action => {
      const card = this.createActionCard(action.name, action.desc, () => {
        if (action.action === 'dirt') {
          this.renderDirtSheets();
        } else {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'backstage',
              text: `${action.icon} ${action.name}...`,
              type: 'action'
            }
          });
        }
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Renders dirt sheet stories
   * @private
   */
  renderDirtSheets() {
    this.container.innerHTML = '';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'backstage');
    });
    this.container.appendChild(backBtn);

    // Title
    const title = document.createElement('h4');
    title.textContent = '📰 Wrestling Dirt Sheets';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    // Get stories
    const stories = DirtSheetGenerator.checkDirtSheets();

    if (stories.length === 0) {
      this.container.innerHTML += '<p>No major news this week.</p>';
      return;
    }

    stories.forEach(story => {
      const card = document.createElement('div');
      card.className = 'panel mb-md';
      card.style.cssText = `
        border-left: 3px solid ${story.category === 'backstage' ? '#9c27b0' : 
                                story.category === 'business' ? '#4caf50' : 
                                story.category === 'injury' ? '#f44336' : '#ffc857'};
      `;
      
      card.innerHTML = `
        <h5 style="margin-bottom: 0.5rem;">${story.headline}</h5>
        <p style="font-size: 0.9rem; color: var(--text-secondary);">${story.text}</p>
        ${!story.accurate ? '<p style="font-size: 0.8rem; color: var(--text-muted);">⚠️ Unverified rumor</p>' : ''}
      `;
      
      this.container.appendChild(card);
    });
  }

  /**
   * Renders the Actions tab
   * @private
   */
  renderActionsTab(state) {
    const player = gameStateManager.getPlayerEntity();
    if (!player) return;

    // Main action categories
    const categories = [
      { name: 'Training', desc: 'Improve your skills', icon: '💪' },
      { name: 'Social Media', desc: 'Post to your followers', icon: '📱' },
      { name: 'Wellness', desc: 'Health and wellness options', icon: '❤️' },
      { name: 'Lifestyle', desc: 'Vacation and self-care', icon: '🏖️' }
    ];

    categories.forEach(cat => {
      const card = this.createActionCard(cat.name, cat.desc, () => {
        this.renderActionCategory(cat.name, player);
      });
      this.container.appendChild(card);
    });

    // Direct actions
    const card = this.createActionCard('Manage Finances', 'Check your bank balance and expenses', () => {
      this.renderFinancialOverview(player);
    });
    this.container.appendChild(card);
  }

  /**
   * Renders a specific action category
   * @private
   */
  renderActionCategory(category, player) {
    this.container.innerHTML = '';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'actions');
    });
    this.container.appendChild(backBtn);

    switch (category) {
      case 'Training':
        this.renderTrainingOptions();
        break;
      case 'Social Media':
        this.renderSocialMediaOptions(player);
        break;
      case 'Wellness':
        this.renderWellnessOptions(player);
        break;
      case 'Lifestyle':
        this.renderLifestyleOptions(player);
        break;
    }
  }

  /**
   * Renders training options
   * @private
   */
  renderTrainingOptions() {
    const options = [
      { name: 'Gym Training', desc: '+Strength, +Stamina' },
      { name: 'Ring Practice', desc: '+Technical, +Aerial' },
      { name: 'Promo Practice', desc: '+Charisma, +Mic Skills' }
    ];

    options.forEach(opt => {
      const card = this.createActionCard(opt.name, opt.desc, () => {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `Training: ${opt.name}...`,
            type: 'training'
          }
        });
        this.render(gameStateManager.getStateRef(), 'actions');
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Renders social media options
   * @private
   */
  renderSocialMediaOptions(player) {
    const types = SocialMediaSystem.getAvailablePostTypes(player);
    const summary = SocialMediaSystem.getSummary(player);

    // Show current stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'panel mb-md';
    statsDiv.innerHTML = `
      <h4>Social Media Stats</h4>
      <p>Followers: ${summary?.followers || 0}</p>
      <p>Tier: ${summary?.tier || 'Unknown'}</p>
      ${summary?.hasScandal ? '<p style="color: #f44336;">⚠️ Active Scandal!</p>' : ''}
    `;
    this.container.appendChild(statsDiv);

    types.forEach(type => {
      const card = this.createActionCard(type.name, type.description, () => {
        const result = SocialMediaSystem.post(player, type.key);
        
        if (result.error) {
          alert(result.error);
        } else {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'personal',
              text: result.narrative,
              type: 'social',
              followers: result.totalFollowers
            }
          });
        }
        this.render(gameStateManager.getStateRef(), 'actions');
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Renders wellness options
   * @private
   */
  renderWellnessOptions(player) {
    const wellness = WellnessEngine.getSummary(player);
    
    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.className = 'panel mb-md';
    statusDiv.innerHTML = `
      <h4>Wellness Status</h4>
      <p>Status: ${wellness?.status || 'CLEAN'}</p>
      ${wellness?.pedUsage ? `<p style="color: #ff9800;">PED Usage Active (Risk: ${wellness.detectionRisk}%)</p>` : ''}
      ${wellness?.strikes > 0 ? `<p style="color: #f44336;">Strikes: ${wellness.strikes}/3</p>` : ''}
    `;
    this.container.appendChild(statusDiv);

    // PED toggle
    const pedCard = this.createActionCard(
      wellness?.pedUsage ? 'Stop Using PEDs' : 'Use PEDs',
      wellness?.pedUsage ? 'Withdrawal penalties apply' : 'Boost stats but risk detection',
      () => {
        const result = WellnessEngine.togglePEDUse(player, !wellness?.pedUsage);
        if (result.error) {
          alert(result.error);
        }
        this.renderActionCategory('Wellness', player);
      }
    );
    this.container.appendChild(pedCard);
  }

  /**
   * Renders lifestyle options
   * @private
   */
  renderLifestyleOptions(player) {
    const summary = LifestyleEngine.getSummary(player);
    
    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.className = 'panel mb-md';
    statusDiv.innerHTML = `
      <h4>Lifestyle</h4>
      <p>Burnout: ${summary?.burnout}/100 (${summary?.burnoutLevel})</p>
      <p>Mental Health: ${summary?.mentalHealth}/100</p>
      <p>Family Morale: ${summary?.familyMorale}/100</p>
      ${summary?.needsRest ? '<p style="color: #ff9800;">⚠️ Need rest!</p>' : ''}
    `;
    this.container.appendChild(statusDiv);

    // Vacation option
    const vacationCard = this.createActionCard('Take Vacation', '1 week, -40 burnout, -$2000', () => {
      const result = LifestyleEngine.takeVacation(player, 1);
      if (result.error) {
        alert(result.error);
      } else {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `Took vacation. Burnout reduced by ${result.burnoutReduction}.`,
            type: 'vacation'
          }
        });
      }
      this.render(gameStateManager.getStateRef(), 'actions');
    });
    this.container.appendChild(vacationCard);

    // Therapy option
    const therapyCard = this.createActionCard('See Therapist', 'Improve mental health, -$100', () => {
      const result = LifestyleEngine.seeTherapist(player);
      if (result.error) {
        alert(result.error);
      }
      this.renderActionCategory('Lifestyle', player);
    });
    this.container.appendChild(therapyCard);
  }

  /**
   * Renders financial overview
   * @private
   */
  renderFinancialOverview(player) {
    this.container.innerHTML = '';

    const financial = player.getComponent('financial');
    const contract = player.getComponent('contract');

    const overview = document.createElement('div');
    overview.className = 'panel';
    overview.innerHTML = `
      <h4>Financial Overview</h4>
      <p><strong>Bank Balance:</strong> $${financial?.bankBalance || 0}</p>
      <p><strong>Weekly Salary:</strong> $${contract?.weeklySalary || 0}</p>
      <p><strong>Weekly Expenses:</strong> $${financial?.weeklyExpenses || 0}</p>
      <p><strong>Medical Debt:</strong> $${financial?.medicalDebt || 0}</p>
      ${financial?.agent ? '<p><strong>Agent:</strong> Yes</p>' : ''}
    `;

    this.container.appendChild(overview);
  }

  /**
   * Renders the People tab
   * @private
   */
  renderPeopleTab(state) {
    if (!state || !state.entities) {
      this.container.innerHTML = '<p>No wrestlers found.</p>';
      return;
    }

    // Show roster list
    const rosterHeader = document.createElement('h4');
    rosterHeader.textContent = 'Roster';
    rosterHeader.style.marginBottom = '1rem';
    this.container.appendChild(rosterHeader);

    const player = gameStateManager.getPlayerEntity();
    const playerContract = player?.getComponent('contract');
    
    // Filter by promotion if player has one
    let rosterIds = [];
    if (playerContract && playerContract.promotionId) {
      const promotion = state.promotions.get(playerContract.promotionId);
      rosterIds = promotion?.roster || [];
    } else {
      rosterIds = Array.from(state.entities.keys());
    }

    rosterIds.forEach(entityId => {
      const entity = state.entities.get(entityId);
      if (!entity) return;

      const identity = entity.getComponent('identity');
      if (!identity) return;

      const card = this.createActionCard(
        identity.name,
        identity.gimmick || 'Wrestler',
        () => {
          this.renderWrestlerDetails(entity);
        }
      );
      this.container.appendChild(card);
    });
  }

  /**
   * Creates an action card element
   * @private
   * @param {string} title - Card title
   * @param {string} description - Card description
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Action card element
   */
  createActionCard(title, description, onClick) {
    const card = document.createElement('div');
    card.className = 'action-card';
    
    const titleEl = document.createElement('h4');
    titleEl.textContent = title;
    
    const descEl = document.createElement('p');
    descEl.textContent = description;
    
    card.appendChild(titleEl);
    card.appendChild(descEl);
    
    card.addEventListener('click', onClick);
    
    return card;
  }

  /**
   * Displays an event to the player
   * @param {object} event - Event to display
   */
  displayEvent(event) {
    this.currentEvent = event;
    this.renderEvent(event);
  }

  /**
   * Renders an event
   * @private
   * @param {object} event - Event to render
   */
  renderEvent(event) {
    if (!this.container) return;

    this.container.innerHTML = '';

    // Update title
    if (this.titleEl) {
      this.titleEl.textContent = event.title || 'Event';
    }

    // Event display
    const eventDisplay = document.createElement('div');
    eventDisplay.className = 'event-display';

    const title = document.createElement('h3');
    title.textContent = event.title || 'Event';

    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description || 'Something has happened...';

    eventDisplay.appendChild(title);
    eventDisplay.appendChild(description);
    this.container.appendChild(eventDisplay);

    // Choice buttons
    if (event.choices) {
      event.choices.forEach((choice, index) => {
        const choiceCard = document.createElement('div');
        choiceCard.className = 'choice-card';

        const choiceTitle = document.createElement('h4');
        choiceTitle.textContent = choice.text;

        choiceCard.appendChild(choiceTitle);

        if (choice.check) {
          const checkInfo = document.createElement('div');
          checkInfo.className = 'choice-check';
          checkInfo.textContent = `Check: ${choice.check.stat} vs DC ${choice.check.dc}`;
          choiceCard.appendChild(checkInfo);
        }

        choiceCard.addEventListener('click', () => {
          this.resolveEventChoice(event, index);
        });

        this.container.appendChild(choiceCard);
      });
    }
  }

  /**
   * Resolves an event choice
   * @private
   * @param {object} event - Event
   * @param {number} choiceIndex - Choice index
   */
  resolveEventChoice(event, choiceIndex) {
    const state = gameStateManager.getStateRef();
    const player = gameStateManager.getPlayerEntity();

    if (!player) return;

    const result = eventManager.resolveChoice(event, choiceIndex, player, state);

    // Log the result
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: result.narrative,
        type: 'event'
      }
    });

    // Clear current event
    this.currentEvent = null;

    // Re-render
    this.render(state, 'match');
  }

  /**
   * Renders training options
   * @private
   */
  renderTrainingOptions() {
    if (!this.container) return;

    this.container.innerHTML = '';

    const title = document.createElement('h4');
    title.textContent = 'Training Options';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const options = [
      { name: 'Gym Training', desc: '+Strength, +Stamina', stat: 'physical' },
      { name: 'Ring Practice', desc: '+Technical, +Aerial', stat: 'inRing' },
      { name: 'Promo Practice', desc: '+Charisma, +Mic Skills', stat: 'entertainment' }
    ];

    options.forEach(option => {
      const card = this.createActionCard(option.name, option.desc, () => {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `You spend time on ${option.name.toLowerCase()}...`,
            type: 'training'
          }
        });
        
        // Go back to match tab
        this.render(gameStateManager.getStateRef(), 'match');
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Renders match preparation
   * @private
   * @param {object} match - Match data
   */
  renderMatchPreparation(match) {
    if (!this.container) return;

    this.container.innerHTML = '';

    const title = document.createElement('h4');
    title.textContent = 'Upcoming Match';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const opponentName = match.opponent?.getComponent('identity')?.name || 'Unknown';
    
    const matchInfo = document.createElement('div');
    matchInfo.className = 'event-display';
    matchInfo.innerHTML = `
      <p>You are scheduled to face <strong>${opponentName}</strong></p>
      <p>Match Type: ${match.matchType || 'Standard Singles'}</p>
    `;
    this.container.appendChild(matchInfo);

    const startBtn = this.createActionCard('Start Match', 'Enter the ring', () => {
      this.startMatch(match);
    });
    this.container.appendChild(startBtn);
  }

  /**
   * Starts a match using MatchView
   * @private
   * @param {object} match - Match configuration
   */
  startMatch(match) {
    this.inMatch = true;
    
    // Update title
    if (this.titleEl) {
      this.titleEl.textContent = 'Match in Progress';
    }

    // Show match view
    this.matchView.show({
      wrestler1: match.player,
      wrestler2: match.opponent,
      matchType: match.matchType || 'Standard Singles',
      playerSide: 'wrestler1'
    }, this.container);

    // Listen for match end
    document.addEventListener('matchEnded', (e) => {
      this.inMatch = false;
      
      // Log result
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `Match ended! Winner: ${e.detail.winner} (${e.detail.rating.toFixed(1)} stars)`,
          type: 'match-result',
          rating: e.detail.rating
        }
      });

      // Return to match tab
      setTimeout(() => {
        this.render(gameStateManager.getStateRef(), 'match');
      }, 1000);
    }, { once: true });
  }

  /**
   * Renders wrestler details
   * @private
   * @param {Entity} entity - Wrestler entity
   */
  renderWrestlerDetails(entity) {
    if (!this.container) return;

    const identity = entity.getComponent('identity');
    const inRingStats = entity.getComponent('inRingStats');
    const popularity = entity.getComponent('popularity');
    const careerStats = entity.getComponent('careerStats');

    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back to Roster';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'people');
    });
    this.container.appendChild(backBtn);

    const details = document.createElement('div');
    details.className = 'panel';
    details.innerHTML = `
      <h3>${identity?.name || 'Unknown'}</h3>
      <p><strong>Gimmick:</strong> ${identity?.gimmick || 'None'}</p>
      <p><strong>Alignment:</strong> ${identity?.alignment || 'Unknown'}</p>
      ${inRingStats ? `
        <h4 style="margin-top: 1rem;">Stats</h4>
        <p>Brawling: ${inRingStats.brawling}</p>
        <p>Technical: ${inRingStats.technical}</p>
        <p>Aerial: ${inRingStats.aerial}</p>
      ` : ''}
      ${popularity ? `
        <p style="margin-top: 1rem;"><strong>Overness:</strong> ${popularity.overness}</p>
      ` : ''}
      ${careerStats ? `
        <p><strong>Record:</strong> ${careerStats.totalWins}-${careerStats.totalLosses}-${careerStats.draws}</p>
      ` : ''}
    `;

    this.container.appendChild(details);
  }
}

export default ActionPanel;
