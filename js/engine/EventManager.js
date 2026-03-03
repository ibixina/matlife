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

    // Filter templates
    const eligibleTemplates = this.eventTemplates.filter(template => {
      // Check required tags
      if (template.requiredTags) {
        const hasAllRequired = template.requiredTags.every(tag =>
          playerTags.includes(tag)
        );
        if (!hasAllRequired) return false;
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
        if (lastFired && (currentWeek - lastFired) < template.cooldownWeeks) {
          return false;
        }
      }

      // Check requiredState function
      if (template.requiredState && typeof template.requiredState === 'function') {
        if (!template.requiredState(playerEntity, state)) {
          return false;
        }
      }

      return true;
    });

    if (eligibleTemplates.length === 0) {
      return null;
    }

    // Weighted random selection
    const weightedItems = eligibleTemplates.map(template => ({
      value: template,
      weight: template.weight || 1
    }));

    const selectedEvent = weightedRandom(weightedItems);

    // Create an instance clone
    const eventInstance = JSON.parse(JSON.stringify(selectedEvent));
    eventInstance.context = {};

    if (eventInstance.id === 'scout_notice') {
      let promotions = Array.from(state.promotions.values()).filter(p => p.prestige >= 50);
      if (promotions.length === 0) {
        promotions = Array.from(state.promotions.values()); // Fallback to any
      }
      if (promotions.length > 0) {
        eventInstance.context.promotionId = promotions[Math.floor(Math.random() * promotions.length)].id;
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
      effects: outcomeData.effects || []
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
