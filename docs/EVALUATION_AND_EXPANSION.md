# Mat Life: Wrestling Simulator — Evaluation & Expansion Plan

---

## Part 1: Codebase Evaluation

### 1.1 Overall Assessment

The foundation is **solid**. The architecture (ECS hybrid, centralized state, D20 resolution) is well-designed and the separation of concerns between core, engine, and UI layers is clean. Character creation through to the game screen is fully functional. Events fire, time advances, tabs navigate, and stats render correctly.

However, the codebase is still in **early Milestone 2** — the skeleton UI works but most gameplay actions are **log-only stubs** (training, locker room, etc. just print messages without modifying state). Several engine systems exist as complete implementations but are **never actually called** during gameplay.

---

### 1.3 Code Issues (Non-Crashing)

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | `ActionPanel` imports `DirtSheetGenerator` which iterates `state.relationships` — but `relationships` is a `Map` and entries don't have `.entityA`/`.entityB` properties as expected; the key is `"idA_idB"` and value is the relationship object | `DirtSheetGenerator.js:75` | Medium |
| 2 | `MatchView` creates DOM elements with hardcoded IDs (`w1-name`, `w2-name`, etc.) that will collide if multiple matches render | `MatchView.js` | Low |
| 3 | `CharacterCreation.startCareer()` directly mutates `state.promotions` Map instead of dispatching an action | `CharacterCreation.js:458` | Medium |
| 4 | `EventManager.generateEvents` returns a single event but some ticks could logically trigger multiple — events are lost | `EventManager.js` | Low |
| 5 | `SocialMediaSystem.getAvailablePostTypes` and `getSummary` are referenced in UI but no validation that the component exists on the entity | `ActionPanel.js:370` | Low |
| 6 | `PromoEngine.getAvailableTones` is called but the method signature expects `entity` — no null guard if entity lacks `entertainmentStats` | `PromoEngine.js` | Low |
| 7 | No save/load system implemented yet — `localforage` is mentioned in docs but not imported anywhere | All | Medium |
| 8 | `capitalize` is imported from `Utils.js` in `PlayerInfoPanel.js` but is also defined locally in `CharacterCreation.js` — inconsistency | Multiple | Low |

---

### 1.4 Systems Status Matrix

| System | Code Exists | Wired to Game Loop | Actually Functional |
|--------|:-----------:|:-------------------:|:-------------------:|
| GameStateManager | ✅ | ✅ | ✅ |
| GameCalendar | ✅ | ✅ | ✅ |
| EntityFactory | ✅ | ✅ | ✅ |
| ResolutionEngine | ✅ | ✅ | ✅ |
| EventManager | ✅ | ✅ | ✅ |
| TagEngine | ✅ | ✅ | ✅ |
| WorldSimulator | ✅ | ✅ | ✅ |
| MatchSimulator | ✅ | ❌ | ❌ (never triggered) |
| MatchView | ✅ | ❌ | ❌ (never shown) |
| RelationshipManager | ✅ | ❌ | ❌ |
| InjuryEngine | ✅ | ⚠️ (tick only) | ⚠️ |
| FinancialEngine | ✅ | ⚠️ (tick only) | ⚠️ |
| ContractEngine | ✅ | ❌ | ❌ |
| PromoEngine | ✅ | ✅ | ⚠️ (no stat effect) |
| SocialMediaSystem | ✅ | ✅ | ⚠️ (no stat effect) |
| LifestyleEngine | ✅ | ⚠️ (tick only) | ⚠️ |
| WellnessEngine | ✅ | ✅ | ⚠️ |
| DirtSheetGenerator | ✅ | ✅ | ⚠️ (relationship bug) |
| Save/Load | ❌ | ❌ | ❌ |
| Character Creation | ✅ | ✅ | ✅ |
| UI Panels | ✅ | ✅ | ✅ |

---

## Part 2: Expansion Plan
**Goal:** Make what exists actually work end-to-end.


