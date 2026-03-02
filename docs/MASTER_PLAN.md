# Mat Life: Definitive Master Plan

This document supersedes ARCHITECTURE.md, ROADMAP.md, and SYSTEM_INTERACTIONS.md as the single source of truth. It consolidates all prior design work, fills every identified gap, and serves as the implementation blueprint.

---

## 1. Game Overview

Mat Life is a text-based professional wrestling career simulator played in a web browser. It combines the management depth of *Total Extreme Wrestling*, the personal narrative of *Fire Pro Wrestling*'s career mode, and D&D-style skill checks for action resolution. The player lives the life of a professional wrestler (or a booker) navigating the politics, physicality, and drama of the wrestling industry.

### 1.1 Game Modes
*   **Wrestler Mode:** Play as an individual wrestler from the independent circuit to the Hall of Fame.
*   **Booker Mode:** Run a promotion — book shows, manage talent, compete for TV ratings.
*   **Post-Career Transition:** A Wrestler Mode career can transition into Booker Mode upon retirement.

### 1.2 New Game Flow (Character Creation)
1.  Player selects Mode (Wrestler or Booker).
2.  **Wrestler Creation:**
    *   Name, Age (18-25 starting range), Hometown, Gender.
    *   **Wrestling Style Archetype** selection (see §3.2). This sets base stat distributions.
    *   **Gimmick Builder:** Choose initial Alignment (Face/Heel), a Gimmick template (Underdog, Monster, Showman, Silent Badass, Comedy, etc.), a Catchphrase (text input), and an Entrance Style (Pyro, Lights Out, Crowd Walk, Simple).
    *   Stat point allocation (small pool to customize within archetype constraints).
    *   Starting scenario: Always begins on the Independent Circuit.
3.  **Booker Creation:**
    *   Choose an existing Promotion to run, OR create a custom indie promotion (Name, Region, Starting Budget, Style Preference).

---

## 2. Core Engine Architecture

### 2.1 Technology Stack
*   **Language:** Vanilla JavaScript (ES6+ Modules) with JSDoc typing.
*   **Paradigm:** Entity-Component-System (ECS) hybrid.
*   **State Management:** Centralized `GameStateManager` with `dispatch(action, payload)` — all mutations flow through this single point.
*   **Rendering:** Vanilla DOM manipulation, CSS Grid/Flexbox. No frameworks.
*   **Persistence:** IndexedDB via `localforage` wrapper. Supports multiple save slots.

### 2.2 The Global State Object
The `GameState` is a single serializable object containing:
```
{
  calendar: { year, month, week, day, timeOfDay },
  player: { entityId, mode },
  entities: Map<UUID, Entity>,           // All wrestlers, managers, bookers, referees
  promotions: Map<UUID, Promotion>,
  championships: Map<UUID, Championship>,
  relationships: Map<"A|B", RelationshipEdge>,
  feuds: Map<UUID, Feud>,
  contracts: Map<UUID, Contract>,
  history: EventLogEntry[],              // The diary/narrative log
  dirtSheets: DirtSheetEntry[],
  settings: { difficulty, autoAdvance }
}
```

### 2.3 The Calendar System
*   **Class:** `GameCalendar`
*   **Granularity:** Year → Month → Week (1-4) → Day (Mon-Sun) → TimeOfDay (Morning, Afternoon, Evening, Night).
*   **TV Schedule Integration:** Each Promotion has fixed show days (e.g., WWE Raw = Monday Evening, AEW Dynamite = Wednesday Evening). PLEs are monthly or quarterly events on specific calendar dates.
*   **On Tick:** Advancing one time slot triggers: injury recovery ticks, contract day counters, morale drift, travel fatigue accumulation, and the Event Generation Engine poll.

### 2.4 Entity-Component System

**Base:** `Entity { id: UUID, tags: Set<string>, components: Map<string, Component> }`

**Components (exhaustive list):**

| Component | Properties | Used By |
|---|---|---|
| `IdentityComponent` | name, age, hometown, gender, gimmick, alignment (Face/Heel/Tweener), catchphrase, entranceStyle | Wrestler, Manager, Booker |
| `PhysicalStatsComponent` | stamina (0-100), strength (1-20), resilience (1-20), speed (1-20) | Wrestler |
| `InRingStatsComponent` | brawling (1-20), technical (1-20), aerial (1-20), selling (1-20), psychology (1-20) | Wrestler |
| `EntertainmentStatsComponent` | charisma (1-20), micSkills (1-20), acting (1-20) | Wrestler, Manager |
| `ConditionComponent` | health (0-100), energy (0-100), injuries: `[{ bodyPart, severity (1-5), daysRemaining, chronic: bool }]`, mentalHealth (0-100) | Wrestler |
| `MovesetComponent` | signatures: Move[], finishers: Move[], movePool: Move[] (see §3.3) | Wrestler |
| `CareerStatsComponent` | totalWins, totalLosses, draws, titleReigns: `[{ titleId, days }]`, bestMatchRating, hallOfFamePoints | Wrestler |
| `PromotionRecordComponent` | `Map<promotionId, { wins, losses, showsWorked }>` | Wrestler |
| `ContractComponent` | promotionId, weeklySalary, lengthWeeks, remainingWeeks, hasCreativeControl, hasMerchCut (%), tvAppearanceBonus, noCompeteWeeks | Wrestler |
| `FinancialComponent` | bankBalance, weeklyExpenses, merchandiseIncome, sponsorships: `[{ name, weeklyPay, weeksRemaining }]`, investments: `[{ name, returnRate, principal }]`, agent: AgentRef | null, investmentAgent: AgentRef | null, medicalDebt | Wrestler |
| `PopularityComponent` | overness (0-100, global recognition), momentum (0-100, current trajectory), regionPop: `Map<region, number>` | Wrestler |
| `SocialMediaComponent` | followers (number), postFrequency, scandalRisk (0-100) | Wrestler |
| `LifestyleComponent` | workRate (matches this week), travelFatigue (0-100), burnout (0-100), familyMorale (0-100), sideHustles: `[{ type: "podcast"|"streaming"|"acting", income, timeCommitment }]` | Wrestler |
| `WellnessComponent` | pedUsage: bool, pedDetectionRisk (0-100), wellnessStrikes (0-3), lastTestWeek | Wrestler |
| `BookerStatsComponent` | creativity (1-20), strictness (1-20), favoritism: `Map<entityId, number>` | Booker |

