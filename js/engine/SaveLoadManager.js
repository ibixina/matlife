/**
 * SaveLoadManager for Mat Life: Wrestling Simulator
 * Save/Load system with localforage
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { Entity } from '../core/Entity.js';
import { deserializeComponent } from '../core/Component.js';
import { deepClone } from '../core/Utils.js';
import { dataManager } from '../core/DataManager.js';
import { EntityFactory } from '../core/EntityFactory.js';

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
        isPlayer: entity.isPlayer === true,
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
      eventFlags: state.eventFlags || {},
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
      } else if (component !== null && typeof component === 'object') {
        serialized[name] = deepClone(component);
      } else {
        serialized[name] = component;
      }
    }
    return serialized;
  }

  /**
   * Normalizes perk arrays, including migration from legacy object form.
   * @private
   */
  _normalizePerkComponent(value) {
    if (Array.isArray(value)) {
      return value.filter(id => typeof id === 'string');
    }
    if (typeof value === 'string') {
      return [value];
    }
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort((a, b) => Number(a) - Number(b))
        .map(key => value[key])
        .filter(id => typeof id === 'string');
    }
    return [];
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
        entity.isPlayer = entityData.isPlayer === true || entityData.id === data.player?.entityId;

        // Restore components
        for (const [compName, compData] of Object.entries(entityData.components)) {
          if (compName === 'unlockedPerks' || compName === 'activePerks') {
            entity.components.set(compName, this._normalizePerkComponent(compData));
            continue;
          }
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
        state.promotions.set(promoData.id, promoData);
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

      // Restore event flags
      state.eventFlags = data.eventFlags || {};

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
   * Checks for and adds new roster members from updated real_life.json
   * @returns {Promise<number>} Number of new wrestlers added
   */
  async checkAndUpdateRosters() {
    try {
      const realLifeData = dataManager.getRealLife();
      if (!realLifeData || !realLifeData.promotions) {
        console.log('No real life data available for roster update');
        return 0;
      }

      const state = gameStateManager.getStateRef();
      if (!state) {
        console.log('No game state available for roster update');
        return 0;
      }

      let addedCount = 0;

      // Check each promotion in the real life data
      for (const realPromo of realLifeData.promotions) {
        const savedPromo = state.promotions.get(realPromo.id);
        if (!savedPromo) continue;

        // Get current roster names for comparison
        const currentRosterNames = new Set();
        for (const entityId of savedPromo.roster || []) {
          const entity = state.entities.get(entityId);
          if (entity) {
            const identity = entity.getComponent('identity');
            if (identity && identity.name) {
              currentRosterNames.add(identity.name.toLowerCase());
            }
          }
        }

        // Check for new roster members in real life data
        if (realPromo.roster && Array.isArray(realPromo.roster)) {
          for (const wrestlerData of realPromo.roster) {
            if (!wrestlerData.name) continue;

            const wrestlerName = wrestlerData.name.toLowerCase();
            if (!currentRosterNames.has(wrestlerName)) {
              // Create new NPC from JSON data
              const npc = EntityFactory.createNPCFromJSON({
                ...wrestlerData,
                hometown: realPromo.region || savedPromo.region || 'Unknown'
              });

              // Add to game state
              gameStateManager.dispatch('ADD_ENTITY', { entity: npc });

              // Set up contract
              const contract = npc.getComponent('contract');
              if (contract) {
                contract.promotionId = savedPromo.id;
                contract.weeklySalary = 500 + (wrestlerData.overness * 10);
                contract.lengthWeeks = 16;
                contract.remainingWeeks = 16;
              }

              // Add to promotion roster
              savedPromo.roster.push(npc.id);

              // Log the addition
              gameStateManager.dispatch('ADD_LOG_ENTRY', {
                entry: {
                  category: 'business',
                  text: `${wrestlerData.name} has been added to ${savedPromo.name}'s roster from updated data files.`,
                  type: 'contract'
                }
              });

              addedCount++;
              console.log(`Added ${wrestlerData.name} to ${savedPromo.name} roster`);
            }
          }
        }
      }

      if (addedCount > 0) {
        console.log(`Roster update complete: Added ${addedCount} new wrestler(s)`);
      }

      return addedCount;
    } catch (error) {
      console.error('Error checking for roster updates:', error);
      return 0;
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
   * Saves the game to a custom key (dev snapshots)
   * @param {string} customKey - Storage key
   * @returns {Promise<boolean>} True if successful
   */
  async saveAs(customKey) {
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
      await localforage.setItem(customKey, saveData);
      return true;
    } catch (error) {
      console.error('Error saving snapshot:', error);
      return false;
    }
  }

  /**
   * Loads the game from a custom key (dev snapshots)
   * @param {string} customKey - Storage key
   * @returns {Promise<boolean>} True if successful
   */
  async loadAs(customKey) {
    try {
      if (typeof localforage === 'undefined') {
        console.warn('localforage not available; skipping load');
        return false;
      }
      const saveData = await localforage.getItem(customKey);
      if (!saveData) return false;
      return this.deserializeState(saveData);
    } catch (error) {
      console.error('Error loading snapshot:', error);
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
        // Check for and add any new roster members from updated data files
        await this.checkAndUpdateRosters();
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
