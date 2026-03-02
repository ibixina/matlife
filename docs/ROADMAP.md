# Mat Life: Comprehensive Development Roadmap & Technical Plan

This document serves as the absolute blueprint for developing *Mat Life*. It outlines the architecture, data models, feature implementation order, and the technical assumptions for every system in the game. It is designed so that the foundation is rock-solid before complex features are layered on top.

---

## Technical Assumptions & Stack
*   **Language:** Vanilla JavaScript (ES6+ Modules) heavily documented with JSDoc to emulate strict typing.
*   **Paradigm:** Object-Oriented/Entity-Component-System (ECS) hybrid.
*   **State Management:** A centralized `GameStateManager` using a Flux-like one-way data flow to prevent desyncs.
*   **Rendering:** Vanilla DOM manipulation using template literals and CSS Grid/Flexbox. No heavy frameworks (React/Vue) to ensure lightning-fast text processing and maximum flexibility.
*   **Persistence:** `IndexedDB` wrapped in a service (e.g., `localforage`) due to the likely size of history logs and persistent world states (saving thousands of match results).

---

## Phase 1: The Core Foundation (World State & Entities)
*Goal: Establish the underlying data structures representing the universe. There is no UI yet, just the backend data running in the console.*

### 1.1 The Calendar System
*   **Class:** `GameCalendar`
*   **Responsibilities:** Tracking Year, Month, Week (1-4), Day, and Time of Day (Morning, Afternoon, Evening).
*   **Mechanism:** Advances time linearly. Acts as the heartbeat that triggers events.

### 1.2 Entity Base Classes & ECS (Entity-Component System)
*   **Class:** `Entity` (Base class with a unique UUID).
*   **Components:**
    *   `IdentityComponent`: Name, Age, Hometown, Gender, Gimmick, Alignment (Face/Heel).
    *   `StatsComponent`: 
        *   *Physical:* Stamina, Strength, Resilience (Injury resistance).
        *   *In-Ring:* Brawling, Technical, Aerial, Selling, Psychology.
        *   *Entertainment:* Charisma, Mic Skills, Acting.
    *   `ConditionComponent`: Current Health (0-100), Energy (0-100), Array of specific injuries (`[{ part: "Neck", severity: 3, daysRemaining: 14 }]`).

### 1.3 World Entities
*   **Class:** `Wrestler` (Extends Entity). Adds `careerStats` (Wins, Passes, Titles).
*   **Class:** `Promotion`. Contains `prestige` (1-100), `bankBalance`, `roster` (Array of UUIDs), `championships` (Array of Title UUIDs), and `stylePreference` (e.g., "Sports Entertainment", "Strong Style").
*   **Class:** `Championship`. Tracks current holder, prestige, and lineage.

### 1.4 The Global Game State
*   **Class:** `GameStateManager`
*   **Responsibilities:** Holds the universal state object. All changes to the world must pass through a `dispatch(action, payload)` method to mutate this state. This guarantees save/load logic is flawless.

---

## Phase 2: The Resolution Engine (D&D Mechanics)
*Goal: Build the system that determines the outcome of ANY action in the game.*

### 2.1 The Roller
*   **Class:** `ResolutionEngine`
*   **Method:** `attemptAction(actor, target, actionType, contextOpts)`
*   **Mechanic:** Uses a D20 system (1-20).
    *   1 = Critical Failure (Botch)
    *   20 = Critical Success (Holy S*** Moment)

### 2.2 Modifiers & Difficulty Classes (DC)
*   The Engine calculates modifiers before rolling.
*   *Example:* Actor attempts "High-Risk Top Rope Move" (Action Type: Aerial, Base DC: 15).
*   *Modifiers:* Actor Aerial Stat (+3), Actor Stamina Penalty (-2), Target Selling Stat (+1). Net modifier: +2. Roll: D20 + 2 vs DC 15.
*   The Engine returns a strongly-typed `ResolutionResult` object containing boolean success, narrative flavor text, and numeric stat changes (e.g., Target loses 15 Stamina).

---

## Phase 3: Relationships, Morale, and Politics
*Goal: Ensure entities interact logically. The world must feel alive even when the player isn't involved.*

### 3.1 The Relationship Graph
*   **Data Structure:** A bidirectional graph stored in `GameState`. `Edge(UUID_A, UUID_B)` contains an `affinity` score (-100 to 100).
*   *Mechanics:* High affinity (+75) = Tag Team chemistry, friends. Low affinity (-75) = Heat, refuses to put over, shoot tendencies on the mic.

### 3.2 The Morale System
*   **Property:** Every Wrestler has a `Morale` score.
*   **Modifiers:** Winning boosts morale. Losing (especially to lower-tier talent) drains it. Not being booked drains it.
*   **Consequences:** Low morale leads to contract holdouts, sandbagging in matches, or jumping to rival promotions.

---

## Phase 4: Basic User Interface & The Loop
*Goal: Bring the Wireframe to life and connect it to the Backend. The game is now playable on a basic level.*

### 4.1 Layout Implementation
*   Implement CSS Grid layout (Top: Stats, Left: Log, Right: Actions, Bottom: Nav).
*   Build the `UIManager` class to handle DOM updates efficiently (using decoupled Event Listeners).

### 4.2 The "Tick" Loop UI
*   Implement the "Advance Time" button.
*   When clicked, the `TurnManager` processes the world state, resolves background NPC events, logs daily narrative strings to the `Event Log`, and stops when a decision is needed from the player.

