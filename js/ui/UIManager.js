/**
 * UIManager for Mat Life: Wrestling Simulator
 * Step 2.3 of Implementation Plan
 * Master renderer and tab switching
 */

import { gameStateManager } from "../core/GameStateManager.js";
import { gameCalendar } from "../core/GameCalendar.js";
import { saveLoadManager } from "../engine/SaveLoadManager.js";
import BookerModeEngine from "../engine/BookerModeEngine.js";
import PlayerInfoPanel from "./PlayerInfoPanel.js";
import EventLogPanel from "./EventLogPanel.js";
import ActionPanel from "./ActionPanel.js";
import NavigationBar from "./NavigationBar.js";

/**
 * UIManager - Master UI controller
 */
export class UIManager {
  constructor() {
    this.currentTab = "match";
    this.unsubscribe = null;
    this.renderScheduled = false;
    this.lastRenderState = null;
    this.lastRenderAction = null;
    this.lastRenderPayload = null;
    this.panels = {
      playerInfo: new PlayerInfoPanel(),
      eventLog: new EventLogPanel(),
      actionPanel: new ActionPanel(),
      navigationBar: new NavigationBar(),
    };
  }

  /**
   * Initializes the UI manager
   */
  init() {
    // Subscribe to state changes
    this.unsubscribe = gameStateManager.subscribe(
      (actionType, payload, state) => {
        this.lastRenderState = state;
        this.lastRenderAction = actionType;
        this.lastRenderPayload = payload;

        if (!this.renderScheduled) {
          this.renderScheduled = true;
          requestAnimationFrame(() => {
            this.renderScheduled = false;
            this.render(
              this.lastRenderState,
              this.lastRenderAction,
              this.lastRenderPayload,
            );
          });
        }
      },
    );

    // Initialize panels
    this.panels.navigationBar.init(this);

    // Setup menu controls
    this.setupMenuControls();
  }

  /**
   * Sets up menu and save/load controls
   * @private
   */
  setupMenuControls() {
    // Menu button
    const menuBtn = document.getElementById("menu-btn");
    const menuModal = document.getElementById("menu-modal");
    const closeMenuBtn = document.getElementById("close-menu");

    if (menuBtn && menuModal) {
      menuBtn.addEventListener("click", () => {
        menuModal.classList.remove("hidden");
        this.updateSaveStatus();
      });

      closeMenuBtn?.addEventListener("click", () => {
        menuModal.classList.add("hidden");
      });

      // Close on backdrop click
      menuModal.addEventListener("click", (e) => {
        if (e.target === menuModal) {
          menuModal.classList.add("hidden");
        }
      });
    }

    // Save button
    const saveBtn = document.getElementById("save-game-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const success = await saveLoadManager.save();
        this.showSaveStatus(
          success ? "Game saved successfully!" : "Failed to save game.",
          success,
        );
      });
    }

    // Load button
    const loadBtn = document.getElementById("load-game-btn");
    if (loadBtn) {
      loadBtn.addEventListener("click", async () => {
        const success = await saveLoadManager.load();
        if (success) {
          this.showSaveStatus("Game loaded successfully!", true);
          this.showScreen("game-screen");
          this.render(gameStateManager.getStateRef());
          // Update NSFW toggle based on loaded settings
          const nsfwToggle = document.getElementById("nsfw-toggle");
          if (nsfwToggle) {
            nsfwToggle.checked =
              gameStateManager.getStateRef()?.settings?.nsfwContent ?? true;
          }
        } else {
          this.showSaveStatus("No save found or failed to load.", false);
        }
      });
    }

    // Delete button
    const deleteBtn = document.getElementById("delete-save-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (
          confirm(
            "Are you sure you want to delete your save? This cannot be undone.",
          )
        ) {
          const success = await saveLoadManager.deleteSave();
          this.showSaveStatus(
            success ? "Save deleted." : "Failed to delete save.",
            success,
          );
        }
      });
    }

    // NSFW toggle
    const nsfwToggle = document.getElementById("nsfw-toggle");
    if (nsfwToggle) {
      // Set initial state based on game settings
      const currentSettings = gameStateManager.getStateRef()?.settings;
      nsfwToggle.checked = currentSettings?.nsfwContent ?? true;

      nsfwToggle.addEventListener("change", (e) => {
        const isEnabled = e.target.checked;
        const state = gameStateManager.getStateRef();
        if (state) {
          state.settings.nsfwContent = isEnabled;
          // Re-render to update the action panel
          this.render(state);
        }
      });
    }
  }

  /**
   * Updates save status display
   * @private
   */
  async updateSaveStatus() {
    const saveInfo = await saveLoadManager.getSaveInfo();
    const statusEl = document.getElementById("save-status");

    if (statusEl) {
      if (saveInfo) {
        statusEl.innerHTML = `
          <p><strong>Save Found</strong></p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            ${saveInfo.playerName} - ${saveInfo.inGameDate}<br>
            Saved: ${new Date(saveInfo.timestamp).toLocaleDateString()}
          </p>
        `;
      } else {
        statusEl.innerHTML = "<p>No save found</p>";
      }
    }
  }

  /**
   * Shows a save status message
   * @private
   */
  showSaveStatus(message, success) {
    const statusEl = document.getElementById("save-status");
    if (statusEl) {
      statusEl.innerHTML = `<p style="color: ${success ? "var(--color-health)" : "var(--color-injury)"}">${message}</p>`;

      // Update save info after a brief delay
      setTimeout(() => this.updateSaveStatus(), 1500);
    }
  }

  /**
   * Renders the UI
   * @param {object} state - Current game state
   */
  render(state, actionType = null, payload = null) {
    if (!state) return;
    this.panels.navigationBar.setMode(state.player?.mode || "WRESTLER");
    // Render player info panel
    this.panels.playerInfo.render(state);

    // Render event log panel
    this.panels.eventLog.render(state, actionType, payload);

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
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    // Show requested screen
    const targetScreen = document.getElementById(screenName);
    if (targetScreen) {
      targetScreen.classList.add("active");
    }

    // If showing game screen, trigger full render
    if (screenName === "game-screen") {
      this.render(gameStateManager.getStateRef());
    }
  }

  /**
   * Updates the date display in the header
   * @param {object} state - Current game state
   */
  updateDateDisplay(state) {
    const dateDisplay = document.getElementById("current-date");
    if (dateDisplay && state.calendar) {
      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const day = days[state.calendar.day];
      const month = months[state.calendar.month - 1];

      let dateText = `${day} - Week ${state.calendar.week}, ${month}`;

      // Check if it's a show day for the player
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        if (state.player?.mode === "BOOKER") {
          const promotion = BookerModeEngine.getPlayerPromotion(state);
          const isShowDay = promotion
            ? BookerModeEngine.isCurrentShowDay(promotion, state)
            : false;
          if (isShowDay) {
            dateText += " 📺 BOOKED SHOW TONIGHT!";
            dateDisplay.style.color = "var(--accent-primary)";
          } else {
            dateDisplay.style.color = "";
          }
        } else {
          const contract = player.getComponent("contract");
          if (contract?.promotionId) {
            const promotion = state.promotions.get(contract.promotionId);
            const isShowDay = promotion
              ? gameCalendar.isShowDay(promotion)
              : false;
            if (isShowDay) {
              dateText += " 📺 SHOW DAY!";
              dateDisplay.style.color = "var(--accent-primary)";
            } else {
              dateDisplay.style.color = "";
            }
          }
        }
      }

      dateDisplay.textContent = dateText;
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
