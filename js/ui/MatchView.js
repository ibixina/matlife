/**
 * MatchView for Mat Life: Wrestling Simulator
 * Step 3.5 of Implementation Plan
 * Match play-by-play display and controls
 */

import { gameStateManager } from '../core/GameStateManager.js';
import MatchSimulator from '../engine/MatchSimulator.js';

/**
 * MatchView - UI for match simulation
 */
export class MatchView {
  constructor() {
    this.simulator = new MatchSimulator();
    this.container = null;
    this.currentMatch = null;
    this.playerSide = 'wrestler1';
  }

  /**
   * Shows the match view
   * @param {object} matchConfig - Match configuration
   * @param {HTMLElement} container - Container element
   */
  show(matchConfig, container) {
    this.container = container;
    this.config = matchConfig;
    this.playerSide = matchConfig.playerSide || 'wrestler1';

    // Clear container
    container.innerHTML = '';

    // Start match
    this.currentMatch = this.simulator.startMatch(matchConfig);

    // Build UI
    this.buildMatchUI();

    // Initial render
    this.updateDisplay();
  }

  /**
   * Builds the match UI
   * @private
   */
  buildMatchUI() {
    // Match container
    const matchContainer = document.createElement('div');
    matchContainer.className = 'match-view';
    matchContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 1rem;
    `;

    // Wrestler summaries (top)
    const wrestlerSummary = document.createElement('div');
    wrestlerSummary.className = 'wrestler-summary';
    wrestlerSummary.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    `;

    wrestlerSummary.innerHTML = `
      <div class="panel" id="wrestler1-status">
        <h4 id="w1-name">Wrestler 1</h4>
        <p style="margin: 0.25rem 0; color: var(--text-secondary);">Avg In-Ring</p>
        <div style="font-size: 1.5rem; font-weight: 700;" id="w1-avg">0</div>
      </div>
      <div class="panel" id="wrestler2-status">
        <h4 id="w2-name">Wrestler 2</h4>
        <p style="margin: 0.25rem 0; color: var(--text-secondary);">Avg In-Ring</p>
        <div style="font-size: 1.5rem; font-weight: 700;" id="w2-avg">0</div>
      </div>
    `;

    matchContainer.appendChild(wrestlerSummary);

    // Title indicator (if applicable)
    if (this.config?.isTitleMatch && this.config?.titleId) {
      const state = gameStateManager.getStateRef();
      const title = state.championships.get(this.config.titleId);
      if (title) {
        const titleHeader = document.createElement('div');
        titleHeader.style.cssText = `
          text-align: center;
          padding: 0.25rem;
          background: var(--accent-primary);
          color: black;
          font-weight: bold;
          font-size: 0.75rem;
          margin-bottom: -0.5rem;
          z-index: 1;
        `;
        titleHeader.textContent = `🏆 TITLE MATCH: ${title.name.toUpperCase()} 🏆`;
        matchContainer.appendChild(titleHeader);
      }
    }

    // Match info
    const matchInfo = document.createElement('div');
    matchInfo.id = 'match-info';
    matchInfo.style.cssText = `
      text-align: center;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      font-weight: 600;
    `;
    matchInfo.innerHTML = `
      <div id="match-type">Match Type</div>
      <div id="match-synergy" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;"></div>
    `;
    matchContainer.appendChild(matchInfo);

    // Play-by-play log
    const playByPlay = document.createElement('div');
    playByPlay.id = 'play-by-play';
    playByPlay.className = 'play-by-play';
    playByPlay.style.cssText = `
      flex: 1;
      overflow-y: auto;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 1rem;
      font-size: 0.9rem;
      line-height: 1.6;
    `;
    matchContainer.appendChild(playByPlay);

    // Results panel
    const results = document.createElement('div');
    results.id = 'match-results';
    results.className = 'panel';
    results.style.display = 'none';
    matchContainer.appendChild(results);

    // Control buttons
    const controls = document.createElement('div');
    controls.className = 'match-controls';
    controls.style.cssText = `
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    `;

    // Win button
    const winBtn = document.createElement('button');
    winBtn.id = 'match-win-btn';
    winBtn.className = 'btn btn-primary';
    winBtn.textContent = 'Win Match';
    winBtn.addEventListener('click', () => this.resolveOutcome(true));
    controls.appendChild(winBtn);

    // Lose button
    const loseBtn = document.createElement('button');
    loseBtn.id = 'match-lose-btn';
    loseBtn.className = 'btn';
    loseBtn.textContent = 'Lose Match';
    loseBtn.addEventListener('click', () => this.resolveOutcome(false));
    controls.appendChild(loseBtn);

    // Continue button (for after match)
    const continueBtn = document.createElement('button');
    continueBtn.id = 'match-continue-btn';
    continueBtn.className = 'btn btn-primary hidden';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => this.endMatch());
    controls.appendChild(continueBtn);

    matchContainer.appendChild(controls);

