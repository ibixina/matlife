/**
 * Entity Base Class for Mat Life: Wrestling Simulator
 * Step 1.3 of Implementation Plan
 * Implements the ECS (Entity-Component-System) base Entity class
 */

import { generateUUID } from './Utils.js';
import { deserializeComponent } from './Component.js';

/**
 * Entity class - The base for all game objects (wrestlers, managers, bookers, etc.)
 * Uses an Entity-Component-System (ECS) architecture
 */
export class Entity {
  /**
   * Creates a new Entity
   * @param {string} [id] - Optional UUID (generates one if not provided)
   */
  constructor(id = generateUUID()) {
    this.id = id;
    this.tags = new Set();
    this.components = new Map();
  }

  /**
   * Adds a component to this entity
   * @param {string} name - Component name/key
   * @param {Component} component - The component instance
   */
  addComponent(name, component) {
    this.components.set(name, component);
  }

  /**
   * Gets a component by name
   * @param {string} name - Component name
   * @returns {Component|null} The component or null if not found
   */
  getComponent(name) {
    return this.components.get(name) || null;
  }

  /**
   * Checks if entity has a component
   * @param {string} name - Component name
   * @returns {boolean} True if component exists
   */
  hasComponent(name) {
    return this.components.has(name);
  }

  /**
   * Removes a component from this entity
   * @param {string} name - Component name
   */
  removeComponent(name) {
    this.components.delete(name);
  }

  /**
   * Adds a tag to this entity
   * @param {string} tag - Tag to add
   */
  addTag(tag) {
    this.tags.add(tag);
  }

  /**
   * Removes a tag from this entity
   * @param {string} tag - Tag to remove
   */
  removeTag(tag) {
    this.tags.delete(tag);
  }

  /**
   * Checks if entity has a tag
   * @param {string} tag - Tag to check
   * @returns {boolean} True if tag exists
   */
  hasTag(tag) {
    return this.tags.has(tag);
  }

  /**
   * Serializes this entity to a plain object
   * @returns {object} Serialized entity data
   */
  serialize() {
    const serializedComponents = {};
    for (const [name, component] of this.components) {
      serializedComponents[name] = component.serialize();
    }

    return {
      id: this.id,
      tags: Array.from(this.tags),
      components: serializedComponents
    };
  }

  /**
   * Deserializes an entity from plain object data
   * @param {object} data - Serialized entity data
   * @returns {Entity} Deserialized entity
   */
  static deserialize(data) {
    const entity = new Entity(data.id);
    
    // Restore tags
    for (const tag of data.tags) {
      entity.addTag(tag);
    }

    // Restore components
    for (const [name, componentData] of Object.entries(data.components)) {
      const component = deserializeComponent(name, componentData);
      entity.addComponent(name, component);
    }

    return entity;
  }

  /**
   * Gets all component names
   * @returns {string[]} Array of component names
   */
  getComponentNames() {
    return Array.from(this.components.keys());
  }

  /**
   * Gets all tags
   * @returns {string[]} Array of tags
   */
  getTags() {
    return Array.from(this.tags);
  }
}
