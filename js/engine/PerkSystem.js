/**
 * PerkSystem for Mat Life: Wrestling Simulator
 * Phase 3.4 - Perk/Skill Tree
 * Unlocks perks at career milestones
 */

import { gameStateManager } from '../core/GameStateManager.js';

const MAX_ACTIVE_PERKS = 8;

const PERKS = {
  iron_man: {
    id: 'iron_man',
    name: 'Iron Man',
    category: 'in_ring',
    description: 'Stamina +10, recover faster between matches',
    requirement: { type: 'matches', value: 50 },
    effect: { stamina: 10 }
  },
  finisher_expert: {
    id: 'finisher_expert',
    name: 'Finisher Expert',
    category: 'in_ring',
    description: '+2 to finisher DC',
    requirement: { type: 'five_star_matches', value: 5 },
    effect: { finisherDC: 2 }
  },
  ring_general: {
    id: 'ring_general',
    name: 'Ring General',
    category: 'in_ring',
    description: 'Psychology +3',
    requirement: { type: 'main_events', value: 10 },
    effect: { psychology: 3 }
  },
  silver_tongue: {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    category: 'entertainment',
    description: 'Promo advantage +3',
    requirement: { type: 'promos', value: 25 },
    effect: { promoBonus: 3 }
  },
  social_media_guru: {
    id: 'social_media_guru',
    name: 'Social Media Guru',
    category: 'entertainment',
    description: '2x follower gain from posts',
    requirement: { type: 'followers', value: 10000 },
    effect: { followerMultiplier: 2 }
  },
  locker_room_leader: {
    id: 'locker_room_leader',
    name: 'Locker Room Leader',
    category: 'backstage',
    description: 'Relationship gains +50%',
    requirement: { type: 'allies', value: 5 },
    effect: { relationshipBonus: 1.5 }
  },
  political_player: {
    id: 'political_player',
    name: 'Political Player',
    category: 'backstage',
    description: 'Contract negotiation +10%',
    requirement: { type: 'contracts', value: 3 },
    effect: { negotiationBonus: 10 }
  },
  peak_athlete: {
    id: 'peak_athlete',
    name: 'Peak Athlete',
    category: 'physical',
    description: 'Training gains +50%',
    requirement: { type: 'training_sessions', value: 30 },
    effect: { trainingMultiplier: 1.5 }
  },
  iron_body: {
    id: 'iron_body',
    name: 'Iron Body',
    category: 'physical',
    description: 'Injury resistance +25%',
    requirement: { type: 'matches_without_injury', value: 20 },
    effect: { injuryResistance: 0.75 }
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    category: 'general',
    description: 'All stats +1',
    requirement: { type: 'years', value: 3 },
    effect: { allStats: 1 }
  }
};

