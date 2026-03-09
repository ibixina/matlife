/**
 * EntityFactory for Mat Life: Wrestling Simulator
 * Creates entities from JSON data or character creation
 */

import { Entity } from "./Entity.js";
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
  BookerStatsComponent,
} from "./Component.js";

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
      Technical: {
        physical: { stamina: 55, strength: 10, resilience: 12, speed: 12 },
        inRing: {
          brawling: 10,
          technical: 16,
          aerial: 8,
          selling: 14,
          psychology: 14,
        },
        entertainment: { charisma: 10, micSkills: 12, acting: 10 },
      },
      "High-Flyer": {
        physical: { stamina: 60, strength: 8, resilience: 10, speed: 16 },
        inRing: {
          brawling: 8,
          technical: 10,
          aerial: 16,
          selling: 12,
          psychology: 10,
        },
        entertainment: { charisma: 12, micSkills: 10, acting: 10 },
      },
      Brawler: {
        physical: { stamina: 55, strength: 14, resilience: 14, speed: 10 },
        inRing: {
          brawling: 16,
          technical: 8,
          aerial: 6,
          selling: 12,
          psychology: 10,
        },
        entertainment: { charisma: 14, micSkills: 10, acting: 8 },
      },
      Powerhouse: {
        physical: { stamina: 50, strength: 18, resilience: 16, speed: 8 },
        inRing: {
          brawling: 14,
          technical: 10,
          aerial: 4,
          selling: 10,
          psychology: 10,
        },
        entertainment: { charisma: 10, micSkills: 8, acting: 10 },
      },
      "Strong Style": {
        physical: { stamina: 58, strength: 14, resilience: 14, speed: 12 },
        inRing: {
          brawling: 16,
          technical: 14,
          aerial: 6,
          selling: 12,
          psychology: 12,
        },
        entertainment: { charisma: 10, micSkills: 10, acting: 10 },
      },
      "Lucha Libre": {
        physical: { stamina: 60, strength: 10, resilience: 10, speed: 16 },
        inRing: {
          brawling: 8,
          technical: 12,
          aerial: 16,
          selling: 10,
          psychology: 12,
        },
        entertainment: { charisma: 14, micSkills: 8, acting: 12 },
      },
    };

    const stats =
      archetypeStats[formData.archetype] || archetypeStats["High-Flyer"];

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
    entity.addComponent(
      "identity",
      new IdentityComponent({
        name: formData.name,
        age: formData.age,
        hometown: formData.hometown,
        gender: formData.gender,
        gimmick: formData.gimmick,
        alignment: formData.alignment,
        catchphrase: formData.catchphrase,
        entranceStyle: formData.entranceStyle,
        archetype: formData.archetype,
      }),
    );

    // Stats
    entity.addComponent(
      "physicalStats",
      new PhysicalStatsComponent(stats.physical),
    );
    entity.addComponent("inRingStats", new InRingStatsComponent(stats.inRing));
    entity.addComponent(
      "entertainmentStats",
      new EntertainmentStatsComponent(stats.entertainment),
    );

    // Other components
    entity.addComponent("condition", new ConditionComponent());
    entity.addComponent("moveset", new MovesetComponent());
    entity.addComponent("careerStats", new CareerStatsComponent());
    entity.addComponent("promotionRecord", new PromotionRecordComponent());
    entity.addComponent("contract", new ContractComponent());
    entity.addComponent(
      "financial",
      new FinancialComponent({ bankBalance: 500 }),
    );
    entity.addComponent("popularity", new PopularityComponent({ overness: 5 }));
    entity.addComponent("socialMedia", new SocialMediaComponent());
    entity.addComponent("lifestyle", new LifestyleComponent());
    entity.addComponent("wellness", new WellnessComponent());

    // Add rookie tag
    entity.addTag("[Rookie]");

    return entity;
  }

  /**
   * Creates a player booker/promoter entity.
   * @param {object} formData
   * @returns {Entity}
   */
  static createPlayerBooker(formData) {
    const entity = new Entity();

    entity.addComponent(
      "identity",
      new IdentityComponent({
        name: formData.bookerName || formData.name || "Booker",
        age: formData.age || 32,
        hometown: formData.hometown || formData.promotionRegion || "Unknown",
        gender: formData.gender || "Unknown",
        gimmick: formData.promotionName || "Promotion Booker",
        alignment: "Neutral",
        catchphrase: "",
        entranceStyle: "Office",
      }),
    );

    entity.addComponent(
      "physicalStats",
      new PhysicalStatsComponent({
        stamina: 45,
        strength: 8,
        resilience: 10,
        speed: 8,
      }),
    );
    entity.addComponent(
      "inRingStats",
      new InRingStatsComponent({
        brawling: 8,
        technical: 10,
        aerial: 6,
        selling: 10,
        psychology: 14,
      }),
    );
    entity.addComponent(
      "entertainmentStats",
      new EntertainmentStatsComponent({
        charisma: 14,
        micSkills: 14,
        acting: 12,
      }),
    );
    entity.addComponent(
      "condition",
      new ConditionComponent({
        health: 100,
        energy: 85,
        mentalHealth: 75,
      }),
    );
    entity.addComponent("careerStats", new CareerStatsComponent());
    entity.addComponent("promotionRecord", new PromotionRecordComponent());
    entity.addComponent("contract", new ContractComponent());
    entity.addComponent(
      "financial",
      new FinancialComponent({
        bankBalance: formData.sandboxMode ? 5000000 : 250000,
        weeklyExpenses: 250,
      }),
    );
    entity.addComponent(
      "popularity",
      new PopularityComponent({
        overness: 35,
        momentum: 50,
      }),
    );
    entity.addComponent(
      "socialMedia",
      new SocialMediaComponent({
        followers: 5000,
      }),
    );
    entity.addComponent("lifestyle", new LifestyleComponent());
    entity.addComponent("wellness", new WellnessComponent());
    entity.addComponent(
      "bookerStats",
      new BookerStatsComponent({
        creativity: formData.bookerBonusPoints?.creativity ?? 16,
        strictness: formData.bookerBonusPoints?.strictness ?? 12,
      }),
    );

    return entity;
  }

  /**
   * Creates an NPC wrestler from JSON data
   * @param {object} jsonEntry - Wrestler JSON data
   * @returns {Entity} NPC entity
   */
  static createNPCFromJSON(jsonEntry) {
    const entity = new Entity();

    entity.addComponent(
      "identity",
      new IdentityComponent({
        name: jsonEntry.name,
        age: jsonEntry.age,
        hometown: jsonEntry.hometown || "Unknown",
        gender: jsonEntry.gender || "Male",
        gimmick: jsonEntry.gimmick || jsonEntry.archetype || "Wrestler",
        alignment: jsonEntry.alignment || (() => {
          const alignments = ["Face", "Heel", "Tweener"];
          return alignments[Math.floor(Math.random() * alignments.length)];
        })(),
        catchphrase: jsonEntry.catchphrase || "",
        entranceStyle: jsonEntry.entranceStyle || "Simple",
      }),
    );

    // Archetype-based stats if not provided
    const archetypeStats = {
      Technical: {
        physical: { stamina: 70, strength: 60, resilience: 65, speed: 60 },
        inRing: {
          brawling: 60,
          technical: 85,
          aerial: 50,
          selling: 80,
          psychology: 80,
        },
        entertainment: { charisma: 70, micSkills: 75, acting: 70 },
      },
      "High-Flyer": {
        physical: { stamina: 75, strength: 50, resilience: 60, speed: 90 },
        inRing: {
          brawling: 50,
          technical: 60,
          aerial: 90,
          selling: 75,
          psychology: 70,
        },
        entertainment: { charisma: 75, micSkills: 65, acting: 70 },
      },
      Brawler: {
        physical: { stamina: 70, strength: 75, resilience: 75, speed: 55 },
        inRing: {
          brawling: 90,
          technical: 55,
          aerial: 45,
          selling: 75,
          psychology: 70,
        },
        entertainment: { charisma: 80, micSkills: 70, acting: 65 },
      },
      Powerhouse: {
        physical: { stamina: 65, strength: 90, resilience: 85, speed: 50 },
        inRing: {
          brawling: 80,
          technical: 60,
          aerial: 40,
          selling: 70,
          psychology: 70,
        },
        entertainment: { charisma: 75, micSkills: 60, acting: 70 },
      },
      "Strong Style": {
        physical: { stamina: 75, strength: 75, resilience: 80, speed: 65 },
        inRing: {
          brawling: 85,
          technical: 75,
          aerial: 50,
          selling: 80,
          psychology: 80,
        },
        entertainment: { charisma: 65, micSkills: 65, acting: 65 },
      },
      "Lucha Libre": {
        physical: { stamina: 75, strength: 60, resilience: 60, speed: 90 },
        inRing: {
          brawling: 60,
          technical: 70,
          aerial: 90,
          selling: 70,
          psychology: 75,
        },
        entertainment: { charisma: 85, micSkills: 60, acting: 80 },
      },
    };

    const baseStats =
      archetypeStats[jsonEntry.archetype] || archetypeStats["Technical"];

    const physical = jsonEntry.stats?.physical || baseStats.physical;
    const inRing = jsonEntry.stats?.inRing || baseStats.inRing;
    const entertainment =
      jsonEntry.stats?.entertainment || baseStats.entertainment;

    // Scale stats by overness (crude approximation)
    const multiplier = 0.5 + (jsonEntry.overness || 50) / 100;

    const scaledPhysical = {};
    Object.entries(physical).forEach(
      ([k, v]) =>
        (scaledPhysical[k] = Math.min(100, Math.round(v * multiplier))),
    );

    const scaledInRing = {};
    Object.entries(inRing).forEach(
      ([k, v]) => (scaledInRing[k] = Math.min(100, Math.round(v * multiplier))),
    );

    const scaledEntertainment = {};
    Object.entries(entertainment).forEach(
      ([k, v]) =>
        (scaledEntertainment[k] = Math.min(100, Math.round(v * multiplier))),
    );

    entity.addComponent(
      "physicalStats",
      new PhysicalStatsComponent(scaledPhysical),
    );
    entity.addComponent("inRingStats", new InRingStatsComponent(scaledInRing));
    entity.addComponent(
      "entertainmentStats",
      new EntertainmentStatsComponent(scaledEntertainment),
    );

    entity.addComponent("condition", new ConditionComponent());
    entity.addComponent("moveset", new MovesetComponent());
    entity.addComponent("careerStats", new CareerStatsComponent());
    entity.addComponent("promotionRecord", new PromotionRecordComponent());
    entity.addComponent("contract", new ContractComponent());
    entity.addComponent("financial", new FinancialComponent());
    entity.addComponent(
      "popularity",
      new PopularityComponent({
        overness: jsonEntry.overness || 5,
        momentum: 50,
      }),
    );
    entity.addComponent("socialMedia", new SocialMediaComponent());
    entity.addComponent("lifestyle", new LifestyleComponent());
    entity.addComponent("wellness", new WellnessComponent());

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
      stylePreference: jsonEntry.stylePreference || "Mixed",
      roster: jsonEntry.roster || [],
      championships: jsonEntry.championships || [],
      shows: jsonEntry.shows || [],
      pleSchedule: jsonEntry.pleSchedule || [],
      bankBalance: jsonEntry.bankBalance || 100000,
      tvDeal: jsonEntry.tvDeal || null,
      wellnessPolicy: jsonEntry.wellnessPolicy || { enabled: false },
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
      currentChampion:
        jsonEntry.currentChampion || jsonEntry.currentHolder || null,
      reigns: jsonEntry.reigns || jsonEntry.reignHistory || [],
    };
  }

  /**
   * Generates a random indie wrestler
   * @param {string} region - Region for the wrestler
   * @returns {Entity} Random indie wrestler
   */
  static generateRandomIndie(region = "USA") {
    const archetypes = [
      "Technical",
      "High-Flyer",
      "Brawler",
      "Powerhouse",
      "Strong Style",
      "Lucha Libre",
    ];
    const alignments = ["Face", "Heel", "Tweener"];

    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    const alignment = alignments[Math.floor(Math.random() * alignments.length)];

    const firstNames = [
      "Mike",
      "John",
      "Chris",
      "Dave",
      "Alex",
      "Sam",
      "Jordan",
      "Casey",
      "Riley",
      "Morgan",
    ];
    const lastNames = [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
    ];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    const formData = {
      name: `${firstName} ${lastName}`,
      age: 18 + Math.floor(Math.random() * 7), // 18-25
      hometown: region,
      gender: Math.random() > 0.5 ? "Male" : "Female",
      gimmick: archetype,
      alignment,
      archetype,
      catchphrase: "",
      entranceStyle: "Simple",
    };

    const entity = this.createPlayerWrestler(formData);
    entity.isPlayer = false;
    return entity;
  }
}

export default EntityFactory;
