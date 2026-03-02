/**
 * UIManager for Mat Life: Wrestling Simulator
 * Step 2.3 of Implementation Plan
 * Master renderer and tab switching
 */

import { gameStateManager } from '../core/GameStateManager.js';
import PlayerInfoPanel from './PlayerInfoPanel.js';
import EventLogPanel from './EventLogPanel.js';
import ActionPanel from './ActionPanel.js';
import NavigationBar from './NavigationBar.js';

/**
 * UIManager - Master UI controller
 */
export class UIManager {
  constructor() {
    this.currentTab = 'match';
    this.unsubscribe = null;
    this.panels = {
      playerInfo: new PlayerInfoPanel(),
      eventLog: new EventLogPanel(),
      actionPanel: new ActionPanel(),
      navigationBar: new NavigationBar()
    };
  }

  /**
   * Initializes the UI manager
   */
  init() {
    // Subscribe to state changes
    this.unsubscribe = gameStateManager.subscribe((actionType, payload, state) => {
      this.render(state);
    });

    // Initialize panels
    this.panels.navigationBar.init(this);

    // Initial render
    this.render(gameStateManager.getStateRef());
  }

  /**
   * Renders the UI
   * @param {object} state - Current game state
   */
  render(state) {
    // Render player info panel
    this.panels.playerInfo.render(state);

    // Render event log panel
    this.panels.eventLog.render(state);

    // Render action panel with current tab
    this.panels.actionPanel.render(state, this.currentTab);

    // Update current date display
    this.updateDateDisplay(state);
  }

  /**
   * Switches to a different tab
   * @param {string} tabName - Tab name to switch to
   */
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update navigation bar
    this.panels.navigationBar.setActiveTab(tabName);
    
    // Re-render action panel
    this.panels.actionPanel.render(gameStateManager.getStateRef(), tabName);
  }

  /**
   * Shows a specific screen
   * @param {string} screenName - Screen to show ('character-creation' or 'game-screen')
   */
  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show requested screen
    const targetScreen = document.getElementById(screenName);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // If showing game screen, trigger full render
    if (screenName === 'game-screen') {
      this.render(gameStateManager.getStateRef());
    }
  }

  /**
   * Updates the date display in the header
   * @param {object} state - Current game state
   */
  updateDateDisplay(state) {
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay && state.calendar) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const timeSlots = ['Morning', 'Afternoon', 'Evening', 'Night'];
      
      const day = days[state.calendar.day];
      const time = timeSlots[state.calendar.timeOfDay];
      const month = months[state.calendar.month - 1];
      
      dateDisplay.textContent = `${day} ${time} - Week ${state.calendar.week}, ${month}`;
    }
  }

  /**
   * Displays an event to the player
   * @param {object} event - Event to display
   */
  displayEvent(event) {
    this.panels.actionPanel.displayEvent(event);
  }

  /**
   * Adds a log entry to the event log
   * @param {object} entry - Log entry
   */
  addLogEntry(entry) {
    this.panels.eventLog.addEntry(entry);
  }

  /**
   * Destroys the UI manager
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Export singleton instance
export const uiManager = new UIManager();
export default uiManager;
