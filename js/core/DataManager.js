/**
 * DataManager - Centralized data loading and access
 * Manages all static game data files
 */
class DataManager {
  constructor() {
    this.data = {
      moves: null,
      realLife: null,
      narratives: null,
      events: null
    };
    this.loaded = false;
  }

  /**
   * Loads all game data files
   * @returns {Promise<boolean>} success
   */
  async loadAll() {
    try {
      await Promise.all([
        this.loadMoves(),
        this.loadRealLife(),
        this.loadNarratives()
      ]);
      this.loaded = true;
      console.log('DataManager: All data loaded successfully');
      return true;
    } catch (error) {
      console.error('DataManager: Failed to load data:', error);
      return false;
    }
  }

  /**
   * Load moves data
   * @private
   */
  async loadMoves() {
    const response = await fetch('./js/data/moves.json');
    if (response.ok) {
      this.data.moves = await response.json();
      console.log(`DataManager: Loaded ${this.data.moves.length} moves`);
    }
  }

  /**
   * Load real-life data (promotions, wrestlers)
   * @private
   */
  async loadRealLife() {
    const response = await fetch('./js/data/real_life.json');
    if (response.ok) {
      this.data.realLife = await response.json();
      console.log(`DataManager: Loaded real-life data: ${this.data.realLife.promotions?.length || 0} promotions`);
    }
  }

  /**
   * Load narratives data
   * @private
   */
  async loadNarratives() {
    const response = await fetch('./js/data/narratives.json');
    if (response.ok) {
      this.data.narratives = await response.json();
      console.log('DataManager: Loaded narratives data');
    }
  }

  /**
   * Get moves data
   * @returns {Array|null}
   */
  getMoves() {
    return this.data.moves;
  }

  /**
   * Get real-life data
   * @returns {Object|null}
   */
  getRealLife() {
    return this.data.realLife;
  }

  /**
   * Get narratives data
   * @returns {Object|null}
   */
  getNarratives() {
    return this.data.narratives;
  }

  /**
   * Get specific narrative by key
   * @param {string} key - Narrative key
   * @returns {Array|null}
   */
  getNarrative(key) {
    return this.data.narratives?.[key] || null;
  }

  /**
   * Get a random narrative from a category
   * @param {string} key - Narrative key
   * @returns {string|null}
   */
  getRandomNarrative(key) {
    const narratives = this.data.narratives?.[key];
    if (!narratives || narratives.length === 0) return null;
    return narratives[Math.floor(Math.random() * narratives.length)];
  }

  /**
   * Check if data is loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }
}

// Export singleton instance
export const dataManager = new DataManager();
export default dataManager;
