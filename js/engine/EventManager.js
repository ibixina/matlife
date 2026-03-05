/**
 * EventManager for Mat Life: Wrestling Simulator
 * Step 1.12 of Implementation Plan
 * Tag-based dynamic event generation
 */

import { gameStateManager } from '../core/GameStateManager.js';
import ResolutionEngine from './ResolutionEngine.js';
import { weightedRandom } from '../core/Utils.js';
import RelationshipManager from './RelationshipManager.js';
import InjuryEngine from './InjuryEngine.js';
import ContractEngine from './ContractEngine.js';

/**
 * EventManager - Handles dynamic event generation and resolution
 */
export class EventManager {
  constructor() {
    this.eventTemplates = [];
    this.cooldowns = new Map(); // eventId -> weekLastFired
  }

  /**
   * Loads event templates
   * @param {EventTemplate[]} templates - Array of event templates
   */
  loadTemplates(templates) {
    this.eventTemplates = templates;
  }

  /**
   * Generates events for the player
   * @param {Entity} playerEntity - The player entity
   * @param {object} state - Current game state
   * @returns {EventTemplate|null} Selected event or null
   */
  generateEvents(playerEntity, state) {
    if (!playerEntity || !this.eventTemplates.length) {
      return null;
    }

    const playerTags = playerEntity.getTags ? playerEntity.getTags() : [];
    const currentWeek = state.calendar.absoluteWeek;
    const scoutMode = this._getScoutNoticeMode(playerEntity, state, playerTags);
    const requirementContext = this._buildRequirementContext(playerEntity, state);

    // Filter templates
    const eligibleTemplates = this.eventTemplates.filter(template => {
      // Check required tags
      if (template.requiredTags) {
        const hasAllRequired = template.requiredTags.every(tag =>
          playerTags.includes(tag)
        );
        if (!hasAllRequired) {
          // Scout notice can also fire in buyout mode for established stars
          if (!(template.id === 'scout_notice' && scoutMode)) {
            return false;
          }
        }
      }

      // Check excluded tags
      if (template.excludedTags) {
        const hasExcluded = template.excludedTags.some(tag =>
          playerTags.includes(tag)
        );
        if (hasExcluded) return false;
      }

      // Check cooldown
      if (template.cooldownWeeks) {
        const lastFired = this.cooldowns.get(template.id);
        if (lastFired !== undefined && (currentWeek - lastFired) < template.cooldownWeeks) {
          return false;
        }
      }

      // Check requiredState function
      if (template.requiredState && typeof template.requiredState === 'function') {
        if (!template.requiredState(playerEntity, state)) {
          return false;
        }
      }

      // Check declarative requirements (context-aware gating)
      if (template.requirements && !this._passesRequirements(template.requirements, requirementContext)) {
        return false;
      }

      // Scout Notice should only appear for free agents or indie-tier contracts
      if (template.id === 'scout_notice') {
        if (!scoutMode) return false;
      }

      return true;
    });

    if (eligibleTemplates.length === 0) {
      return null;
    }

    // Weighted random selection
    const weightedItems = eligibleTemplates.map(template => {
      let weight = template.weight || 1;
      if (template.id === 'scout_notice' && scoutMode === 'buyout') {
        const overness = playerEntity.getComponent('popularity')?.overness || 0;
        const bonus = Math.min(4, Math.floor((overness - 70) / 10) + 1);
        weight += Math.max(1, bonus);
      }
      return { value: template, weight };
    });

    const selectedEvent = weightedRandom(weightedItems);

    // Create an instance clone
    const eventInstance = this._cloneEventTemplate(selectedEvent);
    eventInstance.context = {};

    if (eventInstance.id === 'scout_notice') {
      const contract = playerEntity.getComponent('contract');
      const currentPromotion = contract?.promotionId ? state.promotions.get(contract.promotionId) : null;
      const currentPrestige = currentPromotion?.prestige || 0;

      let promotions = Array.from(state.promotions.values());
      if (scoutMode === 'buyout') {
        promotions = promotions.filter(p =>
          p.id !== currentPromotion?.id &&
          p.prestige >= Math.max(30, currentPrestige - 5)
        );
      } else {
        promotions = promotions.filter(p => p.prestige >= 50);
      }
      if (promotions.length === 0) {
        promotions = Array.from(state.promotions.values()); // Fallback to any
      }
      if (promotions.length > 0) {
        eventInstance.context.promotionId = promotions[Math.floor(Math.random() * promotions.length)].id;
      }
      eventInstance.context.scoutMode = scoutMode;
      eventInstance.context.useGeneratedOffer = true;
      eventInstance.context.presentOfferOnly = true;

      if (scoutMode === 'buyout') {
        eventInstance.title = 'Buyout Offer';
        eventInstance.description = `${'{promotion.name}'} is willing to buy out your current deal to sign you.`;
        if (eventInstance.choices?.[0]) {
          eventInstance.choices[0].text = 'Accept the buyout and sign';
        }
        if (eventInstance.choices?.[1]) {
          eventInstance.choices[1].text = 'Negotiate for a stronger deal';
        }
        if (eventInstance.choices?.[2]) {
          eventInstance.choices[2].text = 'Stay loyal to your current promotion';
        }
      } else if (contract?.promotionId) {
        eventInstance.title = 'Contract Interest';
        eventInstance.description = `${'{promotion.name}'} wants to sign you away from your current promotion.`;
        if (eventInstance.choices?.[0]) {
          eventInstance.choices[0].text = 'Hear their offer';
        }
        if (eventInstance.choices?.[1]) {
          eventInstance.choices[1].text = 'Negotiate for better terms';
        }
        if (eventInstance.choices?.[2]) {
          eventInstance.choices[2].text = 'Decline and stay with your current promotion';
        }
      }
    }

    // Process top-level description templates if available
    if (eventInstance.description) {
      eventInstance.description = this.fillTemplate(eventInstance.description, {
        player: playerEntity,
        state,
        promotionId: eventInstance.context.promotionId
      });
    }

    // Set cooldown
    this.cooldowns.set(eventInstance.id, currentWeek);

    return eventInstance;
  }

