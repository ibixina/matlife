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

    // Wrestler bars (top)
    const wrestlerBars = document.createElement('div');
    wrestlerBars.className = 'wrestler-bars';
    wrestlerBars.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    `;

    wrestlerBars.innerHTML = `
      <div class="wrestler-status" id="wrestler1-status">
        <h4 id="w1-name">Wrestler 1</h4>
        <div class="match-bar">
          <div class="match-bar-fill" id="w1-stamina" style="width: 100%; background: #ffc857;"></div>
          <span>Stamina</span>
        </div>
        <div class="match-bar">
          <div class="match-bar-fill" id="w1-health" style="width: 100%; background: #4caf50;"></div>
          <span>Health</span>
        </div>
        <div class="match-bar">
          <div class="match-bar-fill" id="w1-momentum" style="width: 0%; background: #e94560;"></div>
          <span>Momentum</span>
        </div>
      </div>
      <div class="wrestler-status" id="wrestler2-status">
        <h4 id="w2-name">Wrestler 2</h4>
        <div class="match-bar">
          <div class="match-bar-fill" id="w2-stamina" style="width: 100%; background: #ffc857;"></div>
          <span>Stamina</span>
        </div>
        <div class="match-bar">
          <div class="match-bar-fill" id="w2-health" style="width: 100%; background: #4caf50;"></div>
          <span>Health</span>
        </div>
        <div class="match-bar">
          <div class="match-bar-fill" id="w2-momentum" style="width: 0%; background: #e94560;"></div>
          <span>Momentum</span>
        </div>
      </div>
    `;

    matchContainer.appendChild(wrestlerBars);

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

    // Phase indicator
    const phaseIndicator = document.createElement('div');
    phaseIndicator.id = 'match-phase';
    phaseIndicator.className = 'match-phase';
    phaseIndicator.style.cssText = `
      text-align: center;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      font-weight: 600;
    `;
    phaseIndicator.textContent = 'Feeling Out Phase';
    matchContainer.appendChild(phaseIndicator);

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

    // Move selection
    const moveSelection = document.createElement('div');
    moveSelection.id = 'move-selection';
    moveSelection.className = 'move-selection';
    matchContainer.appendChild(moveSelection);

    // Control buttons
    const controls = document.createElement('div');
    controls.className = 'match-controls';
    controls.style.cssText = `
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    `;

    // Pin attempt button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'btn btn-primary';
    pinBtn.textContent = 'Attempt Pin';
    pinBtn.addEventListener('click', () => this.attemptPin());
    controls.appendChild(pinBtn);

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

    // Update bars
    document.getElementById('w1-stamina').style.width = `${state.wrestler1.stamina}%`;
    document.getElementById('w1-health').style.width = `${state.wrestler1.health}%`;
    document.getElementById('w1-momentum').style.width = `${state.wrestler1.momentum}%`;

    document.getElementById('w2-stamina').style.width = `${state.wrestler2.stamina}%`;
    document.getElementById('w2-health').style.width = `${state.wrestler2.health}%`;
    document.getElementById('w2-momentum').style.width = `${state.wrestler2.momentum}%`;

    // Update phase
    document.getElementById('match-phase').textContent = `${state.phase} - Turn ${state.turn}`;

    // Update play-by-play
    this.updatePlayByPlay(state.log);

    // Update move selection
    if (!state.finished) {
      this.updateMoveSelection();
    } else {
      this.showMatchEnd(state);
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

  /**
   * Updates move selection buttons
   * @private
   */
  updateMoveSelection() {
    const container = document.getElementById('move-selection');
    if (!container) return;

    container.innerHTML = '';

    // Get available moves for player
    const playerWrestler = this.playerSide === 'wrestler1' ?
      this.simulator.matchState.wrestler1 :
      this.simulator.matchState.wrestler2;

    const moves = this.simulator.getAvailableMoves(playerWrestler.entity);

    if (moves.length === 0) {
      // Load default moves if wrestler has none
      const defaultMoves = this.getDefaultMoves();
      moves.push(...defaultMoves);
    }

    const movesGrid = document.createElement('div');
    movesGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    `;

    moves.forEach(move => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = `
        text-align: left;
        font-size: 0.85rem;
        padding: 0.5rem;
      `;
      btn.innerHTML = `
        <div style="font-weight: 600;">${move.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">
          ${move.type} | Cost: ${move.staminaCost} | DC: ${move.baseDC}
        </div>
      `;
      btn.addEventListener('click', () => this.executeMove(move));
      movesGrid.appendChild(btn);
    });

    container.appendChild(movesGrid);
  }

  /**
   * Gets default moves for wrestlers without movesets
   * @private
   */
  getDefaultMoves() {
    return [
      { id: 'punch', name: 'Punch', type: 'strike', staminaCost: 2, baseDC: 5, damageBase: 3, spectacle: 1 },
      { id: 'bodyslam', name: 'Bodyslam', type: 'grapple', staminaCost: 4, baseDC: 6, damageBase: 5, spectacle: 2 },
      { id: 'dropkick', name: 'Dropkick', type: 'aerial', staminaCost: 3, baseDC: 7, damageBase: 5, spectacle: 2 },
      { id: 'suplex', name: 'Suplex', type: 'grapple', staminaCost: 5, baseDC: 8, damageBase: 7, spectacle: 3 }
    ];
  }

  /**
   * Executes a move
   * @private
   */
  executeMove(move) {
    // Player's turn
    const result = this.simulator.simulateTurn(this.playerSide, move);

    if (result.error) {
      console.error(result.error);
      return;
    }

    this.updateDisplay();

    // AI opponent's turn (if match not finished)
    if (!this.simulator.matchState.finished) {
      setTimeout(() => this.executeAIMove(), 1000);
    }
  }

  /**
   * Executes AI move
   * @private
   */
  executeAIMove() {
    const aiSide = this.playerSide === 'wrestler1' ? 'wrestler2' : 'wrestler1';
    const aiWrestler = this.simulator.matchState[aiSide];

    const moves = this.simulator.getAvailableMoves(aiWrestler.entity);
    if (moves.length === 0) {
      moves.push(...this.getDefaultMoves());
    }

    // Simple AI: pick random move
    const move = moves[Math.floor(Math.random() * moves.length)];

    this.simulator.simulateTurn(aiSide, move);
    this.updateDisplay();

    // Check if AI should attempt pin
    const opponent = this.simulator.matchState[this.playerSide];
    if (opponent.stamina < 30 && Math.random() < 0.5) {
      setTimeout(() => {
        this.simulator.attemptPin(aiSide);
        this.updateDisplay();
      }, 500);
    }
  }

  /**
   * Attempts a pin
   * @private
   */
  attemptPin() {
    const result = this.simulator.attemptPin(this.playerSide);

    if (result.error) {
      // Show error in log
      const log = document.getElementById('play-by-play');
      if (log) {
        log.innerHTML += `<div style="color: var(--accent-warning);">${result.error}</div>`;
      }
      return;
    }

    this.updateDisplay();

    // If pin failed, AI gets a turn
    if (!result.matchEnded && !this.simulator.matchState.finished) {
      setTimeout(() => this.executeAIMove(), 1000);
    }
  }

  /**
   * Shows match end screen
   * @private
   */
  showMatchEnd(state) {
    const container = document.getElementById('move-selection');
    if (container) {
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

    // Hide pin button
    const pinBtn = document.querySelector('.match-controls .btn-primary:not(#match-continue-btn)');
    if (pinBtn) {
      pinBtn.classList.add('hidden');
    }
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