### 2.5 The Perk/Trait System
Beyond raw stats, experienced wrestlers unlock **Perks** (passive abilities). These are stored as tags that the Resolution Engine and Event System read.

| Perk | Requirement | Effect |
|---|---|---|
| `[Ring_General]` | Psychology ≥ 16, 200+ matches | +2 to all allies' match ratings when you're on the card |
| `[Iron_Man]` | Stamina ≥ 16, 50+ matches > 20 mins | Stamina drain reduced 25% after minute 15 |
| `[Politician]` | Charisma ≥ 14, 5+ successful backstage negotiations | Advantage on all Creative Control checks |
| `[Spot_Monkey]` | Aerial ≥ 16, 10+ crit successes on high-risk spots | +3 to Aerial DCs but +2 injury severity on failure |
| `[Locker_Room_Leader]` | 10+ years active, avg relationship > +30 | Can mediate disputes between other wrestlers (new action) |
| `[Fragile]` | 5+ major injuries in career | Disadvantage on Resilience checks, but crowd sympathy bonus (+Pop on injury) |
| `[Promo_God]` | Mic Skills ≥ 18 | Can attempt "Pipebomb" promo type (extreme risk/reward) |
| `[Safe_Worker]` | 500+ matches, 0 injuries caused to opponents | Opponents' injury risk reduced to near-zero |

---

## 3. Wrestling-Specific Systems

### 3.1 Wrestling Style Archetypes
The archetype chosen at creation determines starting stat weights, available starting moves, and how the Crowd reacts.

| Archetype | Primary Stats | Secondary Stats | Crowd Expectation |
|---|---|---|---|
| **Technical** | Technical, Psychology | Selling, Stamina | Chain wrestling, submissions, mat work |
| **High-Flyer** | Aerial, Speed | Agility, Selling | Dives, flips, high-risk spots |
| **Brawler** | Brawling, Strength | Resilience, Charisma | Strikes, weapon use, brawls outside the ring |
| **Powerhouse** | Strength, Resilience | Brawling, Stamina | Power moves, slams, dominant squashes |
| **Strong Style** | Brawling, Technical | Resilience, Selling | Stiff strikes, suplexes, fighting spirit spots |
| **Lucha Libre** | Aerial, Speed | Technical, Charisma | Rapid sequences, masks, tradition-heavy storytelling |

