# Mat Life: Step-by-Step Implementation Plan

This document breaks the MASTER_PLAN.md into exact, actionable development steps. Each step specifies the file(s) to create, the classes/functions to implement, what to test, and the acceptance criteria before moving on. Steps are meant to be executed sequentially.

---

## Project Structure

```
matlifewrestlingsim/
├── index.html
├── css/
│   ├── reset.css
│   ├── variables.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── main.js                    // Entry point, wires everything together
│   ├── core/
│   │   ├── GameStateManager.js    // Centralized state with dispatch/subscribe
│   │   ├── GameCalendar.js        // Time tracking and tick logic
│   │   ├── Entity.js              // Base Entity class
│   │   ├── Component.js           // Base Component + all component subclasses
│   │   ├── EntityFactory.js       // Creates entities from JSON data or creation screen
│   │   └── Utils.js               // UUID gen, clamp, random helpers
│   ├── engine/
│   │   ├── ResolutionEngine.js    // D20 roller, modifiers, advantage/disadvantage
│   │   ├── MatchSimulator.js      // Full match simulation with phases
│   │   ├── PromoEngine.js         // Promo battle resolution
│   │   ├── WorldSimulator.js      // Background world tick processing
│   │   ├── EventManager.js        // Tag-based dynamic event generation
│   │   ├── TagEngine.js           // Auto-applies/removes tags based on state
│   │   ├── RelationshipManager.js // Relationship graph operations
│   │   ├── InjuryEngine.js        // Injury generation, recovery, chronic logic
│   │   ├── FinancialEngine.js     // Income/expense processing per tick
│   │   └── BookingEngine.js       // AI booking logic for NPC promotions
│   ├── ui/
│   │   ├── UIManager.js           // Master renderer, tab switching
│   │   ├── PlayerInfoPanel.js     // Top bar: name, titles, stats
│   │   ├── EventLogPanel.js       // Left panel: scrollable narrative log
│   │   ├── ActionPanel.js         // Right panel: choices and actions
│   │   ├── NavigationBar.js       // Bottom tab bar
│   │   ├── CharacterCreation.js   // New game / character creation screens
│   │   ├── MatchView.js           // Match play-by-play display
│   │   ├── PeopleView.js          // Roster directory and relationship viewer
│   │   ├── BookerView.js          // Card booking interface (Booker Mode)
│   │   └── DiaryView.js           // Career log / diary viewer
│   └── data/
│       ├── wrestlers.json
│       ├── promotions.json
│       ├── championships.json
│       ├── moves.json
│       ├── events.json
│       ├── promos.json
│       └── narratives.json
├── docs/
│   ├── MASTER_PLAN.md
│   └── IMPLEMENTATION_PLAN.md     // This file
└── tests/
    ├── test-runner.html           // Browser-based test runner
    ├── resolution.test.js
    ├── calendar.test.js
    ├── state.test.js
    ├── match.test.js
    └── event.test.js
```

---

## MILESTONE 1: The Invisible Engine

**Goal:** All core logic works in the console. No UI. Every system can be validated via test scripts.

---

### Step 1.1: Utility Functions
**File:** `js/core/Utils.js`

**Implement:**
- `generateUUID()` — Returns a v4 UUID string.
- `clamp(value, min, max)` — Returns value clamped between min and max.
- `randomInt(min, max)` — Returns a random integer between min and max (inclusive).
- `randomFloat(min, max)` — Returns a random float between min and max.
- `weightedRandom(items)` — Takes an array of `{ value, weight }` and returns a weighted random pick.
- `rollD20()` — Returns `randomInt(1, 20)`.
- `deepClone(obj)` — Structured clone for state snapshots.

**Acceptance:** Import in console, run `rollD20()` 100 times, verify range is always 1-20. Run `weightedRandom` with known weights and verify distribution over 10,000 runs.

---

### Step 1.2: Component Classes
**File:** `js/core/Component.js`

**Implement every component from MASTER_PLAN §2.4 as a class:**

Each component class has:
- A constructor that accepts an options object with default values for every property.
- A `serialize()` method returning a plain object.
- A static `deserialize(data)` method to reconstruct from plain object.

Components to implement (in order):
1. `IdentityComponent` — Properties: name, age, hometown, gender, gimmick, alignment, catchphrase, entranceStyle. Default alignment: "Face".
2. `PhysicalStatsComponent` — Properties: stamina (default 50), strength (default 10), resilience (default 10), speed (default 10).
3. `InRingStatsComponent` — Properties: brawling (10), technical (10), aerial (10), selling (10), psychology (10).
4. `EntertainmentStatsComponent` — Properties: charisma (10), micSkills (10), acting (10).
5. `ConditionComponent` — Properties: health (100), energy (100), injuries (empty array), mentalHealth (75).
6. `MovesetComponent` — Properties: signatures (empty array), finishers (empty array), movePool (empty array).
7. `CareerStatsComponent` — Properties: totalWins (0), totalLosses (0), draws (0), titleReigns (empty array), bestMatchRating (0), hallOfFamePoints (0).
8. `PromotionRecordComponent` — Properties: records (empty Map).
9. `ContractComponent` — Properties: promotionId (null), weeklySalary (0), lengthWeeks (0), remainingWeeks (0), hasCreativeControl (false), hasMerchCut (0), tvAppearanceBonus (0), noCompeteWeeks (0).
10. `FinancialComponent` — Properties: bankBalance (500), weeklyExpenses (100), merchandiseIncome (0), sponsorships ([]), investments ([]), agent (null), investmentAgent (null), medicalDebt (0).
11. `PopularityComponent` — Properties: overness (5), momentum (0), regionPop (empty Map).
12. `SocialMediaComponent` — Properties: followers (0), postFrequency ("never"), scandalRisk (0).
13. `LifestyleComponent` — Properties: workRate (0), travelFatigue (0), burnout (0), familyMorale (50), sideHustles ([]).
14. `WellnessComponent` — Properties: pedUsage (false), pedDetectionRisk (0), wellnessStrikes (0), lastTestWeek (0).
15. `BookerStatsComponent` — Properties: creativity (10), strictness (10), favoritism (empty Map).

**Acceptance:** Create instances of each component with defaults and with custom values. Serialize, then deserialize, and verify deep equality.

---

### Step 1.3: Entity Base Class
**File:** `js/core/Entity.js`