#### 0.2 Wire Training to Stats
- `renderTrainingOptions` should call a new `TrainingSystem.train(entity, category)` method
- Training consumes a time slot and grants small stat increases (+1 to relevant stats)
- Diminishing returns: stats above 15 are harder to train
- Training adds burnout (+3 per session)

#### 0.3 Wire Match Generation
- Fix `WorldSimulator.generateShowCard()` to properly create match objects with entity references
- When `pendingActions` contains a match, pass the correct `{ player, opponent, matchType }` to `renderMatchPreparation`
- Generate random indie opponents via `EntityFactory.generateRandomIndieWrestler()`
- After match completion, update both wrestlers' career stats

#### 0.4 Wire Financial/Lifestyle/Contract Weekly Processing
- Ensure `FinancialEngine.processWeekly()`, `LifestyleEngine.processWeekly()`, and `ContractEngine.processWeekly()` are called from `WorldSimulator.tick()` and their results are reflected in the UI
- Show weekly financial summary in the event log

#### 0.5 Save/Load System
- Integrate `localforage` for IndexedDB persistence
- Auto-save on each `WorldSimulator.tick()`
- Manual save button in UI
- Load from save on app start if save exists

---

### Phase 1 — Gameplay Depth: The Core Loop (1-2 weeks)

**Goal:** Make time → train → match → reward loop compelling.

#### 1.1 Training System
```
TrainingSystem {
  train(entity, focus: 'gym'|'ring'|'promo'|'sparring') → TrainingResult
  - Consumes 1 time slot
  - Base gain: 0.5-1.0 per stat (random within focus area)
  - Trainer bonus: +0.5 if entity has [Has_Trainer] tag
  - Diminishing returns formula: gain * (20 - currentStat) / 20
  - Injury risk: 3% per session (higher for ring/sparring)
  - Burnout cost: +3 per session (+1 if low intensity)
  - Weekly cap: max 3 training sessions before penalties
}
```

#### 1.2 Match System Activation
- Connect `MatchSimulator` → `MatchView` → career stats pipeline
- Match results affect:
  - **Win/Loss record** (careerStats)
  - **Overness** (+2 win, -1 loss, bonus for high-rated matches)
  - **Momentum** (+5 to +15 based on match rating)
  - **Injuries** (checked via InjuryEngine post-match)
  - **Relationship** with opponent (good matches = +affinity)
  - **Contract evaluation** (promotions track your match quality)

#### 1.3 Weekly Cycle Structure
- Each week = 28 time slots (7 days × 4 slots)
- Morning: Train, Rest, Social Media
- Afternoon: Train, Backstage, Explore
- Evening: Shows, Promos, Events
- Night: Recovery (auto), Social, Rest
- Show days are determined by the player's promotion schedule

#### 1.4 Promo System Effects
- Wire `PromoEngine.runPromo()` results to actually modify entity stats
- Successful promos: +momentum, +overness, +charisma XP
- Failed promos: -momentum, burnout risk
- Promo battles against NPCs using `PromoEngine.promoBattle()`

---

### Phase 2 — World Simulation: Making the World Alive (2-3 weeks)

**Goal:** The wrestling world progresses and reacts whether the player is involved or not.

#### 2.1 AI Promotion Simulation
```
AIPromotionSystem {
  simulateWeek(promotion, state) {
    - Book shows: generate match cards for AI wrestlers
    - Simulate matches: quick-sim match results (no turn-by-turn)
    - Update standings: AI wrestler stats change based on results
    - Title defenses: champions defend on schedule
    - Talent scouting: promotions sign free agents
    - Feuds: auto-generate feuds between roster members with high/low affinity
  }
}
```

#### 2.2 Multi-Promotion Ecosystem
- 5-6 promotions with different:
  - **Size tiers:** Indie (5-15 prestige), Regional (16-40), National (41-70), Global (71-100)
  - **Style preferences:** Hardcore, Technical, Sports Entertainment, Lucha, Strong Style, Mixed
  - **Show schedules:** Weekly, bi-weekly, monthly PPVs
  - **Budgets:** Affects salary offers and production quality