export class PerkSystem {
  static checkAndUnlockPerks(entity) {
    const careerStats = entity.getComponent('careerStats');
    const raw = entity.getComponent('unlockedPerks');
    const unlockedPerks = Array.isArray(raw) ? raw : [];
    const newUnlocks = [];

    for (const [perkId, perk] of Object.entries(PERKS)) {
      if (unlockedPerks.includes(perkId)) continue;

      if (this.meetsRequirement(entity, careerStats, perk.requirement)) {
        unlockedPerks.push(perkId);
        newUnlocks.push(perk);

        const identity = entity.getComponent('identity');
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `⭐ PERK UNLOCKED: ${identity?.name} gained "${perk.name}" - ${perk.description}`,
            type: 'perk'
          }
        });
      }
    }

    entity.addComponent('unlockedPerks', unlockedPerks);
    return newUnlocks;
  }

  static meetsRequirement(entity, careerStats, requirement) {
    switch (requirement.type) {
      case 'matches':
        return (careerStats?.totalMatches || 0) >= requirement.value;
      case 'five_star_matches':
        return (careerStats?.fiveStarMatches || 0) >= requirement.value;
      case 'main_events':
        return (careerStats?.mainEvents || 0) >= requirement.value;
      case 'promos':
        return (careerStats?.promosCut || 0) >= requirement.value;
      case 'followers':
        const social = entity.getComponent('socialMedia');
        return (social?.followers || 0) >= requirement.value;
      case 'allies':
        return this.countAllies(entity) >= requirement.value;
      case 'contracts':
        return (careerStats?.contractsSigned || 0) >= requirement.value;
      case 'training_sessions':
        return (careerStats?.trainingSessions || 0) >= requirement.value;
      case 'matches_without_injury':
        return (careerStats?.matchesWithoutInjury || 0) >= requirement.value;
      case 'years':
        const state = gameStateManager.getStateRef();
        return (state.calendar?.year || 1) >= requirement.value;
      default:
        return false;
    }
  }

  static countAllies(entity) {
    const relationships = entity.getComponent('relationships') || [];
    return relationships.filter(r => r.affinity >= 50).length;
  }

  static activatePerk(entity, perkId) {
    const rawUnlocked = entity.getComponent('unlockedPerks');
    const unlockedPerks = Array.isArray(rawUnlocked) ? rawUnlocked : [];
    const rawActive = entity.getComponent('activePerks');
    const activePerks = Array.isArray(rawActive) ? rawActive : [];

    if (!unlockedPerks.includes(perkId)) {
      return { error: 'Perk not unlocked' };
    }

    if (activePerks.includes(perkId)) {
      return { error: 'Perk already active' };
    }

    if (activePerks.length >= MAX_ACTIVE_PERKS) {
      return { error: 'Maximum active perks reached (8)' };
    }

    activePerks.push(perkId);
    entity.addComponent('activePerks', activePerks);

    this.applyPerkEffects(entity, perkId);

    const perk = PERKS[perkId];
    return {
      success: true,
      message: `Activated: ${perk.name}`,
      remainingSlots: MAX_ACTIVE_PERKS - activePerks.length
    };
  }

  static deactivatePerk(entity, perkId) {
    const rawActive = entity.getComponent('activePerks');
    const activePerks = Array.isArray(rawActive) ? rawActive : [];
    const index = activePerks.indexOf(perkId);

    if (index === -1) {
      return { error: 'Perk not active' };
    }

    activePerks.splice(index, 1);
    entity.addComponent('activePerks', activePerks);

    this.removePerkEffects(entity, perkId);

    return { success: true, message: 'Perk deactivated' };
  }

  static applyPerkEffects(entity, perkId) {
    const perk = PERKS[perkId];
    if (!perk || !perk.effect) return;

    const inRingStats = entity.getComponent('inRingStats');
    const entertainmentStats = entity.getComponent('entertainmentStats');
    const physicalStats = entity.getComponent('physicalStats');

    for (const [stat, value] of Object.entries(perk.effect)) {
      if (stat === 'stamina' && physicalStats) {
        physicalStats.stamina = Math.min(100, physicalStats.stamina + value);
      } else if (stat === 'psychology' && inRingStats) {
        inRingStats.psychology = Math.min(20, inRingStats.psychology + value);
      } else if (stat === 'allStats') {
        if (inRingStats) {
          inRingStats.brawling = Math.min(20, inRingStats.brawling + value);
          inRingStats.technical = Math.min(20, inRingStats.technical + value);
          inRingStats.aerial = Math.min(20, inRingStats.aerial + value);
          inRingStats.psychology = Math.min(20, inRingStats.psychology + value);
        }
        if (entertainmentStats) {
          entertainmentStats.charisma = Math.min(20, entertainmentStats.charisma + value);
          entertainmentStats.micSkills = Math.min(20, entertainmentStats.micSkills + value);
        }
        if (physicalStats) {
          physicalStats.strength = Math.min(20, physicalStats.strength + value);
          physicalStats.speed = Math.min(20, physicalStats.speed + value);
          physicalStats.resilience = Math.min(20, physicalStats.resilience + value);
        }
      }
    }
  }

  static removePerkEffects(entity, perkId) {
    // Implementation for removing effects when deactivating
    // This would need to track original values or apply negative modifiers
    // For simplicity, we'll leave permanent stat boosts
  }

  static getAvailablePerks(entity) {
    const rawUnlocked = entity.getComponent('unlockedPerks');
    const unlockedPerks = Array.isArray(rawUnlocked) ? rawUnlocked : [];
    const rawActive = entity.getComponent('activePerks');
    const activePerks = Array.isArray(rawActive) ? rawActive : [];

    return {
      unlocked: unlockedPerks.map(id => PERKS[id]).filter(Boolean),
      active: activePerks.map(id => PERKS[id]).filter(Boolean),
      availableSlots: MAX_ACTIVE_PERKS - activePerks.length
    };
  }

  static getPerkProgress(entity) {
    const careerStats = entity.getComponent('careerStats');
    const progress = {};

    for (const [perkId, perk] of Object.entries(PERKS)) {
      const current = this.getRequirementProgress(entity, careerStats, perk.requirement);
      progress[perkId] = {
        name: perk.name,
        requirement: perk.requirement,
        current,
        completed: current >= perk.requirement.value
      };
    }

    return progress;
  }

  static getRequirementProgress(entity, careerStats, requirement) {
    switch (requirement.type) {
      case 'matches':
        return careerStats?.totalMatches || 0;
      case 'five_star_matches':
        return careerStats?.fiveStarMatches || 0;
      case 'main_events':
        return careerStats?.mainEvents || 0;
      case 'promos':
        return careerStats?.promosCut || 0;
      case 'followers':
        const social = entity.getComponent('socialMedia');
        return social?.followers || 0;
      case 'allies':
        return this.countAllies(entity);
      case 'contracts':
        return careerStats?.contractsSigned || 0;
      case 'training_sessions':
        return careerStats?.trainingSessions || 0;
      case 'matches_without_injury':
        return careerStats?.matchesWithoutInjury || 0;
      case 'years':
        const state = gameStateManager.getStateRef();
        return state.calendar?.year || 1;
      default:
        return 0;
    }
  }
}

export default PerkSystem;
