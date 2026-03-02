/**
 * GameStateManager for Mat Life: Wrestling Simulator
 * Step 1.4 of Implementation Plan
 * Centralized state management with dispatch/subscribe pattern
 */

import { deepClone } from './Utils.js';

/**
 * GameStateManager - Singleton class for centralized state management
 * All state mutations flow through dispatch()
 */
class GameStateManager {
  constructor() {
    this.state = null;
    this.listeners = new Set();
    this.actionHandlers = new Map();
    
    // Initialize action handlers
    this._initializeActionHandlers();
  }

  /**
   * Initialize all action type handlers
   * @private
   */
  _initializeActionHandlers() {
    // Entity management
    this.actionHandlers.set('ADD_ENTITY', this._handleAddEntity.bind(this));
    this.actionHandlers.set('REMOVE_ENTITY', this._handleRemoveEntity.bind(this));
    this.actionHandlers.set('UPDATE_COMPONENT', this._handleUpdateComponent.bind(this));
    
    // Tag management
    this.actionHandlers.set('ADD_TAG', this._handleAddTag.bind(this));
    this.actionHandlers.set('REMOVE_TAG', this._handleRemoveTag.bind(this));
    
    // Time management
    this.actionHandlers.set('ADVANCE_TIME', this._handleAdvanceTime.bind(this));
    
    // Logging
    this.actionHandlers.set('ADD_LOG_ENTRY', this._handleAddLogEntry.bind(this));
    
    // Relationships
    this.actionHandlers.set('SET_RELATIONSHIP', this._handleSetRelationship.bind(this));
    
    // Feuds
    this.actionHandlers.set('ADD_FEUD', this._handleAddFeud.bind(this));
    this.actionHandlers.set('UPDATE_FEUD', this._handleUpdateFeud.bind(this));
    this.actionHandlers.set('REMOVE_FEUD', this._handleRemoveFeud.bind(this));
    
    // Contracts
    this.actionHandlers.set('ADD_CONTRACT', this._handleAddContract.bind(this));
    this.actionHandlers.set('UPDATE_CONTRACT', this._handleUpdateContract.bind(this));
    this.actionHandlers.set('REMOVE_CONTRACT', this._handleRemoveContract.bind(this));
  }

  /**
   * Gets the current state (returns a deep clone for safety during development)
   * @returns {object} Current game state
   */
  getState() {
    return deepClone(this.state);
  }

  /**
   * Gets the raw state reference (use with caution)
   * @returns {object} Current game state reference
   */
  getStateRef() {
    return this.state;
  }

  /**
   * Dispatches an action to modify state
   * @param {string} actionType - Type of action
   * @param {object} payload - Action payload
   */
  dispatch(actionType, payload = {}) {
    const handler = this.actionHandlers.get(actionType);
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    // Execute the handler
    handler(payload);

    // Notify all listeners
    this._notifyListeners(actionType, payload);
  }

  /**
   * Subscribes a listener to state changes
   * @param {Function} listener - Callback function(actionType, payload, state)
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of state change
   * @private
   */
  _notifyListeners(actionType, payload) {
    for (const listener of this.listeners) {
      try {
        listener(actionType, payload, this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    }
  }

  /**
   * Initializes a fresh game state
   * @param {object} config - Configuration for new game
   */
  initializeState(config = {}) {
    this.state = {
      calendar: {
        year: config.startYear ?? 1,
        month: config.startMonth ?? 1,
        week: config.startWeek ?? 1,
        day: config.startDay ?? 0, // 0 = Monday
        timeOfDay: config.startTimeOfDay ?? 0, // 0 = Morning
        absoluteWeek: 0
      },
      player: {
        entityId: config.playerId ?? null,
        mode: config.mode ?? 'WRESTLER' // 'WRESTLER' or 'BOOKER'
      },
      entities: new Map(),
      promotions: new Map(),
      championships: new Map(),
      relationships: new Map(),
      feuds: new Map(),
      contracts: new Map(),
      history: [],
      dirtSheets: [],
      settings: {
        difficulty: config.difficulty ?? 'NORMAL',
        autoAdvance: config.autoAdvance ?? false
      }
    };
  }

  // Action Handlers

  _handleAddEntity({ entity }) {
    this.state.entities.set(entity.id, entity);
  }

  _handleRemoveEntity({ entityId }) {
    this.state.entities.delete(entityId);
  }

  _handleUpdateComponent({ entityId, componentName, updates }) {
    const entity = this.state.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const component = entity.components.get(componentName);
    if (!component) {
      throw new Error(`Component not found: ${componentName} on entity ${entityId}`);
    }

    // Merge updates into component
    Object.assign(component, updates);
  }

  _handleAddTag({ entityId, tag }) {
    const entity = this.state.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    entity.tags.add(tag);
  }

  _handleRemoveTag({ entityId, tag }) {
    const entity = this.state.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    entity.tags.delete(tag);
  }

  _handleAdvanceTime() {
    // Calendar tick is handled by GameCalendar, this is just a notification action
    // The actual calendar logic updates the state.calendar object directly
  }

  _handleAddLogEntry({ entry }) {
    const logEntry = {
      id: Date.now(),
      timestamp: { ...this.state.calendar },
      ...entry
    };
    this.state.history.push(logEntry);
  }

  _handleSetRelationship({ entityA, entityB, changes }) {
    const key = this._getRelationshipKey(entityA, entityB);
    const existing = this.state.relationships.get(key);
    
    if (existing) {
      Object.assign(existing, changes);
    } else {
      this.state.relationships.set(key, {
        entityA,
        entityB,
        affinity: 0,
        type: 'professional',
        history: [],
        ...changes
      });
    }
  }

  _handleAddFeud({ feud }) {
    this.state.feuds.set(feud.id, feud);
  }

  _handleUpdateFeud({ feudId, updates }) {
    const feud = this.state.feuds.get(feudId);
    if (feud) {
      Object.assign(feud, updates);
    }
  }

  _handleRemoveFeud({ feudId }) {
    this.state.feuds.delete(feudId);
  }

  _handleAddContract({ contract }) {
    this.state.contracts.set(contract.id, contract);
  }

  _handleUpdateContract({ contractId, updates }) {
    const contract = this.state.contracts.get(contractId);
    if (contract) {
      Object.assign(contract, updates);
    }
  }

  _handleRemoveContract({ contractId }) {
    this.state.contracts.delete(contractId);
  }

  /**
   * Gets a consistent key for relationship lookup
   * @private
   */
  _getRelationshipKey(idA, idB) {
    return [idA, idB].sort().join('|');
  }

  /**
   * Gets an entity by ID
   * @param {string} entityId - Entity ID
   * @returns {Entity|undefined}
   */
  getEntity(entityId) {
    return this.state.entities.get(entityId);
  }

  /**
   * Gets the player entity
   * @returns {Entity|undefined}
   */
  getPlayerEntity() {
    return this.state.entities.get(this.state.player.entityId);
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();
export default gameStateManager;