- Promotions can grow/shrink based on their roster quality and match ratings
- Promotion wars: competing for talent, ratings battles

#### 2.3 Contract System Activation
- Wire `ContractEngine` to create actual negotiations when:
  - Player is a free agent and applies to a promotion
  - A promotion scouts the player (based on overness threshold)
  - Contract is expiring (8 weeks notice)
- Negotiation mini-game: use `ResolutionEngine` for clause negotiation
- Clauses: salary, creative control, no-compete, merchandise split, guaranteed position

#### 2.4 Relationship Consequences
- Wire `RelationshipManager` so affinity actually affects gameplay:
  - Positive affinity (+50): tag team offers, backstage allies, match chemistry bonus
  - Negative affinity (-50): backstage heat, sabotage risk, feud opportunities
  - Affinity drifts based on match interactions, backstage events
- Booker relationship affects card position and push

#### 2.5 Dynamic Feud System
```
FeudManager {
  startFeud(entityA, entityB, cause) → Feud
  escalateFeud(feud) → FeudEvent
  resolveFeud(feud, matchResult) → FeudOutcome
  
  Feud phases: Tension → Heat → Blowoff
  - Tension: trash talk, interference, backstage confrontations
  - Heat: attacks, betrayals, stipulation matches announced
  - Blowoff: PPV match, winner takes the push
  Duration: 4-12 weeks
}
```

---

### Phase 3 — Career Progression: The Long Game (2-3 weeks)

**Goal:** Give the player a career arc with meaningful milestones.

#### 3.1 Card Position System
- Positions: Dark Match → Pre-Show → Opener → Mid-Card → Upper Mid-Card → Main Event
- Movement based on: overness, match quality average, booker relationship, momentum
- Each position has salary modifiers and match type access
- Demotion possible for poor performance or heat

#### 3.2 Championship System
- Activate championship tracking in `GameStateManager`
- Title types per promotion: World, Secondary, Tag, Women's
- Title reigns tracked: length, defenses, quality
- Title match creation: earn title shots through wins, feuds, or Royal Rumble-style events
- Title politics: backstage maneuvering for title shots

#### 3.3 Storyline/Angle System
```
StorylineManager {
  Storyline {
    participants: Entity[]
    type: 'feud' | 'alliance' | 'betrayal' | 'mystery' | 'redemption' | 'championship_chase'
    beats: StoryBeat[]  // scripted narrative moments
    currentBeat: number
    quality: number     // determined by match ratings + promo quality in the storyline
    duration: number    // weeks
  }
  
  // Players can accept/reject storyline pitches from bookers
  // Better storylines = more TV time = more overness
  // Player choices during storylines affect their trajectory
}
```

#### 3.4 Perk/Skill Tree
- Unlock perks at career milestones (matches wrestled, overness thresholds, title reigns)
- Categories:
  - **In-Ring:** "Iron Man" (stamina +10), "Finisher Expert" (+2 to finisher DC)
  - **Entertainment:** "Silver Tongue" (promo advantage), "Social Media Guru" (2x follower gain)
  - **Backstage:** "Locker Room Leader" (relationship bonus), "Political Player" (contract negotiation advantage)
  - **Physical:** "Peak Athlete" (training gains +50%), "Iron Body" (injury resistance)
- Max 8 perks active at once — forces meaningful choices

#### 3.5 Aging & Career Decline
- Age 30-35: No penalties, peak performance
- Age 35-38: -1 to speed per year, +10% injury risk per year
- Age 38-42: -1 to stamina per year, -1 to aerial per year
- Age 42+: Retirement discussions, legends contract option
- Part-timers: reduced schedule, higher pay per appearance

---

### Phase 4 — Narrative Depth: Making It Personal (3-4 weeks)

**Goal:** Every playthrough tells a unique story.

