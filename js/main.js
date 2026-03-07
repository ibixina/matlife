/**
 * Main Entry Point for Mat Life: Wrestling Simulator
 * Step 2.9 of Implementation Plan
 */

import { gameStateManager } from './core/GameStateManager.js';
import uiManager from './ui/UIManager.js';
import CharacterCreation from './ui/CharacterCreation.js';
import eventManager from './engine/EventManager.js';
import { saveLoadManager } from './engine/SaveLoadManager.js';
import DevPanel from './ui/DevPanel.js';
import { dataManager } from './core/DataManager.js';

/**
 * Main Application Class
 */
class MatLifeApp {
  constructor() {
    this.characterCreation = null;
  }

  /**
   * Initializes the application
   */
  async init() {
    console.log('Mat Life: Wrestling Simulator - Initializing...');

    // Initialize UIManager
    uiManager.init();

    // Load JSON data
    await this.loadData();

    const isDevRoute = window.location.pathname.endsWith('/dev') || window.location.hash === '#/dev';
    if (isDevRoute) {
      uiManager.showScreen('dev-screen');
      const devPanel = new DevPanel();
      devPanel.init();
      return;
    }

    // Show save selection screen
    this.showSaveSelectionScreen();

    console.log('Mat Life: Ready!');
  }

  /**
   * Shows the save selection screen with all saves
   * @private
   */
  async showSaveSelectionScreen() {
    const creationScreen = document.getElementById('character-creation');
    const saves = await saveLoadManager.getAllSaves();

    const selectionContainer = document.createElement('div');
    selectionContainer.id = 'save-selection-screen';
    selectionContainer.className = 'creation-container';
    selectionContainer.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-primary); z-index: 10; display: flex; flex-direction: column;';

    selectionContainer.innerHTML = `
      <header class="creation-header" style="flex-shrink: 0;">
        <h1>Mat Life</h1>
        <p class="subtitle">Professional Wrestling Career Simulator</p>
      </header>
      <div style="flex: 1; display: flex; gap: 2rem; padding: 1rem 2rem; overflow: hidden;">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <h2 style="margin-bottom: 1rem; color: var(--text-primary);">Save Files</h2>
          <div id="save-slots-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;">
            ${saves.length === 0 ? '<p style="color: var(--text-secondary);">No save files found</p>' : ''}
          </div>
          <button id="new-save-btn" class="btn btn-primary btn-large" style="margin-top: 1rem;">
            + New Career
          </button>
        </div>
        <div style="flex: 1; border-left: 1px solid var(--border-color); padding-left: 2rem; display: flex; flex-direction: column;">
          <h2 style="margin-bottom: 1rem; color: var(--text-primary);">Quick Start</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">
            Select an existing save to continue your career, or create a new one.
          </p>
          <div id="save-details" style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            <p>Select a save to view details</p>
          </div>
        </div>
      </div>
    `;

    creationScreen.appendChild(selectionContainer);

    // Render save slots
    this._renderSaveSlots(saves);

