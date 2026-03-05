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

    // Check for existing save
    const hasSave = await saveLoadManager.hasSave();

    if (hasSave) {
      // Show continue/new game options
      this.showContinueOptions();
    } else {
      // No save - show character creation
      this.showCharacterCreation();
    }

    console.log('Mat Life: Ready!');
  }

  /**
   * Shows continue/new game options
   * @private
   */
  showContinueOptions() {
    const creationScreen = document.getElementById('character-creation');

    // Add continue section to character creation screen
    const continueSection = document.createElement('div');
    continueSection.id = 'continue-section';
    continueSection.className = 'creation-container';
    continueSection.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-primary); z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center;';
    continueSection.innerHTML = `
      <header class="creation-header">
        <h1>Mat Life</h1>
        <p class="subtitle">Professional Wrestling Career Simulator</p>
      </header>
      <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem;">
        <button id="continue-game-btn" class="btn btn-primary btn-large" style="min-width: 250px;">
          Continue Career
        </button>
        <button id="new-game-btn" class="btn btn-secondary btn-large" style="min-width: 250px;">
          New Career
        </button>
      </div>
    `;

    creationScreen.appendChild(continueSection);

    // Continue button
    document.getElementById('continue-game-btn')?.addEventListener('click', async () => {
      const success = await saveLoadManager.load();
      if (success) {
        continueSection.remove();
        uiManager.showScreen('game-screen');
        uiManager.render(gameStateManager.getStateRef());
      } else {
        alert('Failed to load save. Starting new game.');
        continueSection.remove();
        this.showCharacterCreation();
      }
    });

    // New game button
    document.getElementById('new-game-btn')?.addEventListener('click', () => {
      continueSection.remove();
      this.showCharacterCreation();
    });
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new MatLifeApp();
  app.init();
});

// Export for testing
export { MatLifeApp };
