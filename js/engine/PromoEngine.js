/**
 * PromoEngine for Mat Life: Wrestling Simulator
 * Step 4.1 of Implementation Plan
 * Promo battle resolution
 */

import ResolutionEngine from './ResolutionEngine.js';
import RelationshipManager from './RelationshipManager.js';

/**
 * Promo tones and their mechanics
 */
const PROMO_TONES = {
  aggressive: {
    name: 'Aggressive',
    stat: 'charisma',
    secondaryStat: 'brawling',
    dc: 12,
    risk: 'high',
    description: 'High risk, high reward. Uses intimidation. Can escalate to brawl.'
  },
  comedic: {
    name: 'Comedic',
    stat: 'charisma',
    secondaryStat: 'acting',
    dc: 10,
    risk: 'medium',
    description: 'Uses humor. Great for Faces. Falls flat if Acting is low.'
  },
  philosophical: {
    name: 'Philosophical',
    stat: 'micSkills',
    secondaryStat: 'psychology',
    dc: 14,
    risk: 'medium',
    description: 'Emotional/philosophical. The "worked shoot" option. Best for feuds.'
  },
  pandering: {
    name: 'Pandering',
    stat: 'charisma',
    dc: 8,
    risk: 'low',
    description: 'Safe. Cheap pop. Low ceiling but low risk.'
  },
  pipebomb: {
    name: 'Pipebomb',
    stat: 'micSkills',
    secondaryStat: 'charisma',
    dc: 18,
    risk: 'extreme',
    requiresPerk: '[Promo_God]',
    description: 'Extreme risk/reward. Legendary moment or career-damaging failure.'
  }
};

/**
 * PromoEngine - Handles promo segments and battles
 */
export class PromoEngine {
  /**
   * Runs a solo promo
   * @param {Entity} actor - Wrestler cutting the promo
   * @param {string} tone - Promo tone
   * @param {object} context - Additional context
   * @returns {object} Promo result
   */
  static runPromo(actor, tone, context = {}) {
    const toneConfig = PROMO_TONES[tone];
    if (!toneConfig) {
      return { error: `Unknown promo tone: ${tone}` };
    }

    // Check for required perks
    if (toneConfig.requiresPerk && !actor.hasTag(toneConfig.requiresPerk)) {
      return {
        error: `Requires ${toneConfig.requiresPerk} perk`,
        allowed: false
      };
    }

    // Get stats
    const stats = actor.getComponent('entertainmentStats');
    const primaryStat = stats[toneConfig.stat] || 10;
    const secondaryStat = toneConfig.secondaryStat ?
      (actor.getComponent('inRingStats')[toneConfig.secondaryStat] || stats[toneConfig.secondaryStat] || 10) : 0;

    // Calculate effective stat
    const effectiveStat = Math.floor((primaryStat * 0.7) + (secondaryStat * 0.3));

    // Determine advantage/disadvantage
    const promoContext = {
      hasAdvantage: context.hometown || actor.hasTag('[Hot_Streak]'),
      hasDisadvantage: actor.hasTag('[Burned_Out]') || actor.getComponent('condition').mentalHealth < 50
    };

    // Resolve
    const resolution = ResolutionEngine.resolve({
      actor,
      action: 'Cut Promo',
      stat: toneConfig.stat,
      dc: toneConfig.dc,
      context: promoContext
    });

    // Calculate effects
    const result = this.calculatePromoEffects(resolution, toneConfig, actor, context);

    return {
      tone,
      resolution,
      ...result
    };
  }