**Implement:**
- `Entity` class.
- Constructor: `constructor(id = generateUUID())`. Initializes `this.id`, `this.tags = new Set()`, `this.components = new Map()`.
- `addComponent(name, component)` — Stores component in map keyed by name string (e.g., "identity", "physicalStats").
- `getComponent(name)` — Returns the component or null.
- `hasComponent(name)` — Boolean check.
- `removeComponent(name)` — Deletes from map.
- `addTag(tag)` / `removeTag(tag)` / `hasTag(tag)` — Operate on the tags Set.
- `serialize()` — Returns `{ id, tags: [...this.tags], components: Object.fromEntries(map serialized) }`.
- `static deserialize(data)` — Reconstructs Entity with all components deserialized (needs a component registry/factory for this).

**Acceptance:** Create an Entity, add IdentityComponent and PhysicalStatsComponent, add tags `[Face]` and `[Rookie]`. Serialize, deserialize, verify all data intact.

---

### Step 1.4: The GameStateManager
**File:** `js/core/GameStateManager.js`

**Implement:**
- Singleton class (or module-level instance).
- Internal `state` object matching MASTER_PLAN §2.2 structure.
- `getState()` — Returns a read-only reference (or deep clone for safety during dev).
- `dispatch(actionType, payload)` — A switch/map that applies mutations to state based on action type. All state changes MUST go through dispatch.
- `subscribe(listener)` — Registers a callback function. Called after every dispatch. Returns an unsubscribe function.
- `initializeState(config)` — Sets up a fresh game state from a config object (used at new game creation).

**Action Types to implement initially:**
- `ADD_ENTITY` — payload: `{ entity }`. Adds to `state.entities`.
- `REMOVE_ENTITY` — payload: `{ entityId }`.
- `UPDATE_COMPONENT` — payload: `{ entityId, componentName, updates }`. Merges updates into the component.
- `ADD_TAG` — payload: `{ entityId, tag }`.
- `REMOVE_TAG` — payload: `{ entityId, tag }`.
- `ADVANCE_TIME` — payload: none. Calls `GameCalendar.tick()`.
- `ADD_LOG_ENTRY` — payload: `{ entry }`. Pushes to `state.history`.
- `SET_RELATIONSHIP` — payload: `{ entityA, entityB, changes }`.
- `ADD_FEUD` / `UPDATE_FEUD` / `REMOVE_FEUD`.
- `ADD_CONTRACT` / `UPDATE_CONTRACT` / `REMOVE_CONTRACT`.

**Acceptance:** Dispatch `ADD_ENTITY`, verify entity is in state. Subscribe a listener, dispatch an action, verify listener fires. Dispatch `UPDATE_COMPONENT` on a stat, verify value changed.

---

### Step 1.5: The Calendar System
**File:** `js/core/GameCalendar.js`

**Implement:**
- `GameCalendar` class.
- Internal state: `{ year, month, week, day, timeOfDay }`.
- `TIME_SLOTS` constant: `["Morning", "Afternoon", "Evening", "Night"]`.
- `DAYS` constant: `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]`.
- `tick()` — Advances timeOfDay by one slot. If it overflows Night, advance day. If day overflows Sunday, advance week. If week overflows 4, advance month. If month overflows 12, advance year and trigger `onYearEnd` callback.
- `getCurrentDate()` — Returns formatted date string.
- `getWeekNumber()` — Absolute week number since game start (for contract/cooldown tracking).
- `isShowDay(promotion)` — Checks if the current day+timeOfDay matches any of the promotion's scheduled shows.
- `isPLEWeek(promotion)` — Checks if the current week matches a PLE in the promotion's calendar.
- `serialize()` / `static deserialize()`.

**Acceptance:** Start at Monday Morning, Week 1, Jan, Year 1. Tick 28 times (7 days × 4 slots). Verify it's now Monday Morning, Week 2. Tick through the entire year. Verify year increments.

---

### Step 1.6: The Resolution Engine
**File:** `js/engine/ResolutionEngine.js`

**Implement:**
- `ResolutionEngine` class (stateless — all methods can be static or on a singleton).
- **Core Method:** `resolve({ actor, action, target, stat, dc, context })` → Returns `ResolutionResult`.
  - `action` is a string label (e.g., "Aerial Move", "Cut Promo").
  - `stat` is the primary stat name (e.g., "aerial", "micSkills").
  - `dc` is the base Difficulty Class.
  - `context` is an object with optional flags: `{ hasAdvantage, hasDisadvantage, bonuses: [], penalties: [] }`.
- **Resolution Logic:**
  1. Get the actor's stat value from their relevant component.
  2. Calculate total modifier: `statValue + sum(bonuses) - sum(penalties)`.
  3. Determine advantage/disadvantage from context. Also check: actor tags (`[Hot_Streak]` = advantage, `[Burned_Out]` = disadvantage), actor injuries (any injury on relevant body part = disadvantage).
  4. If advantage and disadvantage both present, cancel out (roll normally).
  5. Roll: If advantage, `Math.max(rollD20(), rollD20())`. If disadvantage, `Math.min(rollD20(), rollD20())`. Else `rollD20()`.
  6. If raw roll is 1: `CRITICAL_FAILURE`. If raw roll is 20: `CRITICAL_SUCCESS`.
  7. Else: `total = roll + modifier`. If `total >= dc`: `SUCCESS`. Else: `FAILURE`.
- **Return:** `ResolutionResult { outcome: "CRITICAL_SUCCESS"|"SUCCESS"|"FAILURE"|"CRITICAL_FAILURE", roll, modifier, total, dc }`.

- **Contested Method:** `resolveContested({ actor, actorStat, target, targetStat, context })` → Returns `ContestedResult`.
  - Both sides roll D20 + their stat + modifiers.
  - `ContestedResult { winner: "actor"|"target", margin, actorTotal, targetTotal }`.
  - Margin categories: 1-3 = "narrow", 4-7 = "clear", 8+ = "dominant".

**Acceptance:** Run `resolve()` 10,000 times with a fixed DC and stat. Verify crit rate ~5% each. Verify advantage shifts average roll upward. Verify disadvantage shifts it downward. Test contested with equal stats and verify ~50/50 win rate.

---

### Step 1.7: The Relationship Manager
**File:** `js/engine/RelationshipManager.js`