  /**
   * Evaluates declarative requirements for an event template.
   * @private
   * @param {object} requirements
   * @param {object} context
   * @returns {boolean}
   */
  _passesRequirements(requirements, context) {
    if (!requirements) return true;

    const {
      playerEntity,
      identity,
      contract,
      promotion,
      flags,
      overness,
      momentum,
      burnout,
      bankBalance,
      charisma,
      micSkills,
      brawling,
      technical,
      aerial,
      ringAvg,
      hasInjury,
      isChampion,
      activeFeud
    } = context;

    if (requirements.requiresContract === true && !contract?.promotionId) return false;
    if (requirements.requiresContract === false && !!contract?.promotionId) return false;
    if (requirements.isChampion === true && !isChampion) return false;
    if (requirements.isChampion === false && isChampion) return false;
    if (requirements.activeFeud === true && !activeFeud) return false;
    if (requirements.activeFeud === false && activeFeud) return false;
    if (requirements.hasInjury === true && !hasInjury) return false;
    if (requirements.hasInjury === false && hasInjury) return false;

    if (requirements.minOverness != null && overness < requirements.minOverness) return false;
    if (requirements.maxOverness != null && overness > requirements.maxOverness) return false;
    if (requirements.minMomentum != null && momentum < requirements.minMomentum) return false;
    if (requirements.maxMomentum != null && momentum > requirements.maxMomentum) return false;
    if (requirements.minBurnout != null && burnout < requirements.minBurnout) return false;
    if (requirements.maxBurnout != null && burnout > requirements.maxBurnout) return false;
    if (requirements.minBankBalance != null && bankBalance < requirements.minBankBalance) return false;
    if (requirements.maxBankBalance != null && bankBalance > requirements.maxBankBalance) return false;

    if (requirements.minCharisma != null && charisma < requirements.minCharisma) return false;
    if (requirements.minMicSkills != null && micSkills < requirements.minMicSkills) return false;
    if (requirements.minBrawling != null && brawling < requirements.minBrawling) return false;
    if (requirements.minTechnical != null && technical < requirements.minTechnical) return false;
    if (requirements.minAerial != null && aerial < requirements.minAerial) return false;
    if (requirements.minRingAvg != null && ringAvg < requirements.minRingAvg) return false;

    if (requirements.minPromotionPrestige != null && (promotion?.prestige || 0) < requirements.minPromotionPrestige) return false;
    if (requirements.maxPromotionPrestige != null && (promotion?.prestige || 0) > requirements.maxPromotionPrestige) return false;

    if (Array.isArray(requirements.alignmentIn) && requirements.alignmentIn.length > 0) {
      if (!requirements.alignmentIn.includes(identity?.alignment)) return false;
    }
    if (Array.isArray(requirements.promotionStyleIn) && requirements.promotionStyleIn.length > 0) {
      if (!requirements.promotionStyleIn.includes(promotion?.stylePreference)) return false;
    }

    if (Array.isArray(requirements.requiresFlags) && requirements.requiresFlags.length > 0) {
      const hasAllFlags = requirements.requiresFlags.every(flag => !!flags[flag]);
      if (!hasAllFlags) return false;
    }
    if (Array.isArray(requirements.excludesFlags) && requirements.excludesFlags.length > 0) {
      const hasBlocked = requirements.excludesFlags.some(flag => !!flags[flag]);
      if (hasBlocked) return false;
    }

    return true;
  }

