/**
 * MatchSimulator for Mat Life: Wrestling Simulator
 * Step 3.1 of Implementation Plan
 * Full match simulation with phases
 */

import { gameStateManager } from '../core/GameStateManager.js';
import ResolutionEngine, { OUTCOME } from './ResolutionEngine.js';
import InjuryEngine from './InjuryEngine.js';
import { randomInt, clamp } from '../core/Utils.js';
import RelationshipManager from './RelationshipManager.js';

/**
 * Match phases with turn ranges and rules
 */
const PHASES = [
  { 
    name: "Feeling Out", 
    turns: [1, 3], 
    allowedMoveTypes: ["strike", "grapple"], 
    staminaDrainMultiplier: 0.5,
    description: "Both wrestlers test each other with basic holds and strikes."
  },
  { 
    name: "Building Heat", 
    turns: [4, 8], 
    allowedMoveTypes: ["strike", "grapple", "aerial"], 
    staminaDrainMultiplier: 1.0,
    description: "The pace picks up. The heel takes control and works over the babyface."
  },
  { 
    name: "The Comeback", 
    turns: [6, 10], 
    allowedMoveTypes: ["strike", "grapple", "aerial", "submission"], 
    staminaDrainMultiplier: 1.0, 
    momentumBonus: true,
    description: "The babyface fires up! The crowd is on their feet!"
  },
  { 
    name: "The Finish", 
    turns: [8, 12], 
    allowedMoveTypes: ["strike", "grapple", "aerial", "submission", "finisher"], 
    staminaDrainMultiplier: 1.2,
    description: "Near falls, finishers, and the dramatic conclusion."
  }
];

/**
 * MatchSimulator - Simulates wrestling matches
 */
export class MatchSimulator {
  constructor() {
    this.matchState = null;
    this.config = null;
    this.callbacks = {};
  }

  /**
   * Starts a new match
   * @param {object} config - Match configuration
   * @returns {object} Initial match state
   */
  startMatch(config) {
    this.config = config;
    const wrestler1 = config.wrestler1 ?? config.player ?? config.wrestler ?? config.actor;
    const wrestler2 = config.wrestler2 ?? config.opponent ?? config.target;
    const { matchType = 'Standard Singles', bookedWinner, finishType } = config;

    if (!wrestler1 || !wrestler2) {
      throw new Error('Match config must include both wrestlers');
    }

    // Initialize match state
    this.matchState = {
      wrestler1: {
        entity: wrestler1,
        stamina: 100,
        health: 100,
        momentum: 0,
        movesHit: 0,
        movesMissed: 0
      },
      wrestler2: {
        entity: wrestler2,
        stamina: 100,
        health: 100,
        momentum: 0,
        movesHit: 0,
        movesMissed: 0
      },
      turn: 1,
      phaseIndex: 0,
      log: [],
      spectacleTotal: 0,
      botchCount: 0,
      matchType,
      bookedWinner,
      finishType,
      finished: false,
      winner: null,
      matchRating: 0
    };

    // Apply match type modifiers
    this.applyMatchTypeModifiers();

    // Log match start
    this.logMatchStart();

    return this.getPublicState();
  }

  /**
   * Gets the current phase
   * @returns {object} Current phase
   */
  getCurrentPhase() {
    const turn = this.matchState.turn;
    let currentPhase = null;
    for (let i = 0; i < PHASES.length; i++) {
      const phase = PHASES[i];
      if (turn >= phase.turns[0] && turn <= phase.turns[1]) {
        currentPhase = { ...phase, index: i };
      }
    }
    if (currentPhase) {
      return currentPhase;
    }
    return { ...PHASES[PHASES.length - 1], index: PHASES.length - 1 };
  }