**Implement:**
- `RelationshipManager` class.
- Uses the `state.relationships` Map from GameStateManager.
- **Key helper:** `getKey(idA, idB)` — Always returns the alphabetically-sorted pair joined by `|` to ensure consistency (A|B same as B|A).
- `getRelationship(idA, idB)` — Returns the edge object or a default `{ affinity: 0, type: "professional", history: [] }`.
- `setRelationship(idA, idB, changes)` — Dispatches `SET_RELATIONSHIP`. Clamps affinity to -100/+100.
- `modifyAffinity(idA, idB, delta, reason)` — Adjusts affinity by delta. Appends reason to history array.
- `getAffinityModifier(idA, idB)` — Returns a numeric modifier for the Resolution Engine. Maps affinity to a range: -100 = -5, 0 = 0, +100 = +5.
- `driftRelationships()` — Called on weekly tick. All relationships drift 1 point toward 0 (decay of grudges and friendships over time).
- `getAverageAffinity(entityId, promotionRoster)` — Returns the average affinity of an entity with all members of a given roster. Used for Locker Room Leader calculation.

**Acceptance:** Set a relationship to +80. Drift it 10 times. Verify it's now +70. Modify by -50. Verify clamped. Check getAffinityModifier returns expected range.

---

### Step 1.8: The Tag Engine
**File:** `js/engine/TagEngine.js`

**Implement:**
- `TagEngine` class.
- `evaluateTags(entity, state)` — Checks all tag rules from MASTER_PLAN §10.1 and adds/removes tags accordingly.
- **Tag Rules (implement as an array of rule objects):**
  ```
  { tag: "Champion", condition: (entity, state) => entity has a title in state.championships, remove: (entity, state) => entity does not have a title }
  { tag: "Hot_Streak", condition: () => entity.careerStats.consecutiveWins >= 5, remove: () => consecutiveWins < 5 }
  { tag: "Cold", condition: () => weeksSinceLastMatch >= 3, remove: () => justBooked }
  { tag: "Contract_Expiring", condition: () => contract.remainingWeeks <= 8, remove: () => remainingWeeks > 8 or no contract }
  { tag: "Veteran", condition: () => yearsActive >= 10, remove: () => never }
  { tag: "Rookie", condition: () => yearsActive < 2, remove: () => yearsActive >= 2 }
  { tag: "Over", condition: () => overness >= 70, remove: () => overness < 60 }
  { tag: "Burned_Out", condition: () => burnout >= 80, remove: () => burnout < 50 }
  { tag: "Financial_Trouble", condition: () => bankBalance < 500, remove: () => bankBalance > 2000 }
  { tag: "Dangerous_Worker", condition: () => injuriesCausedCount >= 3, remove: () => 1 year clean }
  { tag: "Locker_Room_Leader", condition: () => highest avg affinity in promotion + overness >= 50, remove: () => someone else qualifies }
  { tag: "Scandal", condition: () => just failed social media check, remove: () => 4 weeks pass }
  // Plus all injury tags: "Injured_Knee_L", "Injured_Back", etc. generated dynamically from ConditionComponent.injuries
  ```
- `evaluatePerks(entity)` — Checks perk unlock conditions from MASTER_PLAN §2.5 and adds perk tags.
- `runAllEntities(state)` — Iterates all entities and runs `evaluateTags` on each. Called every tick.

**Acceptance:** Create a wrestler entity with 5 consecutive wins. Run evaluateTags. Verify `[Hot_Streak]` tag is present. Set wins to 3. Run again. Verify tag removed.

---

### Step 1.9: The Injury Engine
**File:** `js/engine/InjuryEngine.js`

**Implement:**
- `InjuryEngine` class.
- `BODY_PARTS` constant: Full list from MASTER_PLAN §7.1 (`["Head", "Neck", "Shoulder_L", "Shoulder_R", "Back", "Ribs", "Arm_L", "Arm_R", "Hand_L", "Hand_R", "Hip", "Knee_L", "Knee_R", "Ankle_L", "Ankle_R", "Foot_L", "Foot_R"]`).
- `BODY_PART_WEIGHTS` — Per move type. E.g., `{ aerial: { Knee_L: 3, Knee_R: 3, Ankle_L: 3, Ankle_R: 3, Back: 1, ... }, brawling: { Head: 4, Ribs: 3, ... }, grapple: { Neck: 3, Back: 3, ... } }`.
- `generateInjury(moveType, severity)` — Rolls a weighted random body part based on moveType weights. Returns `{ bodyPart, severity, daysRemaining: calculateRecovery(severity), chronic: false }`.
- `calculateRecovery(severity)` — Returns days: sev 1 = 7-14, sev 2 = 21-42, sev 3 = 56-112, sev 4 = 168-336, sev 5 = 365+.
- `tickInjuries(entity)` — Called daily. Decrements `daysRemaining` on all injuries. Removes healed injuries. Applies age penalty to recovery (MASTER_PLAN §5.2: 35-39 = +20% recovery time, 40+ = +50%).
- `worsenInjury(entity, bodyPart)` — Finds the injury on that body part, increases severity by 1. If severity was 4 and is now 5, set `chronic: true` and apply permanent stat penalties.
- `getInjuryPenalties(entity)` — Returns a map of stat names to penalty values based on current injuries. E.g., `Knee_L` injury penalizes `aerial` and `speed`.
- `INJURY_STAT_MAP` — Maps body parts to affected stats: `{ Knee_L: ["aerial", "speed"], Knee_R: ["aerial", "speed"], Back: ["strength", "resilience"], Neck: ["brawling", "resilience"], Shoulder_L: ["strength", "aerial"], Head: ["psychology", "micSkills"], ... }`.

**Acceptance:** Generate 1000 aerial injuries. Verify knee/ankle body parts appear most frequently. Create a severity-3 injury, tick 80 days, verify it heals. Worsen a severity-4 injury, verify chronic flag set.

---

### Step 1.10: The Financial Engine
**File:** `js/engine/FinancialEngine.js`

**Implement:**
- `FinancialEngine` class.
- `processWeeklyFinances(entity, state)` — Called once per week tick.
  1. **Income:** Add contract salary + merchandiseIncome + sponsorship incomes + side hustle incomes.
  2. **Expenses:** Subtract weeklyExpenses + agent fees (% of income) + investmentAgent fees + medical debt payments.
  3. **Investments:** For each investment, roll: `D20 + investmentAgent.quality vs DC 10`. Success = `principal * returnRate` added. Failure = loss.
  4. **Merchandise Calc:** `overness * alignmentModifier * merchCutPercent * promotionReach / 100`. Face = 1.3x, Heel = 1.0x, Tweener = 1.15x.
  5. **Sponsorship Tick:** Decrement `weeksRemaining` on all sponsorships. Remove expired ones.
  6. Update `bankBalance` on the entity's FinancialComponent via dispatch.
