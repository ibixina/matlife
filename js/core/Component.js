/**
 * Component Classes for Mat Life: Wrestling Simulator
 * Step 1.2 of Implementation Plan
 * Implements all components from MASTER_PLAN §2.4
 */

import { deepClone } from './Utils.js';

// Base Component class
export class Component {
  serialize() {
    const obj = {};
    for (const key of Object.keys(this)) {
      if (this[key] instanceof Map) {
        obj[key] = Array.from(this[key].entries());
      } else if (this[key] instanceof Set) {
        obj[key] = Array.from(this[key]);
      } else {
        obj[key] = deepClone(this[key]);
      }
    }
    return obj;
  }

  static deserialize(data) {
    throw new Error('deserialize() must be implemented by subclass');
  }
}

// 1. Identity Component
export class IdentityComponent extends Component {
  constructor(options = {}) {
    super();
    this.name = options.name ?? 'Unknown';
    this.age = options.age ?? 20;
    this.hometown = options.hometown ?? 'Unknown';
    this.gender = options.gender ?? 'Unknown';
    this.gimmick = options.gimmick ?? '';
    this.alignment = options.alignment ?? 'Face';
    this.catchphrase = options.catchphrase ?? '';
    this.entranceStyle = options.entranceStyle ?? 'Simple';
  }

  static deserialize(data) {
    return new IdentityComponent(data);
  }
}

// 2. Physical Stats Component
export class PhysicalStatsComponent extends Component {
  constructor(options = {}) {
    super();
    this.stamina = options.stamina ?? 50;
    this.strength = options.strength ?? 10;
    this.resilience = options.resilience ?? 10;
    this.speed = options.speed ?? 10;
    // Dynamic stamina recovery system
    this.staminaRecoveryMax = options.staminaRecoveryMax ?? 100; // Current max recovery level
    this.daysSinceFullRest = options.daysSinceFullRest ?? 0; // Days since stamina hit 100
  }

  static deserialize(data) {
    return new PhysicalStatsComponent(data);
  }
}

// 3. In-Ring Stats Component
export class InRingStatsComponent extends Component {
  constructor(options = {}) {
    super();
    this.brawling = options.brawling ?? 10;
    this.technical = options.technical ?? 10;
    this.aerial = options.aerial ?? 10;
    this.selling = options.selling ?? 10;
    this.psychology = options.psychology ?? 10;
  }

  static deserialize(data) {
    return new InRingStatsComponent(data);
  }
}

// 4. Entertainment Stats Component
export class EntertainmentStatsComponent extends Component {
  constructor(options = {}) {
    super();
    this.charisma = options.charisma ?? 10;
    this.micSkills = options.micSkills ?? 10;
    this.acting = options.acting ?? 10;
  }

  static deserialize(data) {
    return new EntertainmentStatsComponent(data);
  }
}

// 5. Condition Component
export class ConditionComponent extends Component {
  constructor(options = {}) {
    super();
    this.health = options.health ?? 100;
    this.energy = options.energy ?? 100;
    this.injuries = options.injuries ?? [];
    this.mentalHealth = options.mentalHealth ?? 75;
  }

  static deserialize(data) {
    return new ConditionComponent(data);
  }
}

// 6. Moveset Component
export class MovesetComponent extends Component {
  constructor(options = {}) {
    super();
    this.signatures = options.signatures ?? [];
    this.finishers = options.finishers ?? [];
    this.movePool = options.movePool ?? [];
  }

  static deserialize(data) {
    return new MovesetComponent(data);
  }
}

// 7. Career Stats Component
export class CareerStatsComponent extends Component {
  constructor(options = {}) {
    super();
    this.totalWins = options.totalWins ?? 0;
    this.totalLosses = options.totalLosses ?? 0;
    this.draws = options.draws ?? 0;
    this.titleReigns = options.titleReigns ?? [];
    this.bestMatchRating = options.bestMatchRating ?? 0;
    this.hallOfFamePoints = options.hallOfFamePoints ?? 0;
    this.consecutiveWins = options.consecutiveWins ?? 0;
    this.yearsActive = options.yearsActive ?? 0;
    this.injuriesCausedCount = options.injuriesCausedCount ?? 0;
    this.matchesThisWeek = options.matchesThisWeek ?? 0;
  }

  static deserialize(data) {
    return new CareerStatsComponent(data);
  }
}

// 8. Promotion Record Component
export class PromotionRecordComponent extends Component {
  constructor(options = {}) {
    super();
    this.records = new Map(options.records ?? []);
  }

  serialize() {
    return {
      records: Array.from(this.records.entries())
    };
  }

  static deserialize(data) {
    return new PromotionRecordComponent({ records: data.records });
  }
}

