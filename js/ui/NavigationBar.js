/**
 * NavigationBar for Mat Life: Wrestling Simulator
 * Step 2.7 of Implementation Plan
 * Bottom tab bar for navigation
 */

/**
 * NavigationBar - Renders the bottom navigation bar
 */
export class NavigationBar {
  constructor() {
    this.container = document.getElementById("nav-bar");
    this.uiManager = null;
  }

  /**
   * Initializes the navigation bar
   * @param {UIManager} uiManager - UI manager instance
   */
  init(uiManager) {
    this.uiManager = uiManager;

    if (!this.container) {
      return;
    }

    // Add click handlers to nav buttons
    const buttons = this.container.querySelectorAll(".nav-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tabName = btn.dataset.tab;
        if (tabName && this.uiManager) {
          this.uiManager.switchTab(tabName);
        }
      });
    });
  }

  /**
   * Sets the active tab
   * @param {string} tabName - Tab name to activate
   */
  setActiveTab(tabName) {
    if (!this.container) {
      return;
    }

    // Remove active from all tabs
    const buttons = this.container.querySelectorAll(".nav-btn");
    buttons.forEach((btn) => {
      btn.classList.remove("active");
    });

    // Add active to selected tab
    const activeBtn = this.container.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }
  }

  /**
   * Renders the navigation bar
   */
  render() {
    // Navigation bar is static HTML, just ensure proper state
    this.setActiveTab("match");
  }

  /**
   * Updates labels/icons based on game mode.
   * @param {string} mode
   */
  setMode(mode = "WRESTLER") {
    if (!this.container) return;

    const configs =
      mode === "BOOKER"
        ? {
            match: { icon: "📊", label: "Dashboard" },
            backstage: { icon: "🧾", label: "Roster" },
            actions: { icon: "🎬", label: "Creative" },
            people: { icon: "🔎", label: "Market" },
            career: { icon: "🏢", label: "Office" },
          }
        : {
            match: { icon: "🤼", label: "Match/Promo" },
            backstage: { icon: "🚪", label: "Backstage" },
            actions: { icon: "⚡", label: "Actions" },
            people: { icon: "👥", label: "People" },
            career: { icon: "⭐", label: "Career" },
          };

    Object.entries(configs).forEach(([tab, config]) => {
      const button = this.container.querySelector(`[data-tab="${tab}"]`);
      if (!button) return;
      const icon = button.querySelector(".nav-icon");
      const label = button.querySelector(".nav-label");
      if (icon) icon.textContent = config.icon;
      if (label) label.textContent = config.label;
    });
  }
}

export default NavigationBar;
