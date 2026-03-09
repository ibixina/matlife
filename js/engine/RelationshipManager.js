/**
 * RelationshipManager for Mat Life: Wrestling Simulator
 * Step 1.7 of Implementation Plan
 * Manages the relationship graph between entities
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { clamp } from '../core/Utils.js';

/**
 * RelationshipManager - Handles relationship graph operations
 */
export class RelationshipManager {
  /**
   * Gets a consistent key for relationship lookup
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @returns {string} Sorted key (A|B or B|A, always consistent)
   */
  static getKey(idA, idB) {
    return [idA, idB].sort().join('|');
  }

  /**
   * Gets a relationship between two entities
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @returns {RelationshipEdge} The relationship edge or default
   */
  static getRelationship(idA, idB) {
    const state = gameStateManager.getStateRef();
    const key = this.getKey(idA, idB);
    
    return state.relationships.get(key) ?? {
      entityA: idA,
      entityB: idB,
      affinity: 0,
      tags: ['professional'],
      history: []
    };
  }

  /**
   * Checks if a relationship has a specific tag
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {string} tag - Tag to check for
   * @returns {boolean} True if relationship has the tag
   */
  static hasTag(idA, idB, tag) {
    const relationship = this.getRelationship(idA, idB);
    return relationship.tags?.includes(tag) ?? false;
  }

  /**
   * Gets all tags for a relationship
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @returns {string[]} Array of tags
   */
  static getTags(idA, idB) {
    const relationship = this.getRelationship(idA, idB);
    return relationship.tags ?? ['professional'];
  }

  /**
   * Sets a relationship between two entities
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {object} changes - Changes to apply
   */
  static setRelationship(idA, idB, changes) {
    let processedChanges = { ...changes };
    
    if (changes.type) {
      const existing = this.getRelationship(idA, idB);
      const existingTags = existing.tags || ['professional'];
      if (!existingTags.includes(changes.type)) {
        processedChanges.tags = [...existingTags, changes.type];
      } else {
        processedChanges = { ...changes, tags: existingTags };
      }
      delete processedChanges.type;
    }
    
    gameStateManager.dispatch('SET_RELATIONSHIP', {
      entityA: idA,
      entityB: idB,
      changes: processedChanges
    });
  }

  /**
   * Modifies the affinity between two entities
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {number} delta - Amount to change affinity by
   * @param {string} [reason] - Reason for the change
   */
  static modifyAffinity(idA, idB, delta, reason = '') {
    const relationship = this.getRelationship(idA, idB);
    const newAffinity = clamp(relationship.affinity + delta, -100, 100);
    
    const history = [...relationship.history];
    if (reason) {
      const state = gameStateManager.getStateRef();
      const date = `${state.calendar.year}-${state.calendar.month}-${state.calendar.week}`;
      history.push(`${date}: ${reason} (${delta > 0 ? '+' : ''}${delta})`);
    }
    
    this.setRelationship(idA, idB, {
      affinity: newAffinity,
      history
    });
  }

  /**
   * Gets the affinity modifier for resolution engine
   * Maps -100/+100 affinity to -5/+5 modifier
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @returns {number} Modifier value (-5 to +5)
   */
  static getAffinityModifier(idA, idB) {
    const relationship = this.getRelationship(idA, idB);
    // Map -100..100 to -5..5
    return Math.round(relationship.affinity / 20);
  }

  /**
   * Drifts all relationships toward 0 (decay over time)
   * Should be called on weekly tick
   */
  static driftRelationships() {
    const state = gameStateManager.getStateRef();
    
    for (const [key, relationship] of state.relationships) {
      if (relationship.affinity !== 0) {
        const drift = relationship.affinity > 0 ? -1 : 1;
        this.setRelationship(relationship.entityA, relationship.entityB, {
          affinity: relationship.affinity + drift
        });
      }
    }
  }

  /**
   * Gets the average affinity of an entity with a roster
   * @param {string} entityId - Entity ID
   * @param {string[]} rosterIds - Array of roster member IDs
   * @returns {number} Average affinity
   */
  static getAverageAffinity(entityId, rosterIds) {
    if (!rosterIds || rosterIds.length === 0) return 0;
    
    let totalAffinity = 0;
    for (const rosterId of rosterIds) {
      if (rosterId !== entityId) {
        const relationship = this.getRelationship(entityId, rosterId);
        totalAffinity += relationship.affinity;
      }
    }
    
    return totalAffinity / rosterIds.length;
  }

  /**
   * Gets all relationships for an entity
   * @param {string} entityId - Entity ID
   * @returns {Array<{entityId: string, relationship: RelationshipEdge}>}
   */
  static getEntityRelationships(entityId) {
    const state = gameStateManager.getStateRef();
    const relationships = [];
    
    for (const [key, relationship] of state.relationships) {
      if (relationship.entityA === entityId || relationship.entityB === entityId) {
        const otherId = relationship.entityA === entityId ? relationship.entityB : relationship.entityA;
        relationships.push({
          entityId: otherId,
          relationship
        });
      }
    }
    
    return relationships;
  }

  /**
   * Creates a new relationship if it doesn't exist
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {string} [type] - Relationship type
   * @param {number} [initialAffinity] - Initial affinity
   */
  static createRelationship(idA, idB, type = 'professional', initialAffinity = 0) {
    const existing = this.getRelationship(idA, idB);
    
    // Only create if it's a default relationship
    const isDefault = existing.tags?.length === 1 && existing.tags[0] === 'professional';
    if (existing.affinity === 0 && isDefault) {
      this.setRelationship(idA, idB, {
        tags: [type],
        affinity: initialAffinity,
        history: []
      });
    }
  }

  /**
   * Adds a tag to a relationship (doesn't remove existing tags)
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {string} newTag - Tag to add
   */
  static addTag(idA, idB, newTag) {
    const relationship = this.getRelationship(idA, idB);
    const tags = [...(relationship.tags || ['professional'])];
    if (!tags.includes(newTag)) {
      tags.push(newTag);
      this.setRelationship(idA, idB, { tags });
    }
  }

  /**
   * Removes a tag from a relationship
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {string} tag - Tag to remove
   */
  static removeTag(idA, idB, tag) {
    const relationship = this.getRelationship(idA, idB);
    const tags = (relationship.tags || ['professional']).filter(t => t !== tag);
    if (tags.length === 0) tags.push('professional');
    this.setRelationship(idA, idB, { tags });
  }

  /**
   * Changes the relationship type (adds tag, keeps existing)
   * @param {string} idA - First entity ID
   * @param {string} idB - Second entity ID
   * @param {string} newType - New relationship type
   */
  static setRelationshipType(idA, idB, newType) {
    this.addTag(idA, idB, newType);
  }
}

/**
 * @typedef {object} RelationshipEdge
 * @property {string} entityA - First entity ID
 * @property {string} entityB - Second entity ID
 * @property {number} affinity - Relationship value (-100 to +100)
 * @property {string[]} tags - Relationship tags (professional, romantic, mentor, rival)
 * @property {string[]} history - Array of relationship events
 */

export default RelationshipManager;
