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

const SAVE_SLOTS_KEY = 'mat_life_save_slots';
const LEGACY_SAVE_KEY = 'mat_life_save';
const MAX_SAVE_SLOTS = 10;

/**
 * SaveLoadManager - Handles game persistence
 */
export class SaveLoadManager {
  constructor() {
    this.autoSaveEnabled = false;
    this.lastSaveTime = null;
    this.currentSaveSlot = null;
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
   * Gets all save slots
   * @returns {Promise<Array>} Array of save metadata
   */
  async getAllSaves() {
    try {
      if (typeof localforage === 'undefined') {
        return [];
      }
      
      // Check for legacy save and migrate if needed
      await this._migrateLegacySave();

      const slots = await localforage.getItem(SAVE_SLOTS_KEY);
      return slots || [];
    } catch (error) {
      console.error('Error getting save slots:', error);
      return [];
    }
  }

  /**
   * Migrates legacy single save to new slot system
   * @private
   */
  async _migrateLegacySave() {
    try {
      const legacySave = await localforage.getItem(LEGACY_SAVE_KEY);
      if (!legacySave) return;

      const existingSlots = await localforage.getItem(SAVE_SLOTS_KEY) || [];
      
      // Check if already migrated
      const alreadyMigrated = existingSlots.some(s => s.isLegacy);
      if (alreadyMigrated) {
        await localforage.removeItem(LEGACY_SAVE_KEY);
        return;
      }

      const gameMode = legacySave.player?.mode || 'WRESTLER';
      const playerName = legacySave.entities?.find(e => e.id === legacySave.player?.entityId)?.components?.identity?.name || 'Unknown';

      const slotData = {
        id: `legacy_${Date.now()}`,
        name: 'Main Save',
        data: legacySave,
        saveDate: legacySave.saveDate || new Date().toISOString(),
        timestamp: legacySave.timestamp || Date.now(),
        gameMode: gameMode,
        playerName: playerName,
        inGameDate: legacySave.calendar ? 
          `Week ${legacySave.calendar.week}, ${this._getMonthName(legacySave.calendar.month)} Year ${legacySave.calendar.year}` :
          'Week 1, January Year 1',
        isLegacy: true
      };

      await localforage.setItem(`mat_life_save_${slotData.id}`, slotData);
      
      existingSlots.push({
        id: slotData.id,
        name: slotData.name,
        saveDate: slotData.saveDate,
        timestamp: slotData.timestamp,
        gameMode: slotData.gameMode,
        playerName: slotData.playerName,
        inGameDate: slotData.inGameDate,
        isLegacy: true
      });

      await localforage.setItem(SAVE_SLOTS_KEY, existingSlots);
      await localforage.removeItem(LEGACY_SAVE_KEY);
      
      console.log('Legacy save migrated to new slot system');
    } catch (error) {
      console.error('Error migrating legacy save:', error);
    }
  }

  /**
   * Saves to a specific slot
   * @param {string} slotId - Unique slot ID
   * @param {string} slotName - Display name for the save
   * @returns {Promise<boolean>} True if successful
   */
  async saveToSlot(slotId, slotName) {
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

      const state = gameStateManager.getStateRef();
      const gameMode = state?.player?.mode || 'WRESTLER';
      const playerName = state?.player?.name || 'Unknown';

      const slotData = {
        id: slotId,
        name: slotName,
        data: saveData,
        saveDate: new Date().toISOString(),
        timestamp: Date.now(),
        gameMode: gameMode,
        playerName: playerName,
        inGameDate: state?.calendar ? 
          `Week ${state.calendar.week}, ${this._getMonthName(state.calendar.month)} Year ${state.calendar.year}` :
          'Week 1, January Year 1'
      };

      await localforage.setItem(`mat_life_save_${slotId}`, slotData);
      this.lastSaveTime = Date.now();
      this.currentSaveSlot = slotId;

      await this._updateSlotMetadata(slotId, slotData);

      console.log(`Game saved to slot: ${slotName}`);
      return true;
    } catch (error) {
      console.error('Error saving to slot:', error);
      return false;
    }
  }

  /**
   * Loads from a specific slot
   * @param {string} slotId - Slot ID to load
   * @returns {Promise<boolean>} True if successful
   */
  async loadFromSlot(slotId) {
    try {
      if (typeof localforage === 'undefined') {
        console.warn('localforage not available; skipping load');
        return false;
      }
      const slotData = await localforage.getItem(`mat_life_save_${slotId}`);
      if (!slotData || !slotData.data) {
        console.log('No save found in slot');
        return false;
      }

      const success = this.deserializeState(slotData.data);
      if (success) {
        console.log(`Game loaded from slot: ${slotData.name}`);
        this.currentSaveSlot = slotId;
        await this.checkAndUpdateRosters();
      }
      return success;
    } catch (error) {
      console.error('Error loading from slot:', error);
      return false;
    }
  }