  /**
   * Simulates a turn
   * @param {string} attackerId - ID of attacking wrestler ('wrestler1' or 'wrestler2')
   * @param {object} move - Move to perform
   * @returns {object} Turn result
   */
  simulateTurn(attackerId, move) {
    if (this.matchState.finished) {
      return { error: 'Match is already finished' };
    }

    const defenderId = attackerId === 'wrestler1' ? 'wrestler2' : 'wrestler1';
    const attacker = this.matchState[attackerId];
    const defender = this.matchState[defenderId];
    const phase = this.getCurrentPhase();

    // Check if move is allowed in current phase
    if (!phase.allowedMoveTypes.includes(move.type) && move.type !== 'finisher') {
      return { error: `Move type ${move.type} not allowed in ${phase.name} phase` };
    }

    // Check stamina
    if (attacker.stamina < move.staminaCost) {
      return { 
        error: 'Not enough stamina',
        attackerId,
        move,
        result: {
          outcome: 'FAILURE',
          narrative: `${attacker.entity.getComponent('identity').name} is too exhausted to perform ${move.name}!`
        }
      };
    }

    // Consume stamina
    const staminaCost = move.staminaCost * phase.staminaDrainMultiplier;
    attacker.stamina = Math.max(0, attacker.stamina - staminaCost);

    // Determine attacker stat
    const attackerStatKey = this.getMoveStatKey(move);

    // Resolution check
    const context = {
      hasAdvantage: attacker.momentum > defender.momentum + 20,
      hasDisadvantage: attacker.stamina < 30
    };

    const resolution = ResolutionEngine.resolve({
      actor: attacker.entity,
      action: move.name,
      target: defender.entity,
      stat: attackerStatKey,
      dc: move.baseDC,
      context
    });

    // Process outcome
    let result = this.processMoveOutcome(resolution, move, attacker, defender, phase, attackerId);
    
    // Increment turn
    this.matchState.turn++;

    // Check for phase change
    const newPhase = this.getCurrentPhase();
    if (newPhase.index !== phase.index) {
      result.phaseChange = {
        from: phase.name,
        to: newPhase.name,
        description: newPhase.description
      };
      this.logEvent('system', `Phase Change: ${newPhase.name} - ${newPhase.description}`);
    }

    // Check if match should end (health depleted)
    if (defender.health <= 0 && phase.name === 'The Finish') {
      this.finishMatch(attackerId);
    }

    return {
      attackerId,
      move,
      resolution,
      result,
      matchState: this.getPublicState()
    };
  }

  /**
   * Processes the outcome of a move
   * @private
   */
  processMoveOutcome(resolution, move, attacker, defender, phase, attackerId) {
    const attackerName = attacker.entity.getComponent('identity').name;
    const defenderName = defender.entity.getComponent('identity').name;

    if (defender.stamina <= 10) {
      const narrative = `1... 2... 3! ${attackerName} gets the pin on the exhausted ${defenderName}!`;
      this.finishMatch(attackerId);
      this.logEvent('match', narrative);
      return {
        winner: attackerId,
        narrative,
        contested: null,
        matchEnded: true,
        matchState: this.getPublicState()
      };
    }
    
    let narrative = '';
    let damage = 0;
    let spectacle = 0;
    let injury = null;

    switch (resolution.outcome) {
      case OUTCOME.CRITICAL_SUCCESS:
        damage = move.damageBase * 1.5;
        spectacle = move.spectacle * 2;
        attacker.momentum += 15;
        attacker.movesHit++;
        narrative = `${attackerName} FLIES through the air — ${move.name} CONNECTS PERFECTLY! The crowd is on their feet! THIS IS WRESTLING!`;
        break;

      case OUTCOME.SUCCESS:
        damage = move.damageBase;
        spectacle = move.spectacle;
        attacker.momentum += 5;
        attacker.movesHit++;
        narrative = `${attackerName} connects with a devastating ${move.name}! ${defenderName} staggers backward.`;
        break;

      case OUTCOME.FAILURE:
        damage = 0;
        spectacle = 0;
        attacker.momentum -= 5;
        attacker.movesMissed++;
        narrative = `${attackerName} attempts the ${move.name} but ${defenderName} counters!`;
        break;

      case OUTCOME.CRITICAL_FAILURE:
        damage = 0;
        spectacle = 0;
        attacker.momentum -= 10;
        attacker.movesMissed++;
        this.matchState.botchCount++;
        
        // Check for injury
        if (Math.random() < move.injuryRisk) {
          const moveType = move.type === 'finisher' ? 'aerial' : move.type;
          injury = InjuryEngine.generateInjury(moveType, randomInt(1, 3));
          InjuryEngine.addInjury(defender.entity, injury.bodyPart, injury.severity, `Botched ${move.name}`);
        }
        
        narrative = `${attackerName} goes for the ${move.name}... AND CRASHES AND BURNS! That could be a serious injury!`;
        break;
    }

    // Apply damage to defender stamina
    defender.stamina = Math.max(0, defender.stamina - damage);
    defender.health = Math.max(0, defender.health - (damage * 0.3));

    // Track spectacle
    this.matchState.spectacleTotal += spectacle;

    // Log the action
    this.logEvent('match', narrative, { 
      attacker: attackerName, 
      defender: defenderName, 
      move: move.name,
      damage,
      outcome: resolution.outcome
    });

    return {
      narrative,
      damage,
      spectacle,
      injury,
      attackerStamina: attacker.stamina,
      defenderStamina: defender.stamina
    };
  }