  /**
   * Runs a promo battle between two wrestlers
   * @param {Entity} actor - Initiating wrestler
   * @param {Entity} target - Opposing wrestler
   * @param {string} actorTone - Actor's tone
   * @param {string} targetTone - Target's tone
   * @returns {object} Promo battle result
   */
  static promoBattle(actor, target, actorTone, targetTone) {
    // Run both promos
    const actorPromo = this.runPromo(actor, actorTone);
    const targetPromo = this.runPromo(target, targetTone);

    if (actorPromo.error || targetPromo.error) {
      return {
        error: actorPromo.error || targetPromo.error,
        actorPromo,
        targetPromo
      };
    }

    // Determine winner based on momentum gained
    const actorMomentum = actorPromo.momentumGained || 0;
    const targetMomentum = targetPromo.momentumGained || 0;

    let winner, loser, margin;

    if (actorMomentum > targetMomentum) {
      winner = actor;
      loser = target;
      margin = actorMomentum - targetMomentum;
    } else if (targetMomentum > actorMomentum) {
      winner = target;
      loser = actor;
      margin = targetMomentum - actorMomentum;
    } else {
      // Draw
      return {
        result: 'draw',
        actorPromo,
        targetPromo,
        narrative: 'Both wrestlers delivered equally compelling promos. The feud heats up!'
      };
    }

    // Apply effects
    const winnerPop = winner.getComponent('popularity');
    const loserPop = loser.getComponent('popularity');

    if (winnerPop) {
      winnerPop.momentum += margin;
      winnerPop.overness += Math.floor(margin / 2);
    }

    if (loserPop) {
      loserPop.momentum -= Math.floor(margin / 2);
    }

    // Generate narrative
    const winnerName = winner.getComponent('identity').name;
    const loserName = loser.getComponent('identity').name;

    let narrative;
    if (margin > 10) {
      narrative = `${winnerName} absolutely destroyed ${loserName} on the mic! The crowd is buzzing!`;
    } else if (margin > 5) {
      narrative = `${winnerName} got the better of ${loserName} in this war of words.`;
    } else {
      narrative = `${winnerName} narrowly won the exchange, but ${loserName} held their own.`;
    }

    return {
      result: 'victory',
      winner,
      loser,
      margin,
      actorPromo,
      targetPromo,
      narrative
    };
  }

  /**
   * Calculates promo effects
   * @private
   */
  static calculatePromoEffects(resolution, toneConfig, actor, context) {
    const identity = actor.getComponent('identity');
    const popularity = actor.getComponent('popularity');

    let momentumGained = 0;
    let overnessGained = 0;
    let narrative = '';
    let consequences = [];

    const name = identity?.name || 'Wrestler';

    switch (resolution.outcome) {
      case 'CRITICAL_SUCCESS':
        momentumGained = 20;
        overnessGained = 10;

        if (toneConfig.risk === 'extreme') {
          narrative = `${name} just cut the promo of a lifetime! The entire industry is talking about it!`;
          // Pipebomb special effect
          consequences.push({ type: 'viral', value: true });
        } else {
          narrative = `${name} delivers an incredible ${toneConfig.name.toLowerCase()} promo! The crowd is eating out of their hand!`;
        }
        break;

      case 'SUCCESS':
        momentumGained = 10;
        overnessGained = 5;
        narrative = `${name}'s ${toneConfig.name.toLowerCase()} promo connects with the audience.`;
        break;

      case 'FAILURE':
        momentumGained = 0;
        overnessGained = -2;
        narrative = `${name}'s promo falls a bit flat. The crowd isn't feeling it.`;

        // Comedic failure is worse
        if (toneConfig.name === 'Comedic') {
          narrative = `${name} tries to be funny... awkward silence. The bit bombs.`;
          overnessGained = -5;
        }
        break;

      case 'CRITICAL_FAILURE':
        momentumGained = -10;
        overnessGained = -5;
        narrative = `${name} completely botches the promo. It's painful to watch.`;

        if (toneConfig.risk === 'extreme') {
          narrative = `${name}'s pipebomb goes horribly wrong. This could hurt their career.`;
          overnessGained = -15;
          consequences.push({ type: 'backstage_heat', value: 20 });
        }
        break;
    }

    // Check for escalation (aggressive promos)
    if (toneConfig.name === 'Aggressive' && resolution.outcome === 'SUCCESS') {
      if (Math.random() < 0.3) {
        consequences.push({ type: 'brawl', value: true });
        narrative += ' The promo gets heated and erupts into a brawl!';
      }
    }

    // Apply changes
    if (popularity) {
      popularity.momentum = Math.max(0, Math.min(100, popularity.momentum + momentumGained));
      popularity.overness = Math.max(0, Math.min(100, popularity.overness + overnessGained));
    }

    // Grant charisma XP for successful promos
    const entertainmentStats = actor.getComponent('entertainmentStats');
    if (entertainmentStats && (resolution.outcome === 'SUCCESS' || resolution.outcome === 'CRITICAL_SUCCESS')) {
      const charismaGain = resolution.outcome === 'CRITICAL_SUCCESS' ? 0.5 : 0.2;
      entertainmentStats.charisma = Math.min(20, entertainmentStats.charisma + charismaGain);
    }

    // Burnout cost for promos
    const lifestyle = actor.getComponent('lifestyle');
    if (lifestyle) {
      const burnoutCost = toneConfig.risk === 'extreme' ? 5 : toneConfig.risk === 'high' ? 3 : 2;
      lifestyle.burnout = Math.min(100, (lifestyle.burnout || 0) + burnoutCost);
    }

    return {
      narrative,
      momentumGained,
      overnessGained,
      charismaGained: (resolution.outcome === 'SUCCESS' || resolution.outcome === 'CRITICAL_SUCCESS') ?
        (resolution.outcome === 'CRITICAL_SUCCESS' ? 0.5 : 0.2) : 0,
      consequences
    };
  }