  /**
   * Pre-computes requirement fields to avoid repeated map scans per template.
   * @private
   */
  _buildRequirementContext(playerEntity, state) {
    const identity = playerEntity.getComponent('identity');
    const popularity = playerEntity.getComponent('popularity');
    const contract = playerEntity.getComponent('contract');
    const financial = playerEntity.getComponent('financial');
    const lifestyle = playerEntity.getComponent('lifestyle');
    const condition = playerEntity.getComponent('condition');
    const inRing = playerEntity.getComponent('inRingStats');
    const entertainment = playerEntity.getComponent('entertainmentStats');
    const promotion = contract?.promotionId ? state.promotions.get(contract.promotionId) : null;
    const flags = state.eventFlags || {};

    const brawling = inRing?.brawling || 0;
    const technical = inRing?.technical || 0;
    const aerial = inRing?.aerial || 0;

    return {
      playerEntity,
      identity,
      contract,
      promotion,
      flags,
      overness: popularity?.overness || 0,
      momentum: popularity?.momentum || 0,
      burnout: lifestyle?.burnout || 0,
      bankBalance: financial?.bankBalance || 0,
      charisma: entertainment?.charisma || 0,
      micSkills: entertainment?.micSkills || 0,
      brawling,
      technical,
      aerial,
      ringAvg: (brawling + technical + aerial) / 3,
      hasInjury: !!(condition?.injuries || []).some(i => (i.daysRemaining || 0) > 0),
      isChampion: Array.from(state.championships.values()).some(c => c.currentChampion === playerEntity.id),
      activeFeud: Array.from(state.feuds.values()).some(f =>
        !f.resolved && (f.entityA === playerEntity.id || f.entityB === playerEntity.id)
      )
    };
  }

  /**
   * Clone helper with fallback for environments where structuredClone fails.
   * @private
   */
  _cloneEventTemplate(template) {
    try {
      return structuredClone(template);
    } catch {
      return JSON.parse(JSON.stringify(template));
    }
  }