#### 4.1 Expanded Event System
- Increase event pool from 14 → 80+ events across categories:
  - **Backstage (20):** locker room politics, booker meetings, mentor/protégé, cliques
  - **Career (15):** contract offers, tryouts, injury comebacks, retirement scares
  - **Personal (15):** family events, financial crises, media appearances, charity work
  - **Industry (10):** promotion closures, talent raids, industry scandals, award shows
  - **Random (10):** travel incidents, fan encounters, viral moments, celebrity crossovers
  - **Seasonal (10):** WrestleMania season, draft, Royal Rumble, year-end awards
- Each event should have `critSuccess`/`critFailure` outcomes for all checked choices
- Chain events: some events trigger follow-ups 2-4 weeks later based on chosen outcome

#### 4.2 Backstage Interaction System
- Locker room has persistent NPCs with opinions
- Actions in "Hang out in Locker Room":
  - **Talk to [wrestler]**: spend time, gain/lose affinity, learn gossip
  - **Play cards**: low-key bonding, small relationship gains across the room
  - **Keep to yourself**: no relationship change, mental health +5
  - **Intimidate rookies**: feared but not liked, +[Bully] tag risk
- Booker meetings:
  - Request title shot (requires overness threshold + relationship)
  - Pitch storyline idea (charisma check)
  - Request time off
  - Complain about position (risky)

#### 4.3 Social Media Depth
- Post types that actually matter:
  - **Kayfabe posts**: protect your character, +momentum
  - **Shoot posts**: risky but can go viral, high follower gain OR scandal
  - **Workout/behind-the-scenes**: safe, steady growth
  - **Controversial takes**: highest risk/reward
  - **Promote upcoming match**: +match hype, +merchandise for that show
- Follower milestones unlock opportunities (sponsorships, podcasts, acting gigs)
- Scandal system: viral negative posts can require crisis management

#### 4.4 Injury Recovery Narrative
- Injuries aren't just "wait X days":
  - Choose rehab intensity (aggressive vs conservative)
  - Comeback match after long injuries (special event)
  - Psychological effects of serious injuries (fear of high spots)
  - Ring rust: -2 to all in-ring stats after 8+ weeks off, recovers over 3 matches

---

### Phase 5 — Booker Mode & End-Game (4+ weeks)

**Goal:** Completely different gameplay perspective + post-career options.

#### 5.1 Booker Mode Core
- Manage a promotion instead of a wrestler
- Book shows: drag wrestlers into match slots, assign stipulations
- Manage roster: sign, release, push, bury
- Financial management: ticket sales, TV deals, merchandise revenue
- Show quality determined by: match ratings, storyline payoffs, crowd reactions

#### 5.2 Show Booking Interface
```
ShowBooker {
  createShowCard(promotion) → ShowCard
  - Match slots: opening, midcard x2-3, co-main, main event
  - Each slot: select participants, match type, stipulation, duration, finish
  - Segment slots: promos, backstage segments, run-ins
  - PPV shows: bigger cards, higher stakes, title matches
  
  simulateShow(showCard) → ShowResult
  - Each match simulated
  - Crowd engagement tracked
  - Show rating calculated
  - Financial results (ticket sales, PPV buys)
}
```

#### 5.3 Post-Career Transitions
- **Commentator:** call matches, build broadcast career
- **Manager:** guide younger wrestlers, take a cut of their earnings
- **Trainer:** run a wrestling school, develop talent
- **Authority figure:** become GM/Commissioner of a promotion
- **Legends contract:** occasional appearances for big money

---

### Phase 6 — Polish & Quality of Life

#### 6.1 UI Improvements
- Wrestler profile pages with full stat breakdown
- Match history with star ratings
- Financial graphs over time
- Calendar view showing scheduled events
- Notification system for important events (contract expiring, title shot earned)
- Achievement/milestone tracker

#### 6.2 Data Expansion
- 100+ starting NPCs with unique gimmicks and stats
- 15+ promotions across different regions
- 50+ moves per archetype
- Regional wrestling scenes (Japan, Mexico, UK, USA)

#### 6.3 Replayability
- Different starting scenarios (indie darling, legacy wrestler, late bloomer, female division)
- Hall of Fame tracking across playthroughs
- Difficulty settings affecting stat growth rates and AI competitiveness
- Random world generation for different wrestling eras