- `calculateTravelCost(fromRegion, toRegion)` — Returns dollar amount for travel between regions.

**Acceptance:** Create a wrestler with a $1000/week salary, $100 expenses, 10% agent fee. Process one week. Verify balance increased by $800 (1000 - 100 - 100).

---

### Step 1.11: The World Simulator
**File:** `js/engine/WorldSimulator.js`

**Implement:**
- `WorldSimulator` class.
- `tick(state)` — The master "advance the world" function. Called when the player clicks "Advance Time."
  1. Call `GameCalendar.tick()`.
  2. Call `TagEngine.runAllEntities(state)` to refresh all tags.
  3. Call `InjuryEngine.tickInjuries()` for all entities (daily).
  4. If it's a new week: Call `FinancialEngine.processWeeklyFinances()` for the player. Call `RelationshipManager.driftRelationships()`.
  5. If it's a show day for the player's promotion: Generate the show card (AI booking for NPC matches). Queue the player's match/promo if booked.
  6. Call `EventManager.generateEvents()` to check for dynamic events.
  7. Process AI promotions: simulate their shows in the background (simplified — just update their prestige, rosters, and title holders based on RNG without full match simulation).
  8. Return a list of `PendingActions` (events/matches/promos requiring player input) or an empty list (meaning the day auto-advances).
- `simulateNPCMatch(wrestler1, wrestler2, matchType)` — Simplified match sim for background. Rolls a single D20 for each wrestler with their highest relevant stat. Higher roll wins. Generates a simplified match rating. Updates win/loss records.

**Acceptance:** Create a state with 10 wrestlers in a promotion. Tick through an entire week. Verify injuries healed, finances processed, relationships drifted, tags updated.

---

### Step 1.12: The Event Manager
**File:** `js/engine/EventManager.js`

**Implement:**
- `EventManager` class.
- `eventTemplates` — Loaded from `events.json`. Array of EventTemplate objects (MASTER_PLAN §10.2 structure).
- `cooldowns` — Map of `eventId → weekLastFired`.
- `generateEvents(playerEntity, state)` — The core method:
  1. Get all player tags.
  2. Filter `eventTemplates` to find those whose `requiredTags` are ALL present in player tags AND whose `excludedTags` are ALL absent.
  3. Further filter by `cooldownWeeks` (skip events that fired too recently).
  4. If `requiredState` function exists on the template, run it and filter out failures.
  5. Apply weights. Use `weightedRandom()` to pick 0 or 1 events.
  6. Return the selected `EventTemplate` (or null if no event fires).
- `resolveChoice(event, choiceIndex, playerEntity, state)` — Player picked a choice. If the choice has a `check`, run it through `ResolutionEngine.resolve()`. Based on the result tier (critSuccess/success/failure/critFailure), apply the `effects` (StateChanges) via `GameStateManager.dispatch()`. Return the narrative string with template variables filled in.
- `fillTemplate(narrativeString, context)` — Replaces `{player.name}`, `{promotion.name}`, `{opponent.name}`, etc. with actual values from the context.

**Acceptance:** Create 3 event templates with different required tags. Give the player tags matching only 1 of them. Run generateEvents 100 times. Verify only the matching event ever fires. Test cooldown: fire an event, verify it doesn't fire again within cooldown period.

---

### Step 1.13: Initial Event Templates
**File:** `js/data/events.json`

**Implement 15 starter events (enough to validate the system):**
1. "The Vultures Circle" — Tags: `[Contract_Expiring]`, `[Over]`. Choices: Leak / Deny / Agent negotiates.
2. "Reckless Opponent" — Tags: `[Impending_Match]`. RequiredState: opponent has `[Dangerous_Worker]`. Choices: Complain to booker / Confront / Risk it.
3. "Locker Room Argument" — Tags: any entity with affinity < -30. Choices: Escalate / Walk away / Mediate (if `[Locker_Room_Leader]`).
4. "Wellness Test" — Tags: `[Substance_Issues]` or random check. Choices: Take the test / Try to dodge.
5. "PED Offer" — ExcludedTags: `[Substance_Issues]` with 3 strikes. Choices: Accept / Refuse / Report.
6. "Fan Encounter" — Tags: `[Over]`. Choices: Sign autographs / Ignore / Selfie (social media boost).
7. "Injury Setback" — Tags: `[Injured_*]`. RequiredState: Player chose to work hurt. Choices: See a doctor / Push through / Take time off.
8. "Scout Notice" — Tags: `[Rookie]`, overness ≥ 25. RequiredState: Player has no contract. A promotion offers a developmental deal.
9. "Gimmick Going Stale" — Tags: `[Cold]`, same gimmick > 1 year. Choices: Reinvent / Double down / Ask booker for direction.
10. "Social Media Blowup" — Tags: `[Scandal]`. Choices: Apologize / Double down / Delete and go silent.
11. "Van Broke Down" (Indie) — Tags: `[Rookie]`, no contract. Choices: Pay for repair / Hitchhike / Miss the show.
12. "Promoter Didn't Pay" (Indie) — Tags: no contract. Choices: Confront / Let it go / Blast on social media.
13. "Faction Power Struggle" — Tags: faction member, non-leader with higher overness than leader. Choices: Challenge / Stay loyal / Leave faction.
14. "Mentor Offer" — Tags: `[Veteran]`, high affinity with a `[Rookie]`. Choices: Accept / Decline.
15. "Burnout Warning" — Tags: `[Burned_Out]`. Choices: Take vacation / See therapist / Ignore.

**Acceptance:** Load the JSON. Verify all 15 templates parse correctly. Run each through the EventManager with matching tags and verify they fire.

---

### Step 1.14: Initial Moves Database
**File:** `js/data/moves.json`

**Implement a starter set of ~40 moves covering all types:**

**Strikes (8):** Punch (brawling, DC 5), Chop (brawling, DC 6), Enzuigiri (aerial, DC 10), Superkick (brawling, DC 9), Dropkick (aerial, DC 7), Headbutt (brawling, DC 8), Forearm Smash (brawling, DC 6), Roundhouse Kick (brawling, DC 9).

