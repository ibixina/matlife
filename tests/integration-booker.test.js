import { gameStateManager } from '../js/core/GameStateManager.js';
import EntityFactory from '../js/core/EntityFactory.js';
import CharacterCreation from '../js/ui/CharacterCreation.js';
import AIPromotionSystem from '../js/engine/AIPromotionSystem.js';
import BookerModeEngine from '../js/engine/BookerModeEngine.js';
import ChampionshipSystem from '../js/engine/ChampionshipSystem.js';
import WorldSimulator from '../js/engine/WorldSimulator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`✓ PASS: ${message}`);
  } else {
    failed += 1;
    console.error(`✗ FAIL: ${message}`);
  }
}

export async function runBookerIntegrationTest() {
  console.log('\n=== Booker Mode Integration Test ===\n');

  const player = EntityFactory.createPlayerBooker({
    bookerName: 'Integration Booker',
    age: 36,
    promotionName: 'Integration Pro',
    promotionRegion: 'USA',
    bookingStyle: 'storyteller',
    productStyle: 'Mixed',
    sandboxMode: false,
    bookerBonusPoints: { creativity: 4, strictness: 3 }
  });
  player.isPlayer = true;

  gameStateManager.initializeState({ playerId: player.id, mode: 'BOOKER' });
  gameStateManager.dispatch('ADD_ENTITY', { entity: player });
  const state = gameStateManager.getStateRef();

  const creator = new CharacterCreation(null);
  AIPromotionSystem.generateInitialPromotions(state, 4);
  creator.generateNPCRosters(state);
  creator.generateFreeAgents(state, 16);

  const promotion = BookerModeEngine.createPlayerPromotion({
    startType: 'custom_indie',
    sandboxMode: false,
    bookingStyle: 'storyteller',
    productStyle: 'Mixed',
    promotionName: 'Integration Pro',
    region: 'USA',
    brandDescription: 'A focused test promotion.'
  }, player, state);

  for (const company of state.promotions.values()) {
    const hasTitles = Array.from(state.championships.values()).some(title => title.promotionId === company.id);
    if (!hasTitles) {
      ChampionshipSystem.initializePromotionChampionships(company);
    }
  }

  assert(state.player.mode === 'BOOKER', 'State initializes in Booker mode');
  assert(state.player.promotionId === promotion.id, 'Player promotion is stored in state');
  assert(promotion.isPlayerPromotion === true, 'Promotion is flagged as player-controlled');
  assert(promotion.roster.length >= 8, 'Starting roster is populated');
  assert(promotion.scoutingReport.length > 0, 'Initial scouting report is generated');

  const bookedShow = BookerModeEngine.autoBookCurrentShow(promotion, state);
  const bookedMatches = bookedShow.booked.filter(slot => slot.slotType === 'match' && slot.participants.length >= 2);
  const bookedSegments = bookedShow.booked.filter(slot => slot.slotType === 'segment' && slot.participants.length >= 1);
  assert(bookedMatches.length >= 3, 'Auto-booker fills multiple match slots');
  assert(bookedSegments.length >= 1, 'Auto-booker fills at least one segment');

  const report = BookerModeEngine.runCurrentShow(promotion, state);
  assert(report.results.length === bookedShow.booked.length, 'Running the show evaluates every slot');
  assert(report.showRating >= 1.2 && report.showRating <= 5.0, 'Show rating stays in bounds');
  assert(report.attendance > 0, 'Show report includes attendance');
  assert(promotion.showHistory.length === 1, 'Completed show is added to history');
  assert(promotion.creative.currentShow.week > state.calendar.absoluteWeek, 'Next show is scheduled for a future week');

  const priorReportCount = promotion.showHistory.length;
  BookerModeEngine.processWeekly(promotion, state);
  assert(promotion.scoutingReport.length > 0, 'Weekly processing refreshes scouting');
  assert(Array.isArray(promotion.pendingComplaints), 'Weekly processing maintains complaint state');

  WorldSimulator.tick(state);
  assert(promotion.showHistory.length === priorReportCount, 'Advancing a day does not duplicate finished shows');

  console.log('\n=== Booker Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('✓ Booker mode integration test passed.');
  } else {
    console.log(`✗ Booker mode integration test failed with ${failed} issue(s).`);
  }
}

runBookerIntegrationTest().then(() => {
  console.log('Booker integration test complete.');
});