  /**
   * Determines if scout notice is allowed this roll and which mode to use.
   * Returns null if event should not be eligible.
   * @private
   * @param {Entity} playerEntity
   * @param {object} state
   * @param {string[]} playerTags
   * @returns {'developmental'|'buyout'|null}
   */
  _getScoutNoticeMode(playerEntity, state, playerTags) {
    const contract = playerEntity.getComponent('contract');
    const popularity = playerEntity.getComponent('popularity');
    const inRingStats = playerEntity.getComponent('inRingStats');
    const entertainmentStats = playerEntity.getComponent('entertainmentStats');
    const overness = popularity?.overness || 0;
    const momentum = popularity?.momentum || 0;
    const ringAvg = inRingStats
      ? ((inRingStats.brawling || 0) + (inRingStats.technical || 0) + (inRingStats.aerial || 0)) / 3
      : 0;
    const promoSkill = entertainmentStats?.charisma || 0;

    // Existing path: free agents can get developmental scouts
    if (!contract?.promotionId) {
      return 'developmental';
    }

    const currentPromotion = state.promotions.get(contract.promotionId);
    if (!currentPromotion) return null;
    if (currentPromotion.prestige <= 15) {
      return 'developmental';
    }

    // New path: rare buyout interest for highly over or highly skilled talent
    const hasHighProfile = overness >= 70;
    const hasEliteSkill = ringAvg >= 82 || (ringAvg >= 75 && promoSkill >= 80);
    if (!hasHighProfile && !hasEliteSkill) return null;

    const baseChance = 0.03;
    const overnessBonus = Math.min(0.06, (overness - 70) * 0.0015);
    const momentumBonus = Math.max(0, Math.min(0.02, momentum * 0.0004));
    const statsBonus = Math.max(0, Math.min(0.025, (ringAvg - 75) * 0.001));
    const promoBonus = Math.max(0, Math.min(0.01, (promoSkill - 78) * 0.0005));
    const poachChance = Math.min(0.12, baseChance + overnessBonus + momentumBonus + statsBonus + promoBonus);

    return Math.random() < poachChance ? 'buyout' : null;
  }

  /**
   * Resolves a player's choice in an event
   * @param {EventTemplate} event - The event template
   * @param {number} choiceIndex - Index of chosen option
   * @param {Entity} playerEntity - The player entity
   * @param {object} state - Current game state
   * @returns {EventResult} Result of the choice
   */
  resolveChoice(event, choiceIndex, playerEntity, state) {
    const choice = event.choices[choiceIndex];
    if (!choice) {
      throw new Error(`Invalid choice index: ${choiceIndex}`);
    }

    let outcome;
    let resolutionResult = null;

    // If choice has a check, resolve it
    if (choice.check) {
      resolutionResult = ResolutionEngine.resolve({
        actor: playerEntity,
        action: event.title,
        stat: choice.check.stat,
        dc: choice.check.dc,
        context: {
          hasAdvantage: choice.check.advantage || false,
          hasDisadvantage: choice.check.disadvantage || false
        }
      });

      outcome = resolutionResult.outcome;
    } else {
      // Auto-success
      outcome = 'SUCCESS';
    }

    // Map the OUTCOME constants to the keys used in events.json
    const outcomeMap = {
      'CRITICAL_SUCCESS': 'critSuccess',
      'SUCCESS': 'success',
      'FAILURE': 'failure',
      'CRITICAL_FAILURE': 'critFailure'
    };

    const outcomeKey = outcomeMap[outcome] || outcome.toLowerCase();

    // Graceful fallback: crits fall back to their base outcome, then to any first outcome
    const fallbackKey = (outcome === 'CRITICAL_SUCCESS') ? 'success' : 'failure';
    const outcomeData = choice.outcomes[outcomeKey]
      || choice.outcomes[fallbackKey]
      || Object.values(choice.outcomes)[0];

    if (!outcomeData) {
      console.warn(`No outcome data for event choice, skipping effects.`);
      return { narrative: 'Something happened...', outcome, resolutionResult, effects: [] };
    }

    // Apply effects
    if (outcomeData.effects) {
      for (const effect of outcomeData.effects) {
        EventManager._applyEffect(effect, playerEntity, state, event.context);
      }
    }

    // Fill template variables
    const narrative = this.fillTemplate(outcomeData.narrative, {
      player: playerEntity,
      state,
      promotionId: event.context?.promotionId
    });

    return {
      narrative,
      outcome,
      resolutionResult,
      effects: outcomeData.effects || [],
      generatedOffer: event.context?.generatedOffer || null,
      generatedPromotionId: event.context?.generatedPromotionId || null
    };
  }