    // New save button
    document.getElementById('new-save-btn')?.addEventListener('click', () => {
      selectionContainer.remove();
      this.showCharacterCreationWithSave();
    });
  }

  /**
   * Shows character creation and prompts for save name after creation
   * @private
   */
  async showCharacterCreationWithSave() {
    const saveName = await this._promptSaveName();
    const slotId = `save_${Date.now()}`;

    const onCareerStart = async () => {
      await saveLoadManager.saveToSlot(slotId, saveName);
      uiManager.showScreen('game-screen');
      uiManager.render(gameStateManager.getStateRef());
    };

    this.characterCreation = new CharacterCreation(uiManager, onCareerStart);
    this.characterCreation.init();
    uiManager.showScreen('character-creation');
  }

  /**
   * Prompts for a save name
   * @private
   */
  _promptSaveName() {
    return new Promise((resolve) => {
      const name = prompt('Enter a name for your save:', `Career ${new Date().toLocaleDateString()}`);
      resolve(name || `Career ${new Date().toLocaleDateString()}`);
    });
  }

  /**
   * Renders save slots
   * @private
   */
  _renderSaveSlots(saves) {
    const container = document.getElementById('save-slots-container');
    if (!container) return;

    container.innerHTML = '';

    const sortedSaves = [...saves].sort((a, b) => b.timestamp - a.timestamp);

    sortedSaves.forEach(save => {
      const slotEl = document.createElement('div');
      slotEl.className = 'save-slot';
      slotEl.style.cssText = `
        padding: 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      `;

      const modeLabel = save.gameMode === 'BOOKER' ? 'Booker' : 'Wrestler';
      const modeClass = save.gameMode === 'BOOKER' ? 'mode-booker' : 'mode-wrestler';

      slotEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: bold; color: var(--text-primary);">${this._escapeHtml(save.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${save.playerName || 'Unknown'}</div>
          </div>
          <span class="${modeClass}" style="
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            background: ${save.gameMode === 'BOOKER' ? 'var(--accent-booker)' : 'var(--accent-wrestler)'};
            color: white;
          ">${modeLabel}</span>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
          <div>${save.inGameDate || 'Week 1'}</div>
          <div>${this._formatDate(save.saveDate)}</div>
        </div>
      `;

      slotEl.addEventListener('click', () => {
        this._selectSaveSlot(save, slotEl);
      });

      container.appendChild(slotEl);
    });

    if (saves.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No save files found</p>';
    }
  }

  /**
   * Handles save slot selection
   * @private
   */
  async _selectSaveSlot(save, slotEl) {
    // Highlight selected slot
    document.querySelectorAll('.save-slot').forEach(el => {
      el.style.borderColor = 'var(--border-color)';
      el.style.background = 'var(--bg-secondary)';
    });
    slotEl.style.borderColor = 'var(--accent-primary)';
    slotEl.style.background = 'var(--bg-hover)';

    // Update details panel
    const detailsEl = document.getElementById('save-details');
    if (detailsEl) {
      const modeLabel = save.gameMode === 'BOOKER' ? 'Booking Mode' : 'Wrestling Mode';
      const modeDesc = save.gameMode === 'BOOKER' 
        ? 'Manage your wrestling promotion, book matches, and build stars.'
        : 'Live your life as a professional wrestler, training and competing.';

      detailsEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
          <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">${this._escapeHtml(save.name)}</h3>
          <p style="color: var(--accent-primary); font-weight: bold; margin-bottom: 1rem;">${modeLabel}</p>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">${modeDesc}</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="continue-save-btn" class="btn btn-primary">Continue</button>
            <button id="delete-save-btn" class="btn btn-danger">Delete</button>
          </div>
        </div>
      `;

      // Continue button
      document.getElementById('continue-save-btn')?.addEventListener('click', async () => {
        const success = await saveLoadManager.loadFromSlot(save.id);
        if (success) {
          const screen = document.getElementById('save-selection-screen');
          if (screen) screen.remove();
          uiManager.showScreen('game-screen');
          uiManager.render(gameStateManager.getStateRef());
        } else {
          alert('Failed to load save.');
        }
      });

      // Delete button
      document.getElementById('delete-save-btn')?.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete "${save.name}"? This cannot be undone.`)) {
          await saveLoadManager.deleteSlot(save.id);
          const saves = await saveLoadManager.getAllSaves();
          this._renderSaveSlots(saves);
          detailsEl.innerHTML = '<p>Select a save to view details</p>';
        }
      });
    }
  }

  /**
   * Shows character creation screen
   * @private
   */
  showCharacterCreation() {
    // Initialize character creation
    this.characterCreation = new CharacterCreation(uiManager);
    this.characterCreation.init();

    // Show character creation screen
    uiManager.showScreen('character-creation');
  }

  /**
   * Loads JSON data files
   * @private
   */
  async loadData() {
    try {
      // Load all data through DataManager
      await dataManager.loadAll();

      // Load event templates separately (not managed by DataManager)
      const eventsResponse = await fetch('./js/data/events.json');
      if (eventsResponse.ok) {
        const eventTemplates = await eventsResponse.json();
        eventManager.loadTemplates(eventTemplates);
        console.log(`Loaded ${eventTemplates.length} event templates`);
      }

    } catch (error) {
      console.warn('Could not load some data files:', error);
      // Continue without data - game will use defaults
    }
  }

  /**
   * Formats date for display
   * @private
   */
  _formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Escapes HTML for safe display
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new MatLifeApp();
  app.init();
});

// Export for testing
export { MatLifeApp };
