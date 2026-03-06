import { gameStateManager } from "../core/GameStateManager.js";
import { generateUUID, randomInt, clamp } from "../core/Utils.js";
import EntityFactory from "../core/EntityFactory.js";
import ContractEngine from "./ContractEngine.js";
import ChampionshipSystem from "./ChampionshipSystem.js";
import StorylineManager from "./StorylineManager.js";
import RelationshipManager from "./RelationshipManager.js";
import CardPositionSystem from "./CardPositionSystem.js";

const MATCH_TYPES = [
  "Standard Singles",
  "Tag Team",
  "Triple Threat",
  "Fatal Four Way",
  "No DQ",
  "Steel Cage",
  "Ladder Match",
  "Submission Match",
  "Falls Count Anywhere",
  "Battle Royal",
];

const SEGMENT_TYPES = [
  "Solo Promo",
  "Face-Off",
  "Contract Signing",
  "Backstage Interview",
  "Hype Package",
  "Open Challenge",
];

const BOOKING_STYLES = {
  traditionalist: {
    name: "Traditionalist",
    matchBonus: { technical: 0.12, psychology: 0.14 },
    promoBonus: 0.02,
    chaosPenalty: 0.1,
    crowdBias: "steady",
  },
  sports_entertainment: {
    name: "Sports Entertainment",
    matchBonus: { charisma: 0.12, acting: 0.12 },
    promoBonus: 0.16,
    chaosPenalty: 0.03,
    crowdBias: "spectacle",
  },
  workrate: {
    name: "Workrate",
    matchBonus: {
      brawling: 0.08,
      technical: 0.16,
      aerial: 0.12,
      psychology: 0.1,
    },
    promoBonus: -0.02,
    chaosPenalty: 0.06,
    crowdBias: "athletic",
  },
  lucha: {
    name: "Lucha Spectacle",
    matchBonus: { aerial: 0.18, charisma: 0.05 },
    promoBonus: 0.04,
    chaosPenalty: 0.04,
    crowdBias: "flashy",
  },
  hardcore: {
    name: "Hardcore Chaos",
    matchBonus: { brawling: 0.16, resilience: 0.08 },
    promoBonus: -0.04,
    chaosPenalty: -0.08,
    crowdBias: "violent",
  },
  storyteller: {
    name: "Storyteller",
    matchBonus: { psychology: 0.18, charisma: 0.08, micSkills: 0.08 },
    promoBonus: 0.12,
    chaosPenalty: 0.02,
    crowdBias: "dramatic",
  },
};

const PUSH_TO_POSITION = {
  buried: "dark_match",
  lower_mid: "opener",
  steady: "mid_card",
  featured: "upper_mid",
  main_event: "main_event",
};

const POSITION_TO_PUSH = {
  dark_match: "buried",
  pre_show: "buried",
  opener: "lower_mid",
  mid_card: "steady",
  upper_mid: "featured",
  main_event: "main_event",
};

