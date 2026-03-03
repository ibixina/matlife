/**
 * Comprehensive Integration Test Suite
 * Tests all core mechanics, systems, and their interactions.
 */

import { gameStateManager } from '../js/core/GameStateManager.js';
import EntityFactory from '../js/core/EntityFactory.js';
import WorldSimulator from '../js/engine/WorldSimulator.js';
import eventManager from '../js/engine/EventManager.js';
import MatchSimulator from '../js/engine/MatchSimulator.js';
import MatchResultProcessor from '../js/engine/MatchResultProcessor.js';
import ChampionshipSystem from '../js/engine/ChampionshipSystem.js';
import RelationshipManager from '../js/engine/RelationshipManager.js';
import AIPromotionSystem from '../js/engine/AIPromotionSystem.js';
import ContractEngine from '../js/engine/ContractEngine.js';
import InjuryEngine from '../js/engine/InjuryEngine.js';
import LifestyleEngine from '../js/engine/LifestyleEngine.js';

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

async function runComprehensiveTests() {
    console.log('\n=== Mat Life: Comprehensive Integration Tests ===\n');

    try {
        // ---------------------------------------------------------
        // 1. GameState & Initial World Setup
        // ---------------------------------------------------------
        console.log('--- 1. GameState & World Setup ---');

        const formData = {
            name: 'Test Setup Player',
            age: 21,
            hometown: 'Test City',
            gender: 'Male',
            gimmick: 'Test Gimmick',
            alignment: 'Face',
            archetype: 'Technical',
            catchphrase: 'Testing 1 2 3',
            entranceStyle: 'Simple',
            bonusPoints: { technical: 5 }
        };

        // Create player explicitly assigning isPlayer
        const player = EntityFactory.createPlayerWrestler(formData);
        player.isPlayer = true;

        gameStateManager.initializeState({ player });
        const state = gameStateManager.getStateRef();

        assert(state.player.entityId === player.id, 'Player entity correctly set in state');
        assert(player.getComponent('inRingStats').technical >= 21, 'Bonus points correctly applied to technical stat');

        // Create 3 promotions via AIPromotionSystem
        AIPromotionSystem.generateInitialPromotions(state, 3);
        assert(state.promotions.size === 3, 'Generated 3 initial promotions');

        // Check if championships were added
        for (const promotion of state.promotions.values()) {
            ChampionshipSystem.initializePromotionChampionships(promotion);
        }
        assert(state.championships.size > 0, 'Championships initialized across promotions');

        // Give player a contract to the top promotion
        const topPromo = Array.from(state.promotions.values()).sort((a, b) => b.prestige - a.prestige)[0];
        const contractResult = ContractEngine.signContract(player, topPromo, 'midcard', 52, 1000);
        assert(contractResult.success, 'Player successfully signed a contract');
        assert(player.getComponent('contract').promotionId === topPromo.id, 'Player contract reflects correct promotion');
        assert(topPromo.roster.includes(player.id), 'Player added to promotion roster');

        // Generate NPCs for the promotion
        const npc = EntityFactory.generateRandomIndie('USA');
        ContractEngine.signContract(npc, topPromo, 'midcard', 52, 500);
        assert(!npc.isPlayer, 'NPC correctly flagged as non-player');
        assert(topPromo.roster.includes(npc.id), 'NPC added to promotion roster');

        // ---------------------------------------------------------
        // 2. Booking & Title System
        // ---------------------------------------------------------
        console.log('\n--- 2. Booking & Championship System ---');

        const titles = ChampionshipSystem.getPromotionChampionships(topPromo.id);
        assert(titles.length > 0, 'Promotion has championships available');

        const worldTitle = titles.find(t => t.type === 'world');
        assert(worldTitle !== undefined, 'World Title exists');

        // Check title shot eligibility
        player.getComponent('popularity').overness = 100;
        player.getComponent('popularity').momentum = 100;
        player.getComponent('careerStats').consecutiveWins = 10;
        const eligibility = ChampionshipSystem.checkTitleShotEligibility(player, topPromo);
        assert(eligibility.eligible === true, 'Player eligible for title shot with max stats');

        // Manually trigger pending title shot
        player.getComponent('contract').pendingTitleShot = true;
        const matchCard = WorldSimulator._generateShowCard(topPromo, player, state);
        assert(matchCard.isTitleMatch === true, 'Show card generator recognized pending title shot and booked title match');
        assert(matchCard.titleId !== null, 'Match card has valid title ID attached');
        assert(player.getComponent('contract').pendingTitleShot === false, 'Pending title shot flag consumed');

        // ---------------------------------------------------------
        // 3. Match Simulation Engine
        // ---------------------------------------------------------
        console.log('\n--- 3. Match Simulation Engine ---');

        const sim = new MatchSimulator();
        const simState = sim.startMatch(matchCard);

        assert(simState.phase === 'Feeling Out', 'Match starts in Feeling Out phase');
        assert(simState.wrestler1.health === 100, 'Wrestlers start at 100 health');

        // Simulate a turn
        const move = sim.getAvailableMoves(player)[0];
        const turnResult = sim.simulateTurn('wrestler1', move);

        assert(turnResult.error === undefined, 'Turn simulated without errors');
        assert(sim.matchState.turn === 2, 'Turn counter incremented');
        assert(sim.matchState.wrestler1.stamina < 100, 'Stamina consumed during move');

        // Verify fast-forward finish logic
        // We'll advance the turn to finish phase and drop health to force an end
        sim.matchState.turn = 10;
        assert(sim.getCurrentPhase().name === 'The Finish', 'Correctly transitioned phase based on turns');

        sim.matchState.wrestler2.stamina = 5; // Drop opponent stamina so pin won't fail
        const pinResult = sim.attemptPin('wrestler1');
        assert(pinResult.matchEnded, 'Pin attempt succeeded on exhausted opponent');
        assert(sim.matchState.finished, 'Match marked as finished');
        assert(sim.matchState.winner === 'wrestler1', 'Player wins the simulated match');

        // ---------------------------------------------------------
        // 4. Match Result Processing (Post-Match)
        // ---------------------------------------------------------
        console.log('\n--- 4. Match Result Processor ---');

        // Test the MatchResultProcessor explicitly
        MatchResultProcessor.processMatchResult(
            { ...matchCard, turn: sim.matchState.turn },
            player,
            npc,
            sim.matchState.matchRating
        );

        const pPopularity = player.getComponent('popularity');
        const npcPopularity = npc.getComponent('popularity');
        const pCareer = player.getComponent('careerStats');

        assert(pCareer.totalWins === 1, 'Player career stats updated with win');
        // Overness was maxed at 100 earlier, shouldn't exceed 100
        assert(pPopularity.overness <= 100, 'Popularity properly capped at 100');
        assert(npcPopularity.overness >= 0, 'NPC popularity correctly mitigated');

        // Verify title changed hands
        const updatedTitleInfo = ChampionshipSystem.getChampionshipInfo(matchCard.titleId);
        assert(updatedTitleInfo.currentChampion.name === player.getComponent('identity').name, 'Title successfully changed hands after win');

        // ---------------------------------------------------------
        // 5. Relationships & Feuds
        // ---------------------------------------------------------
        console.log('\n--- 5. Relationships & Feuds ---');

        const relationship = RelationshipManager.getRelationship(player.id, npc.id);
        assert(relationship !== undefined, 'Relationship established after match');
        // Match should have impacted affinity slightly
        assert(typeof relationship.affinity === 'number', 'Affinity has a valid number');

        // ---------------------------------------------------------
        // 6. Injuries & Conditioning
        // ---------------------------------------------------------
        console.log('\n--- 6. Injuries & Conditioning ---');

        InjuryEngine.addInjury(player, 'knee', 2, 'Test Injury');
        const playerCondition = player.getComponent('condition');
        assert(playerCondition.injuries.length === 1, 'Injury correctly applied');
        assert(playerCondition.health < 100, 'Health reduced due to injury application');

        InjuryEngine.processDailyRecovery(player);
        assert(playerCondition.injuries[0].daysRemaining === 1, 'Recovery correctly subtracted a day');

        // ---------------------------------------------------------
        // 7. Contract Expiration During Time Advancement
        // ---------------------------------------------------------
        console.log('\n--- 7. Contract Expiration During Time Advancement ---');

        // Create a new player with a short-term contract
        const testPlayer = EntityFactory.createPlayerWrestler({
            name: 'Contract Test Player',
            age: 22,
            hometown: 'Test Town',
            gender: 'Male',
            gimmick: 'Contract Tester',
            alignment: 'Face',
            archetype: 'Technical',
            bonusPoints: {}
        });
        testPlayer.isPlayer = true;

        // Sign player to a promotion with a 1-week contract
        const testPromotion = Array.from(state.promotions.values())[0];
        ContractEngine.signContract(testPlayer, testPromotion, 'midcard', 1, 500);
        assert(testPlayer.getComponent('contract').remainingWeeks === 1, 'Contract initialized with 1 week remaining');
        assert(testPromotion.roster.includes(testPlayer.id), 'Player added to promotion roster');

        // Simulate a week passing (7 days)
        // Set the calendar to end of week to trigger contract expiration
        state.calendar.day = 6;

        // Tick to trigger weekly processing and contract expiration
        const pendingBefore = WorldSimulator.tick(state);

        // Contract should have expired during the tick
        const playerContract = testPlayer.getComponent('contract');
        const expired = playerContract.promotionId === null && playerContract.remainingWeeks === 0;
        assert(expired, 'Contract expired: promotionId cleared and remainingWeeks is 0');
        assert(!testPromotion.roster.includes(testPlayer.id), 'Player removed from promotion roster after contract expiration');

        // Verify player is now a free agent
        assert(playerContract.promotionId === null, 'Player is now a free agent (no promotionId)');
        assert(playerContract.weeklySalary === 0, 'Weekly salary reset to 0 after expiration');

        // Test that advancing time after expiration doesn't crash
        // This simulates the bug where stale promotion reference was used
        try {
            for (let i = 0; i < 10; i++) {
                WorldSimulator.tick(state);
            }
            assert(true, 'Time advancement works correctly after contract expiration');
        } catch (e) {
            assert(false, `Time advancement crashed after contract expiration: ${e.message}`);
        }

        // Test immediate re-signing after expiration
        const reSignResult = ContractEngine.signContract(testPlayer, testPromotion, 'midcard', 4, 600);
        assert(reSignResult.success, 'Player can re-sign with promotion after expiration');
        assert(testPlayer.getComponent('contract').remainingWeeks === 4, 'New contract has 4 weeks remaining');
        assert(testPromotion.roster.includes(testPlayer.id), 'Player re-added to promotion roster');

        // ---------------------------------------------------------
        // 8. No-Compete Clause Functionality
        // ---------------------------------------------------------
        console.log('\n--- 8. No-Compete Clause Functionality ---');

        // Create player for no-compete test
        const noCompetePlayer = EntityFactory.createPlayerWrestler({
            name: 'NoCompete Test Player',
            age: 23,
            hometown: 'Test City',
            gender: 'Male',
            gimmick: 'NoCompete Tester',
            alignment: 'Heel',
            archetype: 'Brawler',
            bonusPoints: {}
        });
        noCompetePlayer.isPlayer = true;

        // Sign player and then release them to trigger no-compete
        const ncPromotion = Array.from(state.promotions.values())[0];
        ContractEngine.signContract(noCompetePlayer, ncPromotion, 'midcard', 4, 500);
        
        // Set up no-compete clause (4 weeks)
        const ncContract = noCompetePlayer.getComponent('contract');
        ncContract.noCompeteWeeks = 4;
        
        // Release player to activate no-compete
        const releaseResult = ContractEngine.releaseWrestler(noCompetePlayer);
        assert(releaseResult.success, 'Player released successfully');
        assert(ncContract.noCompeteActive === true, 'No-compete clause is active');
        assert(ncContract.noCompeteWeeksRemaining === 4, 'No-compete has 4 weeks remaining');

        // Try to sign new contract while no-compete is active
        const blockedSignResult = ContractEngine.signContract(noCompetePlayer, ncPromotion, 'midcard', 4, 500);
        assert(blockedSignResult.success === false, 'Cannot sign contract while no-compete is active');
        assert(blockedSignResult.error.includes('No-compete'), 'Error message mentions no-compete clause');

        // Simulate 28 days (4 weeks) to let no-compete expire
        for (let i = 0; i < 28; i++) {
            ContractEngine.processNoCompeteDaily(noCompetePlayer);
            
            // Check if no-compete expired
            if (!ncContract.noCompeteActive || ncContract.noCompeteWeeksRemaining <= 0) {
                break;
            }
        }

        assert(ncContract.noCompeteActive === false || ncContract.noCompeteWeeksRemaining <= 0, 
               'No-compete clause expired after daily processing');

        // Now signing should work
        const afterNoCompeteSignResult = ContractEngine.signContract(noCompetePlayer, ncPromotion, 'midcard', 4, 500);
        assert(afterNoCompeteSignResult.success, 'Can sign contract after no-compete expires');

        // ---------------------------------------------------------
        // 9. Burnout Natural Decay
        // ---------------------------------------------------------
        console.log('\n--- 9. Burnout Natural Decay ---');

        const burnoutPlayer = EntityFactory.createPlayerWrestler({
            name: 'Burnout Test Player',
            age: 24,
            hometown: 'Test Town',
            gender: 'Male',
            gimmick: 'Burnout Tester',
            alignment: 'Face',
            archetype: 'Technical',
            bonusPoints: {}
        });
        burnoutPlayer.isPlayer = true;

        // Set high burnout
        const burnoutLifestyle = burnoutPlayer.getComponent('lifestyle');
        burnoutLifestyle.burnout = 80;

        // Process one week
        LifestyleEngine.processWeekly(burnoutPlayer);

        // Burnout should have decreased due to natural decay
        assert(burnoutLifestyle.burnout < 80, `Burnout decreased from 80 to ${burnoutLifestyle.burnout} due to natural decay`);

        // ---------------------------------------------------------
        // 10. Injury Prevents Match Generation
        // ---------------------------------------------------------
        console.log('\n--- 10. Injury Prevents Match Generation ---');

        const injuredPlayer = EntityFactory.createPlayerWrestler({
            name: 'Injured Test Player',
            age: 25,
            hometown: 'Test City',
            gender: 'Male',
            gimmick: 'Injury Tester',
            alignment: 'Face',
            archetype: 'High-Flyer',
            bonusPoints: {}
        });
        injuredPlayer.isPlayer = true;

        // Sign to promotion
        const injPromotion = Array.from(state.promotions.values())[0];
        ContractEngine.signContract(injuredPlayer, injPromotion, 'midcard', 8, 500);

        // Add serious injury (severity 4)
        InjuryEngine.addInjury(injuredPlayer, 'knee', 4, 'Testing injury');

        // Verify injury is serious enough to prevent wrestling
        const playerCondition = injuredPlayer.getComponent('condition');
        const seriousInjuries = playerCondition.injuries.filter(i => i.severity >= 3);
        assert(seriousInjuries.length > 0, 'Player has serious injury');

        // ---------------------------------------------------------
        // 11. Events Stop Time Advancement
        // ---------------------------------------------------------
        console.log('\n--- 11. Events Stop Time Advancement ---');

        // This is primarily a UI test, but we can verify event generation works
        const eventPlayer = EntityFactory.createPlayerWrestler({
            name: 'Event Test Player',
            age: 26,
            hometown: 'Test Town',
            gender: 'Male',
            gimmick: 'Event Tester',
            alignment: 'Heel',
            archetype: 'Brawler',
            bonusPoints: {}
        });
        eventPlayer.isPlayer = true;

        // Load event templates if not already loaded
        if (eventManager.eventTemplates.length === 0) {
            try {
                const eventsResponse = await fetch('./js/data/events.json');
                const eventTemplates = await eventsResponse.json();
                eventManager.loadTemplates(eventTemplates);
            } catch (e) {
                console.log('Note: Could not load events.json, using test templates');
                eventManager.loadTemplates([]);
            }
        }

        // Test that events can be generated
        const generatedEvent = eventManager.generateEvents(eventPlayer, state);
        console.log(`  Event generation ${generatedEvent ? 'successful' : 'returned null'} (may be null based on conditions)`);

    } catch (error) {
        console.error('Test execution critically failed:', error);
        testsFailed++;
    }

    // Final summary
    console.log('\n=== Comprehensive Test Summary ===');
    console.log(`Total assertions: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);

    if (testsFailed === 0) {
        console.log('\n✓ All comprehensive tests passed!');
    } else {
        console.log(`\n✗ ${testsFailed} test(s) failed.`);
    }
}

// Run the test
runComprehensiveTests().then(() => {
    console.log('\nTest execution complete.');
});