  /**
   * Deletes a save slot
   * @param {string} slotId - Slot ID to delete
   * @returns {Promise<boolean>} True if successful
   */
  async deleteSlot(slotId) {
    try {
      if (typeof localforage === 'undefined') {
        return false;
      }
      await localforage.removeItem(`mat_life_save_${slotId}`);
      await this._removeSlotMetadata(slotId);
      console.log(`Save slot deleted: ${slotId}`);
      return true;
    } catch (error) {
      console.error('Error deleting slot:', error);
      return false;
    }
  }

  /**
   * Gets save info for a specific slot
   * @param {string} slotId - Slot ID
   * @returns {Promise<object|null>}
   */
  async getSlotInfo(slotId) {
    try {
      if (typeof localforage === 'undefined') {
        return null;
      }
      const slotData = await localforage.getItem(`mat_life_save_${slotId}`);
      if (!slotData) return null;

      return {
        id: slotData.id,
        name: slotData.name,
        saveDate: slotData.saveDate,
        timestamp: slotData.timestamp,
        gameMode: slotData.gameMode,
        playerName: slotData.playerName,
        inGameDate: slotData.inGameDate
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets the current save slot ID
   * @returns {string|null}
   */
  getCurrentSaveSlot() {
    return this.currentSaveSlot;
  }

  /**
   * Updates slot metadata in the slots list
   * @private
   */
  async _updateSlotMetadata(slotId, slotData) {
    const slots = await this.getAllSaves();
    const existingIndex = slots.findIndex(s => s.id === slotId);
    
    const metadata = {
      id: slotId,
      name: slotData.name,
      saveDate: slotData.saveDate,
      timestamp: slotData.timestamp,
      gameMode: slotData.gameMode,
      playerName: slotData.playerName,
      inGameDate: slotData.inGameDate
    };

    if (existingIndex >= 0) {
      slots[existingIndex] = metadata;
    } else {
      if (slots.length >= MAX_SAVE_SLOTS) {
        const oldest = slots.reduce((a, b) => a.timestamp < b.timestamp ? a : b);
        await this.deleteSlot(oldest.id);
        const idx = slots.indexOf(oldest);
        if (idx >= 0) slots.splice(idx, 1);
      }
      slots.push(metadata);
    }

    await localforage.setItem(SAVE_SLOTS_KEY, slots);
  }

  /**
   * Removes slot from metadata
   * @private
   */
  async _removeSlotMetadata(slotId) {
    const slots = await this.getAllSaves();
    const filtered = slots.filter(s => s.id !== slotId);
    await localforage.setItem(SAVE_SLOTS_KEY, filtered);
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
   * Saves the game to localforage (legacy single save)
   * @returns {Promise<boolean>} True if successful
   */
  async save() {
    const slotId = this.currentSaveSlot || `save_${Date.now()}`;
    const slotName = this.currentSaveSlot ? (await this.getSlotInfo(slotId))?.name : 'Main Save';
    return this.saveToSlot(slotId, slotName || 'Main Save');
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
      
      // Handle both raw saves (dev snapshots) and wrapped saves (slots)
      const actualData = saveData.data || saveData;
      return this.deserializeState(actualData);
    } catch (error) {
      console.error('Error loading snapshot:', error);
      return false;
    }
  }

  /**
   * Loads the game from localforage (legacy single save)
   * @returns {Promise<boolean>} True if successful
   */
  async load() {
    const slots = await this.getAllSaves();
    if (slots.length > 0) {
      const latestSlot = slots.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
      return this.loadFromSlot(latestSlot.id);
    }
    return false;
  }

  /**
   * Checks if any save exists
   * @returns {Promise<boolean>}
   */
  async hasSave() {
    const slots = await this.getAllSaves();
    return slots.length > 0;
  }

  /**
   * Deletes the current save
   * @returns {Promise<boolean>}
   */
  async deleteSave() {
    if (this.currentSaveSlot) {
      return this.deleteSlot(this.currentSaveSlot);
    }
    return false;
  }

  /**
   * Gets save metadata (legacy)
   * @returns {Promise<object|null>}
   */
  async getSaveInfo() {
    const slots = await this.getAllSaves();
    if (slots.length > 0) {
      const latestSlot = slots.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
      return {
        version: '1.0.0',
        saveDate: latestSlot.saveDate,
        timestamp: latestSlot.timestamp,
        playerName: latestSlot.playerName || 'Unknown',
        inGameDate: latestSlot.inGameDate || 'Unknown',
        gameMode: latestSlot.gameMode
      };
    }
    return null;
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
