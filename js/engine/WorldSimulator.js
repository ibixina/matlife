/**
 * WorldSimulator for Mat Life: Wrestling Simulator
 * Step 1.11 of Implementation Plan
 * Background world tick processing
 */

import { gameStateManager } from "../core/GameStateManager.js";
import { gameCalendar } from "../core/GameCalendar.js";
import TagEngine from "./TagEngine.js";
import InjuryEngine from "./InjuryEngine.js";
import FinancialEngine from "./FinancialEngine.js";
import RelationshipManager from "./RelationshipManager.js";
import ResolutionEngine from "./ResolutionEngine.js";
import SocialMediaSystem from "./SocialMediaSystem.js";
import LifestyleEngine from "./LifestyleEngine.js";
import WellnessEngine from "./WellnessEngine.js";
import ContractEngine from "./ContractEngine.js";
import TrainingSystem from "./TrainingSystem.js";
import AIPromotionSystem from "./AIPromotionSystem.js";
import DynamicFeudSystem from "./DynamicFeudSystem.js";
import CardPositionSystem from "./CardPositionSystem.js";
import ChampionshipSystem from "./ChampionshipSystem.js";
import StorylineManager from "./StorylineManager.js";
import PerkSystem from "./PerkSystem.js";
import AgingEngine from "./AgingEngine.js";
import EntityFactory from "../core/EntityFactory.js";
import { rollD20, randomInt } from "../core/Utils.js";
import BookerModeEngine from "./BookerModeEngine.js";
import CharacterEvolution from "./CharacterEvolution.js";

/**
 * WorldSimulator - The master "advance the world" function
 */
export class WorldSimulator {
  /**
   * Advances the world by one day
   * @param {object} state - Current game state
   * @returns {PendingAction[]} List of pending actions requiring player input
   */
  static tick(state) {
    const pendingActions = [];
    gameStateManager.beginBatch();
    try {
      // 1. Advance calendar
      gameCalendar.tick();

      // 2. Refresh all tags
      TagEngine.runAllEntities(state);

      // 3. Process daily stamina recovery for all entities
      this._processDailyStaminaRecovery(state);

      // 4. Tick injuries for all entities (once per day)
      this._tickAllInjuries(state);

      // Process no-compete clauses daily
      this._processNoCompeteClauses(state);

      // 4. If new week, process weekly systems
      const calendar = state.calendar;
      if (calendar.day === 0) {
        // Process finances for player
        const player = gameStateManager.getPlayerEntity();
        if (player) {
          const financialReport = FinancialEngine.processWeeklyFinances(
            player,
            state,
          );

          // Log financial summary
          if (financialReport) {
            const netChangeText =
              financialReport.netChange >= 0
                ? `+$${financialReport.netChange}`
                : `-$${Math.abs(financialReport.netChange)}`;

            gameStateManager.dispatch("ADD_LOG_ENTRY", {
              entry: {
                category: "system",
                text: `Weekly Financial Summary: Income $${financialReport.totalIncome}, Expenses $${financialReport.totalExpenses}, Net ${netChangeText}. Balance: $${financialReport.newBalance}`,
                type: "financial",
                financialReport,
              },
            });
          }
        }

        // Rebuild promotion rosters from active contracts (prevents roster desync)
        this._rebuildPromotionRosters(state);

        // Ensure promotions always have champions after roster rebuilds
        for (const promotion of state.promotions.values()) {
          ChampionshipSystem.ensurePromotionChampions(promotion);
        }

        // Ensure champions are positioned appropriately on the card
        CardPositionSystem.syncChampionPositions(state);

        // Process all entities' weekly systems
        for (const entity of state.entities.values()) {
          // Social media decay
          SocialMediaSystem.processWeekly(entity);

          // Lifestyle processing
          LifestyleEngine.processWeekly(entity);

          // PED effects
          WellnessEngine.processWeekly(entity);

          // Contract expiration
          ContractEngine.processContractExpiration(entity);

          // Reset weekly training counter
          TrainingSystem.resetWeeklyCounter(entity);

          // Random wellness test if under contract
          const contract = entity.getComponent("contract");
          if (contract?.promotionId) {
            const promotion = state.promotions.get(contract.promotionId);
            if (promotion) {
              WellnessEngine.randomTest(entity, promotion);
            }
          }

          // Check for perk unlocks
          PerkSystem.checkAndUnlockPerks(entity);

          // Reset weekly match counter
          const careerStats = entity.getComponent("careerStats");
          if (careerStats) {
            careerStats.matchesThisWeek = 0;
          }

          // Weekly stamina recovery max restoration (restore 20 points each week)
          const physicalStats = entity.getComponent("physicalStats");
          if (physicalStats && physicalStats.staminaRecoveryMax !== undefined) {
            physicalStats.staminaRecoveryMax = Math.min(
              100,
              physicalStats.staminaRecoveryMax + 20,
            );
          }
        }

        // Drift relationships
        RelationshipManager.driftRelationships();

        // Tick feuds
        DynamicFeudSystem.tickAllFeuds();

        // Tick storylines
        StorylineManager.tickAllStorylines();

        // Check for new year (aging)
        if (state.calendar.week === 1 && state.calendar.month === 1) {
          AgingEngine.ageOneYear();
        }

        // Evaluate card positions monthly
        if (state.calendar.week === 2) {
          CardPositionSystem.evaluateAllRosters(state);
          this._generatePlayerPromotionFeuds(state);
        }

        // Process AI promotions (weekly, not every day)
        this._processAIPromotions(state);

        // Evolve NPC attributes occasionally
        this._evolveNPCs(state);

        if (state.player?.mode === "BOOKER") {
          const playerPromotion = BookerModeEngine.getPlayerPromotion(state);
          if (playerPromotion) {
            BookerModeEngine.processWeekly(playerPromotion, state);
          }
        }
      }

      // 5. Check for show days and queue matches/promos
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        if (state.player?.mode === "BOOKER") {
          const playerPromotion = BookerModeEngine.getPlayerPromotion(state);
          if (playerPromotion) {
            BookerModeEngine.ensureCurrentShow(playerPromotion, state);
          }
        } else {
          const playerContract = player.getComponent("contract");
          if (playerContract && playerContract.promotionId) {
            const promotion = state.promotions.get(playerContract.promotionId);
            if (promotion && gameCalendar.isShowDay(promotion)) {
              // Generate show card
              const showAction = this._generateShowCard(
                promotion,
                player,
                state,
              );
              if (showAction) {
                pendingActions.push(showAction);
              }
            }
          }
        }
      }

      // 6. Log the day passage
      gameStateManager.dispatch("ADD_LOG_ENTRY", {
        entry: {
          category: "system",
          text: `Advanced to ${gameCalendar.getCurrentDate()}`,
          type: "time",
        },
      });
    } finally {
      gameStateManager.endBatch();
    }