    this.container.appendChild(matchContainer);
  }

  /**
   * Updates the display
   * @private
   */
  updateDisplay() {
    const state = this.simulator.getPublicState();

    // Update wrestler names
    document.getElementById('w1-name').textContent = state.wrestler1.name;
    document.getElementById('w2-name').textContent = state.wrestler2.name;

    // Update stat summaries
    document.getElementById('w1-avg').textContent = state.wrestler1.avgInRing;
    document.getElementById('w2-avg').textContent = state.wrestler2.avgInRing;

    // Update match info
    const matchTypeEl = document.getElementById('match-type');
    if (matchTypeEl) {
      matchTypeEl.textContent = this.config?.matchType || 'Standard Singles';
    }
    const synergyEl = document.getElementById('match-synergy');
    if (synergyEl) {
      const bonus = state.synergy?.bonus || 0;
      const styleBonus = state.synergy?.styleBonus || 0;
      const alignmentBonus = state.synergy?.alignmentBonus || 0;
      const styleLabel = state.synergy?.style1 && state.synergy?.style2
        ? `${state.synergy.style1} vs ${state.synergy.style2}`
        : 'Unknown styles';
      const alignmentLabel = state.synergy?.alignment1 && state.synergy?.alignment2
        ? `${state.synergy.alignment1} vs ${state.synergy.alignment2}`
        : 'Unknown alignments';
      const totalLabel = bonus >= 0 ? `+${bonus.toFixed(2)}` : bonus.toFixed(2);
      const styleBonusLabel = styleBonus >= 0 ? `+${styleBonus.toFixed(2)}` : styleBonus.toFixed(2);
      const alignmentBonusLabel = alignmentBonus >= 0 ? `+${alignmentBonus.toFixed(2)}` : alignmentBonus.toFixed(2);
      synergyEl.textContent = `${styleLabel} (${styleBonusLabel}), ${alignmentLabel} (${alignmentBonusLabel}) → total ${totalLabel}`;
    }

    // Update play-by-play
    this.updatePlayByPlay(state.log);

    if (state.finished) {
      this.showMatchEnd(state);
    } else {
      this.showMatchChoice();
    }
  }

  /**
   * Updates play-by-play log
   * @private
   */
  updatePlayByPlay(logEntries) {
    const container = document.getElementById('play-by-play');
    if (!container) return;

    container.innerHTML = logEntries.map(entry => {
      const turnLabel = entry.turn ? `<span style="color: var(--text-muted);">[Turn ${entry.turn}]</span> ` : '';
      return `<div style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm);">${turnLabel}${entry.text}</div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  showMatchChoice() {
    const results = document.getElementById('match-results');
    if (results) {
      results.style.display = 'none';
      results.innerHTML = '';
    }

    const winBtn = document.getElementById('match-win-btn');
    const loseBtn = document.getElementById('match-lose-btn');
    if (winBtn) winBtn.classList.remove('hidden');
    if (loseBtn) loseBtn.classList.remove('hidden');
  }

  resolveOutcome(playerWins) {
    const winnerSide = playerWins
      ? this.playerSide
      : (this.playerSide === 'wrestler1' ? 'wrestler2' : 'wrestler1');

    const result = this.simulator.resolveMatch(winnerSide);
    if (result?.error) {
      console.error(result.error);
      return;
    }

    this.updateDisplay();
  }

  /**
   * Shows match end screen
   * @private
   */
  showMatchEnd(state) {
    const container = document.getElementById('match-results');
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `
        <div style="text-align: center; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-lg);">
          <h3 style="color: var(--accent-secondary); margin-bottom: 0.5rem;">Match Over!</h3>
          <p style="font-size: 1.2rem;">Winner: ${state.winner}</p>
          <p style="color: var(--text-secondary);">Match Rating: ${state.matchRating.toFixed(1)} stars</p>
        </div>
      `;
    }

    // Show continue button
    const continueBtn = document.getElementById('match-continue-btn');
    if (continueBtn) {
      continueBtn.classList.remove('hidden');
    }

    // Hide outcome buttons
    const winBtn = document.getElementById('match-win-btn');
    const loseBtn = document.getElementById('match-lose-btn');
    if (winBtn) winBtn.classList.add('hidden');
    if (loseBtn) loseBtn.classList.add('hidden');
  }

  /**
   * Ends the match and returns to game
   * @private
   */
  endMatch() {
    // Dispatch event to return to normal game flow
    const winnerSide = this.simulator.matchState.winner;
    const winnerEntity = this.simulator.matchState[winnerSide]?.entity;
    const winnerName = winnerEntity?.getComponent('identity')?.name || 'Unknown';
    const event = new CustomEvent('matchEnded', {
      detail: {
        winnerSide,
        winnerEntityId: winnerEntity?.id || null,
        winnerName,
        rating: this.simulator.matchState.matchRating
      }
    });
    document.dispatchEvent(event);
  }
}

export default MatchView;