**Grapples (8):** Bodyslam (strength, DC 6), Suplex (technical, DC 8), DDT (technical, DC 8), Powerbomb (strength, DC 11), Piledriver (strength, DC 13, high injury risk), German Suplex (technical, DC 10), Backbreaker (strength, DC 9), Neckbreaker (brawling, DC 7).

**Aerial (8):** Crossbody (aerial, DC 8), Moonsault (aerial, DC 13), 450 Splash (aerial, DC 15), Frog Splash (aerial, DC 11), Diving Elbow (aerial, DC 9), Hurricanrana (aerial, DC 10), Shooting Star Press (aerial, DC 16, highest spectacle), Swanton Bomb (aerial, DC 12).

**Submissions (8):** Armbar (technical, DC 8), Sharpshooter (technical, DC 10), Figure Four (technical, DC 9), Crossface (technical, DC 11), Sleeper Hold (brawling, DC 7), Ankle Lock (technical, DC 10), Kimura (technical, DC 12), Boston Crab (technical, DC 8).

**Signatures/Finishers (8 examples):** Stone Cold Stunner, RKO, Tombstone Piledriver, F-5, GTS, One Winged Angel, Canadian Destroyer, Rainmaker. Each with high spectacle (4-5), high damage, high DC (14-17).

Each move entry: `{ id, name, type, primaryStat, baseDC, staminaCost, damageBase, injuryRisk, spectacle }`.

**Acceptance:** Load the JSON. Verify all entries have valid types and stats. Verify finishers have spectacle ≥ 4.

---

### Step 1.15: Milestone 1 Integration Test
**File:** `tests/integration-m1.test.js` (run in browser console or node)

**Test Scenario: "A Week in the Life"**
1. Initialize GameState.
2. Create a player entity (Wrestler, indie, no contract, archetype: High-Flyer).
3. Create 5 NPC wrestlers.
4. Create 1 indie promotion with the player and NPCs on the roster.
5. Tick through 7 full days (28 time slots).
6. Verify: Calendar advanced correctly. An indie show fired on Saturday. Player was booked for a match. The match was resolved via ResolutionEngine. Win/loss record updated. Financial balance changed. Tags were evaluated. At least 1 event could have fired (check generateEvents returned a valid template).

**Acceptance:** All assertions pass. Console log shows a coherent week of activity.

---

## MILESTONE 2: The Skeleton UI

**Goal:** The game is visible in a browser. The player can see their stats, read the event log, click choices, and advance time.

---

### Step 2.1: HTML Shell
**File:** `index.html`

**Implement:**
- HTML5 boilerplate with meta tags (title: "Mat Life: Wrestling Simulator", description, charset, viewport).
- Link CSS files: reset.css, variables.css, layout.css, components.css.
- Body contains a single `<div id="app">` container.
- Script tag: `<script type="module" src="js/main.js"></script>`.
- A hidden `<div id="character-creation">` for the new game screen (initially visible).
- The main game layout `<div id="game-screen" style="display:none">` containing:
  - `<header id="player-info">` (top row).
  - `<main id="game-area">` containing `<section id="event-log">` (left) and `<section id="action-panel">` (right).
  - `<nav id="nav-bar">` (bottom row) with 4 buttons: Match/Promo, Backstage, Actions, People.

---

### Step 2.2: CSS Design System
**File:** `css/variables.css`

**Implement:**
- CSS custom properties for a dark, premium aesthetic:
  - `--bg-primary: #0a0a0f` (near-black), `--bg-secondary: #12121a` (dark panel), `--bg-tertiary: #1a1a2e` (lighter panel).
  - `--accent-primary: #e94560` (vibrant red — wrestling ropes), `--accent-secondary: #ffc857` (gold — championship).
  - `--text-primary: #e8e8e8`, `--text-secondary: #8888a0`, `--text-accent: #e94560`.
  - `--border-color: #2a2a3e`, `--border-glow: rgba(233, 69, 96, 0.3)`.
  - `--font-primary: 'Inter', sans-serif`, `--font-display: 'Bebas Neue', sans-serif` (headings).
  - `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`.
  - `--transition-fast: 150ms ease`, `--transition-normal: 300ms ease`.

**File:** `css/reset.css` — Standard CSS reset (box-sizing, margin, padding).

**File:** `css/layout.css`
- `#app` — Full viewport height.
- `#game-screen` — CSS Grid: `grid-template-rows: auto 1fr auto; grid-template-columns: 2fr 1fr;`.
- `#player-info` — Spans full width (grid-column: 1 / -1). Flexbox row.
- `#event-log` — Grid row 2, col 1. Scrollable. `overflow-y: auto`.
- `#action-panel` — Grid row 2, col 2.
- `#nav-bar` — Spans full width. Flexbox row with equal-width buttons.

**File:** `css/components.css`
- Styles for buttons (`.btn`, `.btn-primary`, `.btn-danger`), panels (`.panel` with glassmorphism: `backdrop-filter: blur(10px); background: rgba(18,18,26,0.85); border: 1px solid var(--border-color);`), stat bars (`.stat-bar` with gradient fill), log entries (`.log-entry` with subtle left border color coding by category), choice cards (`.choice-card` with hover glow effect).

---

### Step 2.3: UIManager
**File:** `js/ui/UIManager.js`

**Implement:**
- `UIManager` class.
- `init()` — Subscribes to GameStateManager. On every state change, calls `render()`.
- `render(state)` — Calls sub-panel renderers: `PlayerInfoPanel.render()`, `EventLogPanel.render()`, `ActionPanel.render()`.
- `switchTab(tabName)` — Handles bottom nav clicks. Updates `ActionPanel` content based on tab.
- `showScreen(screenName)` — Toggles between "character-creation" and "game-screen" divs.

---

### Step 2.4: PlayerInfoPanel
**File:** `js/ui/PlayerInfoPanel.js`

**Implement:**
- `render(playerEntity)` — Updates the `#player-info` header.
- Left section: Player name (large), current gimmick, alignment icon (🔵 Face / 🔴 Heel / ⚪ Tweener), current promotion name, current titles (if any).
- Right section: Key stats displayed as labeled values (STR, AGL, MIC, etc.), Health bar, Energy bar, Momentum bar (colored gradient), Overness number, Win-Loss record.