  /**
   * Fills template variables in narrative string
   * @param {string} template - Template string
   * @param {object} context - Context object with values
   * @returns {string} Filled template
   */
  fillTemplate(template, context) {
    if (!template) return '';

    let result = template;

    // Replace {player.name}
    if (context.player) {
      const identity = context.player.getComponent('identity');
      result = result.replace(/{player\.name}/g, identity?.name || 'Unknown');
    }

    // Replace {opponent.name} - would need opponent in context
    if (context.opponent) {
      const oppIdentity = context.opponent.getComponent('identity');
      result = result.replace(/{opponent\.name}/g, oppIdentity?.name || 'Unknown');
    }

    // Replace {promotion.name}
    if (context.state && context.promotionId) {
      const promotion = context.state.promotions.get(context.promotionId);
      result = result.replace(/{promotion\.name}/g, promotion?.name || 'Unknown');
    }

    // Replace {date}
    if (context.state?.calendar) {
      const cal = context.state.calendar;
      result = result.replace(/{date}/g, `Week ${cal.week}, Month ${cal.month}, Year ${cal.year}`);
    }

    return result;
  }

  /**
   * Applies a state change effect
   * @private
   * @param {StateChange} effect - Effect to apply
   * @param {Entity} entity - Target entity
   * @param {object} state - Game state
   */
  static _applyEffect(effect, entity, state, eventContext = {}) {
    switch (effect.type) {
      case 'sign_contract':
        const promotionId = effect.promotionId || eventContext.promotionId;
        if (promotionId) {
          if (eventContext.presentOfferOnly) {
            const promotion = state.promotions.get(promotionId);
            if (promotion) {
              const generatedOffer = ContractEngine.generateOffer(promotion, entity);
              if (eventContext.scoutMode === 'buyout') {
                generatedOffer.weeklySalary = Math.floor(generatedOffer.weeklySalary * 1.35);
                generatedOffer.hasMerchCut = Math.max(generatedOffer.hasMerchCut || 0, 8);
                generatedOffer.hasCreativeControl = generatedOffer.hasCreativeControl || Math.random() < 0.35;
              }

              if (effect.weeklySalary != null) {
                generatedOffer.weeklySalary = Math.max(generatedOffer.weeklySalary, effect.weeklySalary);
              }
              if (effect.lengthWeeks != null) {
                generatedOffer.lengthWeeks = effect.lengthWeeks;
                generatedOffer.remainingWeeks = effect.lengthWeeks;
              }

              eventContext.generatedOffer = generatedOffer;
              eventContext.generatedPromotionId = promotion.id;
            }
            break;
          }

          if (eventContext.useGeneratedOffer) {
            const promotion = state.promotions.get(promotionId);
            if (promotion) {
              const generatedOffer = ContractEngine.generateOffer(promotion, entity);
              if (eventContext.scoutMode === 'buyout') {
                generatedOffer.weeklySalary = Math.floor(generatedOffer.weeklySalary * 1.35);
                generatedOffer.hasMerchCut = Math.max(generatedOffer.hasMerchCut || 0, 8);
              }

              if (effect.weeklySalary != null) {
                generatedOffer.weeklySalary = Math.max(generatedOffer.weeklySalary, effect.weeklySalary);
              }
              if (effect.lengthWeeks != null) {
                generatedOffer.lengthWeeks = effect.lengthWeeks;
                generatedOffer.remainingWeeks = effect.lengthWeeks;
              }

              ContractEngine.signContract(entity, generatedOffer);
              break;
            }
          }

          ContractEngine.signContract(entity, { promotionId }, 'opener', effect.lengthWeeks, effect.weeklySalary);
        }
        break;

      case 'stat': {
        // Add delta to existing stat value
        const comp = entity.getComponent(effect.component);
        if (comp) {
          const current = comp[effect.stat];
          // Boolean stats (e.g. pedUsage) are set directly; numeric stats are incremented
          const newVal = typeof current === 'boolean' || typeof effect.value === 'boolean'
            ? effect.value
            : (current ?? 0) + effect.value;
          gameStateManager.dispatch('UPDATE_COMPONENT', {
            entityId: entity.id,
            componentName: effect.component,
            updates: { [effect.stat]: newVal }
          });
        }
        break;
      }

      case 'relationship':
        // Update relationship
        RelationshipManager.modifyAffinity(
          entity.id,
          effect.targetId,
          effect.value,
          effect.reason || 'Event effect'
        );
        break;

      case 'tag':
        // Add or remove tag
        if (effect.action === 'add') {
          gameStateManager.dispatch('ADD_TAG', {
            entityId: entity.id,
            tag: effect.tag
          });
        } else if (effect.action === 'remove') {
          gameStateManager.dispatch('REMOVE_TAG', {
            entityId: entity.id,
            tag: effect.tag
          });
        }
        break;

      case 'money':
        // Modify bank balance
        const financial = entity.getComponent('financial');
        if (financial) {
          financial.bankBalance += effect.value;
        }
        break;

      case 'injury':
        // Add injury
        InjuryEngine.addInjury(entity, effect.bodyPart, effect.severity, effect.cause);
        break;

      case 'contract':
        // Update contract
        gameStateManager.dispatch('UPDATE_COMPONENT', {
          entityId: entity.id,
          componentName: 'contract',
          updates: { [effect.field]: effect.value }
        });
        break;

      case 'event_flag': {
        if (!state.eventFlags) state.eventFlags = {};
        const action = effect.action || 'set';
        const key = effect.flag;
        if (!key) break;

        if (action === 'clear' || action === 'remove') {
          delete state.eventFlags[key];
        } else if (action === 'toggle') {
          state.eventFlags[key] = !state.eventFlags[key];
        } else {
          state.eventFlags[key] = (effect.value !== undefined) ? effect.value : true;
        }
        break;
      }

      default:
        console.warn(`Unknown effect type: ${effect.type}`);
    }
  }
}

