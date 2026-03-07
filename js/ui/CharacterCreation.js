/**
 * CharacterCreation for Mat Life: Wrestling Simulator
 */

import { gameStateManager } from "../core/GameStateManager.js";
import EntityFactory from "../core/EntityFactory.js";
import { capitalize } from "../core/Utils.js";
import AIPromotionSystem from "../engine/AIPromotionSystem.js";
import ChampionshipSystem from "../engine/ChampionshipSystem.js";
import BookerModeEngine from "../engine/BookerModeEngine.js";
import { dataManager } from "../core/DataManager.js";

export class CharacterCreation {
  constructor(uiManager, onCareerStart) {
    this.uiManager = uiManager;
    this.onCareerStart = onCareerStart;
    this.currentStep = 1;
    this.totalSteps = 6;
    this.formData = {
      mode: "WRESTLER",
      archetype: "High-Flyer",
      bookingStyle: "storyteller",
      bonusPoints: {},
      bookerBonusPoints: {},
      pointsRemaining: 10,
      bookerPointsRemaining: 10,
      bookerStart: "custom_indie",
      bookerTargetPromotion: "",
      promotionName: "Frontier Grappling League",
      promotionRegion: "USA",
      productStyle: "Mixed",
      sandboxMode: false,
    };

    this.steps = [
      "step-mode",
      "step-basic-info",
      "step-archetype",
      "step-gimmick",
      "step-stats",
      "step-confirmation",
    ];

    this.statNames = {
      physical: ["strength", "resilience", "speed"],
      inRing: ["brawling", "technical", "aerial", "selling", "psychology"],
      entertainment: ["charisma", "micSkills", "acting"],
    };

    this.bookerStatNames = [
      "creativity",
      "strictness",
      "talentEye",
      "negotiation",
    ];
  }

  init() {
    this.setupEventListeners();
    this.populatePromotionTargets();
    this.updateModeSpecificUI();
    this.showStep(1);
  }