function average(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function pickRandom(items) {
  if (!items?.length) return null;
  return items[randomInt(0, items.length - 1)];
}

function getIdentityName(entity) {
  return entity?.getComponent("identity")?.name || "Unknown";
}

export class BookerModeEngine {
  static getMatchTypes() {
    return MATCH_TYPES.slice();
  }

  static getSegmentTypes() {
    return SEGMENT_TYPES.slice();
  }

  static getBookingStyles() {
    return { ...BOOKING_STYLES };
  }

  static getPlayerPromotion(state = gameStateManager.getStateRef()) {
    if (!state) return null;
    const directId = state.player?.promotionId;
    if (directId && state.promotions.has(directId)) {
      const promotion = state.promotions.get(directId);
      this.ensurePromotionData(promotion, state);
      return promotion;
    }

    for (const promotion of state.promotions.values()) {
      if (promotion.isPlayerPromotion) {
        state.player.promotionId = promotion.id;
        this.ensurePromotionData(promotion, state);
        return promotion;
      }
    }

    return null;
  }

  static isCurrentShowDay(promotion, state = gameStateManager.getStateRef()) {
    if (!promotion) return false;
    const show = this.ensureCurrentShow(promotion, state);
    return (
      show.week === state.calendar.absoluteWeek &&
      show.day === state.calendar.day
    );
  }

  static ensurePromotionData(
    promotion,
    state = gameStateManager.getStateRef(),
  ) {
    if (!promotion) return null;

    promotion.bankBalance = Number.isFinite(promotion.bankBalance)
      ? promotion.bankBalance
      : 150000;
    promotion.stylePreference = promotion.stylePreference || "Mixed";
    promotion.ticketPrice =
      promotion.ticketPrice ??
      Math.max(15, Math.round(promotion.prestige * 0.9));
    promotion.venueSize =
      promotion.venueSize ?? Math.max(300, promotion.prestige * 90);
    promotion.productionLevel =
      promotion.productionLevel ??
      clamp(Math.round(promotion.prestige * 0.85), 25, 100);
    promotion.marketing =
      promotion.marketing ??
      clamp(Math.round(promotion.prestige * 0.7), 15, 100);
    promotion.fanLoyalty =
      promotion.fanLoyalty ??
      clamp(Math.round(promotion.prestige * 0.75), 20, 100);
    promotion.bookingReputation =
      promotion.bookingReputation ??
      clamp(Math.round(promotion.prestige * 0.7), 20, 100);
    promotion.lockerRoomMorale = promotion.lockerRoomMorale ?? 60;
    promotion.medicalTeam =
      promotion.medicalTeam ??
      clamp(Math.round(promotion.prestige * 0.65), 10, 100);
    promotion.scoutingBudget =
      promotion.scoutingBudget ??
      clamp(Math.round(promotion.prestige * 0.55), 5, 100);
    promotion.trainingFacility =
      promotion.trainingFacility ??
      clamp(Math.round(promotion.prestige * 0.5), 5, 100);
    promotion.weeklyOverhead =
      promotion.weeklyOverhead ??
      Math.max(500, Math.round(promotion.productionLevel * 45));
    promotion.sponsorRevenue =
      promotion.sponsorRevenue ??
      Math.max(0, Math.round(promotion.prestige * 25));
    promotion.sandboxMode = promotion.sandboxMode === true;
    promotion.showHistory = Array.isArray(promotion.showHistory)
      ? promotion.showHistory
      : [];
    promotion.pendingComplaints = Array.isArray(promotion.pendingComplaints)
      ? promotion.pendingComplaints
      : [];
    promotion.scoutingReport = Array.isArray(promotion.scoutingReport)
      ? promotion.scoutingReport
      : [];
    promotion.rosterNotes = promotion.rosterNotes || {};
    promotion.creative = promotion.creative || {};
    promotion.creative.currentShow = promotion.creative.currentShow || null;
    promotion.creative.storySeeds = Array.isArray(promotion.creative.storySeeds)
      ? promotion.creative.storySeeds
      : [];
    promotion.creative.lastShowResult =
      promotion.creative.lastShowResult || null;
    promotion.businessHistory = Array.isArray(promotion.businessHistory)
      ? promotion.businessHistory
      : [];
    promotion.monthlyPLEWeek = promotion.monthlyPLEWeek ?? 4;
    promotion.brand = promotion.brand || {};
    promotion.brand.bookingStyle =
      promotion.brand.bookingStyle || "storyteller";
    promotion.brand.product =
      promotion.brand.product || promotion.stylePreference;
    promotion.brand.description =
      promotion.brand.description ||
      "Balanced wrestling with room for long-term stories.";
    promotion.tvDeal = promotion.tvDeal || {
      name:
        promotion.prestige >= 70
          ? "National TV"
          : promotion.prestige >= 40
            ? "Regional TV"
            : "Streaming Package",
      weeklyRights: Math.max(0, Math.round(promotion.prestige * 20)),
    };

    if (!promotion.creative.currentShow) {
      promotion.creative.currentShow = this.createShowTemplate(
        promotion,
        state,
      );
    }

    if (!promotion.scoutingReport.length) {
      this.refreshScoutingReport(promotion, state);
    }

    return promotion;
  }

  static createPlayerPromotion(
    config,
    player,
    state = gameStateManager.getStateRef(),
  ) {
    const promotionId = `player_promo_${generateUUID().slice(0, 8)}`;
    const prestige = config.sandboxMode
      ? 88
      : config.startType === "custom_indie"
        ? 22
        : 42;
    const promotion = {
      id: promotionId,
      name: config.promotionName || "Frontier Grappling League",
      shortName: (config.promotionName || "FGL").slice(0, 12),
      region: config.region || "USA",
      prestige,
      roster: [],
      shows: [{ day: 5 }],
      pleSchedule: [{ week: 4, day: 6 }],
      stylePreference: config.productStyle || "Mixed",
      momentum: 50,
      isPlayerPromotion: true,
      bankBalance: config.sandboxMode
        ? 5000000
        : config.startType === "custom_indie"
          ? 250000
          : 750000,
      sandboxMode: config.sandboxMode === true,
      ownerId: player?.id || null,
      brand: {
        bookingStyle: config.bookingStyle || "storyteller",
        product: config.productStyle || "Mixed",
        description:
          config.brandDescription ||
          "A player-run promotion focused on strong cards and evolving stories.",
      },
    };

    state.promotions.set(promotion.id, promotion);
    state.player.promotionId = promotion.id;
    this.ensurePromotionData(promotion, state);

    const initialTalent = this.acquireStartingRoster(promotion, state, config);
    for (const wrestler of initialTalent) {
      this.signTalent(
        promotion,
        wrestler,
        {
          lengthWeeks: config.sandboxMode ? 104 : 32,
          salary: config.sandboxMode
            ? 2500 + wrestler.getComponent("popularity")?.overness * 30
            : undefined,
          force: config.sandboxMode,
          quiet: true,
        },
        state,
      );
    }

    ChampionshipSystem.initializePromotionChampionships(promotion);
    this.ensurePromotionData(promotion, state);
    return promotion;
  }

  static takeoverPromotion(
    promotionId,
    player,
    config = {},
    state = gameStateManager.getStateRef(),
  ) {
    const promotion = state.promotions.get(promotionId);
    if (!promotion) return null;

    promotion.isPlayerPromotion = true;
    promotion.ownerId = player?.id || null;
    promotion.sandboxMode = config.sandboxMode === true;
    promotion.brand = promotion.brand || {};
    promotion.brand.bookingStyle =
      config.bookingStyle || promotion.brand.bookingStyle || "storyteller";
    promotion.brand.product =
      config.productStyle ||
      promotion.brand.product ||
      promotion.stylePreference ||
      "Mixed";
    promotion.brand.description =
      config.brandDescription ||
      promotion.brand.description ||
      `A new creative era for ${promotion.name}.`;
    state.player.promotionId = promotion.id;

    this.ensurePromotionData(promotion, state);
    ChampionshipSystem.ensurePromotionChampions(promotion);
    return promotion;
  }

  static acquireStartingRoster(promotion, state, config = {}) {
    const available = this.getAvailableTalent(state, promotion, true).sort(
      (a, b) =>
        (b.getComponent("popularity")?.overness || 0) -
        (a.getComponent("popularity")?.overness || 0),
    );

    if (config.sandboxMode) {
      return available.slice(0, 18);
    }

    const desired = config.startType === "custom_indie" ? 10 : 14;
    const minOverness = config.startType === "custom_indie" ? 18 : 28;
    const pool = available.filter(
      (entity) =>
        (entity.getComponent("popularity")?.overness || 0) >= minOverness,
    );
    return (pool.length ? pool : available).slice(0, desired);
  }

  static getAvailableTalent(
    state = gameStateManager.getStateRef(),
    promotion = null,
    includeContractedIfSandbox = false,
  ) {
    const sandboxMode = promotion?.sandboxMode === true;
    const talent = [];

    for (const entity of state.entities.values()) {
      if (entity.isPlayer) continue;
      const contract = entity.getComponent("contract");
      const popularity = entity.getComponent("popularity");
      if (!popularity) continue;
      if (!contract?.promotionId) {
        talent.push(entity);
        continue;
      }
      if (includeContractedIfSandbox && sandboxMode) {
        talent.push(entity);
      }
    }

    return talent;
  }

  static refreshScoutingReport(
    promotion,
    state = gameStateManager.getStateRef(),
  ) {
    const pool = this.getAvailableTalent(state, promotion, true);
    const scored = pool
      .filter((entity) => !promotion.roster.includes(entity.id))
      .map((entity) => {
        const popularity = entity.getComponent("popularity");
        const inRing = entity.getComponent("inRingStats");
        const entertainment = entity.getComponent("entertainmentStats");
        const condition = entity.getComponent("condition");
        const score = average([
          popularity?.overness || 0,
          popularity?.momentum || 0,
          average([
            inRing?.brawling || 0,
            inRing?.technical || 0,
            inRing?.aerial || 0,
            inRing?.psychology || 0,
            entertainment?.charisma || 0,
            entertainment?.micSkills || 0,
          ]),
          condition?.health || 50,
        ]);

        return {
          wrestlerId: entity.id,
          name: getIdentityName(entity),
          overness: popularity?.overness || 0,
          momentum: popularity?.momentum || 0,
          fit: this.describeTalentFit(entity, promotion),
          salaryHint: ContractEngine.calculateBaseSalary(
            Math.max(10, promotion.prestige),
            popularity?.overness || 10,
            average([
              inRing?.brawling || 0,
              inRing?.technical || 0,
              inRing?.aerial || 0,
            ]),
          ),
          score: Math.round(score),
        };
      })
      .sort((a, b) => b.score - a.score);

    promotion.scoutingReport = scored.slice(0, promotion.sandboxMode ? 20 : 12);
    return promotion.scoutingReport;
  }

  static describeTalentFit(entity, promotion) {
    const inRing = entity.getComponent("inRingStats");
    const entertainment = entity.getComponent("entertainmentStats");
    const style = promotion?.brand?.bookingStyle || "storyteller";

    if (style === "workrate") {
      const strong = average([
        inRing?.technical || 0,
        inRing?.psychology || 0,
        inRing?.aerial || 0,
      ]);
      return strong >= 68
        ? "Excellent ring fit"
        : strong >= 50
          ? "Useful hand"
          : "Needs polish";
    }
    if (style === "sports_entertainment") {
      const strong = average([
        entertainment?.charisma || 0,
        entertainment?.micSkills || 0,
        entertainment?.acting || 0,
      ]);
      return strong >= 68
        ? "TV-ready personality"
        : strong >= 50
          ? "Needs scripting support"
          : "Low promo upside";
    }
    if (style === "hardcore") {
      const strong = average([
        inRing?.brawling || 0,
        entity.getComponent("physicalStats")?.resilience || 0,
      ]);
      return strong >= 68
        ? "Thrives in violent stipulations"
        : strong >= 50
          ? "Can survive the style"
          : "Safety risk";
    }

    const balanced = average([
      inRing?.psychology || 0,
      entertainment?.charisma || 0,
      inRing?.technical || 0,
      entity.getComponent("popularity")?.overness || 0,
    ]);
    return balanced >= 70
      ? "Headline-ready"
      : balanced >= 55
        ? "Strong supporting talent"
        : "Development project";
  }

  static createShowTemplate(
    promotion,
    state = gameStateManager.getStateRef(),
    weekOffset = 0,
  ) {
    const projectedWeek = state.calendar.week + weekOffset;
    const monthOffset = Math.floor((projectedWeek - 1) / 4);
    const calendarWeek = ((projectedWeek - 1) % 4) + 1;
    const month = ((state.calendar.month - 1 + monthOffset) % 12) + 1;
    const absoluteWeek = state.calendar.absoluteWeek + weekOffset;
    const isPLE = calendarWeek === (promotion.monthlyPLEWeek || 4);
    const matchSlots = isPLE ? 6 : 4;
    const segmentSlots = isPLE ? 3 : 2;
    const day = isPLE ? 6 : (promotion.shows?.[0]?.day ?? 5);
    const name = isPLE
      ? `${promotion.name} Collision Course`
      : `${promotion.name} Weekly TV`;

    const show = {
      id: generateUUID(),
      week: absoluteWeek,
      calendarWeek,
      month,
      day,
      isPLE,
      type: isPLE ? "PLE" : "TV",
      name,
      booked: [],
      locked: false,
      notes: [],
      expectedAttendance: 0,
      varietyScore: 0,
    };

    for (let i = 0; i < matchSlots; i++) {
      show.booked.push({
        id: generateUUID(),
        slotType: "match",
        label:
          i === 0
            ? "Opener"
            : i === matchSlots - 1
              ? "Main Event"
              : `Match ${i + 1}`,
        participants: [],
        matchType: "Standard Singles",
        stipulation: "Standard",
        duration: isPLE ? 16 : 12,
        bookedWinnerId: null,
        titleId: null,
        finish: "Clean",
        roadAgentNotes: "",
        result: null,
      });

      if (i < segmentSlots) {
        show.booked.push({
          id: generateUUID(),
          slotType: "segment",
          label: i === segmentSlots - 1 ? "Go-Home Angle" : `Segment ${i + 1}`,
          segmentType: i === 0 ? "Solo Promo" : "Face-Off",
          participants: [],
          focusStorylineId: null,
          duration: isPLE ? 8 : 6,
          notes: "",
          result: null,
        });
      }
    }

    return show;
  }

  static ensureCurrentShow(promotion, state = gameStateManager.getStateRef()) {
    this.ensurePromotionData(promotion, state);
    if (
      !promotion.creative.currentShow ||
      promotion.creative.currentShow.week < state.calendar.absoluteWeek
    ) {
      promotion.creative.currentShow = this.createShowTemplate(
        promotion,
        state,
      );
    }
    return promotion.creative.currentShow;
  }

  static setCurrentShowSlot(
    promotion,
    slotId,
    updates,
    state = gameStateManager.getStateRef(),
  ) {
    const show = this.ensureCurrentShow(promotion, state);
    const slot = show.booked.find((entry) => entry.id === slotId);
    if (!slot) return false;
    Object.assign(slot, updates);
    return true;
  }

  static clearCurrentShow(promotion, state = gameStateManager.getStateRef()) {
    promotion.creative.currentShow = this.createShowTemplate(
      promotion,
      state,
      1,
    );
    return promotion.creative.currentShow;
  }

  static autoBookCurrentShow(
    promotion,
    state = gameStateManager.getStateRef(),
  ) {
    const show = this.clearCurrentShow(promotion, state);
    const roster = (promotion.roster || [])
      .map((id) => state.entities.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const popA = a.getComponent("popularity")?.overness || 0;
        const popB = b.getComponent("popularity")?.overness || 0;
        return popB - popA;
      });

    const activeStorylines = Array.from(state.storylines.values()).filter(
      (storyline) =>
        storyline.active &&
        storyline.participants.some((id) => promotion.roster.includes(id)),
    );
    const activeFeuds = Array.from(state.feuds.values())
      .filter((feud) => feud.promotionId === promotion.id)
      .sort((a, b) => b.heat - a.heat);

    const used = new Set();
    const titles = ChampionshipSystem.getPromotionChampionships(promotion.id);
    const worldTitle = titles.find((title) => title.type === "world");
    const secondaryTitle = titles.find((title) => title.type !== "world");

    const pickOpponent = (wrestler) => {
      const candidates = roster.filter(
        (entity) => entity.id !== wrestler.id && !used.has(entity.id),
      );
      if (!candidates.length) return null;

      const heated = candidates.find((entity) => {
        const feud = activeFeuds.find(
          (item) =>
            (item.entityA === wrestler.id && item.entityB === entity.id) ||
            (item.entityB === wrestler.id && item.entityA === entity.id),
        );
        return feud;
      });
      return heated || candidates[0];
    };

    const matchSlots = show.booked.filter((slot) => slot.slotType === "match");
    matchSlots.forEach((slot, index) => {
      let wrestlerA = null;
      let wrestlerB = null;

      if (index === matchSlots.length - 1 && worldTitle?.currentChampion) {
        wrestlerA = state.entities.get(worldTitle.currentChampion) || null;
      }
      if (!wrestlerA) {
        wrestlerA = roster.find((entity) => !used.has(entity.id)) || null;
      }
      if (!wrestlerA) return;
      wrestlerB = pickOpponent(wrestlerA);
      if (!wrestlerB) return;

      used.add(wrestlerA.id);
      used.add(wrestlerB.id);

      const feud = activeFeuds.find(
        (item) =>
          (item.entityA === wrestlerA.id && item.entityB === wrestlerB.id) ||
          (item.entityB === wrestlerA.id && item.entityA === wrestlerB.id),
      );
      const storyline = activeStorylines.find(
        (item) =>
          item.participants.includes(wrestlerA.id) &&
          item.participants.includes(wrestlerB.id),
      );

      slot.participants = [wrestlerA.id, wrestlerB.id];
      slot.matchType =
        index === matchSlots.length - 1
          ? "Standard Singles"
          : pickRandom(MATCH_TYPES.slice(0, 5));
      slot.duration =
        index === matchSlots.length - 1
          ? show.isPLE
            ? 22
            : 16
          : show.isPLE
            ? 14
            : 11;
      slot.stipulation = feud?.heat >= 80 ? "No DQ" : "Standard";
      slot.bookedWinnerId = wrestlerA.id;
      slot.finish =
        storyline?.type === "betrayal"
          ? "Interference"
          : feud?.heat >= 90
            ? "Decisive"
            : "Clean";
      slot.titleId =
        worldTitle?.currentChampion === wrestlerA.id ||
        worldTitle?.currentChampion === wrestlerB.id
          ? worldTitle.id
          : secondaryTitle && index === 1
            ? secondaryTitle.id
            : null;
      slot.roadAgentNotes = feud
        ? `Keep the ${getIdentityName(wrestlerA)} vs ${getIdentityName(wrestlerB)} issue hot.`
        : "Aim for a clean, crowd-pleasing match.";
    });

    show.booked
      .filter((slot) => slot.slotType === "segment")
      .forEach((slot, index) => {
        const targetStoryline =
          activeStorylines[index] || activeStorylines[0] || null;
        const participants = targetStoryline
          ? targetStoryline.participants.slice(
              0,
              Math.min(3, targetStoryline.participants.length),
            )
          : roster.slice(index * 2, index * 2 + 2).map((entity) => entity.id);

        slot.participants = participants;
        slot.focusStorylineId = targetStoryline?.id || null;
        slot.segmentType = index === 0 ? "Face-Off" : pickRandom(SEGMENT_TYPES);
        slot.notes = targetStoryline
          ? `Advance ${targetStoryline.name}.`
          : "Reinforce key characters and upcoming matches.";
      });

    this.refreshScoutingReport(promotion, state);
    return show;
  }

  static createStoryline(
    promotion,
    type,
    participantIds,
    options = {},
    state = gameStateManager.getStateRef(),
  ) {
    const participants = participantIds
      .map((id) => state.entities.get(id))
      .filter(Boolean);

    if (participants.length < 2) {
      return { error: "At least two participants are required." };
    }

    const storyline = StorylineManager.createStoryline(type, participants, {
      name: options.name,
      duration: options.duration || 8,
      initialChoices: options.initialChoices || [],
    });

    if (!storyline?.id) {
      return storyline;
    }

    promotion.creative.storySeeds.push({
      id: storyline.id,
      title: storyline.name,
      participantIds,
      type,
      status: "active",
    });

    gameStateManager.dispatch("ADD_LOG_ENTRY", {
      entry: {
        category: "backstage",
        text: `Creative launches "${storyline.name}" in ${promotion.name}.`,
        type: "creative",
      },
    });

    return storyline;
  }

  static signTalent(
    promotion,
    wrestler,
    options = {},
    state = gameStateManager.getStateRef(),
  ) {
    if (!promotion || !wrestler)
      return { success: false, reason: "Invalid talent or promotion." };
    this.ensurePromotionData(promotion, state);

    const contract = wrestler.getComponent("contract");
    if (!contract)
      return { success: false, reason: "Talent is missing contract data." };

    const previousPromotionId = contract.promotionId;
    if (previousPromotionId && previousPromotionId !== promotion.id) {
      if (!(promotion.sandboxMode || options.force)) {
        return {
          success: false,
          reason: "Talent is under contract elsewhere.",
        };
      }
      const previousPromotion = state.promotions.get(previousPromotionId);
      if (previousPromotion) {
        previousPromotion.roster = (previousPromotion.roster || []).filter(
          (id) => id !== wrestler.id,
        );
        ChampionshipSystem.reassignTitlesForDeparture(
          previousPromotionId,
          wrestler.id,
        );
      }
    }

    const offer = ContractEngine.generateOffer(promotion, wrestler);
    const salary = options.salary ?? offer.weeklySalary;
    const lengthWeeks =
      options.lengthWeeks ?? (promotion.sandboxMode ? 104 : 32);
    const position =
      options.position ||
      ContractEngine.calculateCardPosition(
        wrestler.getComponent("popularity")?.overness || 25,
        promotion,
      );

    contract.promotionId = promotion.id;
    contract.weeklySalary = salary;
    contract.lengthWeeks = lengthWeeks;
    contract.remainingWeeks = lengthWeeks;
    contract.position = position;
    contract.hasCreativeControl = options.creativeControl === true;
    contract.hasMerchCut = offer.hasMerchCut;
    contract.tvAppearanceBonus = offer.tvAppearanceBonus;
    contract.negotiatedSalary = salary;

    if (!promotion.roster.includes(wrestler.id)) {
      promotion.roster.push(wrestler.id);
    }

    this.ensureRosterNote(promotion, wrestler.id).morale = clamp(
      this.ensureRosterNote(promotion, wrestler.id).morale + 8,
      0,
      100,
    );
    this.ensureRosterNote(promotion, wrestler.id).pushLevel =
      POSITION_TO_PUSH[position] || "steady";

    if (!options.quiet) {
      gameStateManager.dispatch("ADD_LOG_ENTRY", {
        entry: {
          category: "business",
          text: `${promotion.name} signs ${getIdentityName(wrestler)} for $${salary}/week.`,
          type: "contract",
        },
      });
    }

    return { success: true, wrestlerId: wrestler.id, salary, lengthWeeks };
  }

  static releaseTalent(
    promotion,
    wrestlerId,
    state = gameStateManager.getStateRef(),
  ) {
    const wrestler = state.entities.get(wrestlerId);
    if (!promotion || !wrestler)
      return { success: false, reason: "Talent not found." };

    const contract = wrestler.getComponent("contract");
    if (contract) {
      contract.promotionId = null;
      contract.weeklySalary = 0;
      contract.lengthWeeks = 0;
      contract.remainingWeeks = 0;
      contract.position = null;
    }

    promotion.roster = (promotion.roster || []).filter(
      (id) => id !== wrestlerId,
    );
    delete promotion.rosterNotes[wrestlerId];

    gameStateManager.dispatch("ADD_LOG_ENTRY", {
      entry: {
        category: "business",
        text: `${promotion.name} releases ${getIdentityName(wrestler)}.`,
        type: "contract",
      },
    });

    return { success: true };
  }

  static ensureRosterNote(promotion, wrestlerId) {
    promotion.rosterNotes = promotion.rosterNotes || {};
    if (!promotion.rosterNotes[wrestlerId]) {
      promotion.rosterNotes[wrestlerId] = {
        morale: 60,
        pushLevel: "steady",
        usageStreak: 0,
        unusedWeeks: 0,
        promisedPush: null,
        chemistryHints: [],
        injuryConcern: 0,
        lastMatchRating: 0,
        lastSegmentRating: 0,
      };
    }
    return promotion.rosterNotes[wrestlerId];
  }

  static setPushLevel(
    promotion,
    wrestlerId,
    pushLevel,
    state = gameStateManager.getStateRef(),
  ) {
    const wrestler = state.entities.get(wrestlerId);
    if (!wrestler) return { success: false, reason: "Talent not found." };

    const note = this.ensureRosterNote(promotion, wrestlerId);
    note.pushLevel = pushLevel;
    note.promisedPush = pushLevel;

    const contract = wrestler.getComponent("contract");
    if (contract) {
      contract.position =
        PUSH_TO_POSITION[pushLevel] || contract.position || "mid_card";
    }

    return { success: true };
  }

  static runCurrentShow(promotion, state = gameStateManager.getStateRef()) {
    const show = this.ensureCurrentShow(promotion, state);
    const usedTalent = new Set();
    const results = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let safetyRisk = 0;

    show.booked.forEach((slot, index) => {
      const weight =
        slot.slotType === "match"
          ? index === show.booked.length - 1
            ? 1.4
            : 1.0
          : 0.7;
      let result = null;

      if (slot.slotType === "match") {
        result = this.simulateBookedMatch(
          slot,
          promotion,
          state,
          index,
          show.booked.length,
        );
      } else {
        result = this.simulateSegment(
          slot,
          promotion,
          state,
          index,
          show.booked.length,
        );
      }

      slot.result = result;
      results.push(result);
      totalWeightedScore += result.score * weight;
      totalWeight += weight;
      safetyRisk += result.safetyRisk || 0;
      (slot.participants || []).forEach((id) => usedTalent.add(id));
    });

    const varietyScore = this.calculateVarietyScore(show);
    const crowdSatisfaction = clamp(
      Math.round(
        totalWeightedScore / Math.max(1, totalWeight) +
          varietyScore * 1.5 +
          18 -
          safetyRisk * 0.12,
      ),
      20,
      100,
    );
    const showRating = clamp(
      1.1 + crowdSatisfaction / 22 + randomInt(-3, 3) / 10,
      1.2,
      5.0,
    );
    const attendance = this.calculateAttendance(
      promotion,
      show,
      state,
      crowdSatisfaction,
    );
    const financials = this.calculateShowFinancials(
      promotion,
      show,
      attendance,
      crowdSatisfaction,
      state,
    );
    const report = {
      id: generateUUID(),
      week: state.calendar.absoluteWeek,
      name: show.name,
      type: show.type,
      showRating: Number(showRating.toFixed(2)),
      crowdSatisfaction,
      attendance,
      safetyRisk,
      varietyScore,
      results,
      financials,
      notes: this.generateShowNotes(
        results,
        showRating,
        financials,
        safetyRisk,
      ),
    };

    promotion.bankBalance += financials.net;
    if (!promotion.sandboxMode) {
      promotion.prestige = clamp(
        Math.round(
          promotion.prestige +
            (showRating >= 4.2
              ? 2
              : showRating >= 3.4
                ? 1
                : showRating < 2.6
                  ? -2
                  : -1) +
            (financials.net > 0 ? 1 : -1),
        ),
        5,
        100,
      );
    }
    promotion.fanLoyalty = clamp(
      Math.round(promotion.fanLoyalty + (showRating - 3) * 6),
      5,
      100,
    );
    promotion.bookingReputation = clamp(
      Math.round(promotion.bookingReputation + (showRating - 3) * 5),
      5,
      100,
    );
    promotion.lockerRoomMorale = clamp(
      Math.round(
        promotion.lockerRoomMorale +
          (showRating >= 3.8 ? 4 : showRating < 2.5 ? -5 : -1) -
          safetyRisk * 0.12,
      ),
      0,
      100,
    );
    promotion.momentum = clamp(
      Math.round((promotion.momentum + crowdSatisfaction) / 2),
      0,
      100,
    );

    this.applyUnusedTalentMorale(promotion, usedTalent, state);

    promotion.showHistory.unshift(report);
    promotion.showHistory = promotion.showHistory.slice(0, 12);
    promotion.creative.lastShowResult = report;
    promotion.businessHistory.unshift({
      week: state.calendar.absoluteWeek,
      balance: promotion.bankBalance,
      net: financials.net,
      attendance,
      showRating: report.showRating,
    });
    promotion.businessHistory = promotion.businessHistory.slice(0, 20);

    gameStateManager.dispatch("ADD_LOG_ENTRY", {
      entry: {
        category: "business",
        text: `${show.name} drew ${attendance.toLocaleString()} fans and scored ${report.showRating.toFixed(2)} stars. Net: ${financials.net >= 0 ? "+" : "-"}$${Math.abs(financials.net).toLocaleString()}.`,
        type: "show-report",
      },
    });

    promotion.creative.currentShow = this.createShowTemplate(
      promotion,
      state,
      1,
    );
    this.refreshScoutingReport(promotion, state);
    this.generateComplaints(promotion, state);

    return report;
  }

  static simulateBookedMatch(slot, promotion, state, slotIndex, totalSlots) {
    const participants = (slot.participants || [])
      .map((id) => state.entities.get(id))
      .filter(Boolean);
    if (participants.length < 2) {
      return {
        slotId: slot.id,
        label: slot.label,
        score: 18,
        crowdReaction: "Dead silence",
        safetyRisk: 0,
        summary: "The slot went out empty, hurting the flow of the show.",
      };
    }

    const bookingStyle =
      BOOKING_STYLES[promotion.brand?.bookingStyle] ||
      BOOKING_STYLES.storyteller;
    const overness = average(
      participants.map(
        (entity) => entity.getComponent("popularity")?.overness || 0,
      ),
    );
    const momentum = average(
      participants.map(
        (entity) => entity.getComponent("popularity")?.momentum || 0,
      ),
    );
    const ringSkill = average(
      participants.map((entity) => {
        const inRing = entity.getComponent("inRingStats");
        const physical = entity.getComponent("physicalStats");
        const entertainment = entity.getComponent("entertainmentStats");
        return average([
          inRing?.brawling || 0,
          inRing?.technical || 0,
          inRing?.aerial || 0,
          inRing?.selling || 0,
          inRing?.psychology || 0,
          physical?.stamina || 0,
          entertainment?.charisma || 0,
        ]);
      }),
    );

    const relationshipBonus = this.calculateChemistryBonus(participants);
    const titleBonus = slot.titleId ? 8 : 0;
    const stipulationBonus =
      slot.stipulation && slot.stipulation !== "Standard"
        ? [
            "No DQ",
            "Steel Cage",
            "Ladder Match",
            "Falls Count Anywhere",
          ].includes(slot.stipulation)
          ? 5
          : 3
        : 0;
    const durationTarget = totalSlots - slotIndex <= 2 ? 18 : 12;
    const pacingPenalty =
      Math.abs((slot.duration || durationTarget) - durationTarget) * 0.9;
    const feudBonus = this.getFeudHeatBonus(
      slot.participants,
      promotion.id,
      state,
    );
    const finishPenalty =
      slot.finish === "Dusty Finish"
        ? 4
        : slot.finish === "Interference"
          ? 2
          : 0;
    const styleBonus = this.calculateBookingStyleBonus(
      participants,
      bookingStyle,
    );
    const safetyRisk = this.calculateSafetyRisk(participants, slot);
    const baseScore =
      ringSkill * 0.55 +
      overness * 0.18 +
      momentum * 0.12 +
      promotion.productionLevel * 0.08 +
      promotion.bookingReputation * 0.07 +
      10;
    const score = clamp(
      Math.round(
        baseScore +
          relationshipBonus +
          titleBonus +
          stipulationBonus +
          feudBonus +
          styleBonus -
          pacingPenalty -
          finishPenalty -
          safetyRisk * 0.14 +
          (slotIndex === totalSlots - 1 ? 6 : 0),
      ),
      18,
      100,
    );

    const winner = this.resolveBookedWinner(
      slot,
      participants,
      promotion,
      state,
    );
    const losers = participants.filter((entity) => entity.id !== winner.id);
    this.applyMatchResults(slot, winner, losers, score, promotion, state);
    const crowdReaction = this.describeCrowd(score, slot.slotType, safetyRisk);

    return {
      slotId: slot.id,
      label: slot.label,
      score,
      crowdReaction,
      safetyRisk,
      winnerId: winner.id,
      winnerName: getIdentityName(winner),
      summary: `${getIdentityName(winner)} won the ${slot.matchType}${slot.titleId ? " and left with gold" : ""}.`,
    };
  }

  static simulateSegment(slot, promotion, state) {
    const participants = (slot.participants || [])
      .map((id) => state.entities.get(id))
      .filter(Boolean);
    if (!participants.length) {
      return {
        slotId: slot.id,
        label: slot.label,
        score: 22,
        crowdReaction: "Confused silence",
        safetyRisk: 0,
        summary: "The segment never found a focal point.",
      };
    }

    const promoSkill = average(
      participants.map((entity) => {
        const entertainment = entity.getComponent("entertainmentStats");
        const popularity = entity.getComponent("popularity");
        return average([
          entertainment?.charisma || 0,
          entertainment?.micSkills || 0,
          entertainment?.acting || 0,
          popularity?.overness || 0,
          popularity?.momentum || 0,
        ]);
      }),
    );
    const storylineBonus = slot.focusStorylineId ? 9 : 2;
    const bookingStyle =
      BOOKING_STYLES[promotion.brand?.bookingStyle] ||
      BOOKING_STYLES.storyteller;
    const baseScore =
      promoSkill * 0.72 +
      storylineBonus +
      promotion.productionLevel * 0.1 +
      promotion.bookingReputation * 0.08 +
      bookingStyle.promoBonus * 30 +
      12;
    const score = clamp(Math.round(baseScore + randomInt(-6, 6)), 24, 98);

    participants.forEach((entity) => {
      const popularity = entity.getComponent("popularity");
      if (popularity) {
        popularity.momentum = clamp(
          popularity.momentum + (score >= 75 ? 5 : score < 45 ? -3 : 1),
          0,
          100,
        );
      }
      const note = this.ensureRosterNote(promotion, entity.id);
      note.morale = clamp(note.morale + (score >= 70 ? 3 : -1), 0, 100);
      note.lastSegmentRating = score;
      note.usageStreak += 1;
      note.unusedWeeks = 0;
    });

    return {
      slotId: slot.id,
      label: slot.label,
      score,
      crowdReaction: this.describeCrowd(score, "segment", 0),
      safetyRisk: 0,
      summary: `${slot.segmentType} moved the audience ${score >= 70 ? "forward" : score < 45 ? "backward" : "sideways"}.`,
    };
  }

  static resolveBookedWinner(slot, participants, promotion, state) {
    const preferred =
      participants.find((entity) => entity.id === slot.bookedWinnerId) ||
      participants[0];
    const preferredNote = this.ensureRosterNote(promotion, preferred.id);
    const preferredContract = preferred.getComponent("contract");
    const pushBias =
      preferredNote.pushLevel === "main_event"
        ? 8
        : preferredNote.pushLevel === "featured"
          ? 4
          : 0;
    const rebellionRisk =
      preferredContract?.hasCreativeControl &&
      slot.bookedWinnerId &&
      slot.bookedWinnerId !== preferred.id
        ? 15
        : 0;

    const resistanceRoll = randomInt(1, 100) + rebellionRisk;
    if (resistanceRoll > 92 && participants.length > 1) {
      return participants.sort(
        (a, b) =>
          (b.getComponent("popularity")?.momentum || 0) -
          (a.getComponent("popularity")?.momentum || 0),
      )[0];
    }

    const contenderScores = participants.map((entity) => {
      const popularity = entity.getComponent("popularity");
      const note = this.ensureRosterNote(promotion, entity.id);
      const inRing = entity.getComponent("inRingStats");
      const base = average([
        popularity?.overness || 0,
        popularity?.momentum || 0,
        inRing?.psychology || 0,
        inRing?.technical || 0,
        inRing?.brawling || 0,
      ]);
      const bookingBoost = entity.id === preferred.id ? 10 + pushBias : 0;
      return { entity, total: base + bookingBoost + randomInt(-8, 8) };
    });

    contenderScores.sort((a, b) => b.total - a.total);
    return contenderScores[0].entity;
  }

  static applyMatchResults(slot, winner, losers, score, promotion, state) {
    const winnerCareer = winner.getComponent("careerStats");
    const winnerPop = winner.getComponent("popularity");
    const winnerCondition = winner.getComponent("condition");
    const winnerNote = this.ensureRosterNote(promotion, winner.id);

    if (winnerCareer) {
      winnerCareer.totalWins += 1;
      winnerCareer.consecutiveWins = Math.max(
        1,
        winnerCareer.consecutiveWins + 1,
      );
      winnerCareer.bestMatchRating = Math.max(
        winnerCareer.bestMatchRating || 0,
        score / 20,
      );
      winnerCareer.matchesThisWeek = (winnerCareer.matchesThisWeek || 0) + 1;
    }
    if (winnerPop) {
      winnerPop.overness = clamp(
        winnerPop.overness + (score >= 80 ? 3 : score >= 60 ? 1 : 0),
        0,
        100,
      );
      winnerPop.momentum = clamp(
        winnerPop.momentum + (score >= 80 ? 8 : 4),
        0,
        100,
      );
    }
    if (winnerCondition) {
      winnerCondition.energy = clamp(
        winnerCondition.energy - Math.round((slot.duration || 10) * 1.6),
        0,
        100,
      );
      winnerCondition.health = clamp(
        winnerCondition.health -
          Math.round(this.calculateSafetyRisk([winner], slot) * 0.4),
        0,
        100,
      );
    }
    winnerNote.morale = clamp(
      winnerNote.morale + (score >= 75 ? 5 : 2),
      0,
      100,
    );
    winnerNote.lastMatchRating = score;
    winnerNote.usageStreak += 1;
    winnerNote.unusedWeeks = 0;

    losers.forEach((loser) => {
      const career = loser.getComponent("careerStats");
      const popularity = loser.getComponent("popularity");
      const condition = loser.getComponent("condition");
      const note = this.ensureRosterNote(promotion, loser.id);

      if (career) {
        career.totalLosses += 1;
        career.consecutiveWins = Math.min(
          -1,
          (career.consecutiveWins || 0) - 1,
        );
        career.matchesThisWeek = (career.matchesThisWeek || 0) + 1;
      }
      if (popularity) {
        popularity.momentum = clamp(
          popularity.momentum - (score < 45 ? 4 : 1),
          0,
          100,
        );
        popularity.overness = clamp(
          popularity.overness + (score >= 85 ? 1 : 0),
          0,
          100,
        );
      }
      if (condition) {
        condition.energy = clamp(
          condition.energy - Math.round((slot.duration || 10) * 1.8),
          0,
          100,
        );
        condition.health = clamp(
          condition.health -
            Math.round(this.calculateSafetyRisk([loser], slot) * 0.6),
          0,
          100,
        );
      }
      note.morale = clamp(note.morale + (score >= 72 ? 1 : -3), 0, 100);
      note.lastMatchRating = score;
      note.usageStreak += 1;
      note.unusedWeeks = 0;
    });

    if (slot.titleId) {
      const title = state.championships.get(slot.titleId);
      if (title && title.currentChampion !== winner.id) {
        ChampionshipSystem.awardChampionship(
          slot.titleId,
          winner,
          title.currentChampion,
        );
      } else if (title) {
        ChampionshipSystem.recordDefense(slot.titleId, score / 20);
      }
    }

    if (slot.participants?.length >= 2) {
      const [entityA, entityB] = slot.participants;
      RelationshipManager.modifyAffinity(
        entityA,
        entityB,
        score >= 70 ? 2 : -1,
        `Booked match in ${promotion.name}`,
      );
      this.advanceFeud(slot.participants, promotion.id, score, state);
    }
  }

  static advanceFeud(
    participantIds,
    promotionId,
    score,
    state = gameStateManager.getStateRef(),
  ) {
    for (const feud of state.feuds.values()) {
      if (feud.promotionId !== promotionId) continue;
      const involved = participantIds.every(
        (id) => id === feud.entityA || id === feud.entityB,
      );
      if (!involved) continue;
      feud.heat = clamp((feud.heat || 0) + (score >= 70 ? 12 : 5), 0, 100);
      feud.phase =
        feud.heat >= 75 ? "blowoff" : feud.heat >= 45 ? "heated" : "tension";
      feud.matches = Array.isArray(feud.matches) ? feud.matches : [];
      feud.matches.push({ week: state.calendar.absoluteWeek, score });
    }
  }

  static calculateChemistryBonus(participants) {
    if (participants.length < 2) return 0;
    const bonuses = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const relationship = RelationshipManager.getRelationship(
          participants[i].id,
          participants[j].id,
        );
        bonuses.push((relationship?.affinity || 0) / 12);
      }
    }
    return average(bonuses);
  }

  static getFeudHeatBonus(
    participantIds,
    promotionId,
    state = gameStateManager.getStateRef(),
  ) {
    if (!participantIds?.length) return 0;
    const feud = Array.from(state.feuds.values()).find(
      (item) =>
        item.promotionId === promotionId &&
        participantIds.every(
          (id) => id === item.entityA || id === item.entityB,
        ),
    );
    if (!feud) return 0;
    return (feud.heat || 0) / 8;
  }

  static calculateBookingStyleBonus(participants, style) {
    const multipliers = Object.entries(style.matchBonus || {});
    if (!multipliers.length) return 0;

    const score = average(
      participants.map((entity) => {
        const physical = entity.getComponent("physicalStats");
        const inRing = entity.getComponent("inRingStats");
        const entertainment = entity.getComponent("entertainmentStats");
        const values = {
          strength: physical?.strength || 0,
          resilience: physical?.resilience || 0,
          stamina: physical?.stamina || 0,
          brawling: inRing?.brawling || 0,
          technical: inRing?.technical || 0,
          aerial: inRing?.aerial || 0,
          selling: inRing?.selling || 0,
          psychology: inRing?.psychology || 0,
          charisma: entertainment?.charisma || 0,
          micSkills: entertainment?.micSkills || 0,
          acting: entertainment?.acting || 0,
        };
        return multipliers.reduce(
          (sum, [stat, weight]) => sum + (values[stat] || 0) * weight,
          0,
        );
      }),
    );

    return score / 12;
  }

  static calculateSafetyRisk(participants, slot) {
    const hazardousMatch =
      [
        "No DQ",
        "Steel Cage",
        "Ladder Match",
        "Falls Count Anywhere",
        "Battle Royal",
      ].includes(slot.matchType) ||
      ["No DQ", "Steel Cage", "Ladder Match", "Falls Count Anywhere"].includes(
        slot.stipulation,
      );
    const duration = slot.duration || 10;
    const baseRisk = hazardousMatch ? 18 : 8;
    const fatiguePenalty = average(
      participants.map((entity) => {
        const condition = entity.getComponent("condition");
        const physical = entity.getComponent("physicalStats");
        return average([
          100 - (condition?.health || 100),
          100 - (condition?.energy || 100),
          100 - (physical?.staminaRecoveryMax || 100),
        ]);
      }),
    );

    return clamp(
      Math.round(baseRisk + duration * 0.6 + fatiguePenalty * 0.25),
      4,
      100,
    );
  }

  static describeCrowd(score, slotType, safetyRisk = 0) {
    if (slotType === "segment") {
      if (score >= 80) return "The crowd leaned into every word";
      if (score >= 60) return "The audience stayed engaged";
      if (score >= 40) return "Polite reaction";
      return "The promo dragged";
    }

    if (safetyRisk >= 55 && score >= 75) return "Wild chaos with real danger";
    if (score >= 88) return "Sustained roar and near-fall frenzy";
    if (score >= 72) return "Strong reactions and steady heat";
    if (score >= 55) return "Good applause with a few cold patches";
    if (score >= 38) return "Muted interest";
    return "The match lost the building";
  }

  static calculateVarietyScore(show) {
    const matchTypes = new Set(
      show.booked
        .filter((slot) => slot.slotType === "match")
        .map((slot) => `${slot.matchType}|${slot.stipulation}`),
    );
    const segmentTypes = new Set(
      show.booked
        .filter((slot) => slot.slotType === "segment")
        .map((slot) => slot.segmentType),
    );
    const repeatsPenalty = Math.max(
      0,
      show.booked.length - matchTypes.size - segmentTypes.size,
    );
    return clamp(
      matchTypes.size * 3 + segmentTypes.size * 2 - repeatsPenalty * 2,
      -10,
      16,
    );
  }

  static calculateAttendance(promotion, show, state, crowdSatisfaction) {
    const starPower = average(
      show.booked.flatMap((slot) =>
        (slot.participants || []).map(
          (id) =>
            state.entities.get(id)?.getComponent("popularity")?.overness || 0,
        ),
      ),
    );
    const ticketPenalty = Math.max(
      0,
      (promotion.ticketPrice - Math.max(20, promotion.prestige)) * 1.4,
    );
    const raw =
      promotion.venueSize *
        (0.48 +
          promotion.fanLoyalty / 170 +
          crowdSatisfaction / 220 +
          starPower / 240 +
          promotion.marketing / 300) -
      ticketPenalty;
    return clamp(
      Math.round(raw),
      Math.round(promotion.venueSize * 0.2),
      promotion.venueSize,
    );
  }

  static calculateShowFinancials(
    promotion,
    show,
    attendance,
    crowdSatisfaction,
    state,
  ) {
    const salaryCost =
      (promotion.roster || []).reduce((sum, wrestlerId) => {
        const wrestler = state.entities.get(wrestlerId);
        return sum + (wrestler?.getComponent("contract")?.weeklySalary || 0);
      }, 0) / (show.isPLE ? 2.5 : 4.5);
    const gate = Math.round(attendance * promotion.ticketPrice);
    const merch = Math.round(attendance * (promotion.fanLoyalty / 20));
    const sponsorship = Math.round(
      promotion.sponsorRevenue * (show.isPLE ? 1.8 : 1),
    );
    const tvRights = Math.round(
      (promotion.tvDeal?.weeklyRights || 0) * (show.isPLE ? 1.25 : 1),
    );
    const production = Math.round(
      promotion.productionLevel * (show.isPLE ? 110 : 70),
    );
    const marketing = Math.round(promotion.marketing * (show.isPLE ? 25 : 12));
    const medical = Math.round(promotion.medicalTeam * 8);
    const overhead = Math.round(
      (promotion.weeklyOverhead || 0) * (show.isPLE ? 1.3 : 0.7),
    );
    const totalRevenue = gate + merch + sponsorship + tvRights;
    const totalExpenses =
      salaryCost + production + marketing + medical + overhead;
    const net = promotion.sandboxMode
      ? totalRevenue
      : totalRevenue - totalExpenses;

    return {
      gate,
      merch,
      sponsorship,
      tvRights,
      salaryCost: Math.round(salaryCost),
      production,
      marketing,
      medical,
      overhead,
      totalRevenue,
      totalExpenses: promotion.sandboxMode ? 0 : totalExpenses,
      net: Math.round(net),
    };
  }

  static generateShowNotes(results, showRating, financials, safetyRisk) {
    const notes = [];
    const strongest = results.slice().sort((a, b) => b.score - a.score)[0];
    const weakest = results.slice().sort((a, b) => a.score - b.score)[0];

    if (strongest)
      notes.push(`Best segment: ${strongest.label} (${strongest.score}).`);
    if (weakest)
      notes.push(`Weakest segment: ${weakest.label} (${weakest.score}).`);
    if (showRating >= 4.2)
      notes.push("Momentum is climbing. Fans expect a bigger next show.");
    if (showRating < 2.8)
      notes.push("Creative direction is being questioned by the audience.");
    if (financials.net < 0)
      notes.push(
        "The show lost money. Pricing, spending, or card value needs attention.",
      );
    if (safetyRisk > 55)
      notes.push("The medical team flagged excessive danger on this card.");
    return notes;
  }

  static applyUnusedTalentMorale(
    promotion,
    usedTalent,
    state = gameStateManager.getStateRef(),
  ) {
    for (const wrestlerId of promotion.roster || []) {
      const note = this.ensureRosterNote(promotion, wrestlerId);
      if (usedTalent.has(wrestlerId)) {
        note.unusedWeeks = 0;
        continue;
      }
      note.unusedWeeks += 1;
      note.usageStreak = 0;
      note.morale = clamp(note.morale - (note.promisedPush ? 6 : 3), 0, 100);
    }
  }

  static generateComplaints(promotion, state = gameStateManager.getStateRef()) {
    promotion.pendingComplaints = [];
    for (const wrestlerId of promotion.roster || []) {
      const wrestler = state.entities.get(wrestlerId);
      if (!wrestler) continue;
      const note = this.ensureRosterNote(promotion, wrestlerId);
      const name = getIdentityName(wrestler);
      if (note.unusedWeeks >= 2) {
        promotion.pendingComplaints.push({
          id: generateUUID(),
          wrestlerId,
          severity: note.unusedWeeks >= 4 ? "high" : "medium",
          text: `${name} is frustrated about being left off shows for ${note.unusedWeeks} straight weeks.`,
        });
      }
      if (note.morale <= 35) {
        promotion.pendingComplaints.push({
          id: generateUUID(),
          wrestlerId,
          severity: "high",
          text: `${name} thinks the office has lost faith in them.`,
        });
      }
    }
    return promotion.pendingComplaints;
  }

  static processWeekly(promotion, state = gameStateManager.getStateRef()) {
    this.ensurePromotionData(promotion, state);

    if (!promotion.sandboxMode) {
      const payroll = (promotion.roster || []).reduce((sum, wrestlerId) => {
        const wrestler = state.entities.get(wrestlerId);
        return sum + (wrestler?.getComponent("contract")?.weeklySalary || 0);
      }, 0);
      const fixed =
        payroll +
        (promotion.weeklyOverhead || 0) +
        Math.round((promotion.medicalTeam || 0) * 10);
      const passive = Math.round(
        (promotion.tvDeal?.weeklyRights || 0) + (promotion.sponsorRevenue || 0),
      );
      const net = passive - fixed;
      promotion.bankBalance += net;
      promotion.businessHistory.unshift({
        week: state.calendar.absoluteWeek,
        balance: promotion.bankBalance,
        net,
        attendance: 0,
        showRating: 0,
      });
      promotion.businessHistory = promotion.businessHistory.slice(0, 20);
    }

    if (promotion.bankBalance < 0 && !promotion.sandboxMode) {
      promotion.bookingReputation = clamp(
        promotion.bookingReputation - 5,
        0,
        100,
      );
      promotion.lockerRoomMorale = clamp(
        promotion.lockerRoomMorale - 8,
        0,
        100,
      );
      gameStateManager.dispatch("ADD_LOG_ENTRY", {
        entry: {
          category: "business",
          text: `${promotion.name} is running in the red. The locker room feels the pressure.`,
          type: "finance-warning",
        },
      });
    }

    this.refreshScoutingReport(promotion, state);
    this.generateComplaints(promotion, state);
    this.ensureCurrentShow(promotion, state);
  }

  static adjustBusinessSetting(
    promotion,
    key,
    value,
    state = gameStateManager.getStateRef(),
  ) {
    this.ensurePromotionData(promotion, state);
    const numericSettings = [
      "ticketPrice",
      "venueSize",
      "productionLevel",
      "marketing",
      "medicalTeam",
      "scoutingBudget",
      "trainingFacility",
    ];
    if (numericSettings.includes(key)) {
      promotion[key] = Math.round(value);
    } else if (key === "bookingStyle") {
      promotion.brand.bookingStyle = value;
    } else if (key === "product") {
      promotion.brand.product = value;
      promotion.stylePreference = value;
    }
    return promotion;
  }
}

export default BookerModeEngine;
