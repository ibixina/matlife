# Under the Ring: Mat Life Architecture & Engine Foundation

## 1. Core Philosophy: The Game as a Living State Machine

To prevent the game from feeling like a rigid set of menus, the foundation must be built as a **Living State Machine driven by an Event Engine**. Instead of hardcoding specific interactions (e.g., "If Player chooses X, outcome Y happens"), the engine will simulate a living world where entities interact based on universal rules. 

Every action (playing a match, taking a bump, cutting a promo) is a generic request sent to the Engine, which resolves it using the D&D-style check system against the current Game State.

---

## 2. The Foundational Systems (The Engine)

### A. The Global State Manager (The "Brain")
This is the single source of truth. It holds:
- **Calendar Time:** The current date (Year/Month/Week/Day). Time progression triggers the simulation of the rest of the world.
- **World Data:** All active Promotions, their TV deals, and their popularity.
- **The Roster (Entity Registry):** Every wrestler, manager, and booker in the game.
- **Title Lineages:** History of who held what belt and for how long.
- **Storylines (Feud Tracker):** Ongoing rivalries, their current "Heat" level, and the entities involved.

### B. The Entity-Component Model
Instead of massive, rigid classes, entities (Wrestlers, Promotions) are built from modular components.
- **A Wrestler Entity contains:**
  - `IdentityComponent` (Name, Age, Gimmick, Alignment)
  - `StatComponent` (Strength, Agility, Mic Skills, Stamina)
  - `HealthComponent` (Overall physical condition, specific injuries)
  - `ContractComponent` (Current promotion, salary, perks like Creative Control)
  - `RelationshipGraph` (A mapping of their affinity/heat with other entities)

### C. The Resolution Engine (The D&D Simulator)
This is the core mechanic discussed earlier. Any attempted action passes through this engine.
- **Input:** `Actor` (Player), `Action` (e.g., "Cut Promo"), `Target` (e.g., "Rival"), `Context` (e.g., "Live TV").
- **Process:** 
  1. Engine identifies the primary stat (Mic Skills).
  2. Engine gathers modifiers (Relationship with Target, Crowd alignment, Active injuries).
  3. Engine rolls the RNG (1-20 or 1-100).
  4. Engine compares total to the Target's Defense, or the Action's Difficulty Class (DC).
- **Output:** Returns an `EventResult` (Critical Success, Success, Failure, Critical Failure) containing state changes (e.g., "+5 Pop, -10 Rival Relationship").

### D. The Progression & Event Loop (The "Tick")
The game progresses in "Ticks" (usually half-days or full days). When the player clicks "Advance", the engine processes:
1. **World Simulation:** Other wrestlers simulate their matches/promos. Promotions gain/lose ratings. Injuries heal.
2. **Context Generation:** If it's a TV day, the engine looks at active Storylines and randomly generates Backstage Events or Booking decisions for the player.
3. **Player Phase:** The game pauses and waits for player input (Matches, Promos, Backstage decisions).

---

## 3. Technology Stack & Implementation

To build this robustly as a web-based game while ensuring performance and maintainability:

### Core Logic (Backend-in-the-Browser)
- **Language:** **Vanilla JavaScript (ES6 Modules)** or **TypeScript**. TypeScript is highly recommended here because managing complex states (Stats, Injuries, Contracts) benefits massively from strict typing to prevent bugs.
- **Architecture Pattern:** Model-View-Controller (MVC) or Flux-like state management. 
  - *Model:* The Game State and Classes.
  - *Controller/Engine:* The logic that processes actions and updates the State.
  - *View:* The UI that renders the current state and captures clicks.

### Frontend (User Interface)
- **HTML5 & Vanilla CSS:** Using CSS Grid and Flexbox to create the UI layout wireframed earlier. 
- **DOM Manipulation:** Custom JS rendering functions to update the Events Log and Menus dynamically without reloading the page.
- **Design System:** We will build a design system prioritizing modern, rich aesthetics (dark mode, glassmorphism, subtle micro-animations for dice rolls and stat changes) as requested, avoiding generic layouts.

### Persistence (Saving the Game)
- **IndexedDB / LocalStorage:** The Global State will be serialized into JSON and saved to the browser's storage, allowing players to save their career progress locally and resume later. LocalStorage is fine for basic states, but IndexedDB is better if the history log grows large.

---

## 4. Why This Foundation Works

By building the **State Manager** and the **Resolution Engine** first, *adding features becomes trivial*.
- Want to add a new "Chair Shot" action? You just pass it to the Resolution Engine and ask it to check `Brawling` vs `Toughness`.
- Want to add "Tag Teams"? You create a new `TagTeam` entity that references two `Wrestler` entities. The Engine evaluates them by merging their stats.
- This creates systemic, emergent gameplay. The game doesn't need to know *what* a specific feud is; it only knows that Wrestler A and B have "-50 Relationship", so the Engine will naturally make their matches more aggressive and injury-prone.