  setupEventListeners() {
    document.querySelectorAll(".mode-card").forEach((card) => {
      card.addEventListener("click", () => {
        document
          .querySelectorAll(".mode-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        this.formData.mode = card.dataset.mode;
        this.updateModeSpecificUI();
      });
    });

    document
      .querySelectorAll(".archetype-card[data-archetype]")
      .forEach((card) => {
        card.addEventListener("click", () => {
          document
            .querySelectorAll(".archetype-card[data-archetype]")
            .forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          this.formData.archetype = card.dataset.archetype;
        });
      });

    document.querySelectorAll(".booker-style-card").forEach((card) => {
      card.addEventListener("click", () => {
        document
          .querySelectorAll(".booker-style-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        this.formData.bookingStyle = card.dataset.bookingStyle;
      });
    });

    const ageSlider = document.getElementById("wrestler-age");
    const ageValue = document.querySelector(".range-value");
    if (ageSlider && ageValue) {
      ageSlider.addEventListener("input", (e) => {
        ageValue.textContent = e.target.value;
      });
    }

    const bookerStart = document.getElementById("booker-start");
    if (bookerStart) {
      bookerStart.addEventListener("change", () =>
        this.updateBookerStartVisibility(),
      );
    }

    document
      .getElementById("next-step")
      ?.addEventListener("click", () => this.nextStep());
    document
      .getElementById("prev-step")
      ?.addEventListener("click", () => this.prevStep());
    document
      .getElementById("start-career-btn")
      ?.addEventListener("click", () => this.startCareer());
  }

  populatePromotionTargets() {
    const select = document.getElementById("booker-target-promotion");
    if (!select) return;

    const realLifePromotions = dataManager.getRealLife()?.promotions || [];
    select.innerHTML = '<option value="">Choose a promotion</option>';
    realLifePromotions.forEach((promotion) => {
      const option = document.createElement("option");
      option.value = promotion.id;
      option.textContent = `${promotion.name} (${promotion.prestige || 50} prestige)`;
      select.appendChild(option);
    });
  }

  updateModeSpecificUI() {
    const isBooker = this.formData.mode === "BOOKER";
    document
      .getElementById("wrestler-basic-fields")
      ?.classList.toggle("hidden", isBooker);
    document
      .getElementById("booker-basic-fields")
      ?.classList.toggle("hidden", !isBooker);
    document
      .getElementById("wrestler-style-grid")
      ?.classList.toggle("hidden", isBooker);
    document
      .getElementById("booker-style-grid")
      ?.classList.toggle("hidden", !isBooker);
    document
      .getElementById("wrestler-gimmick-form")
      ?.classList.toggle("hidden", isBooker);
    document
      .getElementById("booker-promotion-form")
      ?.classList.toggle("hidden", !isBooker);

    const step2Title = document.querySelector("#step-basic-info h2");
    const step3Title = document.querySelector("#step-archetype h2");
    const step4Title = document.querySelector("#step-gimmick h2");
    const step5Title = document.querySelector("#step-stats h2");
    const startBtn = document.getElementById("start-career-btn");

    if (step2Title)
      step2Title.textContent = isBooker ? "Booker Setup" : "Basic Information";
    if (step3Title)
      step3Title.textContent = isBooker
        ? "Choose Your Booking Style"
        : "Choose Your Style";
    if (step4Title)
      step4Title.textContent = isBooker
        ? "Promotion Identity"
        : "Build Your Gimmick";
    if (step5Title)
      step5Title.textContent = isBooker
        ? "Distribute Booker Points"
        : "Distribute Bonus Points";
    if (startBtn)
      startBtn.textContent = isBooker ? "Launch Promotion" : "Start Career";

    this.updateBookerStartVisibility();
  }

  updateBookerStartVisibility() {
    const bookerStart =
      document.getElementById("booker-start")?.value ||
      this.formData.bookerStart;
    document
      .getElementById("booker-target-wrap")
      ?.classList.toggle("hidden", bookerStart !== "established");
    document
      .getElementById("promotion-name-wrap")
      ?.classList.toggle("hidden", bookerStart === "established");
  }

  showStep(stepNum) {
    document
      .querySelectorAll(".step")
      .forEach((step) => step.classList.add("hidden"));
    const stepId = this.steps[stepNum - 1];
    document.getElementById(stepId)?.classList.remove("hidden");

    document
      .getElementById("prev-step")
      ?.classList.toggle("hidden", stepNum === 1);
    const nextBtn = document.getElementById("next-step");
    if (nextBtn) {
      if (stepNum === this.totalSteps) {
        nextBtn.classList.add("hidden");
      } else {
        nextBtn.classList.remove("hidden");
        nextBtn.textContent =
          stepNum === this.totalSteps - 1 ? "Review" : "Next";
      }
    }

    if (stepNum === 5) {
      this.renderStatAllocation();
    } else if (stepNum === 6) {
      this.renderCharacterSummary();
    }

    this.currentStep = stepNum;
  }

  nextStep() {
    if (this.currentStep >= this.totalSteps) return;
    if (!this.validateStep(this.currentStep)) return;
    this.saveStepData(this.currentStep);
    this.showStep(this.currentStep + 1);
  }

  prevStep() {
    if (this.currentStep <= 1) return;
    this.showStep(this.currentStep - 1);
  }

  validateStep(stepNum) {
    const isBooker = this.formData.mode === "BOOKER";
    switch (stepNum) {
      case 1:
        return Boolean(this.formData.mode);
      case 2:
        if (isBooker) {
          const bookerName = document
            .getElementById("booker-name")
            ?.value?.trim();
          const startType = document.getElementById("booker-start")?.value;
          const target = document.getElementById(
            "booker-target-promotion",
          )?.value;
          if (!bookerName) {
            alert("Please enter the booker name.");
            return false;
          }
          if (startType === "established" && !target) {
            alert("Please choose a promotion to take over.");
            return false;
          }
        } else {
          const name = document.getElementById("wrestler-name")?.value?.trim();
          if (!name) {
            alert("Please enter a ring name.");
            return false;
          }
        }
        break;
      case 3:
        if (isBooker) {
          if (!this.formData.bookingStyle) {
            alert("Please select a booking style.");
            return false;
          }
        } else if (!this.formData.archetype) {
          alert("Please select a wrestling style.");
          return false;
        }
        break;
      case 4:
        if (isBooker) {
          const startType =
            document.getElementById("booker-start")?.value ||
            this.formData.bookerStart;
          if (startType !== "established") {
            const promotionName = document
              .getElementById("booker-promotion-name")
              ?.value?.trim();
            if (!promotionName) {
              alert("Please name your promotion.");
              return false;
            }
          }
        }
        break;
      default:
        break;
    }
    return true;
  }

  saveStepData(stepNum) {
    const isBooker = this.formData.mode === "BOOKER";
    switch (stepNum) {
      case 2:
        if (isBooker) {
          this.formData.bookerName =
            document.getElementById("booker-name")?.value?.trim() || "Booker";
          this.formData.age =
            parseInt(document.getElementById("booker-age")?.value, 10) || 32;
          this.formData.gender =
            document.getElementById("booker-gender")?.value || "Other";
          this.formData.hometown =
            document.getElementById("booker-hometown")?.value ||
            "Parts Unknown";
          this.formData.bookerStart =
            document.getElementById("booker-start")?.value || "custom_indie";
          this.formData.bookerTargetPromotion =
            document.getElementById("booker-target-promotion")?.value || "";
          this.formData.sandboxMode = this.formData.bookerStart === "sandbox";
        } else {
          this.formData.name =
            document.getElementById("wrestler-name")?.value?.trim() ||
            "Wrestler";
          this.formData.age =
            parseInt(document.getElementById("wrestler-age")?.value, 10) || 20;
          this.formData.gender =
            document.getElementById("wrestler-gender")?.value || "Male";
          this.formData.hometown =
            document.getElementById("wrestler-hometown")?.value ||
            "Parts Unknown";
        }
        break;
      case 4:
        if (isBooker) {
          this.formData.promotionName =
            document.getElementById("promotion-name")?.value?.trim() ||
            this.formData.promotionName;
          this.formData.promotionRegion =
            document.getElementById("promotion-region")?.value || "USA";
          this.formData.productStyle =
            document.getElementById("promotion-style")?.value || "Mixed";
          this.formData.brandDescription =
            document.getElementById("promotion-description")?.value?.trim() ||
            "";
        } else {
          this.formData.alignment =
            document.querySelector('input[name="alignment"]:checked')?.value ||
            "Face";
          this.formData.gimmick =
            document.getElementById("gimmick-template")?.value || "Underdog";
          this.formData.catchphrase =
            document.getElementById("catchphrase")?.value || "";
          this.formData.entranceStyle =
            document.getElementById("entrance-style")?.value || "Simple";
        }
        break;
      default:
        break;
    }
  }

  renderStatAllocation() {
    const container = document.getElementById("stat-allocation");
    const pointsEl = document.getElementById("points-remaining");
    if (!container || !pointsEl) return;

    container.innerHTML = "";

    if (this.formData.mode === "BOOKER") {
      pointsEl.textContent = this.formData.bookerPointsRemaining;
      const labels = {
        creativity: "Creative Vision",
        strictness: "Locker Room Control",
        talentEye: "Talent Eye",
        negotiation: "Negotiation",
      };
      this.bookerStatNames.forEach((stat) => {
        const baseValue = 10;
        const currentBonus = this.formData.bookerBonusPoints[stat] || 0;
        container.appendChild(
          this.createStatRow(
            labels[stat],
            baseValue,
            currentBonus,
            this.formData.bookerPointsRemaining,
            (delta) => this.adjustBookerStat(stat, delta),
          ),
        );
      });
      return;
    }

    pointsEl.textContent = this.formData.pointsRemaining;
    const archetypeStats = this.getArchetypeStats(this.formData.archetype);
    Object.entries(this.statNames).forEach(([category, stats]) => {
      const categoryHeader = document.createElement("h4");
      categoryHeader.textContent = capitalize(category);
      categoryHeader.style.margin = "1rem 0 0.5rem";
      container.appendChild(categoryHeader);

      stats.forEach((stat) => {
        const baseValue = archetypeStats[category]?.[stat] || 10;
        const currentBonus = this.formData.bonusPoints[stat] || 0;
        container.appendChild(
          this.createStatRow(
            capitalize(stat),
            baseValue,
            currentBonus,
            this.formData.pointsRemaining,
            (delta) => this.adjustStat(stat, delta),
          ),
        );
      });
    });
  }

  createStatRow(labelText, baseValue, currentBonus, pointsRemaining, onAdjust) {
    const row = document.createElement("div");
    row.className = "stat-row";

    const statName = document.createElement("span");
    statName.className = "stat-name";
    statName.textContent = labelText;

    const controls = document.createElement("div");
    controls.className = "stat-controls";

    const minusBtn = document.createElement("button");
    minusBtn.className = "stat-btn";
    minusBtn.textContent = "-";
    minusBtn.disabled = currentBonus <= 0;
    minusBtn.addEventListener("click", () => onAdjust(-1));

    const currentEl = document.createElement("span");
    currentEl.className = "stat-current";
    currentEl.textContent = baseValue + currentBonus;

    const plusBtn = document.createElement("button");
    plusBtn.className = "stat-btn";
    plusBtn.textContent = "+";
    plusBtn.disabled = pointsRemaining <= 0 || currentBonus >= 5;
    plusBtn.addEventListener("click", () => onAdjust(1));

    controls.appendChild(minusBtn);
    controls.appendChild(currentEl);
    controls.appendChild(plusBtn);

    row.appendChild(statName);
    row.appendChild(controls);
    return row;
  }

  adjustStat(stat, delta) {
    const current = this.formData.bonusPoints[stat] || 0;
    if (delta > 0 && this.formData.pointsRemaining > 0 && current < 5) {
      this.formData.bonusPoints[stat] = current + 1;
      this.formData.pointsRemaining--;
    } else if (delta < 0 && current > 0) {
      this.formData.bonusPoints[stat] = current - 1;
      this.formData.pointsRemaining++;
    }
    this.renderStatAllocation();
  }

  adjustBookerStat(stat, delta) {
    const current = this.formData.bookerBonusPoints[stat] || 0;
    if (delta > 0 && this.formData.bookerPointsRemaining > 0 && current < 5) {
      this.formData.bookerBonusPoints[stat] = current + 1;
      this.formData.bookerPointsRemaining--;
    } else if (delta < 0 && current > 0) {
      this.formData.bookerBonusPoints[stat] = current - 1;
      this.formData.bookerPointsRemaining++;
    }
    this.renderStatAllocation();
  }

  getArchetypeStats(archetype) {
    const stats = {
      Technical: {
        physical: { strength: 10, resilience: 12, speed: 12 },
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
        physical: { strength: 8, resilience: 10, speed: 16 },
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
        physical: { strength: 14, resilience: 14, speed: 10 },
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
        physical: { strength: 18, resilience: 16, speed: 8 },
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
        physical: { strength: 14, resilience: 14, speed: 12 },
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
        physical: { strength: 10, resilience: 10, speed: 16 },
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

    return stats[archetype] || stats["High-Flyer"];
  }

  renderCharacterSummary() {
    const container = document.getElementById("character-summary");
    if (!container) return;

    if (this.formData.mode === "BOOKER") {
      const bookingStyle =
        BookerModeEngine.getBookingStyles()[this.formData.bookingStyle]?.name ||
        this.formData.bookingStyle;
      const promotionName =
        this.formData.bookerStart === "established"
          ? dataManager
              .getRealLife()
              ?.promotions?.find(
                (p) => p.id === this.formData.bookerTargetPromotion,
              )?.name || "Established Promotion"
          : this.formData.promotionName;

      container.innerHTML = `
        <div class="summary-section">
          <h4>Booker</h4>
          <div class="summary-row"><span class="summary-label">Name</span><span class="summary-value">${this.formData.bookerName}</span></div>
          <div class="summary-row"><span class="summary-label">Age</span><span class="summary-value">${this.formData.age}</span></div>
          <div class="summary-row"><span class="summary-label">Start Type</span><span class="summary-value">${capitalize(this.formData.bookerStart.replace(/_/g, " "))}</span></div>
        </div>
        <div class="summary-section">
          <h4>Promotion</h4>
          <div class="summary-row"><span class="summary-label">Promotion</span><span class="summary-value">${promotionName}</span></div>
          <div class="summary-row"><span class="summary-label">Region</span><span class="summary-value">${this.formData.promotionRegion}</span></div>
          <div class="summary-row"><span class="summary-label">Product</span><span class="summary-value">${this.formData.productStyle}</span></div>
          <div class="summary-row"><span class="summary-label">Sandbox</span><span class="summary-value">${this.formData.sandboxMode ? "Yes" : "No"}</span></div>
        </div>
        <div class="summary-section">
          <h4>Creative Identity</h4>
          <div class="summary-row"><span class="summary-label">Booking Style</span><span class="summary-value">${bookingStyle}</span></div>
          ${this.bookerStatNames.map((stat) => `<div class="summary-row"><span class="summary-label">${capitalize(stat)}</span><span class="summary-value">${10 + (this.formData.bookerBonusPoints[stat] || 0)}</span></div>`).join("")}
        </div>
      `;
      return;
    }

    const archetypeStats = this.getArchetypeStats(this.formData.archetype);
    container.innerHTML = `
      <div class="summary-section">
        <h4>Identity</h4>
        <div class="summary-row"><span class="summary-label">Name</span><span class="summary-value">${this.formData.name}</span></div>
        <div class="summary-row"><span class="summary-label">Age</span><span class="summary-value">${this.formData.age}</span></div>
        <div class="summary-row"><span class="summary-label">Hometown</span><span class="summary-value">${this.formData.hometown}</span></div>
        <div class="summary-row"><span class="summary-label">Gender</span><span class="summary-value">${this.formData.gender}</span></div>
      </div>
      <div class="summary-section">
        <h4>Gimmick</h4>
        <div class="summary-row"><span class="summary-label">Archetype</span><span class="summary-value">${this.formData.archetype}</span></div>
        <div class="summary-row"><span class="summary-label">Alignment</span><span class="summary-value">${this.formData.alignment}</span></div>
        <div class="summary-row"><span class="summary-label">Style</span><span class="summary-value">${this.formData.gimmick}</span></div>
        <div class="summary-row"><span class="summary-label">Entrance</span><span class="summary-value">${this.formData.entranceStyle}</span></div>
      </div>
      <div class="summary-section">
        <h4>Key Stats</h4>
        <div class="summary-row"><span class="summary-label">Strength</span><span class="summary-value">${archetypeStats.physical.strength + (this.formData.bonusPoints.strength || 0)}</span></div>
        <div class="summary-row"><span class="summary-label">Aerial</span><span class="summary-value">${archetypeStats.inRing.aerial + (this.formData.bonusPoints.aerial || 0)}</span></div>
        <div class="summary-row"><span class="summary-label">Technical</span><span class="summary-value">${archetypeStats.inRing.technical + (this.formData.bonusPoints.technical || 0)}</span></div>
      </div>
    `;
  }

  startCareer() {
    const player =
      this.formData.mode === "BOOKER"
        ? EntityFactory.createPlayerBooker(this.formData)
        : EntityFactory.createPlayerWrestler(this.formData);
    player.isPlayer = true;

    gameStateManager.initializeState({
      playerId: player.id,
      mode: this.formData.mode,
      startYear: 1,
      startMonth: 1,
      startWeek: 1,
    });

    gameStateManager.dispatch("ADD_ENTITY", { entity: player });

    if (this.formData.mode === "BOOKER") {
      this.createBookerWorld(player);
    } else {
      this.createWrestlingWorld(player);
    }

    gameStateManager.dispatch("ADD_LOG_ENTRY", {
      entry: {
        category: "system",
        text:
          this.formData.mode === "BOOKER"
            ? `Welcome to Mat Life Booker Mode. ${this.formData.bookerStart === "established" ? "A new regime begins." : "Your promotion is open for business."}`
            : "Welcome to Mat Life! Your wrestling career begins...",
        type: "start",
      },
    });

    if (this.onCareerStart) {
      this.onCareerStart();
    } else {
      this.uiManager?.showScreen("game-screen");
    }
  }

  createWrestlingWorld(player) {
    const state = gameStateManager.getStateRef();
    AIPromotionSystem.generateInitialPromotions(state, 6);
    this.generateNPCRosters(state);
    this.generateFreeAgents(state, 18);

    const promotions = Array.from(state.promotions.values());
    const indiePromo =
      promotions.find((p) => p.prestige <= 20) ||
      promotions.sort((a, b) => a.prestige - b.prestige)[0];

    if (indiePromo) {
      indiePromo.roster.push(player.id);
      const contract = player.getComponent("contract");
      if (contract) {
        contract.promotionId = indiePromo.id;
        contract.weeklySalary = 100;
        contract.lengthWeeks = 16;
        contract.remainingWeeks = 16;
        contract.position = "opener";
      }
    }

    for (const promotion of state.promotions.values()) {
      ChampionshipSystem.initializePromotionChampionships(promotion);
    }
  }

  createBookerWorld(player) {
    const state = gameStateManager.getStateRef();
    AIPromotionSystem.generateInitialPromotions(state, 6);
    this.generateNPCRosters(state);
    this.generateFreeAgents(state, this.formData.sandboxMode ? 30 : 20);

    let playerPromotion = null;
    if (this.formData.bookerStart === "established") {
      playerPromotion = BookerModeEngine.takeoverPromotion(
        this.formData.bookerTargetPromotion,
        player,
        {
          bookingStyle: this.formData.bookingStyle,
          productStyle: this.formData.productStyle,
          sandboxMode: this.formData.sandboxMode,
          brandDescription: this.formData.brandDescription,
        },
        state,
      );
    } else {
      playerPromotion = BookerModeEngine.createPlayerPromotion(
        {
          startType: this.formData.bookerStart,
          sandboxMode: this.formData.sandboxMode,
          bookingStyle: this.formData.bookingStyle,
          productStyle: this.formData.productStyle,
          promotionName: this.formData.promotionName,
          region: this.formData.promotionRegion,
          brandDescription: this.formData.brandDescription,
        },
        player,
        state,
      );
    }

    if (playerPromotion) {
      for (const promotion of state.promotions.values()) {
        const hasTitles = Array.from(state.championships.values()).some(
          (title) => title.promotionId === promotion.id,
        );
        if (!hasTitles) {
          ChampionshipSystem.initializePromotionChampionships(promotion);
        }
      }
      ChampionshipSystem.ensurePromotionChampions(playerPromotion);
      BookerModeEngine.autoBookCurrentShow(playerPromotion, state);
    }
  }

  generateNPCRosters(state) {
    for (const promotion of state.promotions.values()) {
      if (promotion.realData?.roster) {
        promotion.realData.roster.forEach((wData) => {
          const npc = EntityFactory.createNPCFromJSON({
            ...wData,
            hometown: promotion.region,
          });
          gameStateManager.dispatch("ADD_ENTITY", { entity: npc });

          const contract = npc.getComponent("contract");
          if (contract) {
            contract.promotionId = promotion.id;
            contract.weeklySalary = 500 + (wData.overness || 20) * 10;
            contract.lengthWeeks = 52;
            contract.remainingWeeks = 52;
          }

          promotion.roster.push(npc.id);
        });
      }

      const targetSize =
        promotion.prestige <= 15
          ? 6
          : promotion.prestige <= 40
            ? 15
            : promotion.prestige <= 70
              ? 30
              : 50;
      const needed = targetSize - promotion.roster.length;
      for (let i = 0; i < needed; i++) {
        const npc = EntityFactory.generateRandomIndie(promotion.region);
        gameStateManager.dispatch("ADD_ENTITY", { entity: npc });
        const contract = npc.getComponent("contract");
        if (contract) {
          contract.promotionId = promotion.id;
          contract.weeklySalary = 50 + Math.floor(Math.random() * 150);
          contract.lengthWeeks = 26;
          contract.remainingWeeks = 26;
        }
        promotion.roster.push(npc.id);
      }
    }
  }

  generateFreeAgents(state, count = 20) {
    const regions = ["USA", "Japan", "Mexico", "Canada", "UK"];
    for (let i = 0; i < count; i++) {
      const npc = EntityFactory.generateRandomIndie(
        regions[i % regions.length],
      );
      const contract = npc.getComponent("contract");
      if (contract) {
        contract.promotionId = null;
        contract.weeklySalary = 0;
        contract.lengthWeeks = 0;
        contract.remainingWeeks = 0;
      }
      gameStateManager.dispatch("ADD_ENTITY", { entity: npc });
    }
  }
}

export default CharacterCreation;