---

### Step 2.5: EventLogPanel
**File:** `js/ui/EventLogPanel.js`

**Implement:**
- `render(historyEntries)` — Renders the `state.history` array as styled log entries in `#event-log`.
- Each entry: timestamp (game date), category icon, narrative text.
- Category color coding: Match = gold, Backstage = purple, Personal = blue, Financial = green, Injury = red.
- Auto-scrolls to bottom on new entries.
- Max display: last 100 entries (older ones are still in state, just not rendered).

---

### Step 2.6: ActionPanel
**File:** `js/ui/ActionPanel.js`

**Implement:**
- `render(pendingActions, currentTab)` — Renders the `#action-panel`.
- If there's a pending event (from EventManager): Display event title, narrative text, and choice buttons. Each choice button shows the check info (stat + DC) if applicable. Clicking a choice calls `EventManager.resolveChoice()` and logs the result.
- If no pending event: Display tab-appropriate actions based on `currentTab`.
  - **Match/Promo tab:** List of upcoming booked segments. "Advance to next event" button.
  - **Backstage tab:** "Visit Booker's Office", "Hang out in Locker Room", "Check Dirt Sheets" buttons.
  - **Actions tab:** "Train (Gym)", "Train (Ring)", "Rest", "Social Media Post", "Manage Finances" buttons.
  - **People tab:** Searchable list of roster members. Click to expand details.

---

### Step 2.7: NavigationBar
**File:** `js/ui/NavigationBar.js`

**Implement:**
- `render()` — Creates 4 buttons in `#nav-bar`. Each has an icon and label.
- Click handler calls `UIManager.switchTab(tabName)`.
- Active tab gets highlighted styling (accent border-bottom, brighter text).

---

### Step 2.8: CharacterCreation Screen
**File:** `js/ui/CharacterCreation.js`

**Implement:**
- Step 1: Mode selection (Wrestler / Booker). Two large cards.
- Step 2 (Wrestler): Form fields for Name, Age (slider 18-25), Hometown (text input), Gender (select).
- Step 3: Archetype selection. Six cards (Technical, High-Flyer, Brawler, Powerhouse, Strong Style, Lucha) each showing stat distributions and a description.
- Step 4: Gimmick Builder. Alignment radio (Face/Heel), Gimmick template dropdown, Catchphrase text input, Entrance Style dropdown.
- Step 5: Stat point allocation. Show base stats from archetype. Give 10 bonus points to distribute. +/- buttons per stat.
- Step 6: Confirmation screen showing full character summary. "Start Career" button.
- On confirm: Call `EntityFactory.createPlayerWrestler(formData)`, `GameStateManager.initializeState()`, `UIManager.showScreen("game-screen")`.

---

### Step 2.9: Main Entry Point
**File:** `js/main.js`

**Implement:**
- Import all modules.
- On DOMContentLoaded:
  1. Initialize `GameStateManager`.
  2. Initialize `UIManager`.
  3. Show Character Creation screen.
  4. Wire up the "Advance Time" button: calls `WorldSimulator.tick()`, which triggers state changes, which triggers UI re-render via subscription.
- Load JSON data files (`moves.json`, `events.json`, etc.) via `fetch()`.

**Acceptance for Milestone 2:** Open `index.html` in browser. Character creation flow works. After creating a character, the game screen appears with stats, an empty event log, and clickable action buttons. Clicking "Advance Time" ticks the calendar and logs a "Day passed" entry.

---

## MILESTONE 3: The Ring

**Goal:** The Match Simulator produces compelling play-by-play text. Matches are playable from start to finish.

---

### Step 3.1: Match Simulator Core
**File:** `js/engine/MatchSimulator.js`

**Implement:**
- `MatchSimulator` class.
- `startMatch(config)` — Config: `{ wrestler1, wrestler2, matchType, bookedWinner, finishType, timeAllotment, feudHeat, referee }`.
- Internal match state: `{ phase, turn, wrestler1State: { stamina, health, momentum }, wrestler2State, log: [], spectacleTotal, botchCount }`.
- `PHASES` — Array of phase objects:
  ```
  [
    { name: "Feeling Out", turns: [1,3], allowedMoveTypes: ["strike", "grapple"], staminaDrainMultiplier: 0.5 },
    { name: "Building Heat", turns: [4,8], allowedMoveTypes: ["strike", "grapple", "aerial"], staminaDrainMultiplier: 1.0 },
    { name: "The Comeback", turns: [6,10], allowedMoveTypes: all, staminaDrainMultiplier: 1.0, momentumBonus: true },
    { name: "The Finish", turns: [8,12], allowedMoveTypes: all + finishers, staminaDrainMultiplier: 1.2 }
  ]
  ```
- `simulateTurn(attackerEntity, defenderEntity, phase)` — Core turn logic:
  1. Select a move (player chooses from available moves filtered by phase; AI uses weighted random from their moveset filtered by phase).
  2. Run `ResolutionEngine.resolve()` with the move's `primaryStat` vs `baseDC`, modified by attacker stamina and defender selling.
  3. On SUCCESS: Apply damage (reduce defender stamina by `damageBase`). Add `spectacle`. Generate play-by-play text.
  4. On FAILURE: Move missed/countered. Minor stamina cost to attacker. Generate failure text.
  5. On CRITICAL_SUCCESS: Double spectacle. Extra damage. "Holy sh** moment" text. Crowd pop spike.
  6. On CRITICAL_FAILURE: Botch. Check for injury via `InjuryEngine.generateInjury()`. Botch counter incremented. Embarrassing text.
  7. Check for pin attempt (attacker can attempt pin if defender stamina < threshold for current phase). Pin is a Contested Check: attacker Strength vs defender Resilience. Modified by stamina remaining.
- `finishMatch()` — Resolve the booked finish. Calculate final Match Rating (MASTER_PLAN §3.5). Return full match result object.

---

### Step 3.2: Match Type Modifiers
**Add to `MatchSimulator`:**