  /**
   * Attempts a pin
   * @param {string} attackerId - ID of wrestler attempting pin
   * @returns {object} Pin result
   */
  attemptPin(attackerId) {
    if (this.matchState.finished) {
      return { error: 'Match is already finished' };
    }

    const defenderId = attackerId === 'wrestler1' ? 'wrestler2' : 'wrestler1';
    const attacker = this.matchState[attackerId];
    const defender = this.matchState[defenderId];
    const phase = this.getCurrentPhase();

    // Can only pin in finish phase or if defender is exhausted
    if (phase.name !== 'The Finish' && defender.stamina > 20) {
      return { 
        error: 'Too early for a pin attempt',
        allowed: false
      };
    }

    const attackerName = attacker.entity.getComponent('identity').name;
    const defenderName = defender.entity.getComponent('identity').name;

    if (defender.stamina <= 10) {
      const narrative = `1... 2... 3! ${attackerName} gets the pin on the exhausted ${defenderName}!`;
      this.finishMatch(attackerId);
      this.logEvent('match', narrative);
      return {
        winner: attackerId,
        narrative,
        contested: null,
        matchEnded: true,
        matchState: this.getPublicState()
      };
    }

    // Contested check
    const contested = ResolutionEngine.resolveContested({
      actor: attacker.entity,
      actorStat: 'strength',
      target: defender.entity,
      targetStat: 'resilience'
    });

    const winner = contested.winner === 'actor' ? attackerId : defenderId;
    
    let narrative = '';
    let matchEnded = false;

    if (winner === attackerId) {
      // Successful pin
      narrative = `1... 2... 3! ${attackerName} gets the pin!`;
      matchEnded = true;
      this.finishMatch(attackerId);
    } else {
      // Kickout
      const kickoutTiming = contested.margin <= 3 ? 'at TWO' : 'at ONE';
      narrative = `${defenderName} kicks out ${kickoutTiming}! ${attackerName} can't believe it!`;
      defender.momentum += 10;
    }

    this.logEvent('match', narrative);

    return {
      winner,
      narrative,
      contested,
      matchEnded,
      matchState: this.getPublicState()
    };
  }

  /**
   * Finishes the match
   * @private
   * @param {string} winnerId - ID of winning wrestler
   */
  finishMatch(winnerId) {
    this.matchState.finished = true;
    this.matchState.winner = winnerId;

    const winner = this.matchState[winnerId];
    const loserId = winnerId === 'wrestler1' ? 'wrestler2' : 'wrestler1';
    const loser = this.matchState[loserId];

    // Calculate match rating
    this.matchState.matchRating = this.calculateMatchRating();

    // Log match end
    const winnerName = winner.entity.getComponent('identity').name;
    this.logEvent('match', `Match over! Winner: ${winnerName}`, { 
      winner: winnerName,
      rating: this.matchState.matchRating
    });
  }

  /**
   * Calculates match rating (0-5.5 stars)
   * @returns {number} Match rating
   */
  calculateMatchRating() {
    const w1 = this.matchState.wrestler1;
    const w2 = this.matchState.wrestler2;
    
    const psych1 = w1.entity.getComponent('inRingStats').psychology;
    const psych2 = w2.entity.getComponent('inRingStats').psychology;
    
    let rating = ((psych1 + psych2) / 2) / 5;
    
    // Spectacle bonus
    const maxSpectacle = 50;
    rating += (this.matchState.spectacleTotal / maxSpectacle) * 1.5;
    
    // Botch penalty
    rating -= this.matchState.botchCount * 0.5;
    
    // Match type bonus
    if (this.matchState.matchType.includes('Cell') || this.matchState.matchType.includes('Ladder')) {
      rating += 0.5;
    }

    // Chemistry bonus
    const relationship = RelationshipManager.getRelationship(w1.entity.id, w2.entity.id);
    if (relationship) {
      rating += (relationship.affinity / 100) * 0.5;
    }

    return clamp(rating, 0, 5.5);
  }

