/**
 * CharacterEvolution for Mat Life: Wrestling Simulator
 * Handles character attribute changes (alignment, gimmick, archetype)
 */

const ARCHETYPE_REQUIREMENTS = {
  Technical: {
    physical: { strength: 40, resilience: 45, speed: 40 },
    inRing: { brawling: 40, technical: 60, aerial: 30, selling: 55, psychology: 55 },
    entertainment: { charisma: 40, micSkills: 50, acting: 40 },
  },
  "High-Flyer": {
    physical: { strength: 30, resilience: 35, speed: 65 },
    inRing: { brawling: 30, technical: 40, aerial: 65, selling: 45, psychology: 40 },
    entertainment: { charisma: 50, micSkills: 40, acting: 40 },
  },
  Brawler: {
    physical: { strength: 55, resilience: 55, speed: 40 },
    inRing: { brawling: 65, technical: 30, aerial: 25, selling: 45, psychology: 40 },
    entertainment: { charisma: 55, micSkills: 40, acting: 35 },
  },
  Powerhouse: {
    physical: { strength: 70, resilience: 65, speed: 30 },
    inRing: { brawling: 55, technical: 40, aerial: 20, selling: 40, psychology: 40 },
    entertainment: { charisma: 40, micSkills: 35, acting: 40 },
  },
  "Strong Style": {
    physical: { strength: 55, resilience: 55, speed: 45 },
    inRing: { brawling: 60, technical: 55, aerial: 30, selling: 50, psychology: 50 },
    entertainment: { charisma: 40, micSkills: 45, acting: 40 },
  },
  "Lucha Libre": {
    physical: { strength: 35, resilience: 35, speed: 65 },
    inRing: { brawling: 30, technical: 45, aerial: 65, selling: 40, psychology: 45 },
    entertainment: { charisma: 55, micSkills: 35, acting: 50 },
  },
};

const GIMMICKS = [
  "Technician", "High-Flyer", "Brawler", "Powerhouse", "Strong Style",
  "Lucha Libre", "Cult Hero", "Veteran", "Rising Star", "Enigma",
  "Mercenary", "Traditionalist", "Showman", "Revolutionary", "Old School"
];

const ALIGNMENTS = ["Face", "Heel", "Tweener"];

export default class CharacterEvolution {
  /**
   * Check if entity meets stat requirements for an archetype
   * @param {object} entity - Entity with stats components
   * @param {string} archetype - Target archetype
   * @returns {object} - { canChange: boolean, missing: object }
   */
  static canChangeArchetype(entity, archetype) {
    const requirements = ARCHETYPE_REQUIREMENTS[archetype];
    if (!requirements) {
      return { canChange: false, missing: { general: "Unknown archetype" } };
    }

    const identity = entity.getComponent("identity");
    if (identity && identity.archetype === archetype) {
      return { canChange: true, missing: {}, isCurrent: true };
    }

    const physicalStats = entity.getComponent("physicalStats");
    const inRingStats = entity.getComponent("inRingStats");
    const entertainmentStats = entity.getComponent("entertainmentStats");

    if (!physicalStats || !inRingStats || !entertainmentStats) {
      return { canChange: false, missing: { general: "Missing stats components" } };
    }

    const physicalTotal = (physicalStats.strength || 0) + (physicalStats.resilience || 0) + (physicalStats.speed || 0);
    if (physicalTotal >= 240) {
      return { canChange: true, missing: {}, isCurrent: false, highStats: true };
    }

    const missing = {};

    for (const [stat, req] of Object.entries(requirements.physical)) {
      if (physicalStats[stat] < req) {
        missing[stat] = { required: req, current: physicalStats[stat] };
      }
    }

    for (const [stat, req] of Object.entries(requirements.inRing)) {
      if (inRingStats[stat] < req) {
        missing[`inRing.${stat}`] = { required: req, current: inRingStats[stat] };
      }
    }

    for (const [stat, req] of Object.entries(requirements.entertainment)) {
      if (entertainmentStats[stat] < req) {
        missing[`entertainment.${stat}`] = { required: req, current: entertainmentStats[stat] };
      }
    }

    return {
      canChange: Object.keys(missing).length === 0,
      missing,
    };
  }

  /**
   * Get archetype requirements for display
   * @param {string} archetype - Target archetype
   * @returns {object} - Requirements object
   */
  static getArchetypeRequirements(archetype) {
    return ARCHETYPE_REQUIREMENTS[archetype] || null;
  }

