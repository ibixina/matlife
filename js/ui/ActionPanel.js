/**
 * ActionPanel for Mat Life: Wrestling Simulator
 * Step 2.6 of Implementation Plan
 * Right panel with choices and actions
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { gameCalendar } from '../core/GameCalendar.js';
import WorldSimulator from '../engine/WorldSimulator.js';
import eventManager from '../engine/EventManager.js';
import MatchView from './MatchView.js';
import MatchResultProcessor from '../engine/MatchResultProcessor.js';
import PromoEngine from '../engine/PromoEngine.js';
import SocialMediaSystem from '../engine/SocialMediaSystem.js';
import DirtSheetGenerator from '../engine/DirtSheetGenerator.js';
import LifestyleEngine from '../engine/LifestyleEngine.js';
import WellnessEngine from '../engine/WellnessEngine.js';
import TrainingSystem from '../engine/TrainingSystem.js';
import RelationshipManager from '../engine/RelationshipManager.js';
import DynamicFeudSystem from '../engine/DynamicFeudSystem.js';
import ContractEngine from '../engine/ContractEngine.js';
import ChampionshipSystem from '../engine/ChampionshipSystem.js';
import PerkSystem from '../engine/PerkSystem.js';
import StorylineManager from '../engine/StorylineManager.js';
import CardPositionSystem from '../engine/CardPositionSystem.js';
import EntityFactory from '../core/EntityFactory.js';
import ResolutionEngine from '../engine/ResolutionEngine.js';
import { randomInt } from '../core/Utils.js';

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
    this.currentOffer = null;
    this.currentPromotion = null;
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
        people: 'People',
        career: 'Career'
      };
      this.titleEl.textContent = titles[currentTab] || 'Actions';
    }

    // Clear container
    this.container.innerHTML = '';

    // Render based on tab
    switch (currentTab) {
      case 'match':
        // Check if there's an ongoing match and restore it
        if (this.inMatch && this.matchView.simulator?.matchState && !this.matchView.simulator.matchState.finished) {
          this.titleEl.textContent = 'Match in Progress';
          // Rebuild the match UI without restarting the match
          this.container.innerHTML = '';
          this.matchView.container = this.container;
          this.matchView.buildMatchUI();
          this.matchView.updateDisplay();
        } else {
          this.renderMatchTab(state);
        }
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
      case 'career':
        this.renderCareerTab(state);
        break;
      default:
        this.renderMatchTab(state);
    }
  }

  /**
   * Gets info about the next show day for a promotion
   * @private
   */
  _getNextShowInfo(promotion) {
    if (!promotion?.shows?.length) return null;
    const cal = gameStateManager.getStateRef().calendar;
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let minDays = Infinity;
    let nextShow = null;
    const currentDayIndex = cal.day;

    for (const show of promotion.shows) {
      let diff = show.day - currentDayIndex;
      if (diff <= 0) diff += 7; // wrap to next week
      if (diff < minDays) {
        minDays = diff;
        nextShow = { day: DAYS[show.day], days: diff };
      }
    }
    return nextShow;
  }

  /**
   * Advances time until next show day or event
   * @private
   */
  _advanceToNextShow(player) {
    let contract = player.getComponent('contract');
    if (!contract?.promotionId) return;

    const state = gameStateManager.getStateRef();
    let promotion = state.promotions.get(contract.promotionId);
    if (!promotion) return;

    // Check if player is injured before starting
    if (this._isPlayerInjured(player)) {
      this.render(gameStateManager.getStateRef(), 'match');
      return;
    }

    // Fast-forward to show day
    const maxTicks = 28;
    for (let i = 0; i < maxTicks; i++) {
      const pendingActions = WorldSimulator.tick(state);

      // Check if contract expired during this tick
      contract = player.getComponent('contract');
      if (!contract?.promotionId) {
        // Contract expired - stop advancing and refresh the UI
        this.render(gameStateManager.getStateRef(), 'match');
        return;
      }

      // Check if player became injured during this tick
      if (this._isPlayerInjured(player)) {
        this.render(gameStateManager.getStateRef(), 'match');
        return;
      }

      if (pendingActions?.length > 0) {
        const matchAction = pendingActions.find(a => a.type === 'match');
        if (matchAction) {
          this.renderMatchPreparation(matchAction);
          return;
        }
      }

      // Check for events AFTER ticking and processing match/injury/contract
      // Events have a 30% chance to occur (average every 3-4 days)
      if (Math.random() < 0.3) {
        const event = eventManager.generateEvents(player, state);
        if (event) {
          this.displayEvent(event);
          return;
        }
      }
    }

    // Refresh promotion reference in case it changed
    contract = player.getComponent('contract');
    if (!contract?.promotionId) {
      this.render(gameStateManager.getStateRef(), 'match');
      return;
    }
    promotion = state.promotions.get(contract.promotionId);
    if (!promotion) return;

    // Check if player is still injured before forcing a match
    if (this._isPlayerInjured(player)) {
      this.render(gameStateManager.getStateRef(), 'match');
      return;
    }

    // If loop completed without a match, force-generate one
    const rosterIds = (promotion.roster || []).filter(id => id !== player.id);
    let opponent = null;

    for (const id of rosterIds) {
      const entity = state.entities.get(id);
      if (entity) { opponent = entity; break; }
    }

    if (!opponent) {
      // Generate an opponent
      opponent = EntityFactory.generateRandomIndie(promotion.region || 'USA');
      gameStateManager.dispatch('ADD_ENTITY', { entity: opponent });
      const npcContract = opponent.getComponent('contract');
      if (npcContract) {
        npcContract.promotionId = promotion.id;
        npcContract.remainingWeeks = 1;
      }
      if (!promotion.roster) promotion.roster = [];
      promotion.roster.push(opponent.id);
    }

    this.renderMatchPreparation({
      type: 'match',
      player,
      opponent,
      promotion,
      matchType: 'Standard Singles',
      bookedWinner: Math.random() < 0.5 ? 'wrestler1' : 'wrestler2'
    });
  }

  /**
   * Checks if player has serious injuries that prevent wrestling
   * @private
   * @param {Entity} player - Player entity
   * @returns {boolean} True if player has serious injuries
   */
  _isPlayerInjured(player) {
    const condition = player.getComponent('condition');
    if (!condition?.injuries || condition.injuries.length === 0) {
      return false;
    }

    // Serious injuries are severity 3 or higher
    const seriousInjuries = condition.injuries.filter(i => i.severity >= 3);
    return seriousInjuries.length > 0;
  }

  /**
   * Renders the Match/Promo tab
   * @private
   */
  renderMatchTab(state) {
    const player = gameStateManager.getPlayerEntity();
    if (!player) return;

    const contract = player.getComponent('contract');

    if (contract && contract.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      const nextShow = this._getNextShowInfo(promotion);

      // Show info panel about next show
      if (nextShow) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'panel mb-md';
        infoDiv.innerHTML = `
          <p style="font-size: 0.9rem;">📺 Next show: <strong>${nextShow.day}</strong> (${nextShow.days} day${nextShow.days !== 1 ? 's' : ''} away)</p>
        `;
        this.container.appendChild(infoDiv);
      }

      // Advance Time (1 day)
      const advanceCard = this.createActionCard(
        'Advance Time',
        'Move forward one day',
        () => {
          const pendingActions = WorldSimulator.tick(gameStateManager.getStateRef());

          // Check if player became injured during this tick
          if (this._isPlayerInjured(player)) {
            this.render(gameStateManager.getStateRef(), 'match');
            return;
          }

          if (pendingActions?.length > 0) {
            const matchAction = pendingActions.find(a => a.type === 'match');
            if (matchAction) {
              this.renderMatchPreparation(matchAction);
              return;
            }
          }

          // Events have a 30% chance to occur (average every 3-4 days)
          if (Math.random() < 0.3) {
            const event = eventManager.generateEvents(player, gameStateManager.getStateRef());
            if (event) {
              this.displayEvent(event);
              return;
            }
          }

          this.render(gameStateManager.getStateRef(), 'match');
        }
      );
      this.container.appendChild(advanceCard);

      // Skip to Next Show
      const skipCard = this.createActionCard(
        '⏩ Skip to Next Show',
        `Fast-forward to the next show day${nextShow ? ` (${nextShow.day})` : ''}`,
        () => this._advanceToNextShow(player)
      );
      this.container.appendChild(skipCard);
    } else {
      // No contract - indie wrestler
      const indieCard = this.createActionCard(
        '🤼 Find Indie Booking',
        'Search for an indie match opportunity',
        () => this._findIndieMatch(player)
      );
      this.container.appendChild(indieCard);

      // Advance time
      const advanceCard = this.createActionCard(
        'Advance Time',
        'Move forward one day',
        () => {
          WorldSimulator.tick(gameStateManager.getStateRef());

          if (this._isPlayerInjured(player)) {
            this.render(gameStateManager.getStateRef(), 'match');
            return;
          }

          // Events have a 30% chance to occur (average every 3-4 days)
          if (Math.random() < 0.3) {
            const event = eventManager.generateEvents(player, gameStateManager.getStateRef());
            if (event) {
              this.displayEvent(event);
              return;
            }
          }
          this.render(gameStateManager.getStateRef(), 'match');
        }
      );
      this.container.appendChild(advanceCard);
    }

    // Training option
    const trainingCard = this.createActionCard(
      'Train',
      'Improve your wrestling skills',
      () => this.renderTrainingSubMenu(player)
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
   * Finds and sets up an indie match for the player
   * @private
   */
  _findIndieMatch(player) {
    const state = gameStateManager.getStateRef();

    // Find or generate an opponent
    let opponent = null;
    for (const entity of state.entities.values()) {
      if (entity.id === player.id) continue;
      const contract = entity.getComponent('contract');
      // Prefer free agents or low-tier contracted wrestlers
      if (!contract?.promotionId) {
        opponent = entity;
        break;
      }
    }

    if (!opponent) {
      // Generate a random indie opponent
      opponent = EntityFactory.generateRandomIndie('USA');
      gameStateManager.dispatch('ADD_ENTITY', { entity: opponent });
    }

    const opponentName = opponent.getComponent('identity')?.name || 'Unknown';

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'system',
        text: `Found an indie booking! You'll face ${opponentName}.`,
        type: 'action'
      }
    });

    // Advance time for the booking
    WorldSimulator.tick(state);

    this.renderMatchPreparation({
      type: 'match',
      player,
      opponent,
      matchType: 'Standard Singles',
      promotion: null
    });
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
            let resultText = result.narrative;
            if (result.momentumGained > 0) resultText += ` Momentum +${result.momentumGained}.`;
            if (result.momentumGained < 0) resultText += ` Momentum ${result.momentumGained}.`;
            if (result.overnessGained > 0) resultText += ` Overness +${result.overnessGained}.`;
            if (result.overnessGained < 0) resultText += ` Overness ${result.overnessGained}.`;
            if (result.charismaGained > 0) resultText += ` Charisma +${result.charismaGained.toFixed(1)}.`;

            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'backstage',
                text: resultText,
                type: 'promo',
                momentum: result.momentumGained,
                overness: result.overnessGained,
                charisma: result.charismaGained
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
    const player = gameStateManager.getPlayerEntity();

    // Show active feuds first
    if (player) {
      const feuds = DynamicFeudSystem.getEntityFeuds(player.id);
      const activeFeuds = feuds.filter(f => !f.resolved);

      if (activeFeuds.length > 0) {
        const feudsTitle = document.createElement('h4');
        feudsTitle.textContent = '🔥 Active Feuds';
        feudsTitle.style.marginBottom = '1rem';
        this.container.appendChild(feudsTitle);

        activeFeuds.forEach(feud => {
          const card = this.createActionCard(
            `vs ${feud.opponent}`,
            `${feud.phaseName} Phase | Heat: ${feud.heat}/100 | ${feud.cause}`,
            () => this.renderFeudDetails(feud)
          );
          card.style.borderLeft = '3px solid #e94560';
          this.container.appendChild(card);
        });
      }
    }

    const contract = player?.getComponent('contract');

    const actions = [
      { name: "Visit Booker's Office", desc: 'Discuss your position and request matches', icon: '📋', action: 'booker' },
      { name: 'Hang out in Locker Room', desc: 'Build relationships with other wrestlers', icon: '🗣️', action: 'locker' },
      { name: 'Check Dirt Sheets', desc: 'Read the latest wrestling news and rumors', icon: '📰', action: 'dirt' },
      { name: 'View Relationships', desc: 'See who are your allies and rivals', icon: '👥', action: 'relationships' }
    ];

    actions.forEach(action => {
      const card = this.createActionCard(action.name, action.desc, () => {
        if (action.action === 'dirt') {
          this.renderDirtSheets();
        } else if (action.action === 'relationships') {
          this.renderRelationships(player);
        } else if (action.action === 'booker') {
          this.renderBookerOffice(player);
        } else if (action.action === 'locker') {
          this.renderLockerRoom(player);
        }
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Renders the Booker's Office interaction
   * @private
   */
  renderBookerOffice(player) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.render(gameStateManager.getStateRef(), 'backstage'));
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = "📋 Booker's Office";
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const contract = player.getComponent('contract');
    const state = gameStateManager.getStateRef();

    if (!contract?.promotionId) {
      const noContract = document.createElement('p');
      noContract.textContent = 'You need to be signed to a promotion first.';
      this.container.appendChild(noContract);
      return;
    }

    const promotion = state.promotions.get(contract.promotionId);
    const popularity = player.getComponent('popularity');

    // Current standing
    const standingDiv = document.createElement('div');
    standingDiv.className = 'panel mb-md';
    const positionInfo = CardPositionSystem.getPositionInfo(contract.position || 'dark_match');
    standingDiv.innerHTML = `
      <h5>Your Standing in ${promotion?.name || 'Unknown'}</h5>
      <p>Position: <strong>${positionInfo.name}</strong></p>
      <p>Overness: ${popularity?.overness || 0} | Momentum: ${popularity?.momentum || 0}</p>
      <p>Contract: ${contract.remainingWeeks} weeks remaining ($${contract.weeklySalary}/wk)</p>
    `;
    this.container.appendChild(standingDiv);

    // Request title shot
    const titleShotCard = this.createActionCard(
      'Request Title Shot',
      `Requires high overness and good standing (Charisma check DC 14)`,
      () => {
        const result = ResolutionEngine.resolve({
          actor: player, action: 'Request Title Shot',
          stat: 'charisma', dc: 14, context: {}
        });

        let msg;
        if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS') {
          msg = 'The booker agrees! You\'ll get a title shot at the next big show.';
          if (contract) {
            contract.pendingTitleShot = true;
          }
        } else if (result.outcome === 'FAILURE') {
          msg = 'The booker says you need to prove yourself more first.';
        } else {
          msg = 'The booker is not happy with your attitude. Watch your back.';
        }

        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'backstage', text: `📋 ${msg}`, type: 'booker' }
        });
        this.renderBookerOffice(player);
      }
    );
    this.container.appendChild(titleShotCard);

    // Request better position
    const positionCard = this.createActionCard(
      'Pitch for a Push',
      'Ask for a higher card position (Charisma check DC 12)',
      () => {
        const result = ResolutionEngine.resolve({
          actor: player, action: 'Pitch for Push',
          stat: 'charisma', dc: 12, context: {}
        });

        if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS') {
          const positions = ['dark_match', 'pre_show', 'opener', 'mid_card', 'upper_mid', 'main_event'];
          const currentIdx = positions.indexOf(contract.position || 'dark_match');
          if (currentIdx < positions.length - 1) {
            contract.position = positions[currentIdx + 1];
            const newPosition = CardPositionSystem.getPositionInfo(contract.position).name;
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: { category: 'backstage', text: `📋 The booker gives you a push! New position: ${newPosition}`, type: 'booker' }
            });
          } else {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: { category: 'backstage', text: '📋 You\'re already at the top of the card!', type: 'booker' }
            });
          }
        } else {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'backstage', text: '📋 The booker doesn\'t think you\'re ready for a push yet.', type: 'booker' }
          });
        }
        this.renderBookerOffice(player);
      }
    );
    this.container.appendChild(positionCard);

    // Complain about booking
    const complainCard = this.createActionCard(
      'Complain About Booking',
      '⚠️ Risky — could backfire',
      () => {
        const result = ResolutionEngine.resolve({
          actor: player, action: 'Complain',
          stat: 'charisma', dc: 16, context: {}
        });

        if (result.outcome === 'CRITICAL_SUCCESS') {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'backstage', text: '📋 Your passionate speech impressed the booker. They\'ll consider your feedback.', type: 'booker' }
          });
          if (popularity) popularity.momentum = Math.min(100, popularity.momentum + 10);
        } else if (result.outcome === 'CRITICAL_FAILURE') {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'backstage', text: '📋 The booker is furious! You\'ve been buried. Expect a demotion.', type: 'booker' }
          });
          const positions = ['dark_match', 'pre_show', 'opener', 'mid_card', 'upper_mid', 'main_event'];
          const currentIdx = positions.indexOf(contract.position || 'dark_match');
          if (currentIdx > 0) {
            contract.position = positions[currentIdx - 1];
          }
          if (popularity) popularity.momentum = Math.max(0, popularity.momentum - 15);
        } else {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'backstage', text: '📋 The booker listened but nothing will change.', type: 'booker' }
          });
        }
        this.renderBookerOffice(player);
      }
    );
    this.container.appendChild(complainCard);
  }

  /**
   * Renders the Locker Room interaction
   * @private
   */
  renderLockerRoom(player) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.render(gameStateManager.getStateRef(), 'backstage'));
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = '🗣️ Locker Room';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const contract = player.getComponent('contract');
    const state = gameStateManager.getStateRef();

    // Get roster members
    let rosterMembers = [];
    if (contract?.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      rosterMembers = (promotion?.roster || [])
        .filter(id => id !== player.id)
        .map(id => state.entities.get(id))
        .filter(e => e)
        .slice(0, 8);
    }

    if (rosterMembers.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'The locker room is empty.';
      this.container.appendChild(empty);
      return;
    }

    // General actions
    const generalCard = this.createActionCard(
      '🃏 Play Cards with the Boys',
      'Small relationship gains with everyone present',
      () => {
        rosterMembers.slice(0, 4).forEach(member => {
          RelationshipManager.modifyAffinity(player.id, member.id, 2, 'Playing cards in locker room');
        });
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'backstage', text: '🃏 You hung out and played cards. Everyone seems friendlier.', type: 'social' }
        });
        this.renderLockerRoom(player);
      }
    );
    this.container.appendChild(generalCard);

    const quietCard = this.createActionCard(
      '🧘 Keep to Yourself',
      'No relationship change, mental health +5',
      () => {
        const condition = player.getComponent('condition');
        if (condition) condition.mentalHealth = Math.min(100, (condition.mentalHealth || 75) + 5);
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'backstage', text: '🧘 You kept to yourself and focused on your mental game.', type: 'social' }
        });
        this.render(gameStateManager.getStateRef(), 'backstage');
      }
    );
    this.container.appendChild(quietCard);

    // Individual interactions
    const talkTitle = document.createElement('h5');
    talkTitle.textContent = 'Talk to someone:';
    talkTitle.style.margin = '1rem 0 0.5rem';
    this.container.appendChild(talkTitle);

    rosterMembers.forEach(member => {
      const identity = member.getComponent('identity');
      const rel = RelationshipManager.getRelationship(player.id, member.id);
      const affinity = rel?.affinity || 0;
      let label = 'Neutral';
      if (affinity >= 50) label = 'Ally';
      else if (affinity >= 20) label = 'Friendly';
      else if (affinity <= -50) label = 'Enemy';
      else if (affinity <= -20) label = 'Unfriendly';

      const card = this.createActionCard(
        identity?.name || 'Unknown',
        `${label} (${affinity}) — Spend time together`,
        () => {
          const change = randomInt(2, 8);
          RelationshipManager.modifyAffinity(player.id, member.id, change, 'Locker room conversation');
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'backstage', text: `🗣️ You spent time with ${identity?.name}. Relationship +${change}.`, type: 'social' }
          });
          this.renderLockerRoom(player);
        }
      );
      this.container.appendChild(card);
    });
  }

  /**
   * Renders feud details
   * @private
   */
  renderFeudDetails(feud) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'backstage');
    });
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = `🥊 Feud vs ${feud.opponent}`;
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const details = document.createElement('div');
    details.className = 'panel mb-md';
    details.innerHTML = `
      <p><strong>Phase:</strong> ${feud.phaseName}</p>
      <p><strong>Heat:</strong> ${feud.heat}/100</p>
      <p><strong>Duration:</strong> ${feud.duration} weeks</p>
      <p><strong>Started:</strong> ${feud.cause}</p>
    `;
    this.container.appendChild(details);

    // Show available match types for this feud
    const matchTypes = DynamicFeudSystem.getFeudMatchTypes(feud.id);
    const matchTitle = document.createElement('h5');
    matchTitle.textContent = 'Available Match Types:';
    matchTitle.style.margin = '1rem 0 0.5rem';
    this.container.appendChild(matchTitle);

    matchTypes.forEach(type => {
      const typeDiv = document.createElement('div');
      typeDiv.className = 'panel mb-sm';
      typeDiv.textContent = type;
      this.container.appendChild(typeDiv);
    });
  }

  /**
   * Renders relationship view
   * @private
   */
  renderRelationships(player) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'backstage');
    });
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = '👥 Your Relationships';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const relationships = RelationshipManager.getEntityRelationships(player.id);

    if (relationships.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No significant relationships yet.';
      this.container.appendChild(empty);
      return;
    }

    // Sort by affinity (allies first, then rivals)
    relationships.sort((a, b) => b.relationship.affinity - a.relationship.affinity);

    relationships.forEach(({ entityId, relationship }) => {
      const entity = gameStateManager.getStateRef().entities.get(entityId);
      if (!entity) return;

      const identity = entity.getComponent('identity');
      const name = identity?.name || 'Unknown';

      let color = '#666';
      let label = 'Neutral';

      if (relationship.affinity >= 50) {
        color = '#4caf50';
        label = 'Ally';
      } else if (relationship.affinity >= 20) {
        color = '#8bc34a';
        label = 'Friendly';
      } else if (relationship.affinity <= -50) {
        color = '#f44336';
        label = 'Enemy';
      } else if (relationship.affinity <= -20) {
        color = '#ff9800';
        label = 'Unfriendly';
      }

      const card = document.createElement('div');
      card.className = 'panel mb-md';
      card.style.borderLeft = `3px solid ${color}`;
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${name}</strong>
          <span style="color: ${color}; font-weight: 600;">${label} (${relationship.affinity})</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
          ${relationship.type === 'rival' ? '🔥 Rivalry' : 'Professional Relationship'}
        </p>
        ${relationship.affinity >= 50 ? '<p style="font-size: 0.8rem; color: #4caf50;">✓ Chemistry bonus in matches</p>' : ''}
        ${relationship.affinity <= -50 ? '<p style="font-size: 0.8rem; color: #f44336;">⚠️ Risk of backstage conflict</p>' : ''}
      `;
      this.container.appendChild(card);
    });

    // Add relationship explanation
    const info = document.createElement('div');
    info.className = 'panel mt-md';
    info.style.background = 'rgba(255,200,87,0.1)';
    info.innerHTML = `
      <h5>Relationship Effects:</h5>
      <p style="font-size: 0.85rem; margin-top: 0.5rem;">
        <strong>Allies (+50):</strong> Match chemistry bonus, tag team offers<br>
        <strong>Enemies (-50):</strong> Backstage conflict risk, feud opportunities<br>
        <strong>Relationships drift over time</strong> toward neutral
      </p>
    `;
    this.container.appendChild(info);
  }

  /**
   * Renders dirt sheet stories
   * @private
   */
  renderDirtSheets() {
    const stories = DirtSheetGenerator.checkDirtSheets();

    if (stories.length === 0) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: { category: 'system', text: '📰 You check the dirt sheets... No major news this week.', type: 'dirtsheet' }
      });
    } else {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: { category: 'system', text: '📰 — Wrestling Dirt Sheets —', type: 'dirtsheet' }
      });

      stories.forEach(story => {
        const rumor = story.accurate ? '' : ' [UNVERIFIED]';
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: story.category || 'backstage',
            text: `📰 ${story.headline}: ${story.text}${rumor}`,
            type: 'dirtsheet'
          }
        });
      });
    }
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
   * Shows training sub-menu from the Match tab
   * @private
   */
  renderTrainingSubMenu(player) {
    this.container.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.render(gameStateManager.getStateRef(), 'match'));
    this.container.appendChild(backBtn);
    this._renderTrainingCards(player, 'match');
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
        if (result.error) alert(result.error);
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

      const npcContract = entity.getComponent('contract');
      const position = npcContract?.position
        ? CardPositionSystem.getPositionInfo(npcContract.position).name
        : null;
      const subtitle = position
        ? `${identity.gimmick || 'Wrestler'} · ${position}`
        : (identity.gimmick || 'Wrestler');

      const card = this.createActionCard(
        identity.name,
        subtitle,
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

    this.renderEventOutcome(event, result);
  }

  /**
   * Renders the outcome of an event
   * @private
   */
  renderEventOutcome(event, result) {
    if (!this.container) return;

    this.container.innerHTML = '';

    // Update title
    if (this.titleEl) {
      this.titleEl.textContent = `${event.title} - Outcome`;
    }

    // Event display
    const eventDisplay = document.createElement('div');
    eventDisplay.className = 'event-display';

    const title = document.createElement('h3');
    title.textContent = 'Result';

    const narrative = document.createElement('p');
    narrative.className = 'event-description';
    narrative.textContent = result.narrative;

    eventDisplay.appendChild(title);
    eventDisplay.appendChild(narrative);

    if (result.resolutionResult) {
      const rollInfo = document.createElement('p');
      rollInfo.className = 'event-roll';
      rollInfo.style.marginTop = '1rem';
      rollInfo.style.fontStyle = 'italic';
      rollInfo.style.color = '#888';

      let resText = 'Success';
      if (result.resolutionResult.outcome === 'CRITICAL_SUCCESS') resText = 'Critical Success';
      if (result.resolutionResult.outcome === 'FAILURE') resText = 'Failure';
      if (result.resolutionResult.outcome === 'CRITICAL_FAILURE') resText = 'Critical Failure';

      const roll = result.resolutionResult.roll;
      const modifier = result.resolutionResult.modifier || 0;
      const total = result.resolutionResult.total || (roll + modifier);
      const dc = result.resolutionResult.dc;

      let rollText = `Roll: ${total} vs DC ${dc} (${resText})`;
      if (modifier !== 0) {
        const modSign = modifier >= 0 ? '+' : '';
        rollText += ` — ${roll}${modSign}${modifier}`;
      }

      rollInfo.textContent = rollText;
      eventDisplay.appendChild(rollInfo);
    }

    this.container.appendChild(eventDisplay);

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn mt-md';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      this.currentEvent = null;
      this.render(gameStateManager.getStateRef(), 'match');
    });

    this.container.appendChild(continueBtn);
  }

  /**
   * Renders training options (called from Actions tab)
   * @private
   */
  renderTrainingOptions() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.render(gameStateManager.getStateRef(), 'actions'));
    this.container.appendChild(backBtn);

    const player = gameStateManager.getPlayerEntity();
    this._renderTrainingCards(player, 'actions');
  }

  /**
   * Core training card renderer - applies stat changes.
   * @private
   * @param {Entity} player
   * @param {string} returnTab - tab to return to after training
   */
  _renderTrainingCards(player, returnTab) {
    // Show training summary
    const summary = TrainingSystem.getTrainingSummary(player);

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'panel mb-md';
    summaryDiv.innerHTML = `
      <h4>Training Status</h4>
      <p>Sessions this week: ${summary.sessionsThisWeek}/${summary.maxSessions}</p>
      <p>Burnout: ${summary.burnout}/100</p>
      <p>Stamina: ${summary.stamina}/100</p>
      ${summary.hasTrainer ? '<p style="color: var(--accent-secondary);">Trainer Bonus Active (+50% gains)</p>' : ''}
      ${summary.overtraining ? '<p style="color: var(--accent-danger);">⚠️ Overtraining! Reduced gains, increased injury risk</p>' : ''}
    `;
    this.container.appendChild(summaryDiv);

    const title = document.createElement('h4');
    title.textContent = '💪 Training Options';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const categories = TrainingSystem.getTrainingCategories();

    categories.forEach(cat => {
      const displayRisk = summary.overtraining ? cat.injuryRisk * 2 : cat.injuryRisk;
      const desc = `${cat.description} | Stats: ${cat.stats.join(', ')} | Risk: ${Math.round(displayRisk * 100)}%${summary.overtraining && cat.injuryRisk > 0 ? ' ⚠️' : ''}`;

      const card = this.createActionCard(cat.name, desc, () => {
        if (!player) return;

        // Perform training
        const result = TrainingSystem.train(player, cat.key, false);

        if (result.error) {
          // Show error in log
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'system',
              text: `Training failed: ${result.error}`,
              type: 'error'
            }
          });
        } else {
          // Show success
          const gainText = result.gains.length > 0
            ? result.gains.map(g => `${g.stat} +${g.gain.toFixed(1)}`).join(', ')
            : 'No significant gains this session';

          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'personal',
              text: `${result.narrative} (${gainText})`,
              type: 'training',
              gains: result.gains
            }
          });

          // Show injury warning if applicable
          if (result.injury) {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'injury',
                text: `⚠️ INJURY during training: ${result.injury.bodyPart} (Severity ${result.injury.severity})`,
                type: 'injury',
                injury: result.injury
              }
            });
          }
        }

        this.render(gameStateManager.getStateRef(), returnTab);
      });
      this.container.appendChild(card);
    });

    // Add high intensity training option if not overtraining
    if (!summary.overtraining && summary.stamina >= 30) {
      const intensityTitle = document.createElement('h4');
      intensityTitle.textContent = '🔥 High Intensity Training';
      intensityTitle.style.margin = '1rem 0';
      this.container.appendChild(intensityTitle);

      const intensityCard = this.createActionCard(
        'Intense Session',
        '50% more gains but +50% stamina cost and +1 burnout',
        () => {
          if (!player) return;

          // Pick random category for high intensity
          const randomCat = categories[Math.floor(Math.random() * categories.length)];
          const result = TrainingSystem.train(player, randomCat.key, true);

          if (!result.error) {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'personal',
                text: `🔥 HIGH INTENSITY ${result.narrative}`,
                type: 'training',
                gains: result.gains,
                intensity: 'high'
              }
            });

            if (result.injury) {
              gameStateManager.dispatch('ADD_LOG_ENTRY', {
                entry: {
                  category: 'injury',
                  text: `⚠️ INJURY during high intensity training: ${result.injury.bodyPart}`,
                  type: 'injury'
                }
              });
            }
          }

          this.render(gameStateManager.getStateRef(), returnTab);
        }
      );
      this.container.appendChild(intensityCard);
    }
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
    const bookedText = match.bookedWinner === 'wrestler1' ?
      '<span style="color: var(--accent-success);">BOOKED TO WIN</span>' :
      '<span style="color: var(--accent-danger);">BOOKED TO LOSE (DO THE HONORS)</span>';

    let matchDetailHtml = `
      <p>You are scheduled to face <strong>${opponentName}</strong></p>
      <p>Match Type: ${match.matchType || 'Standard Singles'}</p>
    `;

    if (match.isTitleMatch && match.titleId) {
      const state = gameStateManager.getStateRef();
      const title = state.championships.get(match.titleId);
      if (title) {
        matchDetailHtml += `
          <p style="color: var(--accent-primary); font-weight: bold; margin-top: 0.5rem;">
            🏆 FOR THE ${title.name.toUpperCase()}!
          </p>
        `;
      }
    }

    matchDetailHtml += `
      <p style="margin-top: 1rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
        Booking Instruction: <strong>${bookedText}</strong>
      </p>
    `;

    const matchInfo = document.createElement('div');
    matchInfo.className = 'event-display';
    matchInfo.innerHTML = matchDetailHtml;
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

    if (this.titleEl) {
      this.titleEl.textContent = 'Match in Progress';
    }

    this.matchView.show({
      ...match,
      wrestler1: match.player,
      wrestler2: match.opponent,
      matchType: match.matchType || 'Standard Singles',
      playerSide: 'wrestler1'
    }, this.container);

    document.addEventListener('matchEnded', (e) => {
      this.inMatch = false;

      const winnerSide = e.detail.winnerSide;
      const winnerEntityId = e.detail.winnerEntityId;
      const winnerName = e.detail.winnerName || e.detail.winner;
      const rating = e.detail.rating;

      // Determine winner/loser entities
      const playerWon = winnerEntityId ? winnerEntityId === match.player.id : winnerSide === 'wrestler1';
      const winner = playerWon ? match.player : match.opponent;
      const loser = playerWon ? match.opponent : match.player;

      // Process match results — updates career stats, overness, momentum, relationships
      MatchResultProcessor.processMatchResult(
        { ...match, turn: this.matchView.simulator?.matchState?.turn || 10 },
        winner, loser, rating
      );

      // Evaluate booking success
      const followedBooking = match.bookedWinner ?
        ((match.bookedWinner === 'wrestler1' && playerWon) || (match.bookedWinner === 'wrestler2' && !playerWon)) :
        true;
      const bookingStatus = followedBooking ? ' [FOLLOWED BOOKING]' : ' [WENT OFF SCRIPT]';
      const titleBonus = (match.isTitleMatch && playerWon) ? ' 🏆 AND NEW CHAMPION!' : '';

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `Match Ended: ${winnerName} won with ${rating.toFixed(1)} stars${bookingStatus}${titleBonus}`,
          type: 'match'
        }
      });

      if (!followedBooking) {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'backstage',
            text: `⚠️ The booker is NOT HAPPY that you went off-script!`,
            type: 'booker'
          }
        });
      }

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

  /**
   * Renders the Career tab with championships and perks
   * @private
   */
  renderCareerTab(state) {
    const player = gameStateManager.getPlayerEntity();
    if (!player) return;

    const contract = player.getComponent('contract');
    const popularity = player.getComponent('popularity');

    // Fix for legacy bug: cap popularity stats
    if (popularity) {
      popularity.overness = Math.min(100, (popularity.overness || 0));
      popularity.momentum = Math.min(100, (popularity.momentum || 0));
    }

    // Contract / Promotion section
    if (contract?.promotionId) {
      const promotion = state.promotions.get(contract.promotionId);
      const positionInfo = contract.position ?
        CardPositionSystem.getPositionInfo(contract.position).name.toUpperCase() :
        'DARK MATCH';

      const contractCard = document.createElement('div');
      contractCard.className = 'panel mb-md';
      contractCard.innerHTML = `
        <h4>📝 Contract: ${promotion?.name || 'Unknown'}</h4>
        <p>Position: <strong>${positionInfo}</strong></p>
        <p>Salary: $${contract.weeklySalary}/week</p>
        <p>Remaining: ${contract.remainingWeeks} weeks</p>
        ${contract.hasCreativeControl ? '<p style="color: var(--accent-secondary);">✓ Creative Control</p>' : ''}
        ${contract.hasMerchCut > 0 ? `<p>Merch Cut: ${contract.hasMerchCut}%</p>` : ''}
      `;
      this.container.appendChild(contractCard);
    } else {
      const freeAgentCard = document.createElement('div');
      freeAgentCard.className = 'panel mb-md';
      freeAgentCard.style.borderLeft = '3px solid #ff9800';
      freeAgentCard.innerHTML = `
        <h4>⚠️ Free Agent</h4>
        <p style="font-size: 0.9rem;">You are not signed to any promotion. Browse promotions below to apply.</p>
      `;
      this.container.appendChild(freeAgentCard);
    }

    // Browse Promotions / Apply
    const browseCard = this.createActionCard(
      '🏢 Browse Promotions',
      contract?.promotionId ? 'View other promotions and contract offers' : 'Find a promotion to sign with',
      () => this.renderPromotionBrowser(player)
    );
    this.container.appendChild(browseCard);

    // Championships
    const titlesSection = document.createElement('div');
    titlesSection.className = 'panel mb-md';
    titlesSection.innerHTML = '<h4>🏆 Championships</h4>';

    const championships = ChampionshipSystem.getWrestlerChampionships(player);
    if (championships.length === 0) {
      titlesSection.innerHTML += '<p style="margin-top: 0.5rem; color: var(--text-muted);">No championships yet</p>';
    } else {
      championships.forEach(champ => {
        const reignText = champ.totalReigns > 1 ?
          `${champ.totalReigns} reigns, ${champ.totalDefenses} defenses` :
          `Current champion (${champ.reigns[champ.reigns.length - 1]?.defenses || 0} defenses)`;

        titlesSection.innerHTML += `
          <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255,200,87,0.1); border-radius: var(--radius-sm);">
            <strong>${champ.name}</strong><br/>
            <span style="font-size: 0.85rem;">${reignText}</span>
          </div>
        `;
      });
    }
    this.container.appendChild(titlesSection);

    // Perks
    const perkCard = this.createActionCard('View Perks', 'See unlocked and active perks', () => {
      this.renderPerkView(player);
    });
    this.container.appendChild(perkCard);

    // Storylines
    const storylines = StorylineManager.getEntityStorylines(player.id);
    if (storylines.length > 0) {
      const storyCard = document.createElement('div');
      storyCard.className = 'panel mb-md';
      storyCard.innerHTML = '<h4>🎬 Active Storylines</h4>';

      storylines.forEach(story => {
        storyCard.innerHTML += `
          <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm);">
            <strong>${story.name}</strong> (${story.type})<br/>
            <span style="font-size: 0.85rem;">Beat ${story.currentBeat + 1}/${story.totalBeats} | Quality: ${story.quality}/100</span>
          </div>
        `;
      });
      this.container.appendChild(storyCard);
    }
  }

  /**
   * Renders the promotion browser with contract offers
   * @private
   */
  renderPromotionBrowser(player) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.render(gameStateManager.getStateRef(), 'career'));
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = '🏢 Promotions';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const state = gameStateManager.getStateRef();
    const currentContract = player.getComponent('contract');
    const popularity = player.getComponent('popularity');
    const playerOverness = popularity?.overness || 5;

    // Sort promotions by prestige
    const promotions = Array.from(state.promotions.values())
      .sort((a, b) => b.prestige - a.prestige);

    promotions.forEach(promo => {
      const isCurrent = currentContract?.promotionId === promo.id;
      const tierLabel = promo.prestige >= 71 ? 'Global' :
        promo.prestige >= 41 ? 'National' :
          promo.prestige >= 16 ? 'Regional' : 'Indie';

      // Can the player realistically get signed here?
      const minOverness = promo.prestige >= 71 ? 40 :
        promo.prestige >= 41 ? 20 :
          promo.prestige >= 16 ? 10 : 0;
      const canApply = !isCurrent && playerOverness >= minOverness && !currentContract?.promotionId;
      const tooLow = !isCurrent && playerOverness < minOverness;

      const card = document.createElement('div');
      card.className = 'panel mb-md';
      if (isCurrent) card.style.borderLeft = '3px solid var(--accent-secondary)';
      else if (tooLow) card.style.opacity = '0.6';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${promo.name}</strong> ${isCurrent ? '(Current)' : ''}
            <br/><span style="font-size: 0.85rem; color: var(--text-secondary);">${tierLabel} | ${promo.region} | ${promo.stylePreference}</span>
          </div>
          <span style="font-weight: 600;">⭐ ${promo.prestige}</span>
        </div>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Roster: ${promo.roster?.length || 0} wrestlers</p>
        ${tooLow ? `<p style="font-size: 0.8rem; color: var(--accent-danger); margin-top: 0.25rem;">Requires ${minOverness}+ overness to apply</p>` : ''}
      `;

      if (canApply) {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary mt-sm';
        applyBtn.style.marginTop = '0.5rem';
        applyBtn.textContent = '📝 Apply for Contract';
        applyBtn.addEventListener('click', () => this.renderContractOffer(player, promo));
        card.appendChild(applyBtn);
      }

      this.container.appendChild(card);
    });
  }

  /**
   * Renders a contract offer from a promotion
   * @private
   */
  renderContractOffer(player, promotion, existingOffer = null) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      // Clear the stored offer when going back
      this.currentOffer = null;
      this.currentPromotion = null;
      this.renderPromotionBrowser(player);
    });
    this.container.appendChild(backBtn);

    const offer = existingOffer || ContractEngine.generateOffer(promotion, player);

    // Store the current offer and promotion for persistence
    this.currentOffer = offer;
    this.currentPromotion = promotion;

    const title = document.createElement('h4');
    title.textContent = `📝 Contract Offer: ${promotion.name}`;
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const offerDiv = document.createElement('div');
    offerDiv.className = 'panel mb-md';
    offerDiv.innerHTML = `
      <h5>Terms</h5>
      <p><strong>Weekly Salary:</strong> $${this.currentOffer.weeklySalary}</p>
      <p><strong>Length:</strong> ${this.currentOffer.lengthWeeks} weeks</p>
      <p><strong>Position:</strong> ${CardPositionSystem.getPositionInfo(this.currentOffer.position).name}</p>
      <p><strong>TV Appearance Bonus:</strong> $${this.currentOffer.tvAppearanceBonus}</p>
      <p><strong>Creative Control:</strong> ${this.currentOffer.hasCreativeControl ? 'Yes' : 'No'}</p>
      <p><strong>Merch Cut:</strong> ${this.currentOffer.hasMerchCut}%</p>
      <p><strong>No-Compete:</strong> ${this.currentOffer.noCompeteWeeks} weeks</p>
      ${this.currentOffer.benefits.length > 0 ? `<p><strong>Benefits:</strong> ${this.currentOffer.benefits.join(', ')}</p>` : ''}
    `;
    this.container.appendChild(offerDiv);

    // Accept button
    const acceptCard = this.createActionCard(
      '✅ Accept Contract',
      `Sign with ${promotion.name} for $${this.currentOffer.weeklySalary}/week`,
      () => {
        const result = ContractEngine.signContract(player, this.currentOffer);
        if (result && (result.success ?? result)) {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'personal',
              text: `🎉 You signed with ${promotion.name}! Brand changed. New position: ${CardPositionSystem.getPositionInfo(this.currentOffer.position).name}.`,
              type: 'contract'
            }
          });
          // Clear the stored offer after signing
          this.currentOffer = null;
          this.currentPromotion = null;
        }
        this.render(gameStateManager.getStateRef(), 'career');
      }
    );
    acceptCard.style.borderLeft = '3px solid #4caf50';
    this.container.appendChild(acceptCard);

    // Negotiate salary
    const negotiateCard = this.createActionCard(
      '💰 Negotiate Higher Salary',
      `Try to get +50% salary ($${Math.floor(this.currentOffer.weeklySalary * 1.5)}/week)`,
      () => {
        const result = ContractEngine.negotiateClause(player, 'weeklySalary', this.currentOffer, Math.floor(this.currentOffer.weeklySalary * 1.5));
        this.currentOffer.weeklySalary = result.resultValue;

        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `💰 ${result.narrative} Salary: $${result.resultValue}/week`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateCard);

    // Decline
    const declineCard = this.createActionCard(
      '❌ Decline Offer',
      'Walk away from this deal',
      () => {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `Declined contract offer from ${promotion.name}.`, type: 'contract' }
        });
        // Clear the stored offer when declining
        this.currentOffer = null;
        this.currentPromotion = null;
        this.renderPromotionBrowser(player);
      }
    );
    declineCard.style.borderLeft = '3px solid #f44336';
    this.container.appendChild(declineCard);
  }

  /**
   * Renders the perk view
   * @private
   */
  renderPerkView(player) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      this.render(gameStateManager.getStateRef(), 'career');
    });
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = '⭐ Perks';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const perkData = PerkSystem.getAvailablePerks(player);

    // Show active perks
    if (perkData.active.length > 0) {
      const activeDiv = document.createElement('div');
      activeDiv.className = 'panel mb-md';
      activeDiv.innerHTML = `
        <h5>Active Perks (${perkData.active.length}/8)</h5>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
          ${perkData.availableSlots} slots remaining
        </p>
      `;

      perkData.active.forEach(perk => {
        activeDiv.innerHTML += `
          <div style="padding: 0.5rem; margin-top: 0.5rem; background: rgba(76,175,80,0.2); border-radius: var(--radius-sm);">
            <strong>${perk.name}</strong> (${perk.category})<br/>
            <span style="font-size: 0.8rem;">${perk.description}</span>
          </div>
        `;
      });
      this.container.appendChild(activeDiv);
    }

    // Show unlocked but inactive perks
    const unlockedInactive = perkData.unlocked.filter(p =>
      !perkData.active.find(ap => ap.id === p.id)
    );

    if (unlockedInactive.length > 0) {
      const inactiveDiv = document.createElement('div');
      inactiveDiv.className = 'panel mb-md';
      inactiveDiv.innerHTML = '<h5>Unlocked (Inactive)</h5>';

      unlockedInactive.forEach(perk => {
        const card = this.createActionCard(perk.name, perk.description, () => {
          const result = PerkSystem.activatePerk(player, perk.id);
          if (result.success) {
            this.renderPerkView(player);
          } else {
            alert(result.error);
          }
        });
        inactiveDiv.appendChild(card);
      });
      this.container.appendChild(inactiveDiv);
    }

    // Show perk progress
    const progressDiv = document.createElement('div');
    progressDiv.className = 'panel';
    progressDiv.innerHTML = '<h5>Perk Progress</h5>';

    const progress = PerkSystem.getPerkProgress(player);
    Object.values(progress).slice(0, 5).forEach(p => { // Show first 5
      if (!p.completed) {
        const percent = Math.min(100, (p.current / p.requirement.value) * 100);
        progressDiv.innerHTML += `
          <div style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
              <span>${p.name}</span>
              <span>${p.current}/${p.requirement.value}</span>
            </div>
            <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; margin-top: 2px;">
              <div style="height: 100%; width: ${percent}%; background: var(--accent-secondary); border-radius: 2px;"></div>
            </div>
          </div>
        `;
      }
    });
    this.container.appendChild(progressDiv);
  }
}

export default ActionPanel;
