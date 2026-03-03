/**
 * EntityFactory for Mat Life: Wrestling Simulator
 * Creates entities from JSON data or character creation
 */

import { Entity } from './Entity.js';
import {
  IdentityComponent,
  PhysicalStatsComponent,
  InRingStatsComponent,
  EntertainmentStatsComponent,
  ConditionComponent,
  MovesetComponent,
  CareerStatsComponent,
  PromotionRecordComponent,
  ContractComponent,
  FinancialComponent,
  PopularityComponent,
  SocialMediaComponent,
  LifestyleComponent,
  WellnessComponent,
  BookerStatsComponent
} from './Component.js';

/**
 * EntityFactory - Creates game entities
 */
export class EntityFactory {
  /**
   * Creates a player wrestler from character creation form data
   * @param {object} formData - Character creation form data
   * @returns {Entity} Player entity
   */
  static createPlayerWrestler(formData) {
    const entity = new Entity();

    // Archetype stat distributions
    const archetypeStats = {
      'Technical': {
        physical: { stamina: 55, strength: 10, resilience: 12, speed: 12 },
        inRing: { brawling: 10, technical: 16, aerial: 8, selling: 14, psychology: 14 },
        entertainment: { charisma: 10, micSkills: 12, acting: 10 }
      },
      'High-Flyer': {
        physical: { stamina: 60, strength: 8, resilience: 10, speed: 16 },
        inRing: { brawling: 8, technical: 10, aerial: 16, selling: 12, psychology: 10 },
        entertainment: { charisma: 12, micSkills: 10, acting: 10 }
      },
      'Brawler': {
        physical: { stamina: 55, strength: 14, resilience: 14, speed: 10 },
        inRing: { brawling: 16, technical: 8, aerial: 6, selling: 12, psychology: 10 },
        entertainment: { charisma: 14, micSkills: 10, acting: 8 }
      },
      'Powerhouse': {
        physical: { stamina: 50, strength: 18, resilience: 16, speed: 8 },
        inRing: { brawling: 14, technical: 10, aerial: 4, selling: 10, psychology: 10 },
        entertainment: { charisma: 10, micSkills: 8, acting: 10 }
      },
      'Strong Style': {
        physical: { stamina: 58, strength: 14, resilience: 14, speed: 12 },
        inRing: { brawling: 16, technical: 14, aerial: 6, selling: 12, psychology: 12 },
        entertainment: { charisma: 10, micSkills: 10, acting: 10 }
      },
      'Lucha Libre': {
        physical: { stamina: 60, strength: 10, resilience: 10, speed: 16 },
        inRing: { brawling: 8, technical: 12, aerial: 16, selling: 10, psychology: 12 },
        entertainment: { charisma: 14, micSkills: 8, acting: 12 }
      }
    };

    const stats = archetypeStats[formData.archetype] || archetypeStats['High-Flyer'];

    // Apply bonus points (10 points to distribute)
    const bonusPoints = formData.bonusPoints || {};
    for (const [stat, value] of Object.entries(bonusPoints)) {
      if (stats.physical[stat] !== undefined) {
        stats.physical[stat] += value;
      } else if (stats.inRing[stat] !== undefined) {
        stats.inRing[stat] += value;
      } else if (stats.entertainment[stat] !== undefined) {
        stats.entertainment[stat] += value;
      }
    }

    // Identity
    entity.addComponent('identity', new IdentityComponent({
      name: formData.name,
      age: formData.age,
      hometown: formData.hometown,
      gender: formData.gender,
      gimmick: formData.gimmick,
      alignment: formData.alignment,
      catchphrase: formData.catchphrase,
      entranceStyle: formData.entranceStyle
    }));

    // Stats
    entity.addComponent('physicalStats', new PhysicalStatsComponent(stats.physical));
    entity.addComponent('inRingStats', new InRingStatsComponent(stats.inRing));
    entity.addComponent('entertainmentStats', new EntertainmentStatsComponent(stats.entertainment));

    // Other components
    entity.addComponent('condition', new ConditionComponent());
    entity.addComponent('moveset', new MovesetComponent());
    entity.addComponent('careerStats', new CareerStatsComponent());
    entity.addComponent('promotionRecord', new PromotionRecordComponent());
    entity.addComponent('contract', new ContractComponent());
    entity.addComponent('financial', new FinancialComponent({ bankBalance: 500 }));
    entity.addComponent('popularity', new PopularityComponent({ overness: 5 }));
    entity.addComponent('socialMedia', new SocialMediaComponent());
    entity.addComponent('lifestyle', new LifestyleComponent());
    entity.addComponent('wellness', new WellnessComponent());

    // Add rookie tag
    entity.addTag('[Rookie]');

    return entity;
  }