  /**
   * Gets the appropriate stat for a move
   * @private
   */
  getMoveStatKey(move) {
    const statMap = {
      strike: 'brawling',
      grapple: 'technical',
      aerial: 'aerial',
      submission: 'technical',
      finisher: 'psychology'
    };
    
    return statMap[move.type] || 'brawling';
  }

  /**
   * Applies match type modifiers
   * @private
   */
  applyMatchTypeModifiers() {
    const matchType = this.matchState.matchType;
    
    switch (matchType) {
      case 'Hardcore/No DQ':
        // Higher spectacle potential, more injuries
        break;
      case 'Iron Man':
        // Multiple falls needed
        break;
      case 'Ladder Match':
        // Special ladder mechanics
        break;
      case 'Steel Cage':
        // No escape mechanics
        break;
    }
  }

  /**
   * Gets filtered moves for current phase
   * @param {Entity} entity - Wrestler entity
   * @returns {object[]} Available moves
   */
  getAvailableMoves(entity) {
    const phase = this.getCurrentPhase();
    const moveset = entity.getComponent('moveset');
    
    if (!moveset) return [];

    const allMoves = [
      ...(moveset.movePool || []),
      ...(moveset.signatures || []),
      ...(phase.allowedMoveTypes.includes('finisher') ? moveset.finishers || [] : [])
    ];

    const availableMoves = allMoves.filter(move => phase.allowedMoveTypes.includes(move.type));

    if (availableMoves.length > 0) {
      return availableMoves;
    }

    const defaultMoves = [
      {
        name: 'Basic Strike',
        type: 'strike',
        staminaCost: 5,
        damageBase: 8,
        spectacle: 2,
        injuryRisk: 0.02,
        baseDC: 8
      },
      {
        name: 'Simple Grapple',
        type: 'grapple',
        staminaCost: 6,
        damageBase: 10,
        spectacle: 2,
        injuryRisk: 0.03,
        baseDC: 9
      }
    ];

    return defaultMoves.filter(move => phase.allowedMoveTypes.includes(move.type));
  }

  /**
   * Logs a match event
   * @private
   */
  logEvent(category, text, data = {}) {
    this.matchState.log.push({
      turn: this.matchState.turn,
      category,
      text,
      ...data
    });
  }

  /**
   * Logs match start
   * @private
   */
  logMatchStart() {
    const w1 = this.matchState.wrestler1.entity.getComponent('identity').name;
    const w2 = this.matchState.wrestler2.entity.getComponent('identity').name;
    const type = this.matchState.matchType;
    
    this.logEvent('system', `Match begins: ${w1} vs ${w2} - ${type}`);
  }

  /**
   * Gets public match state (safe to expose to UI)
   * @returns {object} Public match state
   */
  getPublicState() {
    return {
      turn: this.matchState.turn,
      phase: this.getCurrentPhase().name,
      wrestler1: {
        name: this.matchState.wrestler1.entity.getComponent('identity').name,
        stamina: Math.round(this.matchState.wrestler1.stamina),
        health: Math.round(this.matchState.wrestler1.health),
        momentum: Math.round(this.matchState.wrestler1.momentum)
      },
      wrestler2: {
        name: this.matchState.wrestler2.entity.getComponent('identity').name,
        stamina: Math.round(this.matchState.wrestler2.stamina),
        health: Math.round(this.matchState.wrestler2.health),
        momentum: Math.round(this.matchState.wrestler2.momentum)
      },
      finished: this.matchState.finished,
      winner: this.matchState.winner ? this.matchState[this.matchState.winner].entity.getComponent('identity').name : null,
      matchRating: this.matchState.matchRating,
      log: this.matchState.log.slice(-10) // Last 10 log entries
    };
  }
}

export default MatchSimulator;
