# Dynamic Event System & System Interactions Blueprint

This document expands on the core architecture to detail the specific interactions between the game's sub-systems and outlines the framework for a truly dynamic, emergent Event System.

---

## Part 1: System Interaction Matrix

The game relies on four major pillars: **The Actor (Wrestler), The Booking (Promotion), The Crowd (Pop/Momentum), and The Narrative (Feuds/History).** Here is how they interact continuously.

### 1. Actor <-> Booking Interaction
*   **The Request:** Promotion schedules Player to lose a match.
*   **The Conflict:** Player's Morale is low, or they have Creative Control.
*   **The Interaction:** Player initiates a "Refusal (Backstage Politics)" action via the Resolution Engine.
    *   *Check:* Player's Charisma + Star Power vs. Promotion's Prestige + Booker's Strictness.
    *   *Win:* The finish is changed. The Booker gains minor Heat against the Player.
    *   *Loss:* Player must comply or refuse. Refusing causes suspension (Calendar skips weeks, Morale tanks, Bank Balance drops).

### 2. Actor <-> Crowd Interaction
*   **The Action:** Player decides to do a massive, dangerous spot (Action: Aerial, High Risk) during a filler match on TV.
*   **The Interaction:** The Resolution Engine calculates the D20 roll.
    *   *Critical Success:* The Crowd "Pops" massively. Momentum stat skyrockets. Promotion viewership increases slightly.
    *   *Failure:* Player botches. The Actor's `ConditionComponent` receives an `Injury` (e.g., "Torn ACL").
*   **Ripple Effect:** The Injury drastically lowers Agility for 6 months. The Promotion strips the Player of any Championships they hold. The Crowd's interest in the Player's current Feud drops because the payoff match is cancelled.

### 3. Crowd <-> Booking Interaction
*   **The Scenario:** A Heel Champion (Actor) has immense Heat (High Crowd interest but negative sentiment). The Promotion books an Underdog Babyface to face the Heel.
*   **The Interaction:** The Match Simulator runs.
    *   The Simulator sees high Heat in the `FeudTracker`. It automatically adds a "+2 Star Rating" base bonus to the match.
    *   If the Babyface wins (as booked), the Crowd Pop provides a massive boost to the Promotion's Prestige score for that week.
    *   If the Booker changes the script to have the Heel win uncleanly (cheating), the Crowd gains "Nuclear Heat," building anticipation (and future viewership ratings) for the next rematch.

---

## Part 2: The Dynamic Event System (The "Card Decks")

A static list of events (e.g., "Event 42: You slipped on ice") gets boring fast. Mat Life will use a **Tag-Based Procedural Event System**.

### 1. How It Works: The "Tags"
Every Entity and current State in the game has dynamic tags.
*   *Player Tags:* `[Face]`, `[Champion]`, `[Injured_Knee]`, `[High_Morale]`, `[Veteran]`
*   *Promotion Tags:* `[Bankrupt_Warning]`, `[Roster_Bloat]`, `[TV_Deal_Expiring]`
*   *Current Feud Tags:* `[Blood_Feud]`, `[Title_Picture]`, `[Stale]`

### 2. Event Generation Engine
Every time the Calendar ticks to a new day, the `EventManager` polls the system:
1.  It scoops up all active Tags for the Player and their surroundings.
2.  It looks at the Database of "Event Templates" and filters out any that don't match the current Tags.
3.  It assigns a "Weight" to the valid events based on severity and recency.
4.  It randomly draws one (or zero) events based on those weights.

### 3. Anatomies of Dynamic Events

#### Example A: The "Vultures" Event
*   **Requirement Tags:** Player `[High_Momentum]`, Player `[Contract_Expiring_Soon]`, Rival Promotion `[High_Prestige]`
*   **Narrative Generation:** The engine inserts the relevant names. "The sheets are reporting that *[Rival Promotion]* is extremely interested in acquiring *[Player Name]* when their contract with *[Current Promotion]* expires in *[X]* weeks."
*   **Player Choices:**
    *   *Choice 1: Leak interest to the Dirt Sheets.* (Check: Mic Skills/Cunning). Success increases your asking price with your current boss. Failure pisses off your current boss (Heat) and you get jobbed out on TV.
    *   *Choice 2: Deny the rumors.* (Check: Acting). Success slightly increases loyalty with your current Promotion.
    *   *Choice 3: Have your Agent quietly negotiate.* (Check: Agent's Skill Level). Costs money, but secures a backup offer safely.

#### Example B: The "Reckless Worker" Event
*   **Requirement Tags:** Opponent `[Low_Technical_Stat]`, Opponent `[Recent_Botch_History]`, Match System `[Impending_Match]`
*   **Narrative Generation:** "You're scheduled to work with *[Opponent Name]* tonight. The locker room knows they've been sloppy lately, and you're carrying a *[Player's Current Minor Injury]*."
*   **Player Choices:**
    *   *Choice 1: Go to the Booker to change the opponent.* (Check: Politics + Star Power).
    *   *Choice 2: Confront the opponent.* (Check: Intimidation/Brawling). Success means they wrestle cautiously (Match rating capped, but safe). Failure means they get angry and might intentionally "shoot" during the match.
    *   *Choice 3: Work the match anyway.* (No check, but the Engine artificially lowers the Opponent's Target DC for botches during the Match Simulation).

### 4. Continuous Consequences (The "Memory" System)
Events are not isolated. The `EventManager` writes the outcome of events to the Player's `HistoryLog` with a decay timer.
*   If you successfully intimidated the opponent in Example B, your `[Locker_Room_Leader]` tag gets stronger.
*   If you failed and got injured, the opponent gains the `[Dangerous_Worker]` tag globally. Now, *other AI wrestlers* will refuse to work with them during the background World Simulation, potentially causing that AI wrestler to be fired by the Promotion due to lack of use.

---

## Part 3: Why This Design Makes the World Feel Alive

By using **Tags** instead of rigid scripts, the game writes its own stories. 

If you decide to play as a cowardly Heel who constantly cheats, you naturally accumulate the `[Coward]` and `[Heat_Magnet]` tags. The Event System will stop giving you events about "Visiting sick kids in hospitals" and start giving you events about "A fan jumped the barricade to attack you" or "The Booker wants you to get squashed by a monster Face to pop the crowd."

The system responds to *who you become*, not just what button you press.