---

## Phase 5: The Match Simulation Engine (The Core Gameplay)
*Goal: Make the matches feel like wrestling matches, not just math equations.*

### 5.1 Match State & Pacing
*   **Class:** `MatchSimulator`
*   **Phases:** Matches move through phases: *Opening Tie-up -> Gaining Control -> The Comeback -> The False Finishes -> The Finish*. 
*   **Stamina Drain:** Actions cost stamina. Trying a finisher at 100% stamina will likely fail (Target kicks out). You must wear the opponent's stamina down first.

### 5.2 Play-by-Play Generation
*   **System:** A templating engine (`LogGenerator`) that reads the `ResolutionResult`.
*   *Example Template:* `[Actor.Name] hits a [QualityAdjective] [MoveType] on [Target.Name]! [CrowdReaction].`
*   Produces varied, contextual text based on the D20 roll and stats.

### 5.3 Match Ratings (The "Meltzer" Scale)
*   **Calculation:** At the end of the simulation, the match is graded (0 to 5+ stars).
*   **Factors:** Length (too short = bad, too long = boring if stamina is 0), High Spots (crits), Selling (how well injuries were portrayed), Crowd Heat (based on the feud), and Chemistry (from the Relationship Graph).

---

## Phase 6: Wrestler Mode Expansion (The RPG Layer)
*Goal: Flesh out the life outside the ring.*

### 6.1 The Progression Grind
*   *Actions Menu Options:* Train Gym (Cost: Energy, Boost: Physicals), Train Ring (Boost: In-Ring stats), Rest (Recover Energy/Health), Socialize (Boost Affinity).
*   *Economy:* Tracking cash for paying agents, buying better gear (small stat buffs), or paying medical bills.

### 6.2 Promos & Feuds
*   *Promo Engine:* Players choose a "Tone" (Aggressive, Cowardly, Shoot, Pandering). The `ResolutionEngine` rolls Mic Skills against the Target's Composure or the Crowd's expectations.
*   *Feud Tracker:* The game creates a `Feud` object when two wrestlers fight/promo. It tracks "Heat." High Heat = massive stat boosts to match ratings.

### 6.3 Contracts & Negotiations
*   A negotiation mini-game trading off Pay vs. Creative Control vs. Dates Per Year.

---

## Phase 7: Booker Mode Expansion (The Tycoon Layer)
*Goal: The parallel modes. Controlling a promotion rather than an individual.*

### 7.1 Card Booking UI
*   A drag-and-drop interface mapping roster to Matches (Opener, Midcard, Main Event) and Promos.
*   Assigning "Road Agent Notes" (e.g., "Protect [Wrestler A]", "Call it in the ring", "Scripted finish").

### 7.2 TV Ratings & Financials
*   **Mechanic:** The aggregate Star Rating of the booked card, combined with the Promotion's Prestige, determines the TV Viewership.
*   **Consequences:** High ratings increase TV Network payouts and Merch sales. Low ratings lead to cancellation.
*   **Rivalries (Monday Night Wars):** Competing directly with AI-controlled promotions holding shows on the same day.

---

## Phase 8: Advanced Narrative Systems (The Wildcards)
*Goal: Replicate the chaotic, unpredictable nature of the pro-wrestling industry.*

### 8.1 The "Dirt Sheet" Generator
*   A weekly newsletter summarizing the AI's background simulation. It leaks random relationship changes ("Backstage heat between X and Y"), injuries, and contract expirations.

### 8.2 Dynamic Random Events
*   *Examples:* Wellness Policy violations, flights getting delayed (forcing the Booker player to rewrite the show last minute), wrestlers refusing to drop titles, crowd hijackings ("CM PUNK!" chants killing a promo).

### 8.3 Injuries & Aging
*   **Degradation:** As age increases > 35, physical stats begin taking permanent penalties. Resilience drops.
*   **Chronic Injuries:** Fighting with an injury worsens it into a chronic condition, permanently lower max health.

---

## Phase 9: Save/Load & Final Polish
*Goal: Wrapping it up for distribution.*

### 9.1 Serialization
*   Converting the complex cyclical `GameState` object into a flat, JSON-friendly structure for `IndexedDB`.
*   Writing the hydration logic to rebuild class prototypes upon loading a save.

### 9.2 UI/UX Polish
*   Implementing rich animations for the Event Log (text scrolling smoothly), D20 roll visualizations, and adding sound effects for crowd reactions (optional).
*   Responsive balancing for mobile vs. desktop browsers.

---

## Development Execution Order

**Milestone 1 (The Invisible Game):** Phases 1, 2, and 3. Testing purely via console logs to ensure the D20 math, stat scaling, and entity relationships work mathematically without UI distractons.

**Milestone 2 (The Skeleton View):** Phase 4. Connecting the basic wireframe to the time loop. Making buttons click and text appear.

**Milestone 3 (The Squared Circle):** Phase 5. Building out the Match Simulator. This is the hardest part. The text generation must feel natural and match outcomes must feel fair based on the D20 rolls.

**Milestone 4 (The Locker Room):** Phases 6, 7, and 8. Building out the RPG loops (training, promos) and the Booker UI.

**Milestone 5 (The Launch):** Phase 9. Save states, CSS animations, balance tuning.