    return pendingActions;
  }

  /**
   * Simulates a simplified match between two NPCs
   * @param {Entity} wrestler1 - First wrestler
   * @param {Entity} wrestler2 - Second wrestler
   * @param {string} matchType - Type of match
   * @returns {object} Match result
   */
  static simulateNPCMatch(
    wrestler1,
    wrestler2,
    matchType = "Standard Singles",
  ) {
    // Get highest relevant stat for each wrestler
    const getHighestStat = (wrestler) => {
      const inRingStats = wrestler.getComponent("inRingStats");
      if (!inRingStats) return 10;

      return Math.max(
        inRingStats.brawling,
        inRingStats.technical,
        inRingStats.aerial,
      );
    };

    const stat1 = getHighestStat(wrestler1);
    const stat2 = getHighestStat(wrestler2);

    // Contested roll
    const contestedResult = ResolutionEngine.resolveContested({
      actor: wrestler1,
      actorStat: "brawling",
      target: wrestler2,
      targetStat: "brawling",
    });

    const winner = contestedResult.winner === "actor" ? wrestler1 : wrestler2;
    const loser = winner === wrestler1 ? wrestler2 : wrestler1;

    // Generate simplified match rating (1-5 stars)
    const baseRating = (stat1 + stat2) / 10;
    const randomFactor = randomInt(-5, 5) / 10;
    const matchRating = Math.max(0.5, Math.min(5, baseRating + randomFactor));

    const calendar = this._getCalendar();
    const matchDate = calendar ? `Week ${calendar.week}, ${calendar.year}` : "Unknown";

    // Update records
    this._updateMatchRecords(winner, loser, matchRating, matchDate, null);

    return {
      winner,
      loser,
      matchRating,
      duration: randomInt(5, 25),
      contestedResult,
    };
  }

  /**
   * Ticks injuries for all entities
   * @private
   * @param {object} state - Game state
   */
  static _tickAllInjuries(state) {
    for (const entity of state.entities.values()) {
      const healedParts = InjuryEngine.tickInjuries(entity);

      // Log healed injuries
      for (const bodyPart of healedParts) {
        const identity = entity.getComponent("identity");
        gameStateManager.dispatch("ADD_LOG_ENTRY", {
          entry: {
            category: "injury",
            text: `${identity?.name || "Unknown"} has recovered from their ${bodyPart} injury`,
            entityId: entity.id,
          },
        });
      }
    }
  }

  /**
   * Processes no-compete clauses for all entities (daily)
   * @private
   * @param {object} state - Game state
   */
  static _processNoCompeteClauses(state) {
    for (const entity of state.entities.values()) {
      ContractEngine.processNoCompeteDaily(entity);
    }
  }

  /**
   * Processes daily stamina recovery for all entities
   * Dynamic recovery: if stamina was fully depleted, max recovery drops
   * Taking days off allows recovery max to restore back to 100
   * @private
   * @param {object} state - Game state
   */
  static _processDailyStaminaRecovery(state) {
    for (const entity of state.entities.values()) {
      const physicalStats = entity.getComponent("physicalStats");
      if (!physicalStats) continue;

      // Initialize recovery tracking if not present
      if (physicalStats.staminaRecoveryMax === undefined) {
        physicalStats.staminaRecoveryMax = 100;
      }
      if (physicalStats.daysSinceFullRest === undefined) {
        physicalStats.daysSinceFullRest = 0;
      }

      const currentStamina = physicalStats.stamina;
      const recoveryMax = physicalStats.staminaRecoveryMax;

      // Check if stamina was fully depleted (at or near 0)
      if (currentStamina <= 5) {
        // Reduce recovery max by 10 (minimum 50)
        physicalStats.staminaRecoveryMax = Math.max(50, recoveryMax - 10);
        physicalStats.daysSinceFullRest = 0;
      } else if (currentStamina >= recoveryMax - 5) {
        // If stamina is near the recovery max, count as a rest day
        physicalStats.daysSinceFullRest++;

        // After 2 days of rest, start restoring recovery max
        if (physicalStats.daysSinceFullRest >= 2) {
          physicalStats.staminaRecoveryMax = Math.min(100, recoveryMax + 10);
        }
      } else {
        // Partial usage, don't change recovery max but reset rest counter
        physicalStats.daysSinceFullRest = 0;
      }

      // Recover stamina toward the current recovery max
      // Calculate recovery amount - more aggressive recovery when low
      let recoveryAmount;
      const targetStamina = physicalStats.staminaRecoveryMax;
      const staminaDeficit = targetStamina - currentStamina;

      if (staminaDeficit > 50) {
        // Large deficit: recover 40% of the way to target
        recoveryAmount = Math.floor(staminaDeficit * 0.4);
      } else if (staminaDeficit > 20) {
        // Medium deficit: recover 30% of the way to target
        recoveryAmount = Math.floor(staminaDeficit * 0.3);
      } else {
        // Small deficit: recover 20% or flat 5, whichever is higher
        recoveryAmount = Math.max(5, Math.floor(staminaDeficit * 0.2));
      }

      // Apply recovery
      physicalStats.stamina = Math.min(
        targetStamina,
        currentStamina + recoveryAmount,
      );
    }
  }

  /**
   * Rebuilds promotion rosters from active contracts
   * @private
   */
  static _rebuildPromotionRosters(state) {
    // Initialize empty rosters
    for (const promotion of state.promotions.values()) {
      promotion.roster = [];
    }

    // Re-add contracted wrestlers
    for (const entity of state.entities.values()) {
      const contract = entity.getComponent("contract");
      if (!contract?.promotionId) continue;
      const promotion = state.promotions.get(contract.promotionId);
      if (promotion) {
        promotion.roster.push(entity.id);
      }
    }

    // Ensure current champions remain on their promotion rosters (AI wrestlers only)
    for (const championship of state.championships.values()) {
      const champId = championship.currentChampion;
      if (!champId) continue;
      const promotion = state.promotions.get(championship.promotionId);
      if (!promotion) continue;
      if (!promotion.roster.includes(champId)) {
        // Only keep AI champions on roster - player should have titles reassigned when leaving
        const champEntity = state.entities.get(champId);
        if (champEntity && !champEntity.isPlayer) {
          promotion.roster.push(champId);
        }
      }
    }
  }

  /**
   * Generates a show card for a promotion
   * @private
   * @param {object} promotion - Promotion object
   * @param {Entity} player - Player entity
   * @param {object} state - Game state
   * @returns {PendingAction|null} Show action or null
   */
  static _generateShowCard(promotion, player, state) {
    const rosterIds = promotion.roster || [];

    if (!rosterIds.includes(player.id)) {
      return null;
    }

    const contract = player.getComponent("contract");
    if (!contract) return null;
    const isBigShow = this._isBigShowWeek(promotion, state);

    // Enforce per-month dates from contract terms
    const monthKey = `${state.calendar.year}-${state.calendar.month}`;
    if (contract.bookedDatesMonthKey !== monthKey) {
      contract.bookedDatesMonthKey = monthKey;
      contract.bookedDatesThisMonth = 0;
      contract.datesCapNotifiedMonthKey = null;
      contract.bigShowReserveNotifiedMonthKey = null;
    }
    const maxDates = Math.max(1, contract.datesPerMonth || 4);
    const reserveBigShowDate = maxDates < 4;
    const reservedDates = reserveBigShowDate ? 1 : 0;
    const nonBigShowCap = Math.max(0, maxDates - reservedDates);
    const bookedDates = contract.bookedDatesThisMonth || 0;

    if (reserveBigShowDate && !isBigShow && bookedDates >= nonBigShowCap) {
      if (contract.bigShowReserveNotifiedMonthKey !== monthKey) {
        gameStateManager.dispatch("ADD_LOG_ENTRY", {
          entry: {
            category: "contract",
            text: `📅 Contract schedule reserved 1 date for this month's big show (${maxDates} dates/month).`,
            type: "contract",
          },
        });
        contract.bigShowReserveNotifiedMonthKey = monthKey;
      }
      return null;
    }

    if ((contract.bookedDatesThisMonth || 0) >= maxDates) {
      if (contract.datesCapNotifiedMonthKey !== monthKey) {
        gameStateManager.dispatch("ADD_LOG_ENTRY", {
          entry: {
            category: "contract",
            text: `📅 Contract date limit reached (${maxDates}/${maxDates}) for this month. You're off this show.`,
            type: "contract",
          },
        });
        contract.datesCapNotifiedMonthKey = monthKey;
      }
      return null;
    }

    // Find opponents from roster
    let opponents = rosterIds
      .filter((id) => id !== player.id)
      .map((id) => state.entities.get(id))
      .filter((e) => e);

    // If no opponents on roster, generate one
    if (opponents.length === 0) {
      const npc = EntityFactory.generateRandomIndie(promotion.region || "USA");
      gameStateManager.dispatch("ADD_ENTITY", { entity: npc });
      const npcContract = npc.getComponent("contract");
      if (npcContract) {
        npcContract.promotionId = promotion.id;
        npcContract.weeklySalary = 100;
        npcContract.lengthWeeks = 52;
        npcContract.remainingWeeks = 52;
      }
      promotion.roster.push(npc.id);
      opponents = [npc];
    }

    let opponent = opponents[randomInt(0, opponents.length - 1)];
    let feudId = null;

    // Pick match type based on card position and randomness
    const matchTypes = [
      "Standard Singles",
      "No DQ",
      "Submission Match",
      "Falls Count Anywhere",
      "Iron Man",
    ];
    let matchType =
      matchTypes[randomInt(0, Math.min(1, matchTypes.length - 1))]; // mostly standard

    // Determine booked winner (Scripted outcome)
    let bookedWinnerId = null;
    let isTitleMatch = false;
    let titleId = null;

    // If player has an active feud in this promotion, feud matches take priority.
    const activeFeudOpponentId = DynamicFeudSystem.getActiveFeudOpponent(
      player.id,
    );
    if (activeFeudOpponentId && rosterIds.includes(activeFeudOpponentId)) {
      const feudOpponent = state.entities.get(activeFeudOpponentId);
      if (feudOpponent) {
        opponent = feudOpponent;
        feudId = [player.id, activeFeudOpponentId].sort().join("_");
        const feudTypes = DynamicFeudSystem.getFeudMatchTypes(feudId);
        if (feudTypes?.length) {
          matchType = feudTypes[randomInt(0, feudTypes.length - 1)];
        }
      }
    }

    // Allow manual booking from feud/match selector to schedule next show.
    const scheduledMatch = state.eventFlags?.__scheduledPlayerMatch;
    if (scheduledMatch && scheduledMatch.promotionId === promotion.id) {
      const scheduledOpponentId = scheduledMatch.opponentId;
      const scheduledOpponent = state.entities.get(scheduledOpponentId);
      const activeFeudLocked =
        !!activeFeudOpponentId && activeFeudOpponentId !== scheduledOpponentId;

      if (
        !activeFeudLocked &&
        scheduledOpponent &&
        rosterIds.includes(scheduledOpponentId)
      ) {
        opponent = scheduledOpponent;
        matchType = scheduledMatch.matchType || matchType;
        feudId = scheduledMatch.feudId || feudId;
      }
      delete state.eventFlags.__scheduledPlayerMatch;
    }

    // Big-show title feud rule:
    // If this is a championship-related feud in blowoff/bloodfeud phase,
    // book it as a title match only on big shows.
    if (feudId) {
      const feud = state.feuds.get(feudId);
      const isBigFeudPhase =
        feud?.phase === "blowoff" || feud?.phase === "bloodfeud";
      if (isBigFeudPhase && isBigShow) {
        const feudTitle = this._findFeudChampionship(
          state,
          promotion.id,
          player.id,
          opponent.id,
        );
        if (feudTitle) {
          isTitleMatch = true;
          titleId = feudTitle.id || feudTitle._id || null;
        }
      }
    }

    if (!feudId && contract?.pendingTitleShot) {
      // Find a championship to contest
      const championships = ChampionshipSystem.getPromotionChampionships(
        promotion.id,
      );
      if (championships.length > 0) {
        // Find best championship (most prestigious) where current champion is not player
        const stateRef = gameStateManager.getStateRef();
        const availableTitles = championships
          .filter(
            (c) =>
              c && (!c.currentChampionId || c.currentChampionId !== player.id),
          )
          .sort((a, b) => b.prestige - a.prestige);

        if (availableTitles.length > 0) {
          const title = availableTitles[0];
          let champ = null;

          if (title.currentChampionId) {
            champ = stateRef.entities.get(title.currentChampionId);
          }

          if (!champ) {
            const rosterOpponents = (promotion.roster || [])
              .filter((id) => id !== player.id)
              .map((id) => stateRef.entities.get(id))
              .filter((e) => e);

            if (rosterOpponents.length > 0) {
              champ = rosterOpponents[randomInt(0, rosterOpponents.length - 1)];
            }
          }

          if (champ) {
            opponent = champ;
          }

          isTitleMatch = true;
          titleId = title.id;
          contract.pendingTitleShot = false; // Shot consumed
        }
      }
    }

    // If player is champion, proactively book defenses sometimes.
    if (!isTitleMatch && !feudId) {
      const playerTitles = [];
      for (const [
        championshipId,
        championship,
      ] of state.championships.entries()) {
        if (championship.promotionId !== promotion.id) continue;
        if (championship.currentChampion !== player.id) continue;
        playerTitles.push({
          id: championship.id || championshipId,
          ...championship,
        });
      }

      if (playerTitles.length > 0) {
        const hasUndefendedTitle = playerTitles.some((t) => {
          const reign = t.reigns?.[t.reigns.length - 1];
          return !reign || (reign.defenses || 0) === 0;
        });
        const defenseChance = hasUndefendedTitle ? 0.85 : 0.45;

        if (Math.random() < defenseChance) {
          const sortedTitles = [...playerTitles].sort(
            (a, b) => (b.prestige || 0) - (a.prestige || 0),
          );
          const title = sortedTitles[0];

          // Pick strongest available contender (avoid recently faced opponents)
          const contenders = (promotion.roster || [])
            .filter((id) => id !== player.id)
            .map((id) => state.entities.get(id))
            .filter((e) => e);

          // Get recent opponents from contract history
          const recentOpponents = contract.recentOpponents || [];

          if (contenders.length > 0) {
            // Filter out recent opponents, prioritize those not recently faced
            let availableContenders = contenders.filter(
              (c) => !recentOpponents.includes(c.id),
            );

            // If all have been faced recently, allow repeats but shuffle for variety
            if (availableContenders.length === 0) {
              availableContenders = contenders;
            }

            availableContenders.sort((a, b) => {
              const popA = a.getComponent("popularity")?.overness || 0;
              const popB = b.getComponent("popularity")?.overness || 0;
              return popB - popA;
            });

            // Pick random from top 3 to add variety
            const topContenders = availableContenders.slice(
              0,
              Math.min(3, availableContenders.length),
            );
            opponent = topContenders[randomInt(0, topContenders.length - 1)];

            // Track this opponent
            contract.recentOpponents = [
              ...(contract.recentOpponents || []),
              opponent.id,
            ].slice(-10);
          }

          isTitleMatch = true;
          titleId = title.id;
          // Champions are slightly favored in scripted defenses
          bookedWinnerId = Math.random() < 0.6 ? player.id : opponent.id;
        }
      }
    }

    // Final scripted outcome should use the final selected opponent.
    if (bookedWinnerId == null) {
      const playerOverness = player.getComponent("popularity")?.overness || 0;
      const opponentOverness =
        opponent.getComponent("popularity")?.overness || 0;
      const winChance = 0.5 + (playerOverness - opponentOverness) / 200;
      bookedWinnerId = Math.random() < winChance ? player.id : opponent.id;
    }

    contract.bookedDatesThisMonth = (contract.bookedDatesThisMonth || 0) + 1;

    return {
      type: "match",
      player,
      opponent,
      promotion,
      matchType,
      bookedWinner: bookedWinnerId === player.id ? "wrestler1" : "wrestler2",
      isTitleMatch,
      titleId,
      feudId,
      isBigShow,
    };
  }

  static _isBigShowWeek(promotion, state) {
    if (gameCalendar.isPLEWeek(promotion)) return true;
    return state?.calendar?.week === 4;
  }

  static _findFeudChampionship(state, promotionId, playerId, opponentId) {
    const feudTitles = [];
    for (const [
      championshipId,
      championship,
    ] of state.championships.entries()) {
      if (championship.promotionId !== promotionId) continue;
      const champId = championship.currentChampion;
      if (champId !== playerId && champId !== opponentId) continue;
      feudTitles.push({ ...championship, _id: championshipId });
    }

    if (feudTitles.length === 0) return null;
    feudTitles.sort((a, b) => (b.prestige || 0) - (a.prestige || 0));
    return feudTitles[0];
  }

  static _getChampionSetForPromotion(state, promotionId) {
    const champions = new Set();
    for (const championship of state.championships.values()) {
      if (championship.promotionId !== promotionId) continue;
      if (!championship.currentChampion) continue;
      champions.add(championship.currentChampion);
    }
    return champions;
  }

  static _estimateProjectedMatchQuality(player, opponent, affinity = 0) {
    const statsA = player.getComponent("inRingStats");
    const statsB = opponent.getComponent("inRingStats");
    const popA = player.getComponent("popularity");
    const popB = opponent.getComponent("popularity");

    const avgRingA = statsA
      ? (statsA.brawling +
          statsA.technical +
          statsA.aerial +
          statsA.psychology) /
        4
      : 40;
    const avgRingB = statsB
      ? (statsB.brawling +
          statsB.technical +
          statsB.aerial +
          statsB.psychology) /
        4
      : 40;
    const overA = popA?.overness || 0;
    const overB = popB?.overness || 0;
    const inRingBlend = avgRingA * 0.5 + avgRingB * 0.5;
    const overnessBlend = overA * 0.5 + overB * 0.5;

    // Closer skill levels generally produce better back-and-forth matches.
    const parityPenalty = Math.abs(avgRingA - avgRingB) * 0.35;
    const chemistryBoost = Math.min(
      15,
      Math.max(0, 10 - Math.abs(affinity) / 10),
    );

    const raw =
      inRingBlend * 0.7 + overnessBlend * 0.3 - parityPenalty + chemistryBoost;
    return Math.max(0, Math.min(100, raw));
  }

  static _estimateRingChemistry(player, opponent) {
    const statsA = player.getComponent("inRingStats");
    const statsB = opponent.getComponent("inRingStats");
    if (!statsA || !statsB) return 35;

    const deltas = [
      Math.abs((statsA.brawling || 0) - (statsB.brawling || 0)),
      Math.abs((statsA.technical || 0) - (statsB.technical || 0)),
      Math.abs((statsA.aerial || 0) - (statsB.aerial || 0)),
      Math.abs((statsA.psychology || 0) - (statsB.psychology || 0)),
      Math.abs((statsA.selling || 0) - (statsB.selling || 0)),
    ];
    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    return Math.max(0, Math.min(100, 100 - avgDelta));
  }

  static _scorePlayerFeudCandidate(
    player,
    opponent,
    relationship,
    championSet,
    recentFeudOpponents,
  ) {
    const affinity = relationship?.affinity ?? 0;
    const projectedQuality = this._estimateProjectedMatchQuality(
      player,
      opponent,
      affinity,
    );
    const chemistry = this._estimateRingChemistry(player, opponent);
    const heatPotential = Math.max(0, -affinity);

    const playerIsChampion = championSet.has(player.id);
    const opponentIsChampion = championSet.has(opponent.id);
    const championshipOpportunity =
      playerIsChampion || opponentIsChampion
        ? 100
        : projectedQuality >= 65
          ? 35
          : 10;

    const repeatPenalty = recentFeudOpponents.includes(opponent.id) ? 40 : 0;

    const score =
      projectedQuality * 0.45 +
      championshipOpportunity * 0.3 +
      chemistry * 0.2 +
      heatPotential * 0.15 -
      repeatPenalty;

    return {
      opponent,
      affinity,
      projectedQuality,
      chemistry,
      championshipOpportunity,
      score,
    };
  }

  static _pickWeightedFeudCandidate(scoredCandidates) {
    if (!scoredCandidates.length) return null;
    const top = [...scoredCandidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(4, scoredCandidates.length));
    const totalWeight = top.reduce((sum, c) => sum + Math.max(1, c.score), 0);
    let roll = Math.random() * totalWeight;
    for (const candidate of top) {
      roll -= Math.max(1, candidate.score);
      if (roll <= 0) return candidate;
    }
    return top[0];
  }

  static _buildFeudCause(candidate) {
    if (candidate.championshipOpportunity >= 95) {
      return "championship collision course";
    }
    if (candidate.affinity <= -45) return "intense rivalry";
    if (candidate.affinity <= -25) return "building tension";
    if (candidate.projectedQuality >= 75 && candidate.chemistry >= 70) {
      return "high-stakes dream match rivalry";
    }
    return "competitive rivalry";
  }

  /**
   * Processes AI promotions in the background
   * @private
   * @param {object} state - Game state
   */
  static _processAIPromotions(state) {
    for (const promotion of state.promotions.values()) {
      // Skip player's promotion
      const player = gameStateManager.getPlayerEntity();
      if (player) {
        const playerContract = player.getComponent("contract");
        if (playerContract?.promotionId === promotion.id) continue;
      }

      // Use AIPromotionSystem for comprehensive simulation
      AIPromotionSystem.simulateWeek(promotion, state);
    }
  }

  /**
   * Evolves NPC attributes occasionally (alignment, gimmick, archetype)
   * @private
   * @param {object} state - Game state
   */
  static _evolveNPCs(state) {
    const npcs = [];
    for (const entity of state.entities.values()) {
      if (entity.isPlayer === false) {
        npcs.push(entity);
      }
    }

    for (const npc of npcs) {
      const result = CharacterEvolution.evolveNPC(npc, 0.05, gameStateManager);
      if (result?.success) {
        const identity = npc.getComponent("identity");
        console.log(`NPC Evolution: ${identity.name} changed ${result.oldValue} to ${result.newValue}`);
      }
    }
  }

  /**
   * Generates feuds for player's promotion based on relationships
   * @private
   * @param {object} state - Game state
   */
  static _generatePlayerPromotionFeuds(state) {
    const player = gameStateManager.getPlayerEntity();
    if (!player) return;

    const playerContract = player.getComponent("contract");
    if (!playerContract?.promotionId) return;

    const promotion = state.promotions.get(playerContract.promotionId);
    if (!promotion?.roster || promotion.roster.length < 4) return;

    const roster = promotion.roster
      .map((id) => state.entities.get(id))
      .filter((e) => e && e.id !== player.id);

    if (roster.length < 1) return;

    const recentFeudOpponents = (
      playerContract.recentFeudOpponents || []
    ).slice(-4);
    const championSet = this._getChampionSetForPromotion(state, promotion.id);

    // Prioritize ensuring the player is in an active feud.
    if (!DynamicFeudSystem.hasActiveFeud(player.id)) {
      const playerCandidates = roster
        .filter((wrestler) => !DynamicFeudSystem.hasActiveFeud(wrestler.id))
        .map((wrestler) => {
          const relationship = RelationshipManager.getRelationship(
            player.id,
            wrestler.id,
          );
          return this._scorePlayerFeudCandidate(
            player,
            wrestler,
            relationship,
            championSet,
            recentFeudOpponents,
          );
        });

      if (playerCandidates.length > 0) {
        const freshCandidates = playerCandidates.filter(
          (candidate) => !recentFeudOpponents.includes(candidate.opponent.id),
        );
        const selectionPool =
          freshCandidates.length > 0 ? freshCandidates : playerCandidates;
        const selected = this._pickWeightedFeudCandidate(selectionPool);

        if (selected) {
          const cause = this._buildFeudCause(selected);
          DynamicFeudSystem.startFeud(player, selected.opponent, cause);
          playerContract.recentFeudOpponents = [
            ...(playerContract.recentFeudOpponents || []),
            selected.opponent.id,
          ].slice(-6);
          return;
        }
      }
    }

    // 30% chance to generate a non-player feud each month
    if (Math.random() > 0.3 || roster.length < 3) return;

    // Find pairs with extreme affinity or create rivalry from exciting matches
    const candidates = [];

    for (let i = 0; i < roster.length; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const relationship = RelationshipManager.getRelationship(
          roster[i].id,
          roster[j].id,
        );

        // Start feud if affinity is very negative
        if (relationship && relationship.affinity <= -30) {
          const feudId = [roster[i].id, roster[j].id].sort().join("_");
          if (!state.feuds.has(feudId)) {
            candidates.push({
              wrestlers: [roster[i], roster[j]],
              affinity: relationship.affinity,
            });
          }
        }
      }
    }

    if (candidates.length > 0) {
      const selected = candidates[randomInt(0, candidates.length - 1)];
      const cause =
        selected.affinity < -50 ? "intense rivalry" : "building tension";
      DynamicFeudSystem.startFeud(
        selected.wrestlers[0],
        selected.wrestlers[1],
        cause,
      );
    }
  }

  /**
   * Updates win/loss records after a match
   * @private
   * @param {Entity} winner - Winning wrestler
   * @param {Entity} loser - Losing wrestler
   * @param {number} matchRating - Match rating
   * @param {string} matchDate - Date string for the match
   * @param {string} promotion - Promotion name
   */
  static _updateMatchRecords(winner, loser, matchRating = 0, matchDate = "Unknown", promotion = null) {
    const winnerIdentity = winner.getComponent("identity");
    const loserIdentity = loser.getComponent("identity");
    const promotionName = promotion || "Independent";
    
    // Update winner
    const winnerCareer = winner.getComponent("careerStats");
    if (winnerCareer) {
      winnerCareer.totalWins++;
      winnerCareer.consecutiveWins = (winnerCareer.consecutiveWins || 0) + 1;
      winnerCareer.totalMatches = (winnerCareer.totalMatches || 0) + 1;
      
      if (matchRating > 0) {
        if (!winnerCareer.starRatings) winnerCareer.starRatings = [];
        winnerCareer.starRatings.push(matchRating);
        if (winnerCareer.starRatings.length > 10) winnerCareer.starRatings.shift();
        winnerCareer.averageRating = winnerCareer.starRatings.reduce((a, b) => a + b, 0) / winnerCareer.starRatings.length;
        
        if (matchRating > (winnerCareer.bestMatchRating || 0)) {
          winnerCareer.bestMatchRating = matchRating;
          winnerCareer.bestMatchDetails = {
            rating: matchRating,
            opponent: loserIdentity?.name || "Unknown",
            date: matchDate,
            promotion: promotionName,
          };
        }
        
        if (!winnerCareer.matchHistory) winnerCareer.matchHistory = [];
        winnerCareer.matchHistory.push({
          rating: matchRating,
          opponent: loserIdentity?.name || "Unknown",
          opponentId: loser.id,
          result: "win",
          date: matchDate,
          isMainEvent: false,
          promotion: promotionName,
        });
        if (winnerCareer.matchHistory.length > 50) winnerCareer.matchHistory.shift();
      }
    }

    // Update loser
    const loserCareer = loser.getComponent("careerStats");
    if (loserCareer) {
      loserCareer.totalLosses++;
      loserCareer.consecutiveWins = 0;
      loserCareer.totalMatches = (loserCareer.totalMatches || 0) + 1;
      
      if (matchRating > 0) {
        if (!loserCareer.starRatings) loserCareer.starRatings = [];
        loserCareer.starRatings.push(matchRating);
        if (loserCareer.starRatings.length > 10) loserCareer.starRatings.shift();
        loserCareer.averageRating = loserCareer.starRatings.reduce((a, b) => a + b, 0) / loserCareer.starRatings.length;
        
        if (matchRating > (loserCareer.bestMatchRating || 0)) {
          loserCareer.bestMatchRating = matchRating;
          loserCareer.bestMatchDetails = {
            rating: matchRating,
            opponent: winnerIdentity?.name || "Unknown",
            date: matchDate,
            promotion: promotionName,
          };
        }
        
        if (!loserCareer.matchHistory) loserCareer.matchHistory = [];
        loserCareer.matchHistory.push({
          rating: matchRating,
          opponent: winnerIdentity?.name || "Unknown",
          opponentId: winner.id,
          result: "loss",
          date: matchDate,
          isMainEvent: false,
          promotion: promotionName,
        });
        if (loserCareer.matchHistory.length > 50) loserCareer.matchHistory.shift();
      }
    }
  }
}

/**
 * @typedef {object} PendingAction
 * @property {string} type - Action type (match, promo, event, etc.)
 * @property {Entity} player - Player entity
 * @property {any} [opponent] - Opponent entity (for matches)
 * @property {object} [promotion] - Promotion object
 * @property {string} [matchType] - Type of match
 */

export default WorldSimulator;
