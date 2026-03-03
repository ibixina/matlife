/**
 * Milestone 1 Integration Test
 * "A Week in the Life" - Tests the complete core engine
 */

import { gameStateManager } from '../js/core/GameStateManager.js';
import { Entity } from '../js/core/Entity.js';
import { 
  IdentityComponent, 
  PhysicalStatsComponent, 
  InRingStatsComponent,
  EntertainmentStatsComponent,
  CareerStatsComponent,
  ContractComponent,
  FinancialComponent,
  PopularityComponent
} from '../js/core/Component.js';
import WorldSimulator from '../js/engine/WorldSimulator.js';
import eventManager from '../js/engine/EventManager.js';
import ResolutionEngine from '../js/engine/ResolutionEngine.js';

// Test results
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ FAIL: ${message}`);
  }
}

async function runIntegrationTest() {
  console.log('\n=== Milestone 1 Integration Test: A Week in the Life ===\n');
  
  // Step 1: Initialize GameState
  console.log('Step 1: Initializing GameState...');
  gameStateManager.initializeState({
    startYear: 1,
    startMonth: 1,
    startWeek: 1,
    startDay: 0, // Monday
    startTimeOfDay: 0 // Morning
  });
  
  const state = gameStateManager.getStateRef();
  assert(state.calendar.year === 1, 'Calendar year initialized to 1');
  assert(state.calendar.month === 1, 'Calendar month initialized to 1');
  assert(state.entities.size === 0, 'Entities map is empty initially');
  
  // Step 2: Create player entity (Wrestler, indie, no contract, High-Flyer)
  console.log('\nStep 2: Creating player entity...');
  const player = new Entity();
  player.addComponent('identity', new IdentityComponent({
    name: 'Test Wrestler',
    age: 20,
    hometown: 'Parts Unknown',
    gender: 'Male',
    gimmick: 'High-Flying Prodigy',
    alignment: 'Face'
  }));
  
  player.addComponent('physicalStats', new PhysicalStatsComponent({
    stamina: 60,
    strength: 10,
    resilience: 10,
    speed: 16 // High speed for High-Flyer
  }));
  
  player.addComponent('inRingStats', new InRingStatsComponent({
    brawling: 10,
    technical: 12,
    aerial: 16, // High aerial for High-Flyer
    selling: 10,
    psychology: 10
  }));
  
  player.addComponent('entertainmentStats', new EntertainmentStatsComponent({
    charisma: 12,
    micSkills: 10,
    acting: 10
  }));
  
  player.addComponent('careerStats', new CareerStatsComponent({
    totalWins: 0,
    totalLosses: 0,
    consecutiveWins: 0,
    yearsActive: 0,
    matchesThisWeek: 0
  }));
  
  player.addComponent('contract', new ContractComponent({
    promotionId: null, // No contract - indie
    weeklySalary: 0,
    remainingWeeks: 0
  }));
  
  player.addComponent('financial', new FinancialComponent({
    bankBalance: 500,
    weeklyExpenses: 100
  }));
  
  player.addComponent('popularity', new PopularityComponent({
    overness: 5,
    momentum: 0
  }));
  
  // Add player to state
  gameStateManager.dispatch('ADD_ENTITY', { entity: player });
  state.player.entityId = player.id;
  
  assert(state.entities.size === 1, 'Player entity added to state');
  assert(gameStateManager.getPlayerEntity().id === player.id, 'Player entity accessible via getPlayerEntity()');
  
  // Step 3: Create 5 NPC wrestlers
  console.log('\nStep 3: Creating 5 NPC wrestlers...');
  const npcWrestlers = [];
  for (let i = 0; i < 5; i++) {
    const npc = new Entity();
    npc.addComponent('identity', new IdentityComponent({
      name: `NPC Wrestler ${i + 1}`,
      age: 20 + i,
      hometown: 'Various',
      gender: 'Male',
      gimmick: `Wrestler ${i + 1}`,
      alignment: i % 2 === 0 ? 'Face' : 'Heel'
    }));
    npc.addComponent('physicalStats', new PhysicalStatsComponent({
      stamina: 50 + i * 2,
      strength: 10 + i,
      resilience: 10 + i,
      speed: 10
    }));
    npc.addComponent('inRingStats', new InRingStatsComponent({
      brawling: 10 + i,
      technical: 10,
      aerial: 10,
      selling: 10,
      psychology: 10
    }));
    npc.addComponent('careerStats', new CareerStatsComponent({
      totalWins: i * 5,
      totalLosses: i * 3
    }));
    
    gameStateManager.dispatch('ADD_ENTITY', { entity: npc });
    npcWrestlers.push(npc);
  }
  
  assert(state.entities.size === 6, 'All 6 entities (1 player + 5 NPCs) added');
  
  // Step 4: Create 1 indie promotion
  console.log('\nStep 4: Creating indie promotion...');
  const indiePromotion = {
    id: 'indie_promo_1',
    name: 'Indie Wrestling Alliance',
    region: 'USA',
    prestige: 15,
    roster: [player.id, ...npcWrestlers.map(n => n.id)],
    shows: [
      { day: 5 }, // Saturday
      { day: 6 }  // Sunday
    ],
    stylePreference: 'Mixed'
  };
  
  state.promotions.set(indiePromotion.id, indiePromotion);
  
  // Update player contract with promotion
  player.getComponent('contract').promotionId = indiePromotion.id;
  player.getComponent('contract').weeklySalary = 100;
  player.getComponent('contract').remainingWeeks = 52;
  
  assert(state.promotions.size === 1, 'Indie promotion added');
  assert(player.getComponent('contract').promotionId === indiePromotion.id, 'Player assigned to promotion');
  
  // Load event templates
  console.log('\nStep 5: Loading event templates...');
  try {
    const eventsResponse = await fetch('./js/data/events.json');
    const eventTemplates = await eventsResponse.json();
    eventManager.loadTemplates(eventTemplates);
    assert(eventManager.eventTemplates.length > 0, `Loaded ${eventManager.eventTemplates.length} event templates`);
  } catch (e) {
    console.log('Note: Could not load events.json, using empty templates for test');
    eventManager.loadTemplates([]);
  }
  
  // Step 6: Tick through 7 full days (28 time slots)
  console.log('\nStep 6: Ticking through a week (28 time slots)...');
  
  const startWeek = state.calendar.week;
  const initialBalance = player.getComponent('financial').bankBalance;
  
  for (let i = 0; i < 28; i++) {
    const pendingActions = WorldSimulator.tick(state);
    
    // Log any pending actions (matches, events)
    if (pendingActions && pendingActions.length > 0) {
      console.log(`  Day ${Math.floor(i / 4) + 1}, Slot ${i % 4}: ${pendingActions.length} pending action(s)`);
    }
  }
  
  // Verify calendar advanced correctly
  assert(state.calendar.week === startWeek + 1 || (startWeek === 4 && state.calendar.week === 1), 
         'Calendar advanced to next week');
  
  // Step 7: Verify various systems worked
  console.log('\nStep 7: Verifying system operations...');
  
  // Check event log
  assert(state.history.length > 0, `Event log has ${state.history.length} entries`);
  
  // Check finances processed
  const currentBalance = player.getComponent('financial').bankBalance;
  assert(currentBalance !== initialBalance, 
         `Finances processed (balance: $${initialBalance} -> $${currentBalance})`);
  
  // Check tags were evaluated
  const playerTags = player.getTags ? player.getTags() : [];
  console.log(`  Player tags: ${playerTags.join(', ') || 'none'}`);
  
  // Test Resolution Engine
  console.log('\nStep 8: Testing Resolution Engine...');
  const resolutionResult = ResolutionEngine.resolve({
    actor: player,
    action: 'Test Move',
    stat: 'aerial',
    dc: 10
  });
  
  assert(resolutionResult.outcome, 'Resolution engine returned result');
  assert(resolutionResult.roll >= 1 && resolutionResult.roll <= 20, 
         `D20 roll in valid range: ${resolutionResult.roll}`);
  console.log(`  Resolution result: ${resolutionResult.outcome} (rolled ${resolutionResult.roll} vs DC ${resolutionResult.dc})`);
  
  // Test NPC match simulation
  console.log('\nStep 9: Testing NPC match simulation...');
  const matchResult = WorldSimulator.simulateNPCMatch(npcWrestlers[0], npcWrestlers[1]);
  assert(matchResult.winner, 'Match had a winner');
  assert(matchResult.matchRating > 0, `Match rating: ${matchResult.matchRating.toFixed(1)} stars`);
  console.log(`  Match result: ${matchResult.winner.getComponent('identity').name} won (${matchResult.matchRating.toFixed(1)} stars)`);
  
  // Step 10: Test event generation
  console.log('\nStep 10: Testing event generation...');
  const possibleEvent = eventManager.generateEvents(player, state);
  if (possibleEvent) {
    console.log(`  Generated event: ${possibleEvent.title}`);
    assert(possibleEvent.title, 'Event has a title');
  } else {
    console.log('  No event generated (may be normal depending on player state)');
  }
  
  // Final summary
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${testsPassed + testsFailed}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n✓ All tests passed! Milestone 1 is complete.');
  } else {
    console.log(`\n✗ ${testsFailed} test(s) failed.`);
  }
  
  return {
    passed: testsPassed,
    failed: testsFailed,
    total: testsPassed + testsFailed
  };
}

// Run the test
runIntegrationTest().then(results => {
  console.log('\nTest execution complete.');
  window.testResults = results;
}).catch(error => {
  console.error('Test failed with error:', error);
});

export { runIntegrationTest };
