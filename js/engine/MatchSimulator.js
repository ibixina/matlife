/**
 * MatchSimulator for Mat Life: Wrestling Simulator
 * Step 3.1 of Implementation Plan
 * Outcome-based match resolution
 */

import { clamp } from "../core/Utils.js";
import RelationshipManager from "./RelationshipManager.js";

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
    const wrestler1 =
      config.wrestler1 ?? config.player ?? config.wrestler ?? config.actor;
    const wrestler2 = config.wrestler2 ?? config.opponent ?? config.target;
    const { matchType = "Standard Singles", bookedWinner, finishType } = config;

    if (!wrestler1 || !wrestler2) {
      throw new Error("Match config must include both wrestlers");
    }

    const avg1 = MatchSimulator._calculateInRingAverage(wrestler1);
    const avg2 = MatchSimulator._calculateInRingAverage(wrestler2);
    const synergy = MatchSimulator._calculateSynergy(wrestler1, wrestler2);

    // Initialize match state
    this.matchState = {
      wrestler1: {
        entity: wrestler1,
        avgInRing: avg1,
      },
      wrestler2: {
        entity: wrestler2,
        avgInRing: avg2,
      },
      log: [],
      matchType,
      bookedWinner,
      finishType,
      finished: false,
      winner: null,
      matchRating: 0,
      synergy,
    };

    // Log match start
    this.logMatchStart();

    return this.getPublicState();
  }

  /**
   * Resolves the match outcome
   * @param {string} winnerId - ID of winning wrestler ('wrestler1' or 'wrestler2')
   * @returns {object} Match result
   */
  resolveMatch(winnerId) {
    if (this.matchState.finished) {
      return { error: "Match is already finished" };
    }

    this.matchState.finished = true;
    this.matchState.winner = winnerId;
    this.matchState.matchRating = this.calculateMatchRating();

    const winnerName =
      this.matchState[winnerId].entity.getComponent("identity").name;
    this.logEvent("match", `Match over! Winner: ${winnerName}`, {
      winner: winnerName,
      rating: this.matchState.matchRating,
    });

    return {
      winner: winnerId,
      matchRating: this.matchState.matchRating,
      matchState: this.getPublicState(),
    };
  }

  /**
   * Calculates match rating (0-7.0 stars)
   * Tuned to make elite ratings significantly rarer.
   * @returns {number} Match rating
   */
  calculateMatchRating() {
    const w1 = this.matchState.wrestler1;
    const w2 = this.matchState.wrestler2;
    const baseAvg = (w1.avgInRing + w2.avgInRing) / 2;

    // Calculate consistency based on wrestler skill
    // Higher skill = more consistent (less random variation)
    const avgSkill = baseAvg;
    const consistency = Math.min(0.9, 0.3 + (avgSkill / 100) * 0.6);

    // Lower baseline curve: average workers should land in the 2.0-4.2 range.
    let rating = 0.5 + (baseAvg / 100) * 4.6;

    // Synergy still matters, but less than before.
    rating += (this.matchState.synergy?.bonus || 0) * 0.6;

    // Add random variation with slight downward drift to reduce rating inflation.
    const maxVariation = 1.2;
    const minVariation = 0.1;
    const variationRange = maxVariation - minVariation;
    const actualVariation = minVariation + variationRange * (1 - consistency);
    const randomFactor = (Math.random() * 2 - 1) * actualVariation - 0.12;
    rating += randomFactor;

    // Top-end gating: 5.5+ should require genuinely elite in-ring average.
    if (baseAvg < 88 && rating > 5.5) {
      rating = 5.5 - (88 - baseAvg) * 0.06;
    }
    if (baseAvg < 82 && rating > 5.0) {
      rating = 5.0 - (82 - baseAvg) * 0.05;
    }

    // Elite bonus for truly exceptional wrestlers - reduced and harder thresholds.
    let eliteBonus = 0;
    if (w1.avgInRing >= 95 && w1.avgInRing < 98) {
      eliteBonus += (w1.avgInRing - 95) * 0.03; // Up to +0.09 per wrestler
    }
    if (w2.avgInRing >= 95 && w2.avgInRing < 98) {
      eliteBonus += (w2.avgInRing - 95) * 0.03; // Up to +0.09 per wrestler
    }
    rating += eliteBonus;

    // Legendary bonus only for near-perfect workers.
    let legendaryBonus = 0;
    if (w1.avgInRing >= 98) {
      legendaryBonus += (w1.avgInRing - 98) * 0.05; // Up to +0.10 per wrestler
    }
    if (w2.avgInRing >= 98) {
      legendaryBonus += (w2.avgInRing - 98) * 0.05; // Up to +0.10 per wrestler
    }
    rating += legendaryBonus;

    return clamp(rating, 0.5, 7.0);
  }

  /**
   * Logs a match event
   * @private
   */
  logEvent(category, text, data = {}) {
    this.matchState.log.push({
      category,
      text,
      ...data,
    });
  }

  /**
   * Logs match start
   * @private
   */
  logMatchStart() {
    const w1 = this.matchState.wrestler1.entity.getComponent("identity").name;
    const w2 = this.matchState.wrestler2.entity.getComponent("identity").name;
    const type = this.matchState.matchType;

    this.logEvent("system", `Match begins: ${w1} vs ${w2} - ${type}`);
  }

  /**
   * Gets public match state (safe to expose to UI)
   * @returns {object} Public match state
   */
  getPublicState() {
    return {
      wrestler1: {
        name: this.matchState.wrestler1.entity.getComponent("identity").name,
        avgInRing: Math.round(this.matchState.wrestler1.avgInRing),
      },
      wrestler2: {
        name: this.matchState.wrestler2.entity.getComponent("identity").name,
        avgInRing: Math.round(this.matchState.wrestler2.avgInRing),
      },
      finished: this.matchState.finished,
      winner: this.matchState.winner
        ? this.matchState[this.matchState.winner].entity.getComponent(
            "identity",
          ).name
        : null,
      matchRating: this.matchState.matchRating,
      synergy: this.matchState.synergy,
      log: this.matchState.log.slice(-10), // Last 10 log entries
    };
  }

  /**
   * Calculates average in-ring stat for a wrestler
   * @private
   */
  static _calculateInRingAverage(entity) {
    const stats = entity.getComponent("inRingStats");
    if (!stats) return 0;
    const {
      brawling = 0,
      technical = 0,
      aerial = 0,
      selling = 0,
      psychology = 0,
    } = stats;
    return (brawling + technical + aerial + selling + psychology) / 5;
  }

  /**
   * Calculates synergy bonus based on relationship affinity
   * @private
   */
  static _calculateSynergy(wrestler1, wrestler2) {
    const style1 = MatchSimulator._determineStyle(wrestler1);
    const style2 = MatchSimulator._determineStyle(wrestler2);
    const alignment1 = MatchSimulator._normalizeAlignment(wrestler1);
    const alignment2 = MatchSimulator._normalizeAlignment(wrestler2);

    const styleKey = MatchSimulator._pairKey(style1, style2);
    const alignmentKey = MatchSimulator._pairKey(alignment1, alignment2);

    const styleBonus = MatchSimulator._styleSynergyBonus(styleKey);
    const alignmentBonus = MatchSimulator._alignmentBonus(alignmentKey);

    const bonus = styleBonus + alignmentBonus;

    return {
      style1,
      style2,
      alignment1,
      alignment2,
      styleBonus,
      alignmentBonus,
      bonus,
    };
  }

  static _pairKey(a, b) {
    const left = (a || "Unknown").toString();
    const right = (b || "Unknown").toString();
    return left <= right ? `${left}|${right}` : `${right}|${left}`;
  }

  static _determineStyle(entity) {
    const identity = entity.getComponent("identity") || {};
    const gimmick = (identity.gimmick || "").toString().trim();

    const archetypeToStyle = {
      "High-Flyer": "Aerial",
      Powerhouse: "Powerhouse",
      Technical: "Technical",
      Brawler: "Brawler",
      "Strong Style": "Brawler",
      "Lucha Libre": "Aerial",
    };

    if (gimmick && archetypeToStyle[gimmick]) {
      return archetypeToStyle[gimmick];
    }

    const inRing = entity.getComponent("inRingStats") || {};
    const physical = entity.getComponent("physicalStats") || {};

    const brawling = inRing.brawling ?? 0;
    const technical = inRing.technical ?? 0;
    const aerial = inRing.aerial ?? 0;
    const strength = physical.strength ?? 0;

    // Powerhouse: strong and brawl-heavy
    if (strength >= 70 && brawling >= 60) return "Powerhouse";

    const maxStat = Math.max(brawling, technical, aerial);
    if (maxStat === technical) return "Technical";
    if (maxStat === aerial) return "Aerial";
    return "Brawler";
  }

  static _normalizeAlignment(entity) {
    const alignment = entity.getComponent("identity")?.alignment;
    if (!alignment) return "Unknown";
    const norm = alignment.toString().trim().toLowerCase();
    if (norm.startsWith("face")) return "Face";
    if (norm.startsWith("heel")) return "Heel";
    return "Unknown";
  }

  static _styleSynergyBonus(pairKey) {
    const bonuses = {
      "Brawler|Technical": 0.35,
      "Aerial|Powerhouse": 0.35,
      "Aerial|Technical": 0.25,
      "Brawler|Powerhouse": 0.2,
      "Aerial|Brawler": 0.2,
      "Powerhouse|Technical": 0.15,
      "Aerial|Aerial": -0.05,
      "Brawler|Brawler": -0.1,
      "Powerhouse|Powerhouse": -0.1,
      "Technical|Technical": -0.05,
    };

    return bonuses[pairKey] ?? 0;
  }

  static _alignmentBonus(pairKey) {
    const bonuses = {
      "Face|Heel": 0.25,
      "Face|Face": -0.1,
      "Heel|Heel": -0.1,
      "Face|Tweener": 0.1,
      "Heel|Tweener": 0.1,
      "Tweener|Tweener": -0.05,
    };
    return bonuses[pairKey] ?? 0;
  }
}

export default MatchSimulator;