  /**
   * Gets available promo tones for a wrestler
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object[]} Available tones
   */
  static getAvailableTones(wrestler) {
    if (!wrestler || typeof wrestler.hasTag !== 'function') {
      return [];
    }
    return Object.entries(PROMO_TONES).map(([key, config]) => ({
      key,
      ...config,
      available: !config.requiresPerk || wrestler.hasTag(config.requiresPerk)
    }));
  }

  /**
   * Generates promo text templates
   * @param {string} tone - Promo tone
   * @param {Entity} wrestler - Wrestler
   * @param {Entity} [target] - Target wrestler (optional)
   * @returns {string} Generated promo text
   */
  static generatePromoText(tone, wrestler, target) {
    const templates = {
      aggressive: [
        "You want to step in the ring with me? You're gonna regret it!",
        "I'm the best there is, the best there was, and the best there ever will be!",
        "You think you can take me? I'll show you why they call me the {gimmick}!",
        "This Sunday, I'm going to END you!"
      ],
      comedic: [
        "I'm not saying I'm the best, but have you seen these abs?",
        "My opponent is so slow, they make dial-up internet look fast!",
        "I walked into a bar... and the bar moved out of my way!",
        "They say wrestling is fake, but my opponent's talent is faker!"
      ],
      philosophical: [
        "In this business, you either adapt or you perish. I've chosen to evolve.",
        "This isn't just about titles. It's about legacy, about what we leave behind.",
        "Every match is a story. This Sunday, I write the final chapter.",
        "The ring is my canvas, and violence is my art."
      ],
      pandering: [
        "I love this city! You fans are the best in the world!",
        "Give me a hell yeah!",
        "Let's hear it for {city}!",
        "I couldn't do this without each and every one of you!"
      ],
      pipebomb: [
        "I'm not here to play by your rules. I'm here to break the system.",
        "You people in the back, you think you control us? Watch me.",
        "This is real life, not your scripted nonsense. I'm taking over.",
        "I see the politics, the games. And I'm done playing."
      ]
    };

    const toneTemplates = templates[tone] || templates.pandering;
    let text = toneTemplates[Math.floor(Math.random() * toneTemplates.length)];

    // Replace placeholders
    const identity = wrestler.getComponent('identity');
    text = text.replace('{gimmick}', identity?.gimmick || 'Wrestler');
    text = text.replace('{city}', identity?.hometown?.split(',')[0] || 'this town');

    if (target) {
      const targetName = target.getComponent('identity').name;
      text = text.replace('{opponent}', targetName);
    }

    return text;
  }
}

export default PromoEngine;