- `applyMatchTypeModifiers(matchType, matchState)` — Modifies rules based on MASTER_PLAN §3.3.
  - Ladder Match: Disable pins. Add "Climb Ladder" action (DC starts at 12, increases by 2 each failed attempt). Winner = first successful climb.
  - Cage Match: Disable outside interference. Add "Escape Cage" action (Agility DC 14). "Cage Spot" actions (high spectacle, high injury risk).
  - Submission Match: Only submission moves can finish. Enable limb targeting (each submission on same body part lowers defender's resistance by 2).
  - Tag Team: Manage two entities per side. "Tag In" action swaps active wrestler. Fresh partner gets stamina/momentum boost. Chemistry bonus from Relationship Graph.
  - Iron Man: Track falls count for each wrestler. Match continues for set number of turns.
  - Royal Rumble: 30 entrants. Elimination via "Over the Top Rope" Strength contest. Entry number determines starting stamina.
  - Hardcore/No DQ: Unlock weapon moves (chair shot, table spot). Higher injury risk. Brawling dominant.

---

### Step 3.3: Play-by-Play Text Generator
**File:** `js/data/narratives.json`

**Implement template sets organized by:**
- Move type (strike, grapple, aerial, submission).
- Outcome (success, failure, critical success, critical failure).
- Phase (feeling out, building heat, comeback, finish).
- Quality adjectives based on roll margin.

Example templates:
```json
{
  "strike_success": [
    "{attacker} connects with a devastating {move}! {defender} staggers backward.",
    "{attacker} lands the {move} flush! The crowd reacts!",
    "A stiff {move} from {attacker} catches {defender} right on the jaw!"
  ],
  "aerial_critical_success": [
    "{attacker} FLIES through the air — {move} CONNECTS PERFECTLY! The crowd is on their feet! THIS IS WRESTLING!",
    "UNBELIEVABLE! {attacker} nails the {move} from the top rope! {defender} is DOWN!"
  ],
  "aerial_critical_failure": [
    "{attacker} goes up top for the {move}... AND CRASHES AND BURNS! That could be a serious injury!",
    "OH NO! {attacker} slips on the top rope — the {move} attempt goes horribly wrong!"
  ],
  "pin_attempt_fail": [
    "{defender} kicks out at TWO! {attacker} can't believe it!",
    "NO! {defender} gets the shoulder up! This match continues!"
  ]
}
```

**Add to MatchSimulator:** A `generateText(template, context)` method that picks a random template from the appropriate category and fills in `{attacker}`, `{defender}`, `{move}`, `{crowd_reaction}`.

---

### Step 3.4: Script Adherence System
**Add to MatchSimulator:**

- Before the finish phase, display to the player: "The script calls for {bookedWinner} to win via {finishType}. Follow the script?"
- If YES: The match resolves normally toward the booked finish. Calculate match quality normally.
- If NO (Shoot): Trigger a Contested Check: Player's Charisma + Overness vs Opponent's Selling + Professionalism.
  - If opponent cooperates: Match finishes differently. Booker relationship -20 to -40.
  - If opponent resists: "Shoot" sequence. Both wrestlers roll Brawling contested. Match quality drops to 1 star max. High injury risk. Massive backstage fallout. Possible termination event queued.

---

### Step 3.5: Match View UI
**File:** `js/ui/MatchView.js`

**Implement:**
- Replaces ActionPanel content during a match.
- Top: Both wrestler names with health/stamina bars.
- Middle: Scrollable play-by-play log (styled with dramatic formatting).
- Bottom: Move selection buttons (filtered by current phase). "Attempt Pin" button (when available). Phase indicator.
- After match ends: Show match rating (star display), key stats (big moves, botches, crowd reaction), and a "Continue" button that returns to normal gameplay.

**Acceptance for Milestone 3:** Start a match from the game. See available moves. Click a move. See play-by-play text appear. Watch stamina bars decrease. Match progresses through phases. See a final star rating. Result is logged to Event Log.

---

## MILESTONE 4: The Life

**Goal:** All RPG systems are functional — promos, contracts, finances, injuries, social media, dirt sheets, and Booker Mode.

---

### Step 4.1: Promo Engine
**File:** `js/engine/PromoEngine.js`

**Implement:**
- `runPromo(actor, target, tone, context)` — Resolves a promo using MASTER_PLAN §3.6.
  - Maps tone to stat and DC.
  - Runs ResolutionEngine.
  - Returns narrative text and effects (momentum change, feud heat change, crowd reaction).
- `promoeBattle(actor, target, actorTone, targetTone)` — Contested promo. Both roll. Winner gains momentum, loser loses. Margin determines severity.
- Load promo text templates from `promos.json`.

### Step 4.2: Contract System
- `NegotiationEngine` in a new file or within FinancialEngine.
- `generateOffer(promotion, wrestler)` — AI generates a contract offer based on wrestler overness and promotion budget.
- `negotiateClause(wrestler, clause, targetValue)` — Resolution check to improve a specific clause (higher pay, creative control, etc.).
- `evaluateOffer(wrestler, offer)` — AI wrestlers decide whether to accept based on prestige, money, and creative freedom.

### Step 4.3: Social Media System
- Add to ActionPanel: "Post to Social Media" action with tone selection (Kayfabe/Personal/Controversial).
- Resolution check for Personal/Controversial posts. Failure adds `[Scandal]` tag.
- Follower growth formula based on overness, post frequency, and viral moments.

### Step 4.4: Dirt Sheet Generator
- `DirtSheetGenerator` class in a new file.
- `generateWeekly(state)` — Scans state for notable changes. Produces 3-5 bullet point stories.
- 15% of stories are deliberately inaccurate (misinformation mechanic).
- Displayed in Backstage tab when player clicks "Check Dirt Sheets."

### Step 4.5: Lifestyle & Burnout Processing
- Add to WorldSimulator weekly tick: Calculate burnout delta based on work rate, travel fatigue, mental health, and financial stress.
- Add "Take Vacation" and "See Therapist" actions to Actions tab.
- If burnout ≥ 90, force a "Breakdown" event.

### Step 4.6: PED & Wellness System
- Add "Use PEDs" toggle to Actions tab.
- When active: Apply stat bonuses weekly. Increase detectionRisk by 5 per week.
- Wellness Test events fire randomly (more frequent in WWE/AEW). Resolution check determines if caught.

### Step 4.7: Full Event Template Library
**File:** `js/data/events.json` — Expand from 15 to 100+ events across all categories in MASTER_PLAN §10.3.

### Step 4.8: Booker Mode UI
**File:** `js/ui/BookerView.js`

- Show booking interface: roster list, drag to match slots (Opener, Midcard, Main Event).
- Set road agent notes per match.
- "Run Show" button that simulates all matches and returns a post-show report.
- Storyline creation form.
- Financial dashboard (income/expenses/balance).
- Scouting action.

### Step 4.9: People View
**File:** `js/ui/PeopleView.js`

- Roster directory with search/filter.
- Click wrestler: show their public stats, current title, your relationship, their win/loss record.
- Sub-tabs: Roster, Factions, Free Agents, Relationships.
- Relationship view: sorted list of all relationships with affinity bars.

### Step 4.10: Diary View
**File:** `js/ui/DiaryView.js`

- Full career log viewer with category filters.
- Career summary: timeline, total wins/losses, titles held, promotions worked for.
- Player can add custom notes.

**Acceptance for Milestone 4:** Full game loop is playable. Player can train, cut promos, manage finances, read dirt sheets, deal with injuries, navigate events with choices, and see consequences ripple through the world.

---

## MILESTONE 5: Polish & Ship

**Goal:** Save/load works. Real-world roster is loaded. The game looks and feels premium.

---

### Step 5.1: Save/Load System
- Implement `SaveManager` using `localforage` (IndexedDB wrapper).
- `saveGame(slotId)` — Serializes entire GameState to JSON. Stores in IndexedDB.
- `loadGame(slotId)` — Retrieves JSON. Deserializes all entities, components, and relationships. Rebuilds class prototypes.
- `listSaves()` — Returns array of `{ slotId, playerName, date, playtime }`.
- `deleteSave(slotId)`.
- Auto-save every 5 minutes of real time.
- UI: Save/Load menu accessible from a gear icon in the header.

### Step 5.2: Real-World Roster Data
**Files:** `js/data/wrestlers.json`, `promotions.json`, `championships.json`

- Populate with 200+ wrestlers across WWE, AEW, TNA, NJPW, CMLL, ROH, RevPro, AAA.
- Each wrestler has accurate stats, archetype, gimmick, alignment, moveset references, and starting relationships.
- Promotions have correct show schedules, PLE calendars, championship lists.

### Step 5.3: CSS Animations & Polish
- Log entry fade-in animation (opacity 0 → 1 with translateY).
- Stat change flash (green for increase, red for decrease).
- D20 roll visualization (brief animation showing the die rolling before revealing result).
- Button hover effects (glow, scale).
- Panel transitions when switching tabs.
- Crowd reaction text effects (shaking text for big pops).

### Step 5.4: Balance Pass
- Play through 5 full in-game years.
- Tune: Stat growth rates (not too fast, not too slow). DC values for all actions. Economy (player shouldn't go bankrupt or become a millionaire too easily). Injury frequency and recovery. Event firing rates. AI booking intelligence.

### Step 5.5: Responsive Design
- Media queries for tablet (768px) and mobile (480px).
- On mobile: Stack the event log and action panel vertically instead of side-by-side.
- Touch-friendly button sizes (min 44px tap targets).

### Step 5.6: Entity Factory Refinement
**File:** `js/core/EntityFactory.js`

- `createPlayerWrestler(formData)` — From character creation screen. Sets up all components with appropriate defaults based on archetype.
- `createNPCFromJSON(jsonEntry)` — Loads a wrestler from the JSON data file. Populates all components.
- `createPromotion(jsonEntry)` — Loads a promotion from JSON.
- `createChampionship(jsonEntry)` — Loads a title belt.
- `generateRandomIndie(region)` — Procedurally generates a random indie wrestler for the player to encounter. Random name, random archetype, random stats within a low range.

---

## Implementation Priority Checklist

For tracking progress. Check off each step as completed.

- [ ] **M1:** Step 1.1 — Utils
- [ ] **M1:** Step 1.2 — Components
- [ ] **M1:** Step 1.3 — Entity
- [ ] **M1:** Step 1.4 — GameStateManager
- [ ] **M1:** Step 1.5 — Calendar
- [ ] **M1:** Step 1.6 — ResolutionEngine
- [ ] **M1:** Step 1.7 — RelationshipManager
- [ ] **M1:** Step 1.8 — TagEngine
- [ ] **M1:** Step 1.9 — InjuryEngine
- [ ] **M1:** Step 1.10 — FinancialEngine
- [ ] **M1:** Step 1.11 — WorldSimulator
- [ ] **M1:** Step 1.12 — EventManager
- [ ] **M1:** Step 1.13 — Initial Event Templates (15)
- [ ] **M1:** Step 1.14 — Moves Database
- [ ] **M1:** Step 1.15 — Integration Test
- [ ] **M2:** Step 2.1 — HTML Shell
- [ ] **M2:** Step 2.2 — CSS Design System
- [ ] **M2:** Step 2.3 — UIManager
- [ ] **M2:** Step 2.4 — PlayerInfoPanel
- [ ] **M2:** Step 2.5 — EventLogPanel
- [ ] **M2:** Step 2.6 — ActionPanel
- [ ] **M2:** Step 2.7 — NavigationBar
- [ ] **M2:** Step 2.8 — CharacterCreation
- [ ] **M2:** Step 2.9 — Main Entry Point
- [ ] **M3:** Step 3.1 — MatchSimulator Core
- [ ] **M3:** Step 3.2 — Match Type Modifiers
- [ ] **M3:** Step 3.3 — Play-by-Play Generator
- [ ] **M3:** Step 3.4 — Script Adherence
- [ ] **M3:** Step 3.5 — Match View UI
- [ ] **M4:** Step 4.1 — Promo Engine
- [ ] **M4:** Step 4.2 — Contract System
- [ ] **M4:** Step 4.3 — Social Media
- [ ] **M4:** Step 4.4 — Dirt Sheet Generator
- [ ] **M4:** Step 4.5 — Lifestyle & Burnout
- [ ] **M4:** Step 4.6 — PED & Wellness
- [ ] **M4:** Step 4.7 — Full Event Library (100+)
- [ ] **M4:** Step 4.8 — Booker Mode UI
- [ ] **M4:** Step 4.9 — People View
- [ ] **M4:** Step 4.10 — Diary View
- [ ] **M5:** Step 5.1 — Save/Load
- [ ] **M5:** Step 5.2 — Real-World Roster Data
- [ ] **M5:** Step 5.3 — CSS Animations
- [ ] **M5:** Step 5.4 — Balance Pass
- [ ] **M5:** Step 5.5 — Responsive Design
- [ ] **M5:** Step 5.6 — EntityFactory Refinement