/**
 * @typedef {object} EventTemplate
 * @property {string} id - Unique identifier
 * @property {string} title - Event title
 * @property {string[]} [requiredTags] - Tags that must be present
 * @property {string[]} [excludedTags] - Tags that must not be present
 * @property {Function} [requiredState] - Complex conditional function
 * @property {number} [weight] - Probability weight
 * @property {number} [cooldownWeeks] - Minimum weeks before re-firing
 * @property {EventChoice[]} choices - Available choices
 */

/**
 * @typedef {object} EventChoice
 * @property {string} text - Choice text
 * @property {object} [check] - Resolution check parameters
 * @property {string} check.stat - Stat to use
 * @property {number} check.dc - Difficulty class
 * @property {boolean} [check.advantage] - Whether to apply advantage
 * @property {boolean} [check.disadvantage] - Whether to apply disadvantage
 * @property {object} outcomes - Outcomes for each result tier
 */

/**
 * @typedef {object} EventResult
 * @property {string} narrative - Result narrative text
 * @property {string} outcome - Outcome type
 * @property {object} [resolutionResult] - Resolution result if check was made
 * @property {StateChange[]} effects - Applied effects
 */

/**
 * @typedef {object} StateChange
 * @property {string} type - Change type (stat, relationship, tag, money, injury, contract)
 * @property {string} [component] - Component name (for stat changes)
 * @property {string} [stat] - Stat name (for stat changes)
 * @property {string} [targetId] - Target entity ID (for relationship changes)
 * @property {string} [tag] - Tag name (for tag changes)
 * @property {string} [action] - Action (add/remove for tags)
 * @property {any} value - New value
 */

// Export singleton instance
export const eventManager = new EventManager();
export default eventManager;
