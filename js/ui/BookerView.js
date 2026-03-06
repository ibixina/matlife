import { gameStateManager } from "../core/GameStateManager.js";
import { gameCalendar } from "../core/GameCalendar.js";
import BookerModeEngine from "../engine/BookerModeEngine.js";
import WorldSimulator from "../engine/WorldSimulator.js";
import ChampionshipSystem from "../engine/ChampionshipSystem.js";
import CardPositionSystem from "../engine/CardPositionSystem.js";

function money(value) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString()}`;
}

function pct(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOptions(
  items,
  selected,
  formatter = (item) => ({ value: item, label: item }),
) {
  return items
    .map((item) => {
      const formatted = formatter(item);
      const isSelected =
        String(formatted.value ?? "") === String(selected ?? "");
      return `<option value="${escapeHtml(formatted.value ?? "")}"${isSelected ? " selected" : ""}>${escapeHtml(formatted.label ?? "")}</option>`;
    })
    .join("");
}

function getEntity(state, id) {
  return id ? state.entities.get(id) : null;
}

function getName(state, id) {
  return getEntity(state, id)?.getComponent("identity")?.name || "Unknown";
}

export class BookerView {
  constructor(container, titleEl, onNavigate) {
    this.container = container;
    this.titleEl = titleEl;
    this.onNavigate = onNavigate;
  }

  render(state, currentTab) {
    const promotion = BookerModeEngine.getPlayerPromotion(state);
    if (!promotion) {
      this.titleEl.textContent = "Booker Mode";
      this.container.innerHTML =
        '<div class="empty-state"><p>No player promotion is active.</p></div>';
      return;
    }

    BookerModeEngine.ensurePromotionData(promotion, state);

    const titles = {
      match: "Dashboard",
      backstage: "Roster",
      actions: "Creative",
      people: "Market",
      career: "Office",
    };
    this.titleEl.textContent = titles[currentTab] || "Booker Mode";

    switch (currentTab) {
      case "match":
        this.renderDashboard(state, promotion);
        break;
      case "backstage":
        this.renderRoster(state, promotion);
        break;
      case "actions":
        this.renderCreative(state, promotion);
        break;
      case "people":
        this.renderMarket(state, promotion);
        break;
      case "career":
        this.renderOffice(state, promotion);
        break;
      default:
        this.renderDashboard(state, promotion);
        break;
    }
  }

  refresh() {
    if (typeof this.onNavigate === "function") {
      this.onNavigate();
    }
  }

  renderDashboard(state, promotion) {
    const show = BookerModeEngine.ensureCurrentShow(promotion, state);
    const lastReport =
      promotion.creative.lastShowResult || promotion.showHistory[0] || null;
    const bookedMatches = show.booked.filter(
      (slot) => slot.slotType === "match" && slot.participants?.length >= 2,
    ).length;
    const bookedSegments = show.booked.filter(
      (slot) => slot.slotType === "segment" && slot.participants?.length >= 1,
    ).length;
    const championships = ChampionshipSystem.getPromotionChampionships(
      promotion.id,
    );
    const isShowDay = BookerModeEngine.isCurrentShowDay(promotion, state);

    this.container.innerHTML = `
      <div class="booker-view">
        <section class="booker-hero">
          <div>
            <h4>${escapeHtml(promotion.name)}</h4>
            <p>${escapeHtml(promotion.brand.description || "")}</p>
            <div class="booker-inline-stats">
              <span>Cash: <strong>${money(promotion.bankBalance)}</strong></span>
              <span>Prestige: <strong>${promotion.prestige}</strong></span>
              <span>Fans: <strong>${pct(promotion.fanLoyalty)}</strong></span>
              <span>Locker Room: <strong>${pct(promotion.lockerRoomMorale)}</strong></span>
            </div>
          </div>
          <div class="booker-hero-actions">
            <button class="btn btn-primary" data-booker-action="goto-booking">Open Show Booker</button>
            <button class="btn" data-booker-action="advance-day">Advance 1 Day</button>
            <button class="btn" data-booker-action="advance-show">Advance To Show</button>
            <button class="btn ${isShowDay ? "btn-primary" : ""}" data-booker-action="run-show">${isShowDay ? "Run Tonight's Show" : "Run Current Card"}</button>
          </div>
        </section>

        <section class="booker-grid booker-grid-2">
          <article class="booker-card">
            <h4>Current Show</h4>
            <p><strong>${escapeHtml(show.name)}</strong> · ${show.type} · Week ${state.calendar.week}</p>
            <p>${bookedMatches} matches booked · ${bookedSegments} segments planned</p>
            <p>${show.isPLE ? "Monthly special event with higher stakes." : "Weekly television, tighter pacing matters."}</p>
            <ul class="booker-mini-list">
              ${show.booked
                .slice(0, 5)
                .map(
                  (slot) =>
                    `<li>${escapeHtml(slot.label)}: ${slot.participants?.length ? escapeHtml(slot.participants.map((id) => getName(state, id)).join(" vs ")) : "Unbooked"}</li>`,
                )
                .join("")}
            </ul>
          </article>

          <article class="booker-card">
            <h4>Champions</h4>
            <ul class="booker-mini-list">
              ${championships.length ? championships.map((title) => `<li>${escapeHtml(title.name)}: <strong>${escapeHtml(title.currentChampion?.name || "Vacant")}</strong></li>`).join("") : "<li>No championships tracked.</li>"}
            </ul>
          </article>
        </section>

        <section class="booker-grid booker-grid-2">
          <article class="booker-card">
            <h4>Creative Pressure</h4>
            <div class="booker-inline-stats">
              <span>Show Day: <strong>${isShowDay ? "Yes" : "No"}</strong></span>
              <span>Booking Rep: <strong>${pct(promotion.bookingReputation)}</strong></span>
              <span>Production: <strong>${pct(promotion.productionLevel)}</strong></span>
              <span>Marketing: <strong>${pct(promotion.marketing)}</strong></span>
            </div>
            <p>${promotion.pendingComplaints.length} active complaint${promotion.pendingComplaints.length === 1 ? "" : "s"} waiting in the office.</p>
          </article>

          <article class="booker-card">
            <h4>Last Show</h4>
            ${
              lastReport
                ? `
              <p><strong>${escapeHtml(lastReport.name)}</strong> · ${lastReport.showRating.toFixed(2)} stars</p>
              <div class="booker-inline-stats">
                <span>Attendance: <strong>${(lastReport.attendance || 0).toLocaleString()}</strong></span>
                <span>Net: <strong>${money(lastReport.financials?.net || 0)}</strong></span>
                <span>Safety: <strong>${Math.round(lastReport.safetyRisk || 0)}</strong></span>
              </div>
              <ul class="booker-mini-list">
                ${(lastReport.notes || [])
                  .slice(0, 4)
                  .map((note) => `<li>${escapeHtml(note)}</li>`)
                  .join("")}
              </ul>
            `
                : "<p>No show has been run yet.</p>"
            }
          </article>
        </section>
      </div>
    `;

    this.attachDashboardActions(state, promotion);
  }

  attachDashboardActions(state, promotion) {
    this.container
      .querySelector('[data-booker-action="goto-booking"]')
      ?.addEventListener("click", () => {
        this.onNavigate?.("actions");
      });
    this.container
      .querySelector('[data-booker-action="advance-day"]')
      ?.addEventListener("click", () => {
        WorldSimulator.tick(gameStateManager.getStateRef());
        this.refresh();
      });
    this.container
      .querySelector('[data-booker-action="advance-show"]')
      ?.addEventListener("click", () => {
        this.advanceToNextShow(promotion);
      });
    this.container
      .querySelector('[data-booker-action="run-show"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.runCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
  }

  renderRoster(state, promotion) {
    const roster = (promotion.roster || [])
      .map((id) => state.entities.get(id))
      .filter(Boolean)
      .sort(
        (a, b) =>
          (b.getComponent("popularity")?.overness || 0) -
          (a.getComponent("popularity")?.overness || 0),
      );

    this.container.innerHTML = `
      <div class="booker-view">
        <section class="booker-card">
          <h4>Roster Management</h4>
          <p>Push talent, monitor morale, and keep the card hierarchy coherent.</p>
          <div class="booker-roster-table">
            ${roster
              .map((wrestler) => {
                const identity = wrestler.getComponent("identity");
                const popularity = wrestler.getComponent("popularity");
                const contract = wrestler.getComponent("contract");
                const note = BookerModeEngine.ensureRosterNote(
                  promotion,
                  wrestler.id,
                );
                const position =
                  CardPositionSystem.getPositionInfo?.(
                    contract?.position || "mid_card",
                  )?.name ||
                  contract?.position ||
                  "Mid-Card";
                return `
                <div class="booker-row">
                  <div>
                    <strong>${escapeHtml(identity?.name || "Unknown")}</strong>
                    <div class="booker-subtle">${escapeHtml(identity?.alignment || "Face")} · ${escapeHtml(position)}</div>
                  </div>
                  <div class="booker-inline-stats">
                    <span>Over ${popularity?.overness || 0}</span>
                    <span>Mom ${popularity?.momentum || 0}</span>
                    <span>Morale ${pct(note.morale)}</span>
                    <span>Pay ${money(contract?.weeklySalary || 0)}</span>
                  </div>
                  <div class="booker-row-actions">
                    <select data-roster-push="${wrestler.id}">
                      ${renderOptions(["buried", "lower_mid", "steady", "featured", "main_event"], note.pushLevel)}
                    </select>
                    <button class="btn" data-roster-book="${wrestler.id}">Book</button>
                    <button class="btn btn-danger" data-roster-release="${wrestler.id}">Release</button>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </section>
      </div>
    `;

    this.container.querySelectorAll("[data-roster-push]").forEach((select) => {
      select.addEventListener("change", () => {
        BookerModeEngine.setPushLevel(
          promotion,
          select.dataset.rosterPush,
          select.value,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
    });

    this.container
      .querySelectorAll("[data-roster-release]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          BookerModeEngine.releaseTalent(
            promotion,
            button.dataset.rosterRelease,
            gameStateManager.getStateRef(),
          );
          this.refresh();
        });
      });

    this.container.querySelectorAll("[data-roster-book]").forEach((button) => {
      button.addEventListener("click", () => {
        const wrestlerId = button.dataset.rosterBook;
        const show = BookerModeEngine.ensureCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        const slot = show.booked.find(
          (item) =>
            item.slotType === "match" &&
            (!item.participants || item.participants.length < 2),
        );
        if (slot) {
          const participants = Array.isArray(slot.participants)
            ? slot.participants.slice()
            : [];
          if (!participants.includes(wrestlerId)) participants.push(wrestlerId);
          slot.participants = participants.slice(0, 2);
          if (!slot.bookedWinnerId)
            slot.bookedWinnerId = slot.participants[0] || null;
        }
        this.onNavigate?.("actions");
      });
    });
  }

  renderCreative(state, promotion) {
    const show = BookerModeEngine.ensureCurrentShow(promotion, state);
    const rosterOptions = (promotion.roster || []).map((id) => ({
      value: id,
      label: getName(state, id),
    }));
    const titles = ChampionshipSystem.getPromotionChampionships(promotion.id);
    const storylines = Array.from(state.storylines.values()).filter(
      (storyline) =>
        storyline.active &&
        storyline.participants.some((id) => promotion.roster.includes(id)),
    );

    this.container.innerHTML = `
      <div class="booker-view">
        <section class="booker-card">
          <div class="booker-card-header">
            <div>
              <h4>${escapeHtml(show.name)}</h4>
              <p>${show.type} card builder. Manual booking stays open-ended; use auto-book if you want a baseline and then tweak.</p>
            </div>
            <div class="booker-hero-actions">
              <button class="btn" data-creative-action="auto-book">Auto Book</button>
              <button class="btn" data-creative-action="clear-show">Clear Card</button>
              <button class="btn btn-primary" data-creative-action="run-show">Run Show</button>
            </div>
          </div>
          <div class="booker-slot-list">
            ${show.booked
              .map((slot) =>
                slot.slotType === "match"
                  ? `
              <div class="booker-slot">
                <h5>${escapeHtml(slot.label)} · Match</h5>
                <div class="booker-slot-grid">
                  <label>Wrestler A
                    <select data-slot-field="participantA" data-slot-id="${slot.id}">
                      <option value="">Select</option>
                      ${renderOptions(rosterOptions, slot.participants?.[0], (item) => item)}
                    </select>
                  </label>
                  <label>Wrestler B
                    <select data-slot-field="participantB" data-slot-id="${slot.id}">
                      <option value="">Select</option>
                      ${renderOptions(rosterOptions, slot.participants?.[1], (item) => item)}
                    </select>
                  </label>
                  <label>Match Type
                    <select data-slot-field="matchType" data-slot-id="${slot.id}">
                      ${renderOptions(BookerModeEngine.getMatchTypes(), slot.matchType)}
                    </select>
                  </label>
                  <label>Stipulation
                    <select data-slot-field="stipulation" data-slot-id="${slot.id}">
                      ${renderOptions(["Standard", "No DQ", "Falls Count Anywhere", "Iron Man", "2/3 Falls", "Loser Leaves Town"], slot.stipulation)}
                    </select>
                  </label>
                  <label>Booked Winner
                    <select data-slot-field="bookedWinnerId" data-slot-id="${slot.id}">
                      <option value="">Decide Later</option>
                      ${renderOptions(
                        (slot.participants || []).filter(Boolean).map((id) => ({
                          value: id,
                          label: getName(state, id),
                        })),
                        slot.bookedWinnerId,
                        (item) => item,
                      )}
                    </select>
                  </label>
                  <label>Title
                    <select data-slot-field="titleId" data-slot-id="${slot.id}">
                      <option value="">Non-title</option>
                      ${renderOptions(
                        titles.map((title) => ({
                          value: title.id,
                          label: title.name,
                        })),
                        slot.titleId,
                        (item) => item,
                      )}
                    </select>
                  </label>
                  <label>Finish
                    <select data-slot-field="finish" data-slot-id="${slot.id}">
                      ${renderOptions(["Clean", "Interference", "Flash Pin", "Dusty Finish", "Submission", "Knockout"], slot.finish)}
                    </select>
                  </label>
                  <label>Minutes
                    <input type="number" min="3" max="40" value="${slot.duration || 10}" data-slot-field="duration" data-slot-id="${slot.id}">
                  </label>
                </div>
                <label>Road Agent Notes
                  <input type="text" value="${escapeHtml(slot.roadAgentNotes || "")}" data-slot-field="roadAgentNotes" data-slot-id="${slot.id}">
                </label>
              </div>
            `
                  : `
              <div class="booker-slot">
                <h5>${escapeHtml(slot.label)} · Segment</h5>
                <div class="booker-slot-grid">
                  <label>Segment Type
                    <select data-slot-field="segmentType" data-slot-id="${slot.id}">
                      ${renderOptions(BookerModeEngine.getSegmentTypes(), slot.segmentType)}
                    </select>
                  </label>
                  <label>Participant A
                    <select data-slot-field="participantA" data-slot-id="${slot.id}">
                      <option value="">Select</option>
                      ${renderOptions(rosterOptions, slot.participants?.[0], (item) => item)}
                    </select>
                  </label>
                  <label>Participant B
                    <select data-slot-field="participantB" data-slot-id="${slot.id}">
                      <option value="">Select</option>
                      ${renderOptions(rosterOptions, slot.participants?.[1], (item) => item)}
                    </select>
                  </label>
                  <label>Storyline Focus
                    <select data-slot-field="focusStorylineId" data-slot-id="${slot.id}">
                      <option value="">General angle</option>
                      ${renderOptions(
                        storylines.map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                        slot.focusStorylineId,
                        (item) => item,
                      )}
                    </select>
                  </label>
                  <label>Minutes
                    <input type="number" min="2" max="20" value="${slot.duration || 6}" data-slot-field="duration" data-slot-id="${slot.id}">
                  </label>
                </div>
                <label>Notes
                  <input type="text" value="${escapeHtml(slot.notes || "")}" data-slot-field="notes" data-slot-id="${slot.id}">
                </label>
              </div>
            `,
              )
              .join("")}
          </div>
        </section>

        <section class="booker-card">
          <h4>Storylines</h4>
          <div class="booker-slot-grid">
            <label>Type
              <select id="new-storyline-type">
                ${renderOptions(["feud", "alliance", "betrayal", "mystery", "redemption", "championship_chase"], "feud")}
              </select>
            </label>
            <label>Participant A
              <select id="new-storyline-a">
                <option value="">Select</option>
                ${renderOptions(rosterOptions, "", (item) => item)}
              </select>
            </label>
            <label>Participant B
              <select id="new-storyline-b">
                <option value="">Select</option>
                ${renderOptions(rosterOptions, "", (item) => item)}
              </select>
            </label>
            <label>Name
              <input id="new-storyline-name" type="text" placeholder="Optional custom name">
            </label>
          </div>
          <div class="booker-hero-actions">
            <button class="btn" id="create-storyline-btn">Create Storyline</button>
          </div>
          <ul class="booker-mini-list booker-storyline-list">
            ${storylines.length ? storylines.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> · ${escapeHtml(item.type)} · Beat ${item.currentBeat + 1}/${item.beats.length}</li>`).join("") : "<li>No active storylines yet.</li>"}
          </ul>
        </section>
      </div>
    `;

    this.container.querySelectorAll("[data-slot-id]").forEach((input) => {
      input.addEventListener("change", () =>
        this.handleSlotUpdate(state, promotion, show, input),
      );
    });

    this.container
      .querySelector('[data-creative-action="auto-book"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.autoBookCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
    this.container
      .querySelector('[data-creative-action="clear-show"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.clearCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
    this.container
      .querySelector('[data-creative-action="run-show"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.runCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
    this.container
      .querySelector("#create-storyline-btn")
      ?.addEventListener("click", () => {
        const type = this.container.querySelector("#new-storyline-type")?.value;
        const participantA =
          this.container.querySelector("#new-storyline-a")?.value;
        const participantB =
          this.container.querySelector("#new-storyline-b")?.value;
        const name = this.container.querySelector("#new-storyline-name")?.value;
        if (participantA && participantB && participantA !== participantB) {
          BookerModeEngine.createStoryline(
            promotion,
            type,
            [participantA, participantB],
            { name },
            gameStateManager.getStateRef(),
          );
          this.refresh();
        }
      });
  }

  handleSlotUpdate(state, promotion, show, input) {
    const slot = show.booked.find((item) => item.id === input.dataset.slotId);
    if (!slot) return;

    const field = input.dataset.slotField;
    const updates = {};

    if (field === "participantA" || field === "participantB") {
      const participantA =
        this.container.querySelector(
          `[data-slot-id="${slot.id}"][data-slot-field="participantA"]`,
        )?.value || "";
      const participantB =
        this.container.querySelector(
          `[data-slot-id="${slot.id}"][data-slot-field="participantB"]`,
        )?.value || "";
      updates.participants = [participantA, participantB].filter(Boolean);
      if (!updates.participants.includes(slot.bookedWinnerId)) {
        updates.bookedWinnerId = updates.participants[0] || null;
      }
    } else if (field === "duration") {
      updates[field] = Number(input.value) || 0;
    } else {
      updates[field] = input.value || null;
    }

    BookerModeEngine.setCurrentShowSlot(
      promotion,
      slot.id,
      updates,
      gameStateManager.getStateRef(),
    );
    this.refresh();
  }

  renderMarket(state, promotion) {
    const report = BookerModeEngine.refreshScoutingReport(promotion, state);

    this.container.innerHTML = `
      <div class="booker-view">
        <section class="booker-card">
          <div class="booker-card-header">
            <div>
              <h4>Scouting Report</h4>
              <p>Unsigned talent and, in sandbox play, any worker you want to poach.</p>
            </div>
            <div class="booker-hero-actions">
              <button class="btn" data-market-action="refresh">Refresh Report</button>
            </div>
          </div>
          <div class="booker-market-grid">
            ${report
              .map(
                (item) => `
              <article class="booker-card scout-card">
                <h5>${escapeHtml(item.name)}</h5>
                <div class="booker-inline-stats">
                  <span>Fit ${escapeHtml(item.fit)}</span>
                  <span>Over ${item.overness}</span>
                  <span>Momentum ${item.momentum}</span>
                  <span>Asking ${money(item.salaryHint)}</span>
                </div>
                <button class="btn btn-primary" data-sign-talent="${item.wrestlerId}">Sign</button>
              </article>
            `,
              )
              .join("")}
          </div>
        </section>
      </div>
    `;

    this.container
      .querySelector('[data-market-action="refresh"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.refreshScoutingReport(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
    this.container.querySelectorAll("[data-sign-talent]").forEach((button) => {
      button.addEventListener("click", () => {
        const wrestler = state.entities.get(button.dataset.signTalent);
        if (wrestler) {
          BookerModeEngine.signTalent(
            promotion,
            wrestler,
            {},
            gameStateManager.getStateRef(),
          );
          this.refresh();
        }
      });
    });
  }

  renderOffice(state, promotion) {
    const complaints = promotion.pendingComplaints || [];
    this.container.innerHTML = `
      <div class="booker-view">
        <section class="booker-card">
          <h4>Business Controls</h4>
          <div class="booker-slot-grid">
            <label>Ticket Price
              <input type="number" min="5" max="500" value="${promotion.ticketPrice}" data-office-setting="ticketPrice">
            </label>
            <label>Venue Size
              <input type="number" min="100" max="50000" value="${promotion.venueSize}" data-office-setting="venueSize">
            </label>
            <label>Production
              <input type="range" min="10" max="100" value="${promotion.productionLevel}" data-office-setting="productionLevel">
            </label>
            <label>Marketing
              <input type="range" min="10" max="100" value="${promotion.marketing}" data-office-setting="marketing">
            </label>
            <label>Medical Team
              <input type="range" min="5" max="100" value="${promotion.medicalTeam}" data-office-setting="medicalTeam">
            </label>
            <label>Booking Style
              <select data-office-setting="bookingStyle">
                ${renderOptions(Object.keys(BookerModeEngine.getBookingStyles()), promotion.brand.bookingStyle, (key) => ({ value: key, label: BookerModeEngine.getBookingStyles()[key].name }))}
              </select>
            </label>
          </div>
          <div class="booker-hero-actions">
            <button class="btn" data-office-action="advance-day">Advance 1 Day</button>
            <button class="btn" data-office-action="advance-show">Advance To Show</button>
            <button class="btn btn-primary" data-office-action="run-show">Run Current Show</button>
          </div>
        </section>

        <section class="booker-card">
          <h4>Locker Room Complaints</h4>
          <ul class="booker-mini-list">
            ${complaints.length ? complaints.map((item) => `<li><strong>${escapeHtml(item.severity.toUpperCase())}</strong>: ${escapeHtml(item.text)}</li>`).join("") : "<li>The locker room is stable this week.</li>"}
          </ul>
        </section>

        <section class="booker-card">
          <h4>Business Trend</h4>
          <ul class="booker-mini-list">
            ${
              (promotion.businessHistory || [])
                .slice(0, 6)
                .map(
                  (item) =>
                    `<li>Week ${item.week}: Balance ${money(item.balance)} · Net ${money(item.net)}${item.showRating ? ` · Rating ${item.showRating.toFixed(2)}` : ""}</li>`,
                )
                .join("") || "<li>No business history yet.</li>"
            }
          </ul>
        </section>
      </div>
    `;

    this.container
      .querySelectorAll("[data-office-setting]")
      .forEach((input) => {
        input.addEventListener("change", () => {
          const value =
            input.type === "range" || input.type === "number"
              ? Number(input.value)
              : input.value;
          BookerModeEngine.adjustBusinessSetting(
            promotion,
            input.dataset.officeSetting,
            value,
            gameStateManager.getStateRef(),
          );
          this.refresh();
        });
      });

    this.container
      .querySelector('[data-office-action="advance-day"]')
      ?.addEventListener("click", () => {
        WorldSimulator.tick(gameStateManager.getStateRef());
        this.refresh();
      });
    this.container
      .querySelector('[data-office-action="advance-show"]')
      ?.addEventListener("click", () => {
        this.advanceToNextShow(promotion);
      });
    this.container
      .querySelector('[data-office-action="run-show"]')
      ?.addEventListener("click", () => {
        BookerModeEngine.runCurrentShow(
          promotion,
          gameStateManager.getStateRef(),
        );
        this.refresh();
      });
  }

  advanceToNextShow(promotion) {
    let guard = 0;
    while (guard < 28) {
      const state = gameStateManager.getStateRef();
      BookerModeEngine.ensureCurrentShow(promotion, state);
      const isShowDay = BookerModeEngine.isCurrentShowDay(promotion, state);
      if (isShowDay) break;
      WorldSimulator.tick(state);
      guard += 1;
    }
    this.refresh();
  }
}

export default BookerView;
