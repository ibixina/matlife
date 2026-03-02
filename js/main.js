/**
 * Main Entry Point for Mat Life: Wrestling Simulator
 * Step 2.9 of Implementation Plan
 */

import { gameStateManager } from './core/GameStateManager.js';
import uiManager from './ui/UIManager.js';
import CharacterCreation from './ui/CharacterCreation.js';
import eventManager from './engine/EventManager.js';

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

    // Initialize GameStateManager
    gameStateManager.initializeState();

    // Initialize UIManager
    uiManager.init();

    // Load JSON data
    await this.loadData();

    // Initialize character creation
    this.characterCreation = new CharacterCreation(uiManager);
    this.characterCreation.init();

    // Show character creation screen
    uiManager.showScreen('character-creation');

    console.log('Mat Life: Ready!');
  }

  /**
   * Loads JSON data files
   * @private
   */
  async loadData() {
    try {
      // Load event templates
      const eventsResponse = await fetch('./js/data/events.json');
      if (eventsResponse.ok) {
        const eventTemplates = await eventsResponse.json();
        eventManager.loadTemplates(eventTemplates);
        console.log(`Loaded ${eventTemplates.length} event templates`);
      }

      // Load moves data (for future use)
      const movesResponse = await fetch('./js/data/moves.json');
      if (movesResponse.ok) {
        const moves = await movesResponse.json();
        console.log(`Loaded ${moves.length} moves`);
        // Store for later use
        window.gameData = window.gameData || {};
        window.gameData.moves = moves;
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
