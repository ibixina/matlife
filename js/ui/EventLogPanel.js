/**
 * EventLogPanel for Mat Life: Wrestling Simulator
 * Step 2.5 of Implementation Plan
 * Left panel with scrollable narrative log
 */

/**
 * EventLogPanel - Renders the event log
 */
export class EventLogPanel {
  constructor() {
    this.container = document.getElementById('log-container');
    this.maxEntries = 100;
    this.lastRenderedCount = 0;
    this.lastRenderedId = null;
  }

  /**
   * Renders the event log
   * @param {object} state - Current game state
   */
  render(state, actionType = null, payload = null) {
    if (!state || !state.history) {
      return;
    }

    // Fast path: append any entries added since last render.
    // UIManager coalesces updates per frame, so multiple ADD_LOG_ENTRY
    // actions can arrive as one render call.
    if (actionType === 'ADD_LOG_ENTRY' && this.container) {
      const entries = state.history.slice(-this.maxEntries);

      if (this.lastRenderedCount > 0 && entries.length >= this.lastRenderedCount) {
        const newEntries = entries.slice(this.lastRenderedCount);

        if (newEntries.length > 0) {
          newEntries.forEach(entry => this.addEntry(entry));
          this.lastRenderedCount = entries.length;
          this.lastRenderedId = entries[entries.length - 1]?.id ?? null;
          return;
        }
      } else if (this.lastRenderedCount === 0 && entries.length === 1) {
        // Fresh panel with exactly one entry can still use incremental add.
        this.addEntry(entries[0]);
        this.lastRenderedCount = 1;
        this.lastRenderedId = entries[0]?.id ?? null;
        return;
      }
    }

    // Get last 100 entries
    const entries = state.history.slice(-this.maxEntries);
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
      
      // Render entries
      entries.forEach(entry => {
        this.renderEntry(entry);
      });

      // Scroll to bottom
      this.scrollToBottom();
    }

    this.lastRenderedCount = entries.length;
    this.lastRenderedId = entries.length ? entries[entries.length - 1].id : null;
  }

  /**
   * Adds a single entry to the log
   * @param {object} entry - Log entry
   */
  addEntry(entry) {
    if (!this.container) {
      return;
    }

    this.renderEntry(entry);
    this.scrollToBottom();

    // Remove old entries if exceeding max
    while (this.container.children.length > this.maxEntries) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  /**
   * Renders a single log entry
   * @private
   * @param {object} entry - Log entry
   */
  renderEntry(entry) {
    if (!this.container) {
      return;
    }

    const entryEl = document.createElement('div');
    entryEl.className = `log-entry ${entry.category || 'system'}`;

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'log-timestamp';
    
    if (entry.timestamp) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const day = days[entry.timestamp.day] || 'Day';
      timestamp.textContent = day;
    } else {
      timestamp.textContent = 'Now';
    }

    // Text
    const text = document.createElement('div');
    text.className = 'log-text';
    text.textContent = entry.text || entry.message || 'Unknown event';

    entryEl.appendChild(timestamp);
    entryEl.appendChild(text);
    this.container.appendChild(entryEl);
  }

  /**
   * Scrolls the log to the bottom
   * @private
   */
  scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /**
   * Clears all log entries
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default EventLogPanel;
