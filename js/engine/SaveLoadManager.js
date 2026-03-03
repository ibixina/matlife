/**
 * SaveLoadManager for Mat Life: Wrestling Simulator
 * Save/Load system with localforage
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { Entity } from '../core/Entity.js';
import { deserializeComponent } from '../core/Component.js';

/**
 * SaveLoadManager - Handles game persistence
 */
export class SaveLoadManager {
  constructor() {
    this.storageKey = 'mat_life_save';
    this.autoSaveEnabled = false;
    this.lastSaveTime = null;
  }

  /**
   * Serializes the game state for saving
   * @returns {object} Serialized state
   */
  serializeState() {
    const state = gameStateManager.getStateRef();
    if (!state) return null;

    // Serialize entities (convert Map to serializable array)
    const serializedEntities = [];
    for (const [id, entity] of state.entities) {
      serializedEntities.push({
        id: entity.id,
        components: this._serializeComponents(entity.components),
        tags: Array.from(entity.tags)
      });
    }

    // Serialize other Maps
    const serializedPromotions = [];
    for (const [id, promotion] of state.promotions) {
      serializedPromotions.push({ id, ...promotion });
    }

    const serializedChampionships = [];
    for (const [id, championship] of state.championships) {
      serializedChampionships.push({ id, ...championship });
    }

    const serializedRelationships = [];
    for (const [key, relationship] of state.relationships) {
      serializedRelationships.push({ key, ...relationship });
    }

    const serializedFeuds = [];
    for (const [id, feud] of state.feuds) {
      serializedFeuds.push({ id, ...feud });
    }

    const serializedContracts = [];
    for (const [id, contract] of state.contracts) {
      serializedContracts.push({ id, ...contract });
    }

    const serializedStorylines = [];
    for (const [id, storyline] of state.storylines) {
      serializedStorylines.push({ id, ...storyline });
    }

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      calendar: state.calendar,
      player: state.player,
      entities: serializedEntities,
      promotions: serializedPromotions,
      championships: serializedChampionships,
      relationships: serializedRelationships,
      feuds: serializedFeuds,
      contracts: serializedContracts,
      storylines: serializedStorylines,
      history: state.history.slice(-100), // Keep last 100 log entries
      dirtSheets: state.dirtSheets || [],
      settings: state.settings,
      saveDate: new Date().toISOString()
    };
  }

  /**
   * Serializes entity components
   * @private
   */
  _serializeComponents(components) {
    const serialized = {};
    for (const [name, component] of components) {
      if (component && typeof component.serialize === 'function') {
        serialized[name] = component.serialize();
      } else {
        serialized[name] = { ...component };
      }
    }
    return serialized;
  }

  /**
   * Deserializes the game state
   * @param {object} data - Serialized state data
   * @returns {boolean} True if successful
   */
  deserializeState(data) {
    if (!data || !data.version) {
      console.error('Invalid save data');
      return false;
    }

    try {
      // Initialize fresh state
      gameStateManager.initializeState({
        playerId: data.player?.entityId,
        mode: data.player?.mode || 'WRESTLER',
        ...data.calendar
      });

      const state = gameStateManager.getStateRef();

      // Restore calendar
      Object.assign(state.calendar, data.calendar);

      // Restore player
      state.player = data.player;

      // Restore entities
      for (const entityData of data.entities) {
        const entity = new Entity(entityData.id);

        // Restore components
        for (const [compName, compData] of Object.entries(entityData.components)) {
          try {
            const component = deserializeComponent(compName, compData);
            entity.components.set(compName, component);
          } catch (error) {
            entity.components.set(compName, compData);
          }
        }

        // Restore tags
        for (const tag of entityData.tags) {
          entity.tags.add(tag);
        }

        state.entities.set(entity.id, entity);
      }

      // Restore promotions
      for (const promoData of data.promotions) {
        const { id, ...promo } = promoData;
        state.promotions.set(id, promo);
      }

      // Restore championships
      if (data.championships) {
        for (const champData of data.championships) {
          const { id, ...championship } = champData;
          state.championships.set(id, championship);
        }
      }

      // Restore relationships
      for (const relData of data.relationships) {
        const { key, ...relationship } = relData;
        state.relationships.set(key, relationship);
      }

      // Restore feuds
      for (const feudData of data.feuds) {
        const { id, ...feud } = feudData;
        state.feuds.set(id, feud);
      }

      // Restore contracts
      for (const contractData of data.contracts) {
        const { id, ...contract } = contractData;
        state.contracts.set(id, contract);
      }

      // Restore storylines
      if (data.storylines) {
        for (const storylineData of data.storylines) {
          const { id, ...storyline } = storylineData;
          state.storylines.set(id, storyline);
        }
      }

      // Restore history
      state.history = data.history || [];

      // Restore dirt sheets
      state.dirtSheets = data.dirtSheets || [];

      // Restore settings
      state.settings = data.settings || {};

      return true;
    } catch (error) {
      console.error('Error deserializing save:', error);
      return false;
    }
  }

  /**
   * Saves the game to localforage
   * @returns {Promise<boolean>} True if successful
   */
  async save() {
    try {
      if (typeof localforage === 'undefined') {
        console.warn('localforage not available; skipping save');
        return false;
      }
      const saveData = this.serializeState();
      if (!saveData) {
        console.warn('No state to save');
        return false;
      }

      await localforage.setItem(this.storageKey, saveData);
      this.lastSaveTime = Date.now();

      console.log('Game saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      return false;
    }
  }

  /**
   * Loads the game from localforage
   * @returns {Promise<boolean>} True if successful
   */
  async load() {
    try {
      if (typeof localforage === 'undefined') {
        console.warn('localforage not available; skipping load');
        return false;
      }
      const saveData = await localforage.getItem(this.storageKey);
      if (!saveData) {
        console.log('No save found');
        return false;
      }

      const success = this.deserializeState(saveData);
      if (success) {
        console.log('Game loaded successfully');
      }
      return success;
    } catch (error) {
      console.error('Error loading game:', error);
      return false;
    }
  }

  /**
   * Checks if a save exists
   * @returns {Promise<boolean>}
   */
  async hasSave() {
    try {
      if (typeof localforage === 'undefined') {
        return false;
      }
      const saveData = await localforage.getItem(this.storageKey);
      return !!saveData;
    } catch (error) {
      return false;
    }
  }

  /**
   * Deletes the save
   * @returns {Promise<boolean>}
   */
  async deleteSave() {
    try {
      if (typeof localforage === 'undefined') {
        return false;
      }
      await localforage.removeItem(this.storageKey);
      console.log('Save deleted');
      return true;
    } catch (error) {
      console.error('Error deleting save:', error);
      return false;
    }
  }

  /**
   * Gets save metadata
   * @returns {Promise<object|null>}
   */
  async getSaveInfo() {
    try {
      if (typeof localforage === 'undefined') {
        return null;
      }
      const saveData = await localforage.getItem(this.storageKey);
      if (!saveData) return null;

      return {
        version: saveData.version,
        saveDate: saveData.saveDate,
        timestamp: saveData.timestamp,
        playerName: saveData.entities?.find(e => e.id === saveData.player?.entityId)?.components?.identity?.name || 'Unknown',
        inGameDate: saveData.calendar ?
          `Week ${saveData.calendar.week}, ${this._getMonthName(saveData.calendar.month)} Year ${saveData.calendar.year}` :
          'Unknown'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Enables/disables auto-save
   * @param {boolean} enabled
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled;
  }

  /**
   * Triggers auto-save if enabled
   */
  async autoSave() {
    if (this.autoSaveEnabled) {
      await this.save();
    }
  }

  /**
   * Gets month name from number
   * @private
   */
  _getMonthName(monthNum) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNum - 1] || 'Unknown';
  }
}

// Export singleton
export const saveLoadManager = new SaveLoadManager();
export default saveLoadManager;
