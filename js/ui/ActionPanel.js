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
import { dataManager } from '../core/DataManager.js';

/**
 * ActionPanel - Renders the action panel
 */
export class ActionPanel {
  constructor() {
    this.container = document.getElementById('action-content');
    this.titleEl = document.getElementById('action-title');
    this.currentEvent = null;
    this.currentMatchAction = null;
    this.matchView = new MatchView();
    this.inMatch = false;
    this.currentOffer = null;
    this.currentPromotion = null;
    this.currentPromotionId = null;
    this.careerView = 'main';
    this.fastForwarding = false;
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
      if (this.currentEvent.result) {
        this.renderEventOutcome(this.currentEvent.event, this.currentEvent.result);
      } else {
        this.renderEvent(this.currentEvent.event);
      }
      return;
    }

    // If there's a pending match action, show it
    if (this.currentMatchAction) {
      this.renderMatchPreparation(this.currentMatchAction);
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
        if (this.careerView === 'offer' && this.currentOffer && this.currentPromotionId) {
          const player = gameStateManager.getPlayerEntity();
          const promotion = state.promotions.get(this.currentPromotionId);
          if (player && promotion) {
            this.renderContractOffer(player, promotion, this.currentOffer);
            break;
          }
          this.currentOffer = null;
          this.currentPromotion = null;
          this.currentPromotionId = null;
          this.careerView = 'main';
        } else if (this.careerView === 'browser') {
          const player = gameStateManager.getPlayerEntity();
          if (player) {
            this.renderPromotionBrowser(player);
            break;
          }
          this.careerView = 'main';
        }
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
    if (this.fastForwarding) return;
    this.fastForwarding = true;

    let contract = player.getComponent('contract');
    if (!contract?.promotionId) {
      this.fastForwarding = false;
      return;
    }

    const state = gameStateManager.getStateRef();
    let promotion = state.promotions.get(contract.promotionId);
    if (!promotion) {
      this.fastForwarding = false;
      return;
    }

    // Check if player is injured before starting
    if (this._isPlayerInjured(player)) {
      this.render(gameStateManager.getStateRef(), 'match');
      this.fastForwarding = false;
      return;
    }

    // Fast-forward to show day (chunked to avoid UI lock)
    const maxTicks = 28;
    let i = 0;
    const step = () => {
      if (i < maxTicks) {
        const pendingActions = WorldSimulator.tick(state);

        // Check if contract expired during this tick
        contract = player.getComponent('contract');
        if (!contract?.promotionId) {
          // Contract expired - stop advancing and refresh the UI
          this.render(gameStateManager.getStateRef(), 'match');
          this.fastForwarding = false;
          return;
        }

        // Check if player became injured during this tick
        if (this._isPlayerInjured(player)) {
          this.render(gameStateManager.getStateRef(), 'match');
          this.fastForwarding = false;
          return;
        }

        if (pendingActions?.length > 0) {
          const matchAction = pendingActions.find(a => a.type === 'match');
          if (matchAction) {
            this.currentMatchAction = matchAction;
            this.renderMatchPreparation(matchAction);
            this.fastForwarding = false;
            return;
          }
        }

        // Check for events AFTER ticking and processing match/injury/contract
        // Events have a 30% chance to occur (average every 3-4 days)
        if (Math.random() < 0.3) {
          const event = eventManager.generateEvents(player, state);
          if (event) {
            this.displayEvent(event);
            this.fastForwarding = false;
            return;
          }
        }

        i++;
        setTimeout(step, 0);
        return;
      }

      // Refresh promotion reference in case it changed
      contract = player.getComponent('contract');
      if (!contract?.promotionId) {
        this.render(gameStateManager.getStateRef(), 'match');
        this.fastForwarding = false;
        return;
      }
      promotion = state.promotions.get(contract.promotionId);
      if (!promotion) {
        this.fastForwarding = false;
        return;
      }

      // Check if player is still injured before forcing a match
      if (this._isPlayerInjured(player)) {
        this.render(gameStateManager.getStateRef(), 'match');
        this.fastForwarding = false;
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
          npcContract.lengthWeeks = 52;
          npcContract.remainingWeeks = 52;
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
      this.fastForwarding = false;
    };

    step();
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
              this.currentMatchAction = matchAction;
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
    CardPositionSystem.syncChampionPositions(state, promotion?.id || null);
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
        if (contract?.pendingTitleShot) {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'backstage',
              text: '📋 You already have a title shot queued for an upcoming show.',
              type: 'booker'
            }
          });
          this.renderBookerOffice(player);
          return;
        }

        const championships = ChampionshipSystem.getPromotionChampionships(promotion.id);
        const challengableTitles = championships.filter(c => c && c.currentChampionId !== player.id);
        if (challengableTitles.length === 0) {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: {
              category: 'backstage',
              text: '📋 No available championship matches right now.',
              type: 'booker'
            }
          });
          this.renderBookerOffice(player);
          return;
        }

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

    // Show available match types for this feud - now clickable!
    const matchTypes = DynamicFeudSystem.getFeudMatchTypes(feud.id);
    const matchTitle = document.createElement('h5');
    matchTitle.textContent = 'Available Match Types (Click to Book):';
    matchTitle.style.margin = '1rem 0 0.5rem';
    this.container.appendChild(matchTitle);

    const state = gameStateManager.getStateRef();
    const opponent = state.entities.get(feud.opponentId);
    const player = gameStateManager.getPlayerEntity();

    matchTypes.forEach(type => {
      const card = this.createActionCard(type, 'Click to book this match type', () => {
        if (player && opponent) {
          this._bookMatchWithType(player, opponent, type);
        }
      });
      this.container.appendChild(card);
    });

    // Add option to settle/resolve the feud if in blowoff or bloodfeud phase
    if (feud.phase === 'blowoff' || feud.phase === 'bloodfeud') {
      const settleTitle = document.createElement('h5');
      settleTitle.textContent = 'End the War:';
      settleTitle.style.margin = '1.5rem 0 0.5rem';
      settleTitle.style.color = '#e94560';
      this.container.appendChild(settleTitle);

      const settleCard = this.createActionCard(
        '💀 Settle the Score',
        'Agree to end this feud after one final match. The winner takes all.',
        () => {
          if (player && opponent) {
            // Book a final "feud ender" match
            const matchTypes = DynamicFeudSystem.getFeudMatchTypes(feud.id);
            const finalMatchType = matchTypes.includes('Retirement Match')
              ? 'Retirement Match'
              : matchTypes.includes('Loser Leaves Town')
                ? 'Loser Leaves Town'
                : matchTypes[matchTypes.length - 1];

            this._bookMatchWithType(player, opponent, finalMatchType);

            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'backstage',
                text: `💀 THE WAR ENDS HERE! This is the FINAL BATTLE between you and ${opponent.getComponent('identity')?.name || 'them'}!`,
                type: 'feud'
              }
            });
          }
        }
      );
      settleCard.style.border = '2px solid #e94560';
      this.container.appendChild(settleCard);
    }
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
      card.style.cursor = 'pointer';
      const romanceLevel = relationship.romanceLevel || 0;
      const trust = relationship.trust ?? 50;
      const romanticStatus = relationship.type === 'romantic'
        ? `💘 Romantic${relationship.committed ? ' · Committed' : ''}${relationship.secretAffair ? ' · Secret Affair' : ''}`
        : (relationship.type === 'rival' ? '🔥 Rivalry' : 'Professional Relationship');
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${name}</strong>
          <span style="color: ${color}; font-weight: 600;">${label} (${relationship.affinity})</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
          ${romanticStatus}
        </p>
        ${relationship.type === 'romantic' ? `<p style="font-size: 0.8rem;">Romance: ${romanceLevel} | Trust: ${trust}</p>` : ''}
        ${relationship.affinity >= 50 ? '<p style="font-size: 0.8rem; color: #4caf50;">✓ Chemistry bonus in matches</p>' : ''}
        ${relationship.affinity <= -50 ? '<p style="font-size: 0.8rem; color: #f44336;">⚠️ Risk of backstage conflict</p>' : ''}
      `;
      card.addEventListener('click', () => {
        this.renderRelationshipActions(player, entity, relationship);
      });
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
        <strong>Romance:</strong> Optional personal storyline with trust/commitment dynamics<br>
        <strong>Relationships drift over time</strong> toward neutral
      </p>
    `;
    this.container.appendChild(info);
  }

  /**
   * Renders action options for a specific relationship
   * @private
   */
  renderRelationshipActions(player, target, relationship) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back to Relationships';
    backBtn.addEventListener('click', () => {
      this.renderRelationships(player);
    });
    this.container.appendChild(backBtn);

    const identity = target.getComponent('identity');
    const name = identity?.name || 'Unknown';

    const title = document.createElement('h4');
    title.textContent = `Actions with ${name}`;
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    // Show current relationship status
    const statusDiv = document.createElement('div');
    statusDiv.className = 'panel mb-md';
    const romanticStatus = relationship.type === 'romantic'
      ? `💘 Romantic${relationship.committed ? ' · Committed' : ''}${relationship.secretAffair ? ' · Secret Affair' : ''}`
      : (relationship.type === 'rival' ? '🔥 Rivalry' : 'Professional Relationship');
    statusDiv.innerHTML = `
      <p><strong>Status:</strong> ${romanticStatus}</p>
      <p><strong>Affinity:</strong> ${relationship.affinity}</p>
      ${relationship.type === 'romantic' ? `<p><strong>Romance Level:</strong> ${relationship.romanceLevel || 0}</p><p><strong>Trust:</strong> ${relationship.trust ?? 50}</p>` : ''}
    `;
    this.container.appendChild(statusDiv);

    // Basic social actions
    const socializeCard = this.createActionCard(
      'Show Respect',
      'Spend time together and improve your relationship',
      () => {
        this.showRespect(player, target);
        this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
      }
    );
    this.container.appendChild(socializeCard);

    const trashTalkCard = this.createActionCard(
      'Talk Trash',
      'Lower relationship and stir conflict',
      () => {
        this.talkTrash(player, target);
        this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
      }
    );
    this.container.appendChild(trashTalkCard);

    // Romance section
    const playerAge = player.getComponent('identity')?.age || 18;
    const targetAge = target.getComponent('identity')?.age || 18;
    if (playerAge >= 18 && targetAge >= 18) {
      const romanceTitle = document.createElement('h4');
      romanceTitle.textContent = 'Romance';
      romanceTitle.style.margin = '1rem 0';
      this.container.appendChild(romanceTitle);

      const flirtCard = this.createActionCard(
        'Flirt',
        'Light romantic approach to test chemistry',
        () => {
          this.flirtWithWrestler(player, target);
          this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
        }
      );
      this.container.appendChild(flirtCard);

      const dateCard = this.createActionCard(
        'Ask on Date',
        'Try to start a romantic connection',
        () => {
          this.askOnDate(player, target);
          this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
        }
      );
      this.container.appendChild(dateCard);

      const privateCard = this.createActionCard(
        'Private Night',
        'Mature interaction (fade-to-black, non-explicit)',
        () => {
          this.privateNight(player, target);
          this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
        }
      );
      this.container.appendChild(privateCard);

      // NSFW actions - only show if NSFW content is enabled
      const nsfwEnabled = gameStateManager.getStateRef().settings.nsfwContent;
      if (nsfwEnabled) {
        const nsfwTitle = document.createElement('h4');
        nsfwTitle.textContent = 'Intimate Actions';
        nsfwTitle.style.margin = '1rem 0';
        nsfwTitle.style.color = '#e91e63';
        this.container.appendChild(nsfwTitle);

        const intimateCard = this.createActionCard(
          'Intimate Encounter',
          'Passionate and explicit physical intimacy',
          () => {
            this.intimateEncounter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        intimateCard.style.borderLeft = '3px solid #e91e63';
        this.container.appendChild(intimateCard);

        const affairCard = this.createActionCard(
          'Explicit Affair',
          'Risky: Explicit secret affair if already committed',
          () => {
            this.explicitSecretAffair(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        affairCard.style.borderLeft = '3px solid #f44336';
        this.container.appendChild(affairCard);

        const roughCard = this.createActionCard(
          'Rough Sex',
          'Intense, aggressive physical encounter with passion and intensity',
          () => {
            this.roughSexEncounter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        roughCard.style.borderLeft = '3px solid #9c27b0';
        this.container.appendChild(roughCard);

        const publicCard = this.createActionCard(
          'Risky Public Play',
          'Explicit encounter in a risky location - backstage, locker room, or venue',
          () => {
            this.publicRiskEncounter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        publicCard.style.borderLeft = '3px solid #ff5722';
        this.container.appendChild(publicCard);

        const kinkCard = this.createActionCard(
          'Explore Kinks',
          'Experiment with fetishes, roleplay, and dominant/submissive dynamics',
          () => {
            this.kinkExploration(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        kinkCard.style.borderLeft = '3px solid #673ab7';
        this.container.appendChild(kinkCard);

        const groupCard = this.createActionCard(
          'Group Activity',
          'Invite others to join for an explicit multi-partner encounter',
          () => {
            this.groupEncounter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        groupCard.style.borderLeft = '3px solid #795548';
        this.container.appendChild(groupCard);

        const seduceCard = this.createActionCard(
          'Seduce in the Ring',
          'Explicit encounter during or after a match - in the ropes or on the mat',
          () => {
            this.ringSeduction(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        seduceCard.style.borderLeft = '3px solid #ec407a';
        this.container.appendChild(seduceCard);

        const showerCard = this.createActionCard(
          'Shower Together',
          'Intimate encounter in the locker room showers with steam and soap',
          () => {
            this.showerEncounter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        showerCard.style.borderLeft = '3px solid #00bcd4';
        this.container.appendChild(showerCard);

        const quickieCard = this.createActionCard(
          'Quick Hookup',
          'Fast, urgent encounter - no time for romance, just pure need',
          () => {
            this.quickHookup(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        quickieCard.style.borderLeft = '3px solid #ff9800';
        this.container.appendChild(quickieCard);

        const hotelCard = this.createActionCard(
          'Hotel Room All-Nighter',
          'Book a room and spend the entire night exploring every desire',
          () => {
            this.hotelAllNighter(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        hotelCard.style.borderLeft = '3px solid #4caf50';
        this.container.appendChild(hotelCard);

        const oilCard = this.createActionCard(
          'Oil Wrestling',
          'Slippery, sensual wrestling match that turns into much more',
          () => {
            this.oilWrestling(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        oilCard.style.borderLeft = '3px solid #ffc107';
        this.container.appendChild(oilCard);

        const spankingCard = this.createActionCard(
          'Spanking Session',
          'Discipline and punishment play with impact and control',
          () => {
            this.spankingSession(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        spankingCard.style.borderLeft = '3px solid #e91e63';
        this.container.appendChild(spankingCard);

        const videoCard = this.createActionCard(
          'Make Private Video',
          'Record an explicit video together - risky but incredibly intimate',
          () => {
            this.privateVideo(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        videoCard.style.borderLeft = '3px solid #9c27b0';
        this.container.appendChild(videoCard);
      }

      const commitCard = this.createActionCard(
        'Commit to Relationship',
        'Become an official couple if chemistry is high',
        () => {
          this.commitRelationship(player, target);
          this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
        }
      );
      this.container.appendChild(commitCard);

      const cheatCard = this.createActionCard(
        'Start Secret Affair',
        'Risky: cheat if you are already committed to someone else',
        () => {
          this.startSecretAffair(player, target);
          this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
        }
      );
      cheatCard.style.borderLeft = '3px solid #ff5722';
      this.container.appendChild(cheatCard);

      // Break up option - always available if in a romantic relationship
      const rel = this._getRel(player.id, target.id);
      if (rel && rel.type === 'romantic') {
        const breakupCard = this.createActionCard(
          'Break Up',
          rel.committed ? 'End your committed relationship' : 'End your romantic connection',
          () => {
            this.breakUp(player, target);
            this.renderRelationshipActions(player, target, this._getRel(player.id, target.id));
          }
        );
        breakupCard.style.borderLeft = '3px solid #f44336';
        this.container.appendChild(breakupCard);
      }
    }
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
    let promotionId = null;
    if (playerContract && playerContract.promotionId) {
      const promotion = state.promotions.get(playerContract.promotionId);
      rosterIds = promotion?.roster || [];
      promotionId = promotion?.id || null;
    } else {
      rosterIds = Array.from(state.entities.keys());
    }

    const championTitlesById = new Map();
    for (const championship of state.championships.values()) {
      if (promotionId && championship.promotionId !== promotionId) continue;
      if (!championship.currentChampion) continue;
      const list = championTitlesById.get(championship.currentChampion) || [];
      list.push(championship);
      championTitlesById.set(championship.currentChampion, list);
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

      const titles = championTitlesById.get(entityId) || [];
      const titleWrap = document.createElement('div');
      titleWrap.className = 'person-title-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'person-name';
      nameEl.textContent = identity.name;
      titleWrap.appendChild(nameEl);

      if (titles.length) {
        const beltGroup = document.createElement('div');
        beltGroup.className = 'belt-group';

        titles.forEach(championship => {
          const belt = document.createElement('span');
          belt.className = `belt-badge belt-${championship.type || 'generic'}`;
          belt.title = championship.name;
          beltGroup.appendChild(belt);
        });

        titleWrap.appendChild(beltGroup);
      }

      const card = this.createActionCard(
        titleWrap,
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
    if (title instanceof HTMLElement) {
      titleEl.appendChild(title);
    } else {
      titleEl.textContent = title;
    }

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
    this.currentEvent = { event, result: null };
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

    // Scout/buyout events should open the contract negotiation screen, not auto-sign.
    if (event.id === 'scout_notice' && result.generatedOffer && result.generatedPromotionId) {
      const promotion = state.promotions.get(result.generatedPromotionId);
      if (promotion) {
        this.currentEvent = null;
        this.careerView = 'offer';
        this.currentOffer = result.generatedOffer;
        this.currentPromotion = promotion;
        this.currentPromotionId = promotion.id;
        this.renderContractOffer(player, promotion, result.generatedOffer);
        return;
      }
    }

    this.currentEvent = { event, result };
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
        '100% more gains but +50% stamina cost and +1 burnout',
        () => {
          if (!player) return;

          // Pick random category for high intensity
          const randomCat = categories[Math.floor(Math.random() * categories.length)];
          const result = TrainingSystem.train(player, randomCat.key, true);

          if (!result.error) {
            const gainsText = result.gains && result.gains.length > 0
              ? result.gains.map(g => `${g.stat} +${g.gain.toFixed(1)}`).join(', ')
              : 'no gains (maxed out)';
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'personal',
                text: `🔥 HIGH INTENSITY ${result.category}: ${result.narrative} (${gainsText}). Burnout +${result.burnoutCost}${result.injury ? ` INJURY: ${result.injury.bodyPart}!` : ''}`,
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
    this.currentMatchAction = null;

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
      const stateRef = gameStateManager.getStateRef();
      const preMatchTitle = (match.isTitleMatch && match.titleId)
        ? stateRef.championships.get(match.titleId)
        : null;
      const wasPlayerChampionBefore = preMatchTitle?.currentChampion === match.player.id;

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
      const playerContract = match.player.getComponent('contract');
      const hasCreativeControl = !!playerContract?.hasCreativeControl;
      const followedBooking = match.bookedWinner ?
        ((match.bookedWinner === 'wrestler1' && playerWon) || (match.bookedWinner === 'wrestler2' && !playerWon)) :
        true;
      const bookingStatus = followedBooking
        ? ' [FOLLOWED BOOKING]'
        : (hasCreativeControl ? ' [CREATIVE CONTROL OVERRIDE]' : ' [WENT OFF SCRIPT]');
      let titleBonus = '';
      if (match.isTitleMatch) {
        if (playerWon && !wasPlayerChampionBefore) {
          titleBonus = ' 🏆 AND NEW CHAMPION!';
        } else if (playerWon && wasPlayerChampionBefore) {
          titleBonus = ' 👑 AND STILL CHAMPION!';
        } else if (!playerWon && wasPlayerChampionBefore) {
          titleBonus = ' ❌ TITLE LOST!';
        }
      }

      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'match',
          text: `Match Ended: ${winnerName} won with ${rating.toFixed(1)} stars${bookingStatus}${titleBonus}`,
          type: 'match'
        }
      });

      if (!followedBooking && !hasCreativeControl) {
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

    const state = gameStateManager.getStateRef();
    const player = gameStateManager.getPlayerEntity();
    const identity = entity.getComponent('identity');
    const inRingStats = entity.getComponent('inRingStats');
    const popularity = entity.getComponent('popularity');
    const careerStats = entity.getComponent('careerStats');
    const playerContract = player?.getComponent('contract');
    const targetContract = entity.getComponent('contract');
    const samePromotion = !!(playerContract?.promotionId &&
      targetContract?.promotionId &&
      playerContract.promotionId === targetContract.promotionId);
    const relationship = player && player.id !== entity.id
      ? RelationshipManager.getRelationship(player.id, entity.id)
      : null;
    const activeFeud = player && player.id !== entity.id
      ? this._getActiveFeud(player.id, entity.id)
      : null;

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
      ${relationship ? `
        <p style="margin-top: 1rem;"><strong>Relationship:</strong> ${relationship.affinity} (${relationship.type})</p>
      ` : ''}
      ${activeFeud ? `
        <p style="color: #ff8c42;"><strong>Active Feud:</strong> ${activeFeud.phase} phase, heat ${activeFeud.heat}</p>
      ` : ''}
    `;

    this.container.appendChild(details);

    if (!player || player.id === entity.id) {
      return;
    }

    const actionTitle = document.createElement('h4');
    actionTitle.textContent = 'Interactions';
    actionTitle.style.margin = '1rem 0';
    this.container.appendChild(actionTitle);

    if (!samePromotion) {
      const info = document.createElement('div');
      info.className = 'panel mb-md';
      info.innerHTML = '<p>You can only book matches/feuds with wrestlers in your current promotion.</p>';
      this.container.appendChild(info);
    }

    if (samePromotion) {
      const askMatchCard = this.createActionCard(
        'Ask for Match',
        'Pitch a singles match with this wrestler (Charisma check DC 10)',
        () => this.askForMatch(player, entity)
      );
      this.container.appendChild(askMatchCard);

      const feudLabel = activeFeud ? 'Escalate Feud' : 'Start Feud';
      const feudDesc = activeFeud
        ? 'Push your rivalry hotter before the next show'
        : 'Turn this into an on-screen rivalry';
      const feudCard = this.createActionCard(
        feudLabel,
        feudDesc,
        () => this.handleFeudAction(player, entity)
      );
      this.container.appendChild(feudCard);
    }

    const respectCard = this.createActionCard(
      'Show Respect',
      'Build trust and improve chemistry',
      () => this.showRespect(player, entity)
    );
    this.container.appendChild(respectCard);

    const trashTalkCard = this.createActionCard(
      'Talk Trash',
      'Lower relationship and stir conflict',
      () => this.talkTrash(player, entity)
    );
    this.container.appendChild(trashTalkCard);

    const playerAge = player.getComponent('identity')?.age || 18;
    const targetAge = entity.getComponent('identity')?.age || 18;
    if (playerAge >= 18 && targetAge >= 18) {
      const romanceTitle = document.createElement('h4');
      romanceTitle.textContent = 'Romance';
      romanceTitle.style.margin = '1rem 0';
      this.container.appendChild(romanceTitle);

      const flirtCard = this.createActionCard(
        'Flirt',
        'Light romantic approach to test chemistry',
        () => this.flirtWithWrestler(player, entity)
      );
      this.container.appendChild(flirtCard);

      const dateCard = this.createActionCard(
        'Ask on Date',
        'Try to start a romantic connection',
        () => this.askOnDate(player, entity)
      );
      this.container.appendChild(dateCard);

      const privateCard = this.createActionCard(
        'Private Night',
        'Mature interaction (fade-to-black, non-explicit)',
        () => this.privateNight(player, entity)
      );
      this.container.appendChild(privateCard);

      // NSFW actions - only show if NSFW content is enabled
      const nsfwEnabled = gameStateManager.getStateRef().settings.nsfwContent;
      if (nsfwEnabled) {
        const intimateCard = this.createActionCard(
          'Intimate Encounter',
          'Passionate and explicit physical intimacy',
          () => this.intimateEncounter(player, entity)
        );
        intimateCard.style.borderLeft = '3px solid #e91e63';
        this.container.appendChild(intimateCard);

        const affairCard = this.createActionCard(
          'Explicit Affair',
          'Risky: Explicit secret affair if already committed',
          () => this.explicitSecretAffair(player, entity)
        );
        affairCard.style.borderLeft = '3px solid #f44336';
        this.container.appendChild(affairCard);

        const roughCard = this.createActionCard(
          'Rough Sex',
          'Intense, aggressive physical encounter with passion and intensity',
          () => this.roughSexEncounter(player, entity)
        );
        roughCard.style.borderLeft = '3px solid #9c27b0';
        this.container.appendChild(roughCard);

        const publicCard = this.createActionCard(
          'Risky Public Play',
          'Explicit encounter in a risky location - backstage, locker room, or venue',
          () => this.publicRiskEncounter(player, entity)
        );
        publicCard.style.borderLeft = '3px solid #ff5722';
        this.container.appendChild(publicCard);

        const kinkCard = this.createActionCard(
          'Explore Kinks',
          'Experiment with fetishes, roleplay, and dominant/submissive dynamics',
          () => this.kinkExploration(player, entity)
        );
        kinkCard.style.borderLeft = '3px solid #673ab7';
        this.container.appendChild(kinkCard);

        const groupCard = this.createActionCard(
          'Group Activity',
          'Invite others to join for an explicit multi-partner encounter',
          () => this.groupEncounter(player, entity)
        );
        groupCard.style.borderLeft = '3px solid #795548';
        this.container.appendChild(groupCard);

        const seduceCard = this.createActionCard(
          'Seduce in the Ring',
          'Explicit encounter during or after a match - in the ropes or on the mat',
          () => this.ringSeduction(player, entity)
        );
        seduceCard.style.borderLeft = '3px solid #ec407a';
        this.container.appendChild(seduceCard);

        const showerCard = this.createActionCard(
          'Shower Together',
          'Intimate encounter in the locker room showers with steam and soap',
          () => this.showerEncounter(player, entity)
        );
        showerCard.style.borderLeft = '3px solid #00bcd4';
        this.container.appendChild(showerCard);

        const quickieCard = this.createActionCard(
          'Quick Hookup',
          'Fast, urgent encounter - no time for romance, just pure need',
          () => this.quickHookup(player, entity)
        );
        quickieCard.style.borderLeft = '3px solid #ff9800';
        this.container.appendChild(quickieCard);

        const hotelCard = this.createActionCard(
          'Hotel Room All-Nighter',
          'Book a room and spend the entire night exploring every desire',
          () => this.hotelAllNighter(player, entity)
        );
        hotelCard.style.borderLeft = '3px solid #4caf50';
        this.container.appendChild(hotelCard);

        const oilCard = this.createActionCard(
          'Oil Wrestling',
          'Slippery, sensual wrestling match that turns into much more',
          () => this.oilWrestling(player, entity)
        );
        oilCard.style.borderLeft = '3px solid #ffc107';
        this.container.appendChild(oilCard);

        const spankingCard = this.createActionCard(
          'Spanking Session',
          'Discipline and punishment play with impact and control',
          () => this.spankingSession(player, entity)
        );
        spankingCard.style.borderLeft = '3px solid #e91e63';
        this.container.appendChild(spankingCard);

        const videoCard = this.createActionCard(
          'Make Private Video',
          'Record an explicit video together - risky but incredibly intimate',
          () => this.privateVideo(player, entity)
        );
        videoCard.style.borderLeft = '3px solid #9c27b0';
        this.container.appendChild(videoCard);
      }

      const commitCard = this.createActionCard(
        'Commit to Relationship',
        'Become an official couple if chemistry is high',
        () => this.commitRelationship(player, entity)
      );
      this.container.appendChild(commitCard);

      const cheatCard = this.createActionCard(
        'Start Secret Affair',
        'Risky: cheat if you are already committed to someone else',
        () => this.startSecretAffair(player, entity)
      );
      cheatCard.style.borderLeft = '3px solid #ff5722';
      this.container.appendChild(cheatCard);

      // Break up option - always available if in a romantic relationship
      const rel = this._getRel(player.id, entity.id);
      if (rel && rel.type === 'romantic') {
        const breakupCard = this.createActionCard(
          'Break Up',
          rel.committed ? 'End your committed relationship' : 'End your romantic connection',
          () => this.breakUp(player, entity)
        );
        breakupCard.style.borderLeft = '3px solid #f44336';
        this.container.appendChild(breakupCard);
      }
    }
  }

  /**
   * Gets an active feud between two wrestlers
   * @private
   * @param {string} playerId
   * @param {string} targetId
   * @returns {object|null}
   */
  _getActiveFeud(playerId, targetId) {
    const state = gameStateManager.getStateRef();
    const feudId = [playerId, targetId].sort().join('_');
    const feud = state.feuds.get(feudId);
    return feud && !feud.resolved ? feud : null;
  }

  /**
   * Creates a player-requested match and opens match prep
   * @private
   * @param {Entity} player
   * @param {Entity} opponent
   */
  askForMatch(player, opponent) {
    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Request Match',
      stat: 'charisma',
      dc: 10,
      context: {}
    });

    if (result.outcome === 'FAILURE' || result.outcome === 'CRITICAL_FAILURE') {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: `📋 Match request denied for now. You were not convincing enough.`,
          type: 'booker'
        }
      });
      this.renderWrestlerDetails(opponent);
      return;
    }

    const activeFeud = this._getActiveFeud(player.id, opponent.id);
    const feudMatchTypes = activeFeud ? DynamicFeudSystem.getFeudMatchTypes(activeFeud.id) : [];

    // Show match type selection if multiple options available
    if (feudMatchTypes.length > 1) {
      this._showMatchTypeSelection(player, opponent, feudMatchTypes);
      return;
    }

    // Single option or no feud - proceed directly
    const matchType = feudMatchTypes.length ? feudMatchTypes[0] : 'Standard Singles';
    this._bookMatchWithType(player, opponent, matchType);
  }

  /**
   * Shows match type selection screen
   * @private
   */
  _showMatchTypeSelection(player, opponent, matchTypes) {
    this.container.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn mb-md';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.renderWrestlerDetails(opponent));
    this.container.appendChild(backBtn);

    const title = document.createElement('h4');
    title.textContent = 'Select Match Type';
    title.style.marginBottom = '1rem';
    this.container.appendChild(title);

    const opponentName = opponent.getComponent('identity')?.name || 'your opponent';
    const info = document.createElement('p');
    info.textContent = `Booker approved your match vs ${opponentName}. Choose the stipulation:`;
    info.style.marginBottom = '1rem';
    this.container.appendChild(info);

    matchTypes.forEach(type => {
      const card = this.createActionCard(type, 'Select this match type', () => {
        this._bookMatchWithType(player, opponent, type);
      });
      this.container.appendChild(card);
    });
  }

  /**
   * Books a match with the selected type
   * @private
   */
  _bookMatchWithType(player, opponent, matchType) {
    const playerOverness = player.getComponent('popularity')?.overness || 0;
    const opponentOverness = opponent.getComponent('popularity')?.overness || 0;
    const playerFavored = playerOverness >= (opponentOverness - 8);
    const bookedWinner = playerFavored
      ? (Math.random() < 0.65 ? 'wrestler1' : 'wrestler2')
      : (Math.random() < 0.7 ? 'wrestler2' : 'wrestler1');

    // Check if this is part of an active feud
    const activeFeud = this._getActiveFeud(player.id, opponent.id);
    const feudId = activeFeud ? activeFeud.id : null;

    this.currentMatchAction = {
      type: 'match',
      player,
      opponent,
      matchType,
      bookedWinner,
      feudId
    };

    const opponentName = opponent.getComponent('identity')?.name || 'your opponent';
    const feudText = activeFeud ? ' (Feud Match)' : '';
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `📋 Match booked: You vs ${opponentName} (${matchType})${feudText}.`,
        type: 'booker'
      }
    });

    this.renderMatchPreparation(this.currentMatchAction);
  }

  /**
   * Starts or escalates a feud with a wrestler
   * @private
   * @param {Entity} player
   * @param {Entity} opponent
   */
  handleFeudAction(player, opponent) {
    const activeFeud = this._getActiveFeud(player.id, opponent.id);

    if (activeFeud) {
      const result = DynamicFeudSystem.escalateFeud(activeFeud.id);
      if (result.error) {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'backstage',
            text: `🔥 Could not escalate feud: ${result.error}`,
            type: 'feud'
          }
        });
      }
      this.renderWrestlerDetails(opponent);
      return;
    }

    const startResult = DynamicFeudSystem.startFeud(player, opponent, 'Challenge issued in the locker room');
    if (!startResult.error) {
      RelationshipManager.modifyAffinity(player.id, opponent.id, -20, 'Feud started');
    } else {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: `🔥 Could not start feud: ${startResult.error}`,
          type: 'feud'
        }
      });
    }

    this.renderWrestlerDetails(opponent);
  }

  /**
   * Friendly interaction with another wrestler
   * @private
   * @param {Entity} player
   * @param {Entity} target
   */
  showRespect(player, target) {
    const targetName = target.getComponent('identity')?.name || 'them';
    RelationshipManager.modifyAffinity(player.id, target.id, 8, 'Showed respect');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🤝 You showed respect to ${targetName}. Relationship improved.`,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Hostile interaction with another wrestler
   * @private
   * @param {Entity} player
   * @param {Entity} target
   */
  talkTrash(player, target) {
    const targetName = target.getComponent('identity')?.name || 'them';
    RelationshipManager.modifyAffinity(player.id, target.id, -10, 'Talked trash backstage');
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🗣️ You talked trash about ${targetName}. Tension is rising.`,
        type: 'social'
      }
    });

    // Small chance to ignite a feud from repeated trash talk if none exists yet
    if (!this._getActiveFeud(player.id, target.id) && Math.random() < 0.25) {
      DynamicFeudSystem.startFeud(player, target, 'Backstage trash talk crossed the line');
    }

    this.renderWrestlerDetails(target);
  }

  /**
   * Gets relationship edge for two entities.
   * @private
   */
  _getRel(aId, bId) {
    return RelationshipManager.getRelationship(aId, bId);
  }

  /**
   * Gets committed romantic partner id (if any), excluding a specific target.
   * @private
   */
  _getCommittedPartnerId(playerId, excludeId = null) {
    const rels = RelationshipManager.getEntityRelationships(playerId);
    const committed = rels.find(r =>
      r.entityId !== excludeId &&
      r.relationship?.type === 'romantic' &&
      r.relationship?.committed === true
    );
    return committed?.entityId || null;
  }

  /**
   * Flirt interaction.
   * @private
   */
  flirtWithWrestler(player, target) {
    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Flirt',
      stat: 'charisma',
      dc: 10,
      context: {}
    });
    const rel = this._getRel(player.id, target.id);
    const delta = (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS') ? 8 : -4;
    const romanceDelta = delta > 0 ? 10 : -6;

    RelationshipManager.modifyAffinity(player.id, target.id, delta, 'Flirting');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: (rel.type === 'rival' ? 'professional' : (rel.type || 'professional')),
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + (delta > 0 ? 4 : -5)))
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: delta > 0 ? `💘 Your flirting lands well with ${targetName}.` : `💔 ${targetName} is not impressed by your flirting.`,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Ask target on a date.
   * @private
   */
  askOnDate(player, target) {
    const rel = this._getRel(player.id, target.id);
    const dc = (rel.affinity >= 25 || (rel.romanceLevel || 0) >= 20) ? 10 : 14;
    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Ask on Date',
      stat: 'charisma',
      dc,
      context: {}
    });

    const success = result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS';
    RelationshipManager.modifyAffinity(player.id, target.id, success ? 10 : -6, 'Date request');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: success ? 'romantic' : (rel.type || 'professional'),
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + (success ? 18 : -8))),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + (success ? 8 : -8))),
      committed: success ? (rel.committed || false) : (rel.committed || false),
      secretAffair: rel.secretAffair || false
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: success ? `💘 ${targetName} agrees to a date. Romance is building.` : `💔 ${targetName} declines the date invitation.`,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Mature relationship progression (non-explicit).
   * @private
   */
  privateNight(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 25 || rel.affinity >= 35;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 The chemistry is not there yet for that level of closeness.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, 8, 'Private time together');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.min(100, (rel.romanceLevel || 0) + 15),
      trust: Math.min(100, (rel.trust ?? 50) + 10),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `🌙 You and ${targetName} spend a private night together. (Fade to black.)`,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Commits relationship when chemistry is high.
   * @private
   */
  commitRelationship(player, target) {
    const rel = this._getRel(player.id, target.id);
    if ((rel.romanceLevel || 0) < 45 || rel.affinity < 35) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 Commitment talks fall flat. Build the relationship further first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    // End committed status with any other partner.
    const otherPartnerId = this._getCommittedPartnerId(player.id, target.id);
    if (otherPartnerId) {
      const prevRel = this._getRel(player.id, otherPartnerId);
      RelationshipManager.setRelationship(player.id, otherPartnerId, {
        ...prevRel,
        committed: false
      });
      RelationshipManager.modifyAffinity(player.id, otherPartnerId, -20, 'Broke commitment');
    }

    RelationshipManager.setRelationship(player.id, target.id, {
      ...rel,
      type: 'romantic',
      committed: true,
      secretAffair: false,
      trust: Math.min(100, (rel.trust ?? 50) + 12),
      romanceLevel: Math.min(100, (rel.romanceLevel || 0) + 8)
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: `💍 You and ${targetName} are now officially together.`,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Explicit intimate encounter (NSFW)
   * @private
   */
  intimateEncounter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 30 || rel.affinity >= 40;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 The chemistry is not strong enough for that level of intimacy yet.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Intimate Encounter',
      stat: 'charisma',
      dc: 12,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrativeKey;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrativeKey = 'nsfw_intimate_critical_success';
        romanceDelta = 25;
        trustDelta = 20;
        affinityDelta = 15;
        break;
      case 'SUCCESS':
        narrativeKey = 'nsfw_intimate_success';
        romanceDelta = 18;
        trustDelta = 15;
        affinityDelta = 10;
        break;
      case 'FAILURE':
        narrativeKey = 'nsfw_intimate_failure';
        romanceDelta = -8;
        trustDelta = -10;
        affinityDelta = -6;
        break;
      case 'CRITICAL_FAILURE':
        narrativeKey = 'nsfw_intimate_critical_failure';
        romanceDelta = -15;
        trustDelta = -20;
        affinityDelta = -15;
        break;
    }

    const narrative = dataManager.getRandomNarrative(narrativeKey)
      ?.replace('{actor}', 'You')
      .replace('{target}', targetName) || `You and ${targetName} share an intimate moment.`;

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Intimate encounter');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Explicit secret affair (NSFW)
   * @private
   */
  explicitSecretAffair(player, target) {
    const currentPartnerId = this._getCommittedPartnerId(player.id, target.id);
    if (!currentPartnerId) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You are not currently committed to anyone. No affair to start.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const rel = this._getRel(player.id, target.id);
    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Explicit Secret Affair',
      stat: 'charisma',
      dc: 14,
      context: {}
    });
    const success = result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS';

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;

    if (success) {
      RelationshipManager.setRelationship(player.id, target.id, {
        ...rel,
        type: 'romantic',
        secretAffair: true,
        committed: false,
        romanceLevel: Math.min(100, (rel.romanceLevel || 0) + 25),
        trust: Math.min(100, (rel.trust ?? 50) + 10)
      });
      RelationshipManager.modifyAffinity(player.id, target.id, 12, 'Explicit affair began');
      narrative = dataManager.getRandomNarrative('nsfw_affair_success')
        ?.replace('{actor}', 'You')
        .replace('{target}', targetName) || `You and ${targetName} share a passionate but risky intimate encounter.`;
    } else {
      RelationshipManager.modifyAffinity(player.id, target.id, -15, 'Explicit affair attempt failed');
      const narrativeKey = result.outcome === 'CRITICAL_FAILURE' ? 'nsfw_intimate_critical_failure' : 'nsfw_intimate_failure';
      narrative = dataManager.getRandomNarrative(narrativeKey)
        ?.replace('{actor}', 'You')
        .replace('{target}', targetName) || `The secret approach fails and creates tension with ${targetName}.`;
    }

    // Fallout risk with committed partner
    const partnerRel = this._getRel(player.id, currentPartnerId);
    const exposure = Math.random() < (success ? 0.35 : 0.6);
    if (exposure) {
      RelationshipManager.modifyAffinity(player.id, currentPartnerId, -40, 'Explicit affair exposed');
      RelationshipManager.setRelationship(player.id, currentPartnerId, {
        ...partnerRel,
        trust: Math.max(0, (partnerRel.trust ?? 50) - 45),
        committed: false
      });
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '⚠️ The explicit affair is exposed! Major trust damage, public scandal, and relationship fallout.',
          type: 'social'
        }
      });
    } else {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: narrative,
          type: 'social'
        }
      });
    }
    this.renderWrestlerDetails(target);
  }

  /**
   * Rough sex encounter (NSFW)
   * @private
   */
  roughSexEncounter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 35 || rel.affinity >= 45;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 The trust level is not high enough for rough intimacy. Build more chemistry first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Rough Sex Encounter',
      stat: 'strength',
      dc: 14,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You and ${targetName} share an intensely passionate and rough encounter. The power dynamic is electric, leaving both of you completely satisfied and deeply connected.`;
        romanceDelta = 30;
        trustDelta = 15;
        affinityDelta = 18;
        break;
      case 'SUCCESS':
        narrative = `The rough encounter with ${targetName} is incredibly intense. You push each other's limits in the best way, building a stronger physical connection.`;
        romanceDelta = 22;
        trustDelta = 10;
        affinityDelta = 12;
        break;
      case 'FAILURE':
        narrative = `The attempt at rough play with ${targetName} goes too far. You misread signals and need to slow down and communicate better.`;
        romanceDelta = -10;
        trustDelta = -15;
        affinityDelta = -8;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `The rough encounter with ${targetName} becomes genuinely uncomfortable. You crossed boundaries and ${targetName} is upset and needs space.`;
        romanceDelta = -20;
        trustDelta = -25;
        affinityDelta = -18;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Rough sex encounter');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Public/risky location encounter (NSFW)
   * @private
   */
  publicRiskEncounter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 40 || rel.affinity >= 50;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You need a stronger bond before attempting something this risky. Build more trust first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Public Risk Encounter',
      stat: 'psychology',
      dc: 16,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;
    let exposed = false;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You and ${targetName} find a secluded backstage area and engage in a thrilling, risky encounter. The possibility of being caught only heightens the intensity. No one discovers you.`;
        romanceDelta = 28;
        trustDelta = 20;
        affinityDelta = 16;
        break;
      case 'SUCCESS':
        narrative = `In a quiet corner of the locker room, you and ${targetName} share an explicit encounter. The adrenaline of the risky location makes it incredibly exciting.`;
        romanceDelta = 20;
        trustDelta = 12;
        affinityDelta = 10;
        break;
      case 'FAILURE':
        narrative = `You try to get intimate with ${targetName} in a risky location but get interrupted before things can get started. The moment is lost.`;
        romanceDelta = -5;
        trustDelta = -5;
        affinityDelta = -3;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `You and ${targetName} are caught in a compromising position backstage! Other wrestlers witness your explicit encounter and word spreads quickly.`;
        romanceDelta = -12;
        trustDelta = -20;
        affinityDelta = -15;
        exposed = true;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Public risk encounter');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });

    if (exposed) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '⚠️ The locker room is buzzing about what they witnessed. Your reputation takes a hit.',
          type: 'social'
        }
      });
    }
    this.renderWrestlerDetails(target);
  }

  /**
   * Kink and fetish exploration (NSFW)
   * @private
   */
  kinkExploration(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 30 || rel.affinity >= 40;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You need to establish more trust before exploring kinks together.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const kinks = [
      'dominant/submissive roleplay',
      'wrestling-themed power exchange',
      'light bondage and restraint',
      'sensory deprivation play',
      'costume and character roleplay'
    ];
    const chosenKink = kinks[Math.floor(Math.random() * kinks.length)];

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Kink Exploration',
      stat: 'psychology',
      dc: 13,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You and ${targetName} explore ${chosenKink} together, discovering shared desires you never knew you had. The experience is mind-blowing and brings you incredibly close.`;
        romanceDelta = 26;
        trustDelta = 22;
        affinityDelta = 14;
        break;
      case 'SUCCESS':
        narrative = `The ${chosenKink} with ${targetName} opens new doors in your physical relationship. You both feel more connected and adventurous.`;
        romanceDelta = 18;
        trustDelta = 15;
        affinityDelta = 10;
        break;
      case 'FAILURE':
        narrative = `The attempt at ${chosenKink} with ${targetName} feels awkward and doesn't work for one of you. You decide to stick to more familiar territory.`;
        romanceDelta = -6;
        trustDelta = -5;
        affinityDelta = -4;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `The ${chosenKink} exploration with ${targetName} goes wrong. Boundaries are crossed and the experience leaves ${targetName} uncomfortable and upset.`;
        romanceDelta = -15;
        trustDelta = -20;
        affinityDelta = -12;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Kink exploration');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Group encounter (NSFW)
   * @private
   */
  groupEncounter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 45 || rel.affinity >= 55;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You need an extremely strong connection before suggesting something this adventurous.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const state = gameStateManager.getStateRef();
    const potentialPartners = Array.from(state.entities.values())
      .filter(e => e.id !== player.id && e.id !== target.id)
      .slice(0, 3);

    if (potentialPartners.length === 0) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 There are no other wrestlers available to join right now.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Group Encounter',
      stat: 'charisma',
      dc: 18,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    const partnerNames = potentialPartners.map(p => p.getComponent('identity')?.name || 'someone').join(', ');
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You, ${targetName}, and ${partnerNames} share an incredibly wild and satisfying group encounter. The chemistry is off the charts and everyone leaves completely fulfilled.`;
        romanceDelta = 35;
        trustDelta = 15;
        affinityDelta = 20;
        potentialPartners.forEach(partner => {
          RelationshipManager.modifyAffinity(player.id, partner.id, 10, 'Group encounter');
        });
        break;
      case 'SUCCESS':
        narrative = `The group encounter with ${targetName} and ${partnerNames} is exciting and memorable. Everyone has a great time exploring together.`;
        romanceDelta = 22;
        trustDelta = 8;
        affinityDelta = 12;
        potentialPartners.forEach(partner => {
          RelationshipManager.modifyAffinity(player.id, partner.id, 5, 'Group encounter');
        });
        break;
      case 'FAILURE':
        narrative = `${targetName} declines your invitation for a group encounter. They're not comfortable with that level of adventure.`;
        romanceDelta = -8;
        trustDelta = -10;
        affinityDelta = -6;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `Your suggestion of a group encounter with ${targetName} and others is met with shock and rejection. ${targetName} questions your commitment to them.`;
        romanceDelta = -18;
        trustDelta = -25;
        affinityDelta = -15;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Group encounter proposal');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Ring seduction (NSFW) - explicit encounter in the ring
   * @private
   */
  ringSeduction(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 35 || rel.affinity >= 45;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 The chemistry is not strong enough for a ring encounter. Build more trust first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Ring Seduction',
      stat: 'charisma',
      dc: 15,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;
    let exposed = false;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `After the arena clears, you and ${targetName} find yourselves alone in the ring. The ropes become your playground as you explore each other in the very place you do battle. The symbolism is not lost on either of you.`;
        romanceDelta = 28;
        trustDelta = 18;
        affinityDelta = 16;
        break;
      case 'SUCCESS':
        narrative = `In a dark corner of the ring, hidden by the shadows, you and ${targetName} share a passionate encounter. The canvas beneath you, the ropes around you - it's incredibly intense.`;
        romanceDelta = 20;
        trustDelta = 12;
        affinityDelta = 10;
        break;
      case 'FAILURE':
        narrative = `You try to get intimate with ${targetName} in the ring, but the venue staff starts cleaning up sooner than expected. You have to stop before things get started.`;
        romanceDelta = -5;
        trustDelta = -3;
        affinityDelta = -3;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `Security catches you and ${targetName} in a compromising position in the ring! They escort you both out, and word spreads quickly through the locker room.`;
        romanceDelta = -15;
        trustDelta = -20;
        affinityDelta = -12;
        exposed = true;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Ring seduction');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });

    if (exposed) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '⚠️ The locker room is buzzing about what security witnessed. Your reputation takes a hit.',
          type: 'social'
        }
      });
    }
    this.renderWrestlerDetails(target);
  }

  /**
   * Shower encounter (NSFW) - in the locker room
   * @private
   */
  showerEncounter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 25 || rel.affinity >= 35;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You need to build more chemistry before suggesting a shower together.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Shower Encounter',
      stat: 'charisma',
      dc: 12,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `The locker room shower becomes a steamy paradise as you and ${targetName} explore each other under the hot water. Soap-slicked bodies slide together in a sensual dance that leaves you both breathless and thoroughly satisfied.`;
        romanceDelta = 24;
        trustDelta = 16;
        affinityDelta = 14;
        break;
      case 'SUCCESS':
        narrative = `In the privacy of the shower, you and ${targetName} share an intimate encounter. The steam, the water, the heat - everything comes together perfectly.`;
        romanceDelta = 16;
        trustDelta = 10;
        affinityDelta = 8;
        break;
      case 'FAILURE':
        narrative = `Another wrestler enters the locker room just as things are getting started. You and ${targetName} have to separate quickly and pretend nothing was happening.`;
        romanceDelta = -4;
        trustDelta = -5;
        affinityDelta = -2;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `The shower encounter goes wrong when you slip on the wet floor. ${targetName} has to help you up, and the moment is completely ruined.`;
        romanceDelta = -10;
        trustDelta = -8;
        affinityDelta = -6;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Shower encounter');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Quick hookup (NSFW) - fast urgent encounter
   * @private
   */
  quickHookup(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 20 || rel.affinity >= 30;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You need at least some chemistry for a hookup. Try flirting first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Quick Hookup',
      stat: 'stamina',
      dc: 10,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `Against the locker room wall, you and ${targetName} give in to urgent desire. It's fast, intense, and incredibly satisfying - pure animal passion without any pretense.`;
        romanceDelta = 18;
        trustDelta = 5;
        affinityDelta = 12;
        break;
      case 'SUCCESS':
        narrative = `You find a private spot and ${targetName} is eager and ready. The encounter is brief but passionate, both of you getting exactly what you need.`;
        romanceDelta = 12;
        trustDelta = 2;
        affinityDelta = 8;
        break;
      case 'FAILURE':
        narrative = `The quickie with ${targetName} feels rushed and unsatisfying. You both leave wanting more but neither knows how to ask.`;
        romanceDelta = 2;
        trustDelta = -3;
        affinityDelta = 2;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `${targetName} seems uncomfortable with the rushed nature of the encounter. They stop you partway through and leave abruptly.`;
        romanceDelta = -8;
        trustDelta = -10;
        affinityDelta = -5;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Quick hookup');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Hotel all-nighter (NSFW) - extended encounter
   * @private
   */
  hotelAllNighter(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 40 || rel.affinity >= 50;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 An all-nighter requires deep trust and chemistry. Build your connection first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Hotel All-Nighter',
      stat: 'stamina',
      dc: 14,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `The hotel room becomes your sanctuary for the night. You and ${targetName} explore every inch of each other, trying things you've only fantasized about. By morning, you're both exhausted, sore, and completely satisfied.`;
        romanceDelta = 35;
        trustDelta = 25;
        affinityDelta = 20;
        break;
      case 'SUCCESS':
        narrative = `The all-nighter with ${targetName} is incredible. Hours of passion, multiple rounds, deep conversations between - you feel closer than ever.`;
        romanceDelta = 25;
        trustDelta = 18;
        affinityDelta = 15;
        break;
      case 'FAILURE':
        narrative = `You book the hotel room but ${targetName} falls asleep halfway through the night. The morning is awkward and disappointing.`;
        romanceDelta = 5;
        trustDelta = -2;
        affinityDelta = 3;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `The hotel all-nighter is a disaster. You and ${targetName} argue about logistics, the room is uncomfortable, and you both leave frustrated and annoyed with each other.`;
        romanceDelta = -12;
        trustDelta = -15;
        affinityDelta = -8;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Hotel all-nighter');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Oil wrestling (NSFW) - slippery sensual wrestling
   * @private
   */
  oilWrestling(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 30 || rel.affinity >= 40;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 Oil wrestling requires comfort with physical intimacy. Build more chemistry first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Oil Wrestling',
      stat: 'technical',
      dc: 12,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `Covered in oil, you and ${targetName} grapple in a private room. Every hold becomes foreplay, every escape an invitation. The wrestling quickly turns into something much more intimate as slick bodies slide together.`;
        romanceDelta = 26;
        trustDelta = 15;
        affinityDelta = 14;
        break;
      case 'SUCCESS':
        narrative = `The oil wrestling with ${targetName} starts competitive but turns sensual quickly. The oil makes every touch electric, and soon you're both exploring each other rather than trying to win.`;
        romanceDelta = 18;
        trustDelta = 10;
        affinityDelta = 10;
        break;
      case 'FAILURE':
        narrative = `The oil makes everything too slippery. You and ${targetName} can't get any holds to work, and the mood is ruined by frustration.`;
        romanceDelta = -3;
        trustDelta = -3;
        affinityDelta = -2;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `${targetName} slips during the oil wrestling and gets oil in their eye. The encounter ends immediately as you help them clean up. Not sexy at all.`;
        romanceDelta = -8;
        trustDelta = -5;
        affinityDelta = -4;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Oil wrestling');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Spanking session (NSFW) - impact play
   * @private
   */
  spankingSession(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 35 || rel.affinity >= 45;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 Impact play requires high trust levels. Build a stronger bond first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Spanking Session',
      stat: 'psychology',
      dc: 14,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You take complete control as ${targetName} surrenders over your knee. Each impact builds tension and desire, the mix of pain and pleasure driving you both wild. By the end, ${targetName} is begging for more and you deliver.`;
        romanceDelta = 28;
        trustDelta = 22;
        affinityDelta = 16;
        break;
      case 'SUCCESS':
        narrative = `The spanking session with ${targetName} is intense and satisfying. You establish clear boundaries and explore the power dynamic carefully, building incredible trust.`;
        romanceDelta = 20;
        trustDelta = 16;
        affinityDelta = 12;
        break;
      case 'FAILURE':
        narrative = `You misjudge ${targetName}'s limits during the spanking. They use the safeword and you stop immediately, but the mood is broken.`;
        romanceDelta = -5;
        trustDelta = -10;
        affinityDelta = -3;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `The spanking session goes wrong when you hit too hard. ${targetName} is angry and hurt, physically and emotionally. They leave upset.`;
        romanceDelta = -15;
        trustDelta = -25;
        affinityDelta = -12;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Spanking session');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });
    this.renderWrestlerDetails(target);
  }

  /**
   * Private video (NSFW) - recording encounter
   * @private
   */
  privateVideo(player, target) {
    const rel = this._getRel(player.id, target.id);
    const gate = (rel.romanceLevel || 0) >= 45 || rel.affinity >= 55;
    if (!gate) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 Recording videos requires extreme trust. Build a much deeper connection first.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Private Video',
      stat: 'psychology',
      dc: 16,
      context: {}
    });

    const targetName = target.getComponent('identity')?.name || 'them';
    let narrative;
    let romanceDelta;
    let trustDelta;
    let affinityDelta;
    let leaked = false;

    switch (result.outcome) {
      case 'CRITICAL_SUCCESS':
        narrative = `You set up the camera and you and ${targetName} create an incredibly erotic video together. Watching yourselves on the screen adds a whole new dimension to your intimacy. The video stays safely between you two.`;
        romanceDelta = 32;
        trustDelta = 20;
        affinityDelta = 18;
        break;
      case 'SUCCESS':
        narrative = `The private video with ${targetName} is exciting and intimate. Being recorded adds thrill to the encounter, and you both agree to keep it secret.`;
        romanceDelta = 22;
        trustDelta = 12;
        affinityDelta = 12;
        break;
      case 'FAILURE':
        narrative = `${targetName} gets uncomfortable with the camera halfway through. You delete the footage and just enjoy the moment without recording.`;
        romanceDelta = 5;
        trustDelta = -5;
        affinityDelta = 4;
        break;
      case 'CRITICAL_FAILURE':
        narrative = `DISASTER! Someone hacks your phone and the video of you and ${targetName} leaks online! The explicit footage spreads through the wrestling community.`;
        romanceDelta = -20;
        trustDelta = -30;
        affinityDelta = -18;
        leaked = true;
        break;
    }

    RelationshipManager.modifyAffinity(player.id, target.id, affinityDelta, 'Private video');
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'romantic',
      romanceLevel: Math.max(0, Math.min(100, (rel.romanceLevel || 0) + romanceDelta)),
      trust: Math.max(0, Math.min(100, (rel.trust ?? 50) + trustDelta)),
      committed: rel.committed || false,
      secretAffair: rel.secretAffair || false
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });

    if (leaked) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '📱 The explicit video has gone viral! Your reputation is damaged and the promotion is asking questions. This is a major scandal.',
          type: 'scandal'
        }
      });
    }
    this.renderWrestlerDetails(target);
  }

  /**
   * Break up with romantic partner
   * @private
   */
  breakUp(player, target) {
    const rel = this._getRel(player.id, target.id);
    if (!rel || rel.type !== 'romantic') {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You are not in a romantic relationship with them.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const targetName = target.getComponent('identity')?.name || 'them';
    const wasCommitted = rel.committed;

    // Set relationship to neutral/negative
    RelationshipManager.setRelationship(player.id, target.id, {
      type: 'acquaintance',
      affinity: -20,
      romanceLevel: 0,
      trust: 20,
      committed: false,
      secretAffair: false
    });

    let narrative;
    if (wasCommitted) {
      narrative = `You sit down with ${targetName} and have a difficult conversation. You explain that you need to end your committed relationship. ${targetName} is hurt and disappointed, but accepts your decision.`;
    } else {
      narrative = `You let ${targetName} know that you want to stop seeing them romantically. They seem disappointed but understand.`;
    }

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: narrative,
        type: 'social'
      }
    });

    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'backstage',
        text: wasCommitted
          ? `💔 You have ended your committed relationship with ${targetName}.`
          : `💔 You have ended your romantic connection with ${targetName}.`,
        type: 'social'
      }
    });

    this.renderWrestlerDetails(target);
  }

  /**
   * Starts an affair if player is already committed elsewhere.
   * @private
   */
  startSecretAffair(player, target) {
    const currentPartnerId = this._getCommittedPartnerId(player.id, target.id);
    if (!currentPartnerId) {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '💬 You are not currently committed to anyone. No affair to start.',
          type: 'social'
        }
      });
      this.renderWrestlerDetails(target);
      return;
    }

    const rel = this._getRel(player.id, target.id);
    const result = ResolutionEngine.resolve({
      actor: player,
      action: 'Start Secret Affair',
      stat: 'charisma',
      dc: 13,
      context: {}
    });
    const success = result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS';

    if (success) {
      RelationshipManager.setRelationship(player.id, target.id, {
        ...rel,
        type: 'romantic',
        secretAffair: true,
        committed: false,
        romanceLevel: Math.min(100, (rel.romanceLevel || 0) + 20),
        trust: Math.min(100, (rel.trust ?? 50) + 6)
      });
      RelationshipManager.modifyAffinity(player.id, target.id, 8, 'Secret affair began');
    } else {
      RelationshipManager.modifyAffinity(player.id, target.id, -10, 'Affair attempt failed');
    }

    // Fallout risk with committed partner
    const partnerRel = this._getRel(player.id, currentPartnerId);
    const exposure = Math.random() < (success ? 0.25 : 0.5);
    if (exposure) {
      RelationshipManager.modifyAffinity(player.id, currentPartnerId, -30, 'Affair exposed');
      RelationshipManager.setRelationship(player.id, currentPartnerId, {
        ...partnerRel,
        trust: Math.max(0, (partnerRel.trust ?? 50) - 35),
        committed: false
      });
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: '⚠️ The affair is exposed. Major trust damage and relationship fallout.',
          type: 'social'
        }
      });
    } else {
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'backstage',
          text: success ? '🕶️ A secret affair begins quietly.' : '💥 The secret approach fails and creates tension.',
          type: 'social'
        }
      });
    }

    this.renderWrestlerDetails(target);
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
      const buyoutCost = (contract.remainingWeeks || 0) * (contract.weeklySalary || 0);

      const contractCard = document.createElement('div');
      contractCard.className = 'panel mb-md';
      contractCard.innerHTML = `
        <h4>📝 Contract: ${promotion?.name || 'Unknown'}</h4>
        <p>Position: <strong>${positionInfo}</strong></p>
        <p>Salary: $${contract.weeklySalary}/week</p>
        <p>Remaining: ${contract.remainingWeeks} weeks</p>
        <p>Dates/Month: ${contract.datesPerMonth || 4}</p>
        <p>Injury Coverage: ${contract.injuryCoveragePct || 0}%</p>
        <p>Title Opportunity: ${contract.titleOpportunityGuaranteed ? `Yes (${contract.championshipOpportunityWeeks || 12} weeks)` : 'No'}</p>
        <p>Buyout Cost: $${buyoutCost}</p>
        ${contract.hasCreativeControl ? '<p style="color: var(--accent-secondary);">✓ Creative Control</p>' : ''}
        ${contract.hasMerchCut > 0 ? `<p>Merch Cut: ${contract.hasMerchCut}%</p>` : ''}
      `;
      this.container.appendChild(contractCard);

      if ((contract.renewalWindowWeeks || 0) > 0) {
        const renewalCard = document.createElement('div');
        renewalCard.className = 'panel mb-md';
        renewalCard.style.borderLeft = '3px solid #ff9800';
        renewalCard.innerHTML = `
          <h4>⚠️ Contract Renewal Window</h4>
          <p>You have ${contract.renewalWindowWeeks} week(s) to renew before free agency.</p>
        `;
        this.container.appendChild(renewalCard);

        const renewalOfferCard = this.createActionCard(
          '🤝 Negotiate Renewal',
          'Open renewal contract terms with your current promotion',
          () => {
            const renewalOffer = contract.pendingRenewalOffer || ContractEngine.generateRenewalOffer(player);
            if (renewalOffer) {
              contract.pendingRenewalOffer = renewalOffer;
              this.careerView = 'offer';
              this.currentPromotionId = promotion.id;
              this.renderContractOffer(player, promotion, renewalOffer);
            } else {
              gameStateManager.dispatch('ADD_LOG_ENTRY', {
                entry: { category: 'personal', text: 'No renewal offer available right now.', type: 'contract' }
              });
              this.render(gameStateManager.getStateRef(), 'career');
            }
          }
        );
        this.container.appendChild(renewalOfferCard);

        const declineRenewalCard = this.createActionCard(
          '🚪 Decline Renewal',
          'Leave immediately and become a free agent',
          () => {
            const result = ContractEngine.declineRenewal(player);
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'personal',
                text: result?.success ? 'You declined renewal and entered free agency.' : (result?.error || 'Could not decline renewal.'),
                type: 'contract'
              }
            });
            this.render(gameStateManager.getStateRef(), 'career');
          }
        );
        declineRenewalCard.style.borderLeft = '3px solid #f44336';
        this.container.appendChild(declineRenewalCard);
      }

      const leaveCard = this.createActionCard(
        '⚠️ Get Out of Contract',
        `Pay buyout ($${buyoutCost}) and become a free agent`,
        () => {
          const result = ContractEngine.releaseWrestler(player);
          if (result?.success) {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'personal',
                text: `You bought out your contract for $${result.buyoutCost} and became a free agent.`,
                type: 'contract'
              }
            });
          } else {
            gameStateManager.dispatch('ADD_LOG_ENTRY', {
              entry: {
                category: 'personal',
                text: result?.error || 'Could not exit contract.',
                type: 'contract'
              }
            });
          }
          this.render(gameStateManager.getStateRef(), 'career');
        }
      );
      leaveCard.style.borderLeft = '3px solid #ff9800';
      this.container.appendChild(leaveCard);
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
      () => {
        this.careerView = 'browser';
        this.renderPromotionBrowser(player);
      }
    );
    this.container.appendChild(browseCard);

    // Championships
    const titlesSection = document.createElement('div');
    titlesSection.className = 'panel mb-md';
    titlesSection.innerHTML = '<h4>🏆 Championships</h4>';

    const championships = ChampionshipSystem.getWrestlerChampionships(player);
    if (championships.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.style.marginTop = '0.5rem';
      emptyState.style.color = 'var(--text-muted)';
      emptyState.textContent = 'No championships yet';
      titlesSection.appendChild(emptyState);
    } else {
      const champList = document.createDocumentFragment();
      championships.forEach(champ => {
        const reignText = champ.totalReigns > 1 ?
          `${champ.totalReigns} reigns, ${champ.totalDefenses} defenses` :
          `Current champion (${champ.reigns[champ.reigns.length - 1]?.defenses || 0} defenses)`;

        const champCard = document.createElement('div');
        champCard.style.marginTop = '0.5rem';
        champCard.style.padding = '0.5rem';
        champCard.style.background = 'rgba(255,200,87,0.1)';
        champCard.style.borderRadius = 'var(--radius-sm)';

        const nameEl = document.createElement('strong');
        nameEl.textContent = champ.name;
        champCard.appendChild(nameEl);
        champCard.appendChild(document.createElement('br'));

        const reignEl = document.createElement('span');
        reignEl.style.fontSize = '0.85rem';
        reignEl.textContent = reignText;
        champCard.appendChild(reignEl);

        champList.appendChild(champCard);
      });
      titlesSection.appendChild(champList);
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

      const storyList = document.createDocumentFragment();
      storylines.forEach(story => {
        const row = document.createElement('div');
        row.style.marginTop = '0.5rem';
        row.style.padding = '0.5rem';
        row.style.background = 'var(--bg-tertiary)';
        row.style.borderRadius = 'var(--radius-sm)';

        const title = document.createElement('strong');
        title.textContent = story.name;
        row.appendChild(title);
        row.append(` (${story.type})`);
        row.appendChild(document.createElement('br'));

        const info = document.createElement('span');
        info.style.fontSize = '0.85rem';
        info.textContent = `Beat ${story.currentBeat + 1}/${story.totalBeats} | Quality: ${story.quality}/100`;
        row.appendChild(info);

        storyList.appendChild(row);
      });
      storyCard.appendChild(storyList);
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
    backBtn.addEventListener('click', () => {
      this.careerView = 'main';
      this.render(gameStateManager.getStateRef(), 'career');
    });
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
        applyBtn.addEventListener('click', (e) => {
          // Prevent click-through side effects when re-rendering immediately
          e.preventDefault();
          e.stopPropagation();
          this.careerView = 'offer';
          this.currentPromotionId = promo.id;
          setTimeout(() => this.renderContractOffer(player, promo), 0);
        });
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
      this.currentPromotionId = null;
      this.careerView = 'browser';
      this.renderPromotionBrowser(player);
    });
    this.container.appendChild(backBtn);

    const baseOffer = existingOffer || ContractEngine.generateOffer(promotion, player);
    const offer = {
      ...baseOffer,
      weeklySalary: baseOffer?.weeklySalary ?? 0,
      lengthWeeks: Math.max(1, baseOffer?.lengthWeeks ?? 8),
      remainingWeeks: Math.max(1, baseOffer?.remainingWeeks ?? (baseOffer?.lengthWeeks ?? 8)),
      position: baseOffer?.position || 'mid_card',
      tvAppearanceBonus: baseOffer?.tvAppearanceBonus ?? 0,
      hasCreativeControl: baseOffer?.hasCreativeControl === true,
      hasMerchCut: baseOffer?.hasMerchCut ?? 0,
      injuryCoveragePct: baseOffer?.injuryCoveragePct ?? 0,
      datesPerMonth: baseOffer?.datesPerMonth ?? 4,
      titleOpportunityGuaranteed: baseOffer?.titleOpportunityGuaranteed === true,
      championshipOpportunityWeeks: baseOffer?.championshipOpportunityWeeks ?? 0,
      noCompeteWeeks: baseOffer?.noCompeteWeeks ?? 0,
      benefits: Array.isArray(baseOffer?.benefits) ? baseOffer.benefits : []
    };

    // Store the current offer and promotion for persistence
    this.currentOffer = offer;
    this.currentPromotion = promotion;
    this.currentPromotionId = promotion?.id || null;
    this.careerView = 'offer';
    const positionInfo = CardPositionSystem.getPositionInfo(this.currentOffer.position || 'mid_card');
    const positionName = positionInfo?.name || 'Mid Card';

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
      <p><strong>Position:</strong> ${positionName}</p>
      <p><strong>TV Appearance Bonus:</strong> $${this.currentOffer.tvAppearanceBonus}</p>
      <p><strong>Creative Control:</strong> ${this.currentOffer.hasCreativeControl ? 'Yes' : 'No'}</p>
      <p><strong>Merch Cut:</strong> ${this.currentOffer.hasMerchCut}%</p>
      <p><strong>Injury Coverage:</strong> ${this.currentOffer.injuryCoveragePct || 0}%</p>
      <p><strong>Dates / Month:</strong> ${this.currentOffer.datesPerMonth || 4}</p>
      <p><strong>Title Opportunity Clause:</strong> ${this.currentOffer.titleOpportunityGuaranteed ? `Yes (within ${this.currentOffer.championshipOpportunityWeeks || 12} weeks)` : 'No'}</p>
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
          this.currentPromotionId = null;
          this.careerView = 'main';
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

    const negotiateLengthCard = this.createActionCard(
      '📅 Negotiate Length',
      'Request a 16-week max player-friendly term',
      () => {
        const result = ContractEngine.negotiateClause(player, 'lengthWeeks', this.currentOffer, 16);
        this.currentOffer.lengthWeeks = result.resultValue;
        this.currentOffer.remainingWeeks = this.currentOffer.lengthWeeks;
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `📅 ${result.narrative} Length: ${result.resultValue} weeks`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateLengthCard);

    const negotiateMerchCard = this.createActionCard(
      '🛍️ Negotiate Merch Cut',
      'Push for better merchandise percentage',
      () => {
        const target = Math.min(25, (this.currentOffer.hasMerchCut || 0) + 3);
        const result = ContractEngine.negotiateClause(player, 'hasMerchCut', this.currentOffer, target);
        this.currentOffer.hasMerchCut = result.resultValue;
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `🛍️ ${result.narrative} Merch Cut: ${result.resultValue}%`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateMerchCard);

    const negotiateCreativeCard = this.createActionCard(
      '🎭 Negotiate Creative Control',
      'Try to add creative control to the deal',
      () => {
        const result = ContractEngine.negotiateClause(player, 'hasCreativeControl', this.currentOffer, true);
        this.currentOffer.hasCreativeControl = result.resultValue;
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `🎭 ${result.narrative} Creative Control: ${this.currentOffer.hasCreativeControl ? 'Yes' : 'No'}`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateCreativeCard);

    const negotiateInjuryCard = this.createActionCard(
      '🩺 Negotiate Injury Protection',
      'Request stronger medical/injury coverage',
      () => {
        const target = Math.min(100, (this.currentOffer.injuryCoveragePct || 0) + 20);
        const result = ContractEngine.negotiateClause(player, 'injuryCoveragePct', this.currentOffer, target);
        this.currentOffer.injuryCoveragePct = result.resultValue;
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `🩺 ${result.narrative} Injury Coverage: ${result.resultValue}%`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateInjuryCard);

    const negotiateDatesCard = this.createActionCard(
      '🗓️ Negotiate Fewer Dates',
      'Request fewer required appearances per month',
      () => {
        const target = Math.max(1, (this.currentOffer.datesPerMonth || 4) - 2);
        const result = ContractEngine.negotiateClause(player, 'datesPerMonth', this.currentOffer, target);
        this.currentOffer.datesPerMonth = result.resultValue;
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: { category: 'personal', text: `🗓️ ${result.narrative} Dates/Month: ${result.resultValue}`, type: 'negotiation' }
        });
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateDatesCard);

    const negotiateTitleRunCard = this.createActionCard(
      '🏆 Negotiate Title Opportunity',
      'Try to add a guaranteed championship opportunity clause',
      () => {
        const clauseResult = ContractEngine.negotiateClause(player, 'titleOpportunityGuaranteed', this.currentOffer, true);
        this.currentOffer.titleOpportunityGuaranteed = clauseResult.resultValue;
        if (this.currentOffer.titleOpportunityGuaranteed) {
          const weeksResult = ContractEngine.negotiateClause(player, 'championshipOpportunityWeeks', this.currentOffer, 12);
          this.currentOffer.championshipOpportunityWeeks = weeksResult.resultValue;
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'personal', text: `🏆 ${weeksResult.narrative} Title opportunity within ${weeksResult.resultValue} weeks.`, type: 'negotiation' }
          });
        } else {
          gameStateManager.dispatch('ADD_LOG_ENTRY', {
            entry: { category: 'personal', text: `🏆 ${clauseResult.narrative}`, type: 'negotiation' }
          });
        }
        this.renderContractOffer(player, promotion, this.currentOffer);
      }
    );
    this.container.appendChild(negotiateTitleRunCard);

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
        this.currentPromotionId = null;
        this.careerView = 'browser';
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

      const activeList = document.createDocumentFragment();
      perkData.active.forEach(perk => {
        const perkRow = document.createElement('div');
        perkRow.style.padding = '0.5rem';
        perkRow.style.marginTop = '0.5rem';
        perkRow.style.background = 'rgba(76,175,80,0.2)';
        perkRow.style.borderRadius = 'var(--radius-sm)';

        const nameEl = document.createElement('strong');
        nameEl.textContent = perk.name;
        perkRow.appendChild(nameEl);
        perkRow.append(` (${perk.category})`);
        perkRow.appendChild(document.createElement('br'));

        const descEl = document.createElement('span');
        descEl.style.fontSize = '0.8rem';
        descEl.textContent = perk.description;
        perkRow.appendChild(descEl);

        activeList.appendChild(perkRow);
      });
      activeDiv.appendChild(activeList);
      this.container.appendChild(activeDiv);
    }

    // Show unlocked but inactive perks
    const activePerkIds = new Set(perkData.active.map(perk => perk.id));
    const unlockedInactive = perkData.unlocked.filter(perk => !activePerkIds.has(perk.id));

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
    const progressRows = document.createDocumentFragment();
    Object.values(progress).filter(p => !p.completed).slice(0, 5).forEach(p => { // Show first 5
      const percent = Math.min(100, (p.current / p.requirement.value) * 100);
      const row = document.createElement('div');
      row.style.marginTop = '0.5rem';

      const labels = document.createElement('div');
      labels.style.display = 'flex';
      labels.style.justifyContent = 'space-between';
      labels.style.fontSize = '0.85rem';

      const name = document.createElement('span');
      name.textContent = p.name;
      labels.appendChild(name);

      const value = document.createElement('span');
      value.textContent = `${p.current}/${p.requirement.value}`;
      labels.appendChild(value);
      row.appendChild(labels);

      const track = document.createElement('div');
      track.style.height = '4px';
      track.style.background = 'var(--bg-tertiary)';
      track.style.borderRadius = '2px';
      track.style.marginTop = '2px';

      const fill = document.createElement('div');
      fill.style.height = '100%';
      fill.style.width = `${percent}%`;
      fill.style.background = 'var(--accent-secondary)';
      fill.style.borderRadius = '2px';
      track.appendChild(fill);

      row.appendChild(track);
      progressRows.appendChild(row);
    });
    progressDiv.appendChild(progressRows);
    this.container.appendChild(progressDiv);
  }
}

export default ActionPanel;