// 9. Contract Component
export class ContractComponent extends Component {
  constructor(options = {}) {
    super();
    this.promotionId = options.promotionId ?? null;
    this.weeklySalary = options.weeklySalary ?? 0;
    this.lengthWeeks = options.lengthWeeks ?? 0;
    this.remainingWeeks = options.remainingWeeks ?? 0;
    this.hasCreativeControl = options.hasCreativeControl ?? false;
    this.hasMerchCut = options.hasMerchCut ?? 0;
    this.tvAppearanceBonus = options.tvAppearanceBonus ?? 0;
    this.noCompeteWeeks = options.noCompeteWeeks ?? 0;
    this.injuryCoveragePct = options.injuryCoveragePct ?? 0;
    this.datesPerMonth = options.datesPerMonth ?? 4;
    this.titleOpportunityGuaranteed = options.titleOpportunityGuaranteed ?? false;
    this.championshipOpportunityWeeks = options.championshipOpportunityWeeks ?? 0;
    this.position = options.position ?? null;
    this.negotiatedSalary = options.negotiatedSalary ?? null;
    this.recentOpponents = options.recentOpponents ?? [];
  }

  static deserialize(data) {
    return new ContractComponent(data);
  }
}

// 10. Financial Component
export class FinancialComponent extends Component {
  constructor(options = {}) {
    super();
    this.bankBalance = options.bankBalance ?? 500;
    this.weeklyExpenses = options.weeklyExpenses ?? 100;
    this.merchandiseIncome = options.merchandiseIncome ?? 0;
    this.sponsorships = options.sponsorships ?? [];
    this.investments = options.investments ?? [];
    this.agent = options.agent ?? null;
    this.investmentAgent = options.investmentAgent ?? null;
    this.medicalDebt = options.medicalDebt ?? 0;
  }

  static deserialize(data) {
    return new FinancialComponent(data);
  }
}

// 11. Popularity Component
export class PopularityComponent extends Component {
  constructor(options = {}) {
    super();
    this.overness = options.overness ?? 5;
    this.momentum = options.momentum ?? 0;
    this.regionPop = new Map(options.regionPop ?? []);
  }

  serialize() {
    return {
      overness: this.overness,
      momentum: this.momentum,
      regionPop: Array.from(this.regionPop.entries())
    };
  }

  static deserialize(data) {
    return new PopularityComponent({
      overness: data.overness,
      momentum: data.momentum,
      regionPop: data.regionPop
    });
  }
}

// 12. Social Media Component
export class SocialMediaComponent extends Component {
  constructor(options = {}) {
    super();
    this.followers = options.followers ?? 0;
    this.postFrequency = options.postFrequency ?? 'never';
    this.scandalRisk = options.scandalRisk ?? 0;
  }

  static deserialize(data) {
    return new SocialMediaComponent(data);
  }
}

// 13. Lifestyle Component
export class LifestyleComponent extends Component {
  constructor(options = {}) {
    super();
    this.workRate = options.workRate ?? 0;
    this.travelFatigue = options.travelFatigue ?? 0;
    this.burnout = options.burnout ?? 0;
    this.familyMorale = options.familyMorale ?? 50;
    this.sideHustles = options.sideHustles ?? [];
  }

  static deserialize(data) {
    return new LifestyleComponent(data);
  }
}

// 14. Wellness Component
export class WellnessComponent extends Component {
  constructor(options = {}) {
    super();
    this.pedUsage = options.pedUsage ?? false;
    this.pedDetectionRisk = options.pedDetectionRisk ?? 0;
    this.wellnessStrikes = options.wellnessStrikes ?? 0;
    this.lastTestWeek = options.lastTestWeek ?? 0;
  }

  static deserialize(data) {
    return new WellnessComponent(data);
  }
}

// 15. Booker Stats Component
export class BookerStatsComponent extends Component {
  constructor(options = {}) {
    super();
    this.creativity = options.creativity ?? 10;
    this.strictness = options.strictness ?? 10;
    this.favoritism = new Map(options.favoritism ?? []);
  }

  serialize() {
    return {
      creativity: this.creativity,
      strictness: this.strictness,
      favoritism: Array.from(this.favoritism.entries())
    };
  }

  static deserialize(data) {
    return new BookerStatsComponent({
      creativity: data.creativity,
      strictness: data.strictness,
      favoritism: data.favoritism
    });
  }
}

// Component registry for deserialization
export const COMPONENT_REGISTRY = {
  identity: IdentityComponent,
  physicalStats: PhysicalStatsComponent,
  inRingStats: InRingStatsComponent,
  entertainmentStats: EntertainmentStatsComponent,
  condition: ConditionComponent,
  moveset: MovesetComponent,
  careerStats: CareerStatsComponent,
  promotionRecord: PromotionRecordComponent,
  contract: ContractComponent,
  financial: FinancialComponent,
  popularity: PopularityComponent,
  socialMedia: SocialMediaComponent,
  lifestyle: LifestyleComponent,
  wellness: WellnessComponent,
  bookerStats: BookerStatsComponent
};

/**
 * Deserializes a component by name
 * @param {string} name - Component name
 * @param {object} data - Serialized component data
 * @returns {Component} Deserialized component
 */
export function deserializeComponent(name, data) {
  const ComponentClass = COMPONENT_REGISTRY[name];
  if (!ComponentClass) {
    throw new Error(`Unknown component: ${name}`);
  }
  return ComponentClass.deserialize(data);
}