**Crowd Demographics Interaction:** A High-Flyer in NJPW gets a moderate pop (Japan respects but doesn't worship it). A High-Flyer in CMLL gets a massive pop. A Powerhouse in Japan (Strong Style territory) gets less reaction than in WWE.

### 3.2 The Moveset System
*   **Class:** `Move { name, type (strike|grapple|aerial|submission|signature|finisher), primaryStat, baseDC, staminaCost, damageBase, injuryRisk (0-1), spectacle (0-5) }`
*   **Learning Moves:** During Training actions, you can attempt to learn a new move. This is a Resolution Check against the move's `baseDC` using the move's `primaryStat`. Failure means you haven't mastered it yet (can retry next training session). Critical failure during training can cause a training injury.
*   **Move Pool Size:** Limited (e.g., 15 regular moves + 2 signatures + 1 finisher). Forces the player to curate a moveset rather than hoarding every move. Can be expanded by the `[Veteran]` perk.
*   **Finisher Protection:** A finisher has high `spectacle` and `damageBase` but should only be used in later match phases. Using it too early lowers its "Protected" status over time (crowds stop believing it finishes matches).

### 3.3 Match Types & Their Rule Modifiers
Each match type modifies the base Match Simulation rules:

| Match Type | Rule Modifier |
|---|---|
| **Standard Singles** | Base rules. Pin or submission. |
| **Tag Team** | Two wrestlers per side. Chemistry stat matters. Hot tag mechanic (tagged-in partner gets temporary Stamina/Momentum boost). |
| **Triple Threat / Fatal 4-Way** | Multiple opponents. Cannot be DQ'd. Increased chaos modifier (more random events mid-match). |
| **Ladder Match** | No pins. Must climb ladder (multiple Aerial/Agility checks with increasing DC as stamina drops). High spectacle multiplier. |
| **TLC (Tables, Ladders, Chairs)** | Ladder rules + weapon spots. Brawling checks. High injury risk. Extreme spectacle. |
| **Steel Cage** | No outside interference. Escape or pin to win. Resilience checks to survive cage spots. |
| **Hell in a Cell** | Cage + weapons + roof. Maximum injury risk. Blade job opportunities. Massive spectacle. |
| **Iron Man Match** | Timed (15, 30, or 60 min). Most falls wins. Stamina management is critical. Psychology stat heavily weighted for pacing. |
| **Submission Match** | Only submissions win. Technical stat dominates. Limb targeting system activated (work a body part to lower their resistance). |
| **Royal Rumble** | 30-man over-the-top-rope. Elimination via Strength checks. Endurance (stamina) is king. Entry number matters (early = harder). |
| **Last Man Standing** | No pin. Must incapacitate (reduce opponent's Health below threshold). Resilience checks to stand up at count of 9. |
| **Hardcore/No DQ** | Weapons legal. Brawling dominant. Can go backstage. Low match quality ceiling but high spectacle. |

### 3.4 Match Simulation Engine (Detailed)
**Class:** `MatchSimulator`

**Match Flow:**
1.  **Pre-Match:** Engine checks Feud Heat, Crowd Demographics, Match Type, and both wrestlers' conditions. Sets the "Match Ceiling" (max possible star rating given the participants and context).
2.  **Phase 1 — The Feeling Out (Turns 1-3):** Low-impact moves. Technical checks. Establishes who controls the pace.
3.  **Phase 2 — Building Heat (Turns 4-8):** The heel (or controlling wrestler) dominates. Selling checks for the babyface. Crowd sympathy builds if the babyface sells well.
4.  **Phase 3 — The Comeback (Turns 6-10):** The babyface fires up. Momentum shifts. Big spots. The crowd engagement peaks here.
5.  **Phase 4 — The Finish (Turns 8-12):** False finishes (kicked-out finishers = massive crowd pop if D20 roll is high). The booked finish occurs (or the player deviates from the script).

**Each Turn:** Both wrestlers select/are assigned an action. The Resolution Engine resolves it. The `LogGenerator` produces play-by-play text. Stamina and Health are updated.

**Blade Jobs:** During Hardcore/Cell matches, a wrestler can choose to "blade" (self-inflict a cut for dramatic blood). Check: Brawling vs DC 10. Success = +Spectacle, crowd heat rises. Failure = cut too deep, infection risk tag added, possible medical stoppage.

**Referee Interactions:** The referee is a background entity with a `Strictness` stat.
*   Low Strictness: Heel can cheat more (eye rakes, low blows) before DQ. Slower counts on pins.
*   High Strictness: Clean match enforced. Fast counts. Can accidentally cause controversial finishes (fast 3-count when shoulder was up).
*   Player can "bump the ref" (Brawling check) to temporarily remove them, allowing interference or cheating.

**Script Adherence:**
*   The Booker pre-determines the winner and the finish type (clean pin, dirty pin, submission, count-out, DQ).
*   The player sees the script before the match.
*   **Following the script:** Safe. Booker relationship is maintained. Match quality depends on performance.
*   **Going against the script (Shoot):** The player refuses to lose, or changes the finish. Requires a contested Charisma + Star Power check vs. the opponent's Compliance. If the opponent cooperates, the match changes. If they don't, a "Shoot" occurs mid-match (realistic fighting, match quality tanks, massive backstage heat, potential real injury, possible firing). Regardless, the Booker's relationship drops significantly. This can lead to being buried on the card or released.

### 3.5 Match Rating Calculation
```
baseRating = avg(wrestler1.psychology, wrestler2.psychology) / 5
+ chemistryBonus (from RelationshipGraph, 0 to 0.5)
+ feudHeatBonus (from FeudTracker, 0 to 1.0)
+ spectacleTotal / maxPossibleSpectacle * 1.0
+ sellingBonus (avg selling stats / 10)
- staminaPenalty (if both exhausted and match dragged, -0.5 to -1.5)
- botchPenalty (each botch = -0.25 to -0.75)
+ crowdDemographicMatch (style vs. region, -0.5 to +0.5)
+ matchTypeCeilingBonus (Cell/Ladder get +0.5 base)

finalRating = clamp(baseRating, 0, 5.5) // DUD to 5.5 stars
```

### 3.6 Promo System (Detailed)
*   **Trigger:** Promo segments are scheduled by the Booker (TV show) or initiated by the player (backstage confrontation).
*   **Tone Selection:** The player picks the tone of their promo:
    *   **Aggressive:** High risk, high reward. Uses Charisma + Brawling (intimidation). Can escalate to a brawl.
    *   **Comedic:** Uses Charisma + Acting. Great for Faces. Falls flat if Acting is low.
    *   **Philosophical / Emotional:** Uses Mic Skills + Psychology. The "worked shoot" option. Best for building long-term feuds.
    *   **Pandering:** Uses Charisma only. Safe. Cheap pop. Low ceiling but low risk.
    *   **Pipebomb (Shoot Promo):** Requires `[Promo_God]` perk. Uses Mic Skills + Charisma vs DC 18. Success = legendary moment, massive Momentum spike, potential real-world consequences (breaks fourth wall). Failure = cringeworthy, career-damaging.
*   **Contested Promos (Promo Battles):** Both wrestlers roll. Higher total wins the segment. The winner's Momentum increases; the loser's drops. If the Feud Heat is high, even the loser benefits slightly (the segment was entertaining).

---

## 4. Promotion System (Detailed)

### 4.1 Promotion Data Model
```
Promotion {
  id, name, region, prestige (0-100), bankBalance,
  stylePreference: "Sports Entertainment" | "Strong Style" | "Lucha" | "Hardcore" | "Technical",
  roster: UUID[],
  championships: UUID[],
  shows: Show[],                    // Weekly TV shows
  pleSchedule: PLE[],              // Premium Live Events (monthly/quarterly)
  tvDeal: { network, weeklyRevenue, ratingsThreshold, weeksRemaining },
  merchandiseRevenue, ticketRevenue,
  audienceDemographic: { hardcore (0-1), casual (0-1), regional (0-1) },
  wellnessPolicy: { enabled: bool, testFrequency, strikeLimit }
}
```

### 4.2 Real-World Promotions (Pre-Loaded Data)

| Promotion | Region | Style | Prestige | Shows | PLE Examples |
|---|---|---|---|---|---|
| **WWE** | USA (National) | Sports Entertainment | 95 | Raw (Mon), SmackDown (Fri), NXT (Tue) | WrestleMania, Royal Rumble, SummerSlam, Survivor Series |
| **AEW** | USA (National) | Hybrid | 75 | Dynamite (Wed), Rampage (Fri), Collision (Sat) | All In, Revolution, Double or Nothing, Full Gear |
| **TNA/Impact** | USA (Regional) | Hybrid | 45 | Impact (Thu) | Bound for Glory, Slammiversary |
| **NJPW** | Japan | Strong Style | 80 | NJPW World shows | Wrestle Kingdom, G1 Climax, Dominion |
| **CMLL** | Mexico | Lucha Libre | 60 | Friday Spectacular | Anniversary Show |
| **ROH** | USA (Regional) | Technical | 40 | ROH TV (varies) | Supercard of Honor, Final Battle |
| **RevPro** | UK | Technical/Strong Style | 35 | Live events | British J-Cup, Summer Sizzler |
| **AAA** | Mexico | Lucha Libre | 55 | TV Azteca | TripleMania |
| **Various Indies** | USA/Global | Mixed | 5-25 | Weekend spot shows | No PLEs, local events only |

### 4.3 Promotion-Specific Progression
Each promotion has a **Card Position** ladder:
1.  **Dark Match / Pre-Show** — Not on TV. Low pay. Low visibility.
2.  **Opening Act** — On TV briefly. Building credibility.
3.  **Midcard** — Regular TV time. Potential IC/US title feuds.
4.  **Upper Midcard** — Featured segments. PLE matches.
5.  **Main Event** — World title feuds. Closing the show. Highest merch sales.

Moving up requires: High Overness + High Match Ratings + Good Booker Relationship + Available storyline slots.

---

## 5. Career Lifecycle Systems

### 5.1 The Independent Circuit (Early Career)
*   **Starting Conditions:** No contract. Low stats. No reputation. Bank balance ~$500.
*   **Gameplay Loop:** Each week, a list of available indie bookings appears (generated based on region). Each booking has: Pay ($25-$200), Travel Cost, Opponent Quality, and Crowd Size.
*   **Objective:** Build enough Overness (≥ 30) and a win record to attract a tryout from a major promotion.
*   **Unique Indie Mechanics:**
    *   Selling merch from your car trunk (small income based on Charisma).
    *   Training at local wrestling schools (stat growth, move learning).
    *   Networking at indie shows (Relationship building with other indie wrestlers who may later become stars).
    *   Getting scouted: If your Overness and Match Ratings cross a threshold, a Promotion's scout (Booker entity) offers a developmental contract.

### 5.2 Age Progression & Physical Decline
*   **Peak Years:** 25-34. No penalties.
*   **Early Decline (35-39):** Physical stats (Strength, Speed, Stamina, Resilience) lose -1 per year. Injury recovery time +20%.
*   **Late Career (40-44):** Physical stats lose -2 per year. Entertainment stats are immune (veterans are better talkers). Chronic injury risk doubles.
*   **Twilight (45+):** Massive physical decline. The game prompts retirement considerations. Can choose to keep going (legend runs) or retire gracefully.
*   **Aging is not purely negative:** Psychology, Selling, Mic Skills, and Charisma can *increase* with age if trained, reflecting real-world veteran savvy.

### 5.3 Hall of Fame & Legacy
**Hall of Fame Points** accumulate over a career:

| Achievement | Points |
|---|---|
| World Title Reign | +20 per reign |
| Midcard Title Reign | +5 per reign |
| 5-Star Match | +10 |
| 4+ Star Match | +3 |
| PLE Main Event appearance | +5 |
| 10+ Year Career | +15 |
| Mentor a future champion | +10 |
| Iconic Promo Moment (Pipebomb success) | +8 |

**Hall of Fame Threshold:** 100 points = eligible. Induction is an event that occurs post-retirement (or late career).

### 5.4 Post-Wrestling Career Paths
Upon retirement, the player can:
1.  **Become a Booker:** Transition to Booker Mode for any promotion that offers.
2.  **Become a Manager:** Accompany a wrestler to ringside, providing stat buffs (uses Entertainment stats).
3.  **Become a Trainer:** Run a wrestling school. Train the next generation (mentor system).
4.  **Leave the Business:** Game ends with a career summary and Hall of Fame status.

---

## 6. Relationship & Politics System (Detailed)

### 6.1 Relationship Graph
*   **Data:** `RelationshipEdge { entityA, entityB, affinity (-100 to +100), type: "professional"|"romantic"|"mentor"|"rival", history: string[] }`
*   **Affinity Drift:** Relationships naturally drift toward 0 over time if there is no interaction (people forget grudges, friendships cool).
*   **Modifiers to Affinity:**
    *   Winning against someone: -5 to their affinity toward you (resentment) unless they have high professionalism.
    *   Having a great match together: +10 mutual.
    *   Being in the same faction: +2 per week passive.
    *   Sabotage/Shoot on someone: -30 to -50 immediate.

### 6.2 Mentor/Student Relationships
*   **Trigger:** If a veteran (10+ years) with high affinity toward a younger wrestler is in the same promotion, a "Mentorship Offer" event can trigger.
*   **Mechanic:** The student gains accelerated stat growth in the mentor's strongest stats. The mentor gains Hall of Fame points. The relationship deepens.
*   **Risk:** If the student surpasses the mentor in Overness, the mentor may become jealous (affinity drop), creating a natural "student vs. teacher" feud.

### 6.3 Romantic Relationships
*   **Trigger:** High affinity (+70) with a compatible entity can trigger a "Romantic Interest" event. Even allowed with the booker
*   **Mechanic:** Romantic relationships boost Morale but create vulnerability (scandal risk via Social Media/Dirt Sheets). On-screen couples can be booked together for angle bonuses. Breakups cause massive Morale drops and potential workplace awkwardness (Disadvantage on checks involving the ex).

### 6.4 Factions & Stables
*   **Formation:** Booker-determined (AI or player in Booker Mode).
*   **Mechanic:** Faction members get +Affinity passively. Shared entrance bonuses. Can interfere in each other's matches.
*   **Faction Leader:** The member with the highest Charisma + Overness. Gets the most screen time and booking priority.
*   **Faction Tension:** If a non-leader member's Overness exceeds the leader's, a "Power Struggle" event triggers (potential betrayal/breakup angle).

### 6.5 Locker Room Dynamics
*   **Locker Room Leader:** The wrestler with the highest combined Overness + Avg Relationship in the promotion. They have informal power (can influence the Booker, mediate disputes).
*   **Troublemakers:** Wrestlers with low avg relationships and high ego (Charisma > Selling) cause random backstage incidents.
*   **Sabotage:** A wrestler with very low affinity toward another can attempt to sabotage them (spread rumors to the Booker, sandbag in a match). This is an NPC action during World Simulation, or a player action in Backstage.

---

## 7. Injury, Wellness & Lifestyle Systems

### 7.1 Body-Part Injury Model
*   **Body Parts:** Head, Neck, Shoulder (L/R), Back, Ribs, Arm (L/R), Hand (L/R), Hip, Knee (L/R), Ankle (L/R), Foot (L/R).
*   **Injury Generation:** When the Resolution Engine determines an injury occurs (botch, high-risk spot failure, opponent's recklessness), it rolls on the Body Part table weighted by the move type (Aerial = knees/ankles, Powerbomb = neck/back, Brawling = head/ribs).
*   **Severity Scale:** 1 (Minor, 1-2 weeks), 2 (Moderate, 3-6 weeks), 3 (Serious, 2-4 months), 4 (Severe, 6-12 months), 5 (Career-Threatening, 12+ months or forced retirement).
*   **Working Hurt:** The player can choose to wrestle with an injury. Each match risks upgrading the injury severity by 1. If a severity-4 injury is worsened, it becomes chronic (permanent stat penalty to related body part's actions).

### 7.2 PED System
*   **Action:** "Use PEDs" is available in the Actions menu.
*   **Benefit:** Temporary stat boost (+3 to Strength, +2 to Stamina, faster injury recovery).
*   **Risk:** Each week of use increases `pedDetectionRisk`. When a Wellness Test event occurs (random, more frequent in WWE/AEW), a check is made: D20 + detectionRisk vs DC 15.
*   **Consequences:** Strike 1 = Warning + 30-day suspension. Strike 2 = 60-day suspension + pay cut. Strike 3 = Termination.

### 7.3 Mental Health & Burnout
*   **Burnout** accumulates from: High work rate (>3 matches/week), Travel Fatigue, low Mental Health, losing streaks, bad Booker relationships.
*   **Mental Health** is affected by: Family events, romantic relationships, isolation (no close relationships), substance issues, financial stress.
*   **Consequences:** High burnout = Disadvantage on all checks. Extremely high burnout triggers a "Breakdown" event (forced time off, stat penalties, potential contract issues).
*   **Recovery:** Rest days, vacations (costs money but restores burnout/mental health), therapy (unlockable action, slow but steady recovery).

### 7.4 Travel & Schedule
*   **Work Rate:** Matches per week. Indie wrestlers may do 4-5 weekend shows. Main roster WWE does 3-4 (TV + house shows). NJPW tours are intense bursts.
*   **Travel Fatigue:** Accumulates based on distance between show locations. Cross-country = +15 fatigue. Same city = +2. International = +25.
*   **Consequences:** High fatigue = stamina penalty entering matches, increased injury risk, morale drain.

### 7.5 Family & Personal Life
*   **Random Life Events:** Marriage proposals, child birth, family illness, divorce. Generated by the Event System based on age, relationship status, and career length.
*   **Mechanic:** Family events affect Morale. Missing family milestones (away on tour) damages Family Morale. High Family Morale grants a passive Morale buff.

---

## 8. Financial System (Detailed)

### 8.1 Income Sources
*   **Contract Salary:** Weekly pay from current promotion.
*   **Merchandise:** Percentage of merch sales (based on Overness × Merch Cut from contract). Faces sell more merch than Heels typically.
*   **PLE Bonuses:** Extra pay for PLE appearances, scaled by card position.
*   **Sponsorships:** Agent finds deals. Duration-limited. Income based on Overness and Social Media following.
*   **Side Hustles:** Podcasts (weekly income, small time cost, builds Social Media followers), Streaming (similar), Acting gigs (high pay, high time commitment, boosts mainstream Overness).
*   **Indie Bookings (if no contract):** Per-show pay.

### 8.2 Expenses
*   **Travel Costs:** Gas/flights to shows.
*   **Medical Bills:** Injury treatment. Severe injuries are expensive. Insurance (if part of contract) covers a percentage.
*   **Agent Fees:** 10-15% of negotiated deals.
*   **Investment Agent Fees:** Flat fee + percentage of returns.
*   **Training Costs:** Gym memberships, wrestling school fees (early career).
*   **Lifestyle Costs:** Base weekly living expenses.
*   **Gear/Attire:** Optional purchases. Premium gear gives minor Charisma/Entrance buffs.

### 8.3 Agent System
*   **Hiring an Agent:** Costs a percentage of all income they negotiate.
*   **Agent Quality Stat (1-20):** Higher quality agents:
    *   Find better sponsorship deals.
    *   Negotiate higher contract salaries.
    *   Alert you to opportunities from other promotions.
    *   Handle PR crises (reduce scandal damage).
*   **Investment Agent:** Separate hire. Takes your money, invests it. Returns vary. Risk of bad investments (agent quality check).

---

## 9. Media & Social Systems

### 9.1 Social Media
*   **Followers:** A number that grows based on Overness, controversial moments, and promos.
*   **Posting:** The player can choose to post (or not). Posting options: Kayfabe (in-character, safe), Personal (out of character, builds connection but risks scandal), Controversial (high risk — could go viral positively or cause a PR disaster).
*   **Scandal Risk:** Each "Personal" or "Controversial" post rolls against `scandalRisk`. Failure = tabloid story, Promotion heat, potential suspension.

### 9.2 Dirt Sheets & Newsletters
*   **Generated Weekly:** The `DirtSheetGenerator` scans the World State for notable changes:
    *   Contract expirations approaching.
    *   Backstage heat incidents (from the Relationship system).
    *   Injury reports.
    *   Booking decisions that leaked.
    *   Potential free agent signings.
*   **Player Impact:** Reading the Dirt Sheets gives the player insider knowledge (e.g., knowing a rival is injured before it's announced lets them pitch a feud to the Booker). Some Dirt Sheet stories are inaccurate (deliberate misinformation / "worked" leaks).

### 9.3 Merchandise
*   **Merch Types:** T-Shirts, Action Figures (high Overness only), Catchphrase items.
*   **Sales Formula:** `weeklyMerchSales = overness * alignment_modifier * merch_cut * promotion_distribution_reach`
*   Faces sell 1.3x more merch than Heels. Tweeners with cool gimmicks can exceed both.

---

## 10. The Dynamic Event System (Comprehensive)

### 10.1 Tag Generation Rules
Tags are automatically applied and removed based on state thresholds:

| Tag | Applied When | Removed When |
|---|---|---|
| `[Champion]` | Holding any title | Losing the title |
| `[Injured_X]` | ConditionComponent has active injury on body part X | Injury heals |
| `[Hot_Streak]` | 5+ consecutive wins | A loss |
| `[Cold]` | No match/promo in 3+ weeks | Getting booked |
| `[Contract_Expiring]` | ≤ 8 weeks remaining on contract | Contract renewed or expired |
| `[Veteran]` | 10+ years active | Never removed |
| `[Rookie]` | < 2 years active | 2 years pass |
| `[Over]` | Overness ≥ 70 | Overness drops below 60 |
| `[Heat_Magnet]` | 3+ feuds in the last 6 months | 3+ months with no feud |
| `[Dangerous_Worker]` | Caused 3+ injuries to opponents | 1 year with no opponent injuries |
| `[Burned_Out]` | Burnout ≥ 80 | Burnout drops below 50 |
| `[Financial_Trouble]` | Bank balance < $500 | Bank balance > $2000 |
| `[Substance_Issues]` | PED usage active + 2+ wellness strikes | Clean for 6 months |
| `[Locker_Room_Leader]` | Highest avg relationship in promotion + Overness ≥ 50 | Another wrestler takes the spot |
| `[Scandal]` | Failed social media check or tabloid event | 4 weeks pass |

### 10.2 Event Template Structure
```
EventTemplate {
  id: string,
  title: string,                          // "The Vultures Circle"
  requiredTags: string[],                 // Tags that MUST be present
  excludedTags: string[],                 // Tags that MUST NOT be present
  requiredState: function(state) -> bool, // Complex conditional (optional)
  weight: number,                         // Base probability weight
  cooldownWeeks: number,                  // Min weeks before this can fire again
  choices: [
    {
      text: string,                       // "Leak it to the sheets"
      check: { stat, dc, advantage?, disadvantage? } | null,  // null = auto-success
      outcomes: {
        critSuccess: { narrative, effects: StateChange[] },
        success: { narrative, effects: StateChange[] },
        failure: { narrative, effects: StateChange[] },
        critFailure: { narrative, effects: StateChange[] }
      }
    }
  ]
}
```
*   `StateChange` is a generic object: `{ type: "stat"|"relationship"|"tag"|"money"|"injury"|"contract", target, value }`
*   Narrative strings support template variables: `{player.name}`, `{opponent.name}`, `{promotion.name}`, etc.

### 10.3 Event Categories & Example Count Targets

| Category | Example Events | Target Count |
|---|---|---|
| **Backstage Politics** | Booker confrontation, locker room argument, sabotage attempt, talent meeting | 15+ |
| **Contract & Business** | Offer from rival promotion, renegotiation, release request, no-compete clause | 10+ |
| **Personal Life** | Family milestone, relationship drama, financial crisis, health scare | 12+ |
| **Media & PR** | Interview opportunity, social media blowup, podcast guest spot, tabloid leak | 10+ |
| **In-Ring** | Pre-match intimidation, opponent disrespect, spot calling disagreement, referee issue | 10+ |
| **Wellness & Health** | Drug test, PED offer, burnout warning, therapy suggestion, rehab | 8+ |
| **Career Milestones** | Record-breaking reign, anniversary, retirement talk, hall of fame buzz | 8+ |
| **Faction/Stable** | Power struggle, new member pitch, betrayal setup, faction dissolution | 8+ |
| **Mentor/Student** | Student surpasses mentor, graduation event, mentor retirement | 6+ |
| **Industry-Wide** | Promotion closes, talent raid, cross-promotion event, pandemic/disaster | 5+ |
| **Indie-Specific** | Van broke down, promoter didn't pay, got discovered by scout, training accident | 8+ |

**Total Target: 100+ unique event templates**, each with 2-4 choices and 4 outcome tiers.

---

## 11. Resolution Engine (Complete Specification)

### 11.1 The D20 Check
```
roll = random(1, 20)
modifier = relevantStat + contextBonuses - contextPenalties
total = roll + modifier

if roll === 1:  return CRITICAL_FAILURE   // Always fails regardless of modifier
if roll === 20: return CRITICAL_SUCCESS   // Always succeeds regardless of DC

if total >= dc: return SUCCESS
else:           return FAILURE
```

### 11.2 Advantage & Disadvantage
*   **Advantage:** Roll 2d20, take the higher. Granted by: Hometown crowd, manager at ringside, `[Hot_Streak]` tag, high chemistry with opponent.
*   **Disadvantage:** Roll 2d20, take the lower. Imposed by: Active injury, `[Burned_Out]` tag, working in an unfamiliar style (Lucha wrestler in a Strong Style promotion), low energy.
*   **Stacking:** Advantage and Disadvantage cancel each other out. Multiple sources of the same don't stack (you either have it or you don't).

### 11.3 Contested Checks
When two entities oppose each other (promo battles, negotiation, shoot wrestling):
```
actorRoll = D20 + actorStat + actorModifiers
targetRoll = D20 + targetStat + targetModifiers
winner = higher total
margin = abs(actorRoll - targetRoll)  // Determines how decisive the victory is
```
*   Margin 1-3: Narrow victory (minor effects).
*   Margin 4-7: Clear victory (moderate effects).
*   Margin 8+: Dominant victory (major effects, potential humiliation of loser).

---

## 12. Booker Mode (Detailed)

### 12.1 Weekly Show Booking Flow
1.  **View Roster & Availability:** See who is healthy, who is injured, who has heat with whom.
2.  **Build the Card:** Assign matches (select participants, match type, card position). Assign promo segments (select participants, angle type).
3.  **Set Road Agent Notes per Match:**
    *   Winner (which wrestler goes over).
    *   Finish Type (Clean, Dirty, DQ, Count-Out, No Contest).
    *   Match Style (Call it in the ring, Scripted spots, Protect [wrestler]).
    *   Time Allotment (5, 10, 15, 20, 30 minutes).
4.  **Run the Show:** The Match Simulator runs each segment. Results are generated.
5.  **Post-Show Report:** TV rating, match ratings, crowd reactions, any incidents (botches, injuries, shoots).

### 12.2 Storyline Creation (Booker)
*   The Booker can create a `Storyline` object: `{ name, participants: UUID[], type, targetPLE, chapters: [] }`
*   **Storyline Types:** Title Chase, Betrayal, Invasion, Redemption, Monster Dominance, Underdog Rise, Love Triangle.
*   **Chapters:** Each week, the Booker assigns a chapter beat (e.g., "Week 1: Confrontation promo. Week 2: Brawl backstage. Week 3: Tag match. Week 4: PLE singles match").
*   **Heat Accumulation:** Well-booked storylines build Heat naturally. Poorly booked ones (repetitive, no payoff, mismatched styles) lose Heat.

### 12.3 Talent Scouting & Signing
*   **Action:** "Scout Indie Scene" — costs time and money. Returns a list of available indie wrestlers with approximate stats.
*   **Signing:** Offer a contract to a free agent. They accept/reject based on: your Promotion prestige vs. competing offers, salary offered, and creative promises.
*   **Releasing Talent:** Costs remaining contract salary as a buyout. Freed wrestler goes to the free agent pool (and might be signed by a rival).

### 12.4 Financial Management (Booker)
*   **Income:** TV deal revenue + ticket sales (based on card strength and venue size) + merchandise.
*   **Expenses:** Wrestler salaries + venue rental + production costs + travel logistics.
*   **Bankruptcy Risk:** If `bankBalance` drops below 0 for 4+ consecutive weeks, the promotion folds. Game over (or restart with a new promotion).

---

## 13. The Diary / Career Log System

*   **Auto-Generated Entries:** Every significant event writes a `DiaryEntry { date, category, text, relatedEntities }` to the player's history.
    *   Match results with star ratings.
    *   Promo outcomes.
    *   Backstage incidents.
    *   Contract signings.
    *   Injuries and recoveries.
    *   Title wins/losses.
    *   Relationship milestones.
*   **Player Notes:** The player can add custom text notes to the diary at any time (for personal narrative tracking).
*   **Career Summary Screen:** Accessible from the `People` tab (self). Shows a timeline visualization of the entire career: titles held, promotions worked for, major feuds, win/loss record by year.

---

## 14. Data Architecture for Real-World Roster

### 14.1 Data Format
All roster data is stored as JSON files loaded at game start.
```
wrestlers.json: [
  {
    "name": "Kenny Omega",
    "age": 42,
    "hometown": "Winnipeg, Manitoba",
    "archetype": "High-Flyer",
    "alignment": "Face",
    "gimmick": "The Best Bout Machine",
    "catchphrase": "Goodbye and goodnight. BANG!",
    "stats": { "strength": 12, "aerial": 18, "technical": 16, ... },
    "promotion": "AEW",
    "overness": 88,
    "movesetIds": ["v_trigger", "one_winged_angel", ...],
    "relationships": [
      { "target": "The Young Bucks", "affinity": 90, "type": "faction" },
      ...
    ]
  },
  ...
]
```

### 14.2 Content Files
*   `wrestlers.json` — Full roster data (200+ wrestlers across all promotions).
*   `promotions.json` — Promotion configs, show schedules, PLE calendars.
*   `championships.json` — All titles, their prestige, and current holders.
*   `moves.json` — Move database (name, type, stats, DC, spectacle).
*   `events.json` — Event template database (100+ templates).
*   `promos.json` — Promo text templates and tone modifiers.
*   `narratives.json` — Play-by-play text templates for match simulation.

---

## 15. UI Layout Specification

Based on the wireframe, the layout uses CSS Grid:

```
+-----------------------------------------------+
| [Player Info Bar]         | [Stats & Record]   |
| Name, Titles, Location   | Stats, Pop, Health  |
| Alignment Icon, Pop Meter | Energy, Momentum    |
+---------------------------+--------------------+
|                           |                    |
|     Events Log            |   Event & Choice   |
|     (scrollable)          |   Menu             |
|                           |   (contextual)     |
|                           |                    |
+---------------------------+--------------------+
| [Match/Promo] [Backstage] [Actions]  [People]  |
+-----------------------------------------------+
```

### 15.1 Navigation Tabs
*   **Match/Promo:** Shows upcoming booked matches, promo segments. Allows preparation actions.
*   **Backstage:** Booker office, locker room interactions, faction management.
*   **Actions:** Training, Rest, Social Media, Side Hustles, PED usage, Agent management, Financial overview.
*   **People:** Roster directory. Click any wrestler to see their public stats, your relationship with them, their title history. Sub-tabs: Roster, Factions, Free Agents, Relationships.

---

## 16. Development Phases (Execution Order)

### Milestone 1: The Invisible Engine (Phases 1-3)
*Target: Console-only. No UI. Pure logic validation.*
1.  Implement `GameStateManager` with dispatch/subscribe.
2.  Implement `Entity` base class and all Components.
3.  Implement `GameCalendar` with tick logic.
4.  Implement `ResolutionEngine` (D20, modifiers, advantage/disadvantage, contested).
5.  Implement `RelationshipGraph`.
6.  Write unit tests for all of the above.
7.  Implement basic `WorldSimulator` (advance time, heal injuries, drift relationships).

### Milestone 2: The Skeleton (Phase 4)
*Target: Playable loop with placeholder data.*
1.  Build CSS design system (variables, grid layout, typography).
2.  Implement `UIManager` (render state to DOM).
3.  Wire up the "Advance Time" button to the tick loop.
4.  Display events in the log panel.
5.  Display choices in the action panel.

### Milestone 3: The Ring (Phase 5)
*Target: Matches are playable and produce compelling text.*
1.  Implement `MatchSimulator` with all phases.
2.  Implement `LogGenerator` with text templates.
3.  Implement Match Rating calculation.
4.  Implement match type modifiers.
5.  Implement script adherence / shoot mechanic.

### Milestone 4: The Life (Phases 6-8)
*Target: Full RPG loop — training, promos, contracts, finances.*
1.  Implement Promo system.
2.  Implement Contract negotiation.
3.  Implement Financial system (income, expenses, agents).
4.  Implement Injury/Wellness/PED systems.
5.  Implement Social Media and Dirt Sheets.
6.  Implement Schedule/Lifestyle/Burnout.
7.  Implement 100+ Event Templates.
8.  Implement Booker Mode (card booking UI, storyline creation, scouting).

### Milestone 5: Polish & Ship (Phase 9)
*Target: Save/load, animations, balance, content.*
1.  Implement IndexedDB save/load with multiple slots.
2.  Load real-world roster data from JSON.
3.  CSS animations (log scroll, dice roll viz, stat change flashes).
4.  Balance pass (stat scaling, DC tuning, economy tuning).
5.  Responsive design for mobile.