  /**
   * Creates an NPC wrestler from JSON data
   * @param {object} jsonEntry - Wrestler JSON data
   * @returns {Entity} NPC entity
   */
  static createNPCFromJSON(jsonEntry) {
    const entity = new Entity();

    entity.addComponent('identity', new IdentityComponent({
      name: jsonEntry.name,
      age: jsonEntry.age,
      hometown: jsonEntry.hometown,
      gender: jsonEntry.gender,
      gimmick: jsonEntry.gimmick,
      alignment: jsonEntry.alignment,
      catchphrase: jsonEntry.catchphrase,
      entranceStyle: jsonEntry.entranceStyle
    }));

    if (jsonEntry.stats) {
      entity.addComponent('physicalStats', new PhysicalStatsComponent(jsonEntry.stats.physical));
      entity.addComponent('inRingStats', new InRingStatsComponent(jsonEntry.stats.inRing));
      entity.addComponent('entertainmentStats', new EntertainmentStatsComponent(jsonEntry.stats.entertainment));
    }

    entity.addComponent('condition', new ConditionComponent());
    entity.addComponent('moveset', new MovesetComponent());
    entity.addComponent('careerStats', new CareerStatsComponent());
    entity.addComponent('promotionRecord', new PromotionRecordComponent());
    entity.addComponent('contract', new ContractComponent());
    entity.addComponent('financial', new FinancialComponent());
    entity.addComponent('popularity', new PopularityComponent({ overness: jsonEntry.overness || 5 }));
    entity.addComponent('socialMedia', new SocialMediaComponent());
    entity.addComponent('lifestyle', new LifestyleComponent());
    entity.addComponent('wellness', new WellnessComponent());

    return entity;
  }

  /**
   * Creates a promotion from JSON data
   * @param {object} jsonEntry - Promotion JSON data
   * @returns {object} Promotion object
   */
  static createPromotion(jsonEntry) {
    return {
      id: jsonEntry.id || `promo_${Date.now()}`,
      name: jsonEntry.name,
      region: jsonEntry.region,
      prestige: jsonEntry.prestige || 50,
      stylePreference: jsonEntry.stylePreference || 'Mixed',
      roster: jsonEntry.roster || [],
      championships: jsonEntry.championships || [],
      shows: jsonEntry.shows || [],
      pleSchedule: jsonEntry.pleSchedule || [],
      bankBalance: jsonEntry.bankBalance || 100000,
      tvDeal: jsonEntry.tvDeal || null,
      wellnessPolicy: jsonEntry.wellnessPolicy || { enabled: false }
    };
  }

  /**
   * Creates a championship from JSON data
   * @param {object} jsonEntry - Championship JSON data
   * @returns {object} Championship object
   */
  static createChampionship(jsonEntry) {
    return {
      id: jsonEntry.id || `title_${Date.now()}`,
      name: jsonEntry.name,
      prestige: jsonEntry.prestige || 50,
      promotionId: jsonEntry.promotionId || null,
      currentChampion: jsonEntry.currentChampion || jsonEntry.currentHolder || null,
      reigns: jsonEntry.reigns || jsonEntry.reignHistory || []
    };
  }

  /**
   * Generates a random indie wrestler
   * @param {string} region - Region for the wrestler
   * @returns {Entity} Random indie wrestler
   */
  static generateRandomIndie(region = 'USA') {
    const archetypes = ['Technical', 'High-Flyer', 'Brawler', 'Powerhouse', 'Strong Style', 'Lucha Libre'];
    const alignments = ['Face', 'Heel', 'Tweener'];

    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    const alignment = alignments[Math.floor(Math.random() * alignments.length)];

    const firstNames = ['Mike', 'John', 'Chris', 'Dave', 'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    const formData = {
      name: `${firstName} ${lastName}`,
      age: 18 + Math.floor(Math.random() * 7), // 18-25
      hometown: region,
      gender: Math.random() > 0.5 ? 'Male' : 'Female',
      gimmick: archetype,
      alignment,
      archetype,
      catchphrase: '',
      entranceStyle: 'Simple'
    };

    const entity = this.createPlayerWrestler(formData);
    entity.isPlayer = false;
    return entity;
  }
}

export default EntityFactory;