  /**
   * Get all archetypes with their requirements
   * @returns {object} - All archetype requirements
   */
  static getAllArchetypeRequirements() {
    return ARCHETYPE_REQUIREMENTS;
  }

  /**
   * Get random gimmick
   * @returns {string} - Random gimmick
   */
  static getRandomGimmick() {
    return GIMMICKS[Math.floor(Math.random() * GIMMICKS.length)];
  }

  /**
   * Get all gimmicks
   * @returns {Array} - All gimmicks
   */
  static getAllGimmicks() {
    return [...GIMMICKS];
  }

  /**
   * Get all alignments
   * @returns {Array} - All alignments
   */
  static getAllAlignments() {
    return [...ALIGNMENTS];
  }

  /**
   * Change entity alignment
   * @param {object} entity - Entity to modify
   * @param {string} alignment - New alignment
   * @param {object} gameStateManager - Game state manager for dispatch
   */
  static changeAlignment(entity, alignment, gameStateManager) {
    if (!ALIGNMENTS.includes(alignment)) {
      return { success: false, error: "Invalid alignment" };
    }

    const identity = entity.getComponent("identity");
    if (!identity) {
      return { success: false, error: "No identity component" };
    }

    const oldAlignment = identity.alignment;
    identity.alignment = alignment;

    if (gameStateManager) {
      gameStateManager.dispatch("UPDATE_COMPONENT", {
        entityId: entity.id,
        componentName: "identity",
        componentData: identity,
      });
    }

    return { success: true, oldValue: oldAlignment, newValue: alignment };
  }

  /**
   * Change entity gimmick
   * @param {object} entity - Entity to modify
   * @param {string} gimmick - New gimmick
   * @param {object} gameStateManager - Game state manager for dispatch
   */
  static changeGimmick(entity, gimmick, gameStateManager) {
    const identity = entity.getComponent("identity");
    if (!identity) {
      return { success: false, error: "No identity component" };
    }

    const oldGimmick = identity.gimmick;
    identity.gimmick = gimmick;

    if (gameStateManager) {
      gameStateManager.dispatch("UPDATE_COMPONENT", {
        entityId: entity.id,
        componentName: "identity",
        componentData: identity,
      });
    }

    return { success: true, oldValue: oldGimmick, newValue: gimmick };
  }

  /**
   * Change entity archetype (with stat check)
   * @param {object} entity - Entity to modify
   * @param {string} archetype - New archetype
   * @param {object} gameStateManager - Game state manager for dispatch
   */
  static changeArchetype(entity, archetype, gameStateManager) {
    const check = this.canChangeArchetype(entity, archetype);
    if (!check.canChange) {
      return { success: false, error: "Stats too low", missing: check.missing };
    }

    const identity = entity.getComponent("identity");
    if (!identity) {
      return { success: false, error: "No identity component" };
    }

    const oldArchetype = identity.archetype;
    identity.archetype = archetype;
    identity.gimmick = archetype;

    if (gameStateManager) {
      gameStateManager.dispatch("UPDATE_COMPONENT", {
        entityId: entity.id,
        componentName: "identity",
        componentData: identity,
      });
    }

    return { success: true, oldValue: oldArchetype, newValue: archetype };
  }

  /**
   * Randomly evolve NPC attributes (called periodically)
   * @param {object} entity - NPC entity to potentially evolve
   * @param {number} chance - Chance to change (0-1)
   * @param {object} gameStateManager - Game state manager
   * @returns {object|null} - Change result or null if no change
   */
  static evolveNPC(entity, chance = 0.1, gameStateManager) {
    if (entity.isPlayer) return null;

    if (Math.random() > chance) return null;

    const identity = entity.getComponent("identity");
    if (!identity) return null;

    const changeType = Math.random();
    let result = null;

    if (changeType < 0.4) {
      const newAlignment = ALIGNMENTS[Math.floor(Math.random() * ALIGNMENTS.length)];
      if (newAlignment !== identity.alignment) {
        result = this.changeAlignment(entity, newAlignment, gameStateManager);
      }
    } else if (changeType < 0.7) {
      const newGimmick = this.getRandomGimmick();
      if (newGimmick !== identity.gimmick) {
        result = this.changeGimmick(entity, newGimmick, gameStateManager);
      }
    } else {
      const archetypes = Object.keys(ARCHETYPE_REQUIREMENTS);
      const newArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
      if (newArchetype !== identity.archetype) {
        const check = this.canChangeArchetype(entity, newArchetype);
        if (check.canChange) {
          result = this.changeArchetype(entity, newArchetype, gameStateManager);
        }
      }
    }

    return result;
  }
}
