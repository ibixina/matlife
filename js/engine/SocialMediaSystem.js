/**
 * Social Media System for Mat Life: Wrestling Simulator
 * Step 4.3 of Implementation Plan
 */

import { gameStateManager } from '../core/GameStateManager.js';
import ResolutionEngine from './ResolutionEngine.js';
import { randomInt, clamp } from '../core/Utils.js';

/**
 * Post types and their mechanics
 */
const POST_TYPES = {
  kayfabe: {
    name: 'Kayfabe',
    description: 'In-character post. Safe, builds wrestling persona.',
    risk: 0,
    followerGrowth: 'low',
    stat: 'charisma',
    dc: 8
  },
  personal: {
    name: 'Personal',
    description: 'Out of character. Builds fan connection but has scandal risk.',
    risk: 15,
    followerGrowth: 'medium',
    stat: 'charisma',
    dc: 10
  },
  controversial: {
    name: 'Controversial',
    description: 'Hot take or divisive opinion. High risk/reward.',
    risk: 40,
    followerGrowth: 'high',
    stat: 'charisma',
    dc: 14
  },
  viral: {
    name: 'Viral Moment',
    description: 'Attempt to create viral content. Extreme risk/reward.',
    risk: 60,
    followerGrowth: 'extreme',
    stat: 'charisma',
    dc: 16
  }
};

/**
 * SocialMediaSystem - Handles social media interactions
 */
export class SocialMediaSystem {
  /**
   * Posts to social media
   * @param {Entity} wrestler - Wrestler entity
   * @param {string} postType - Type of post
   * @param {string} [content] - Post content (optional)
   * @returns {object} Post result
   */
  static post(wrestler, postType, content = '') {
    const typeConfig = POST_TYPES[postType];
    if (!typeConfig) {
      return { error: `Unknown post type: ${postType}` };
    }

    const socialMedia = wrestler.getComponent('socialMedia');
    const stats = wrestler.getComponent('entertainmentStats');
    
    if (!socialMedia) {
      return { error: 'No social media component' };
    }

    // Resolution check for personal/controversial posts
    let resolution = null;
    let scandal = false;
    
    if (typeConfig.risk > 0) {
      resolution = ResolutionEngine.resolve({
        actor: wrestler,
        action: 'Social Media Post',
        stat: typeConfig.stat,
        dc: typeConfig.dc,
        context: {
          hasDisadvantage: socialMedia.scandalRisk > 50
        }
      });

      // Check for scandal
      if (resolution.outcome === 'CRITICAL_FAILURE' || 
          (resolution.outcome === 'FAILURE' && Math.random() * 100 < typeConfig.risk)) {
        scandal = true;
        socialMedia.scandalRisk += typeConfig.risk;
      }
    }

    // Calculate follower growth
    const growth = this.calculateFollowerGrowth(wrestler, typeConfig, resolution);
    
    // Apply growth
    const oldFollowers = socialMedia.followers;
    socialMedia.followers += growth;
    
    // Track post frequency
    socialMedia.postFrequency = 'active';
    socialMedia.lastPostWeek = gameStateManager.getStateRef().calendar?.absoluteWeek || 0;

    // Generate narrative
    const narrative = this.generatePostNarrative(wrestler, postType, resolution, scandal, growth);

    // Log the post
    gameStateManager.dispatch('ADD_LOG_ENTRY', {
      entry: {
        category: 'personal',
        text: narrative,
        type: 'social',
        followers: socialMedia.followers
      }
    });

    // If scandal, add tag and log
    if (scandal) {
      wrestler.addTag('[Scandal]');
      gameStateManager.dispatch('ADD_LOG_ENTRY', {
        entry: {
          category: 'personal',
          text: 'The post has sparked controversy! Scandal risk increased.',
          type: 'scandal'
        }
      });
    }

    return {
      postType,
      resolution,
      scandal,
      followerGrowth: growth,
      totalFollowers: socialMedia.followers,
      narrative
    };
  }

  /**
   * Calculates follower growth
   * @private
   */
  static calculateFollowerGrowth(wrestler, typeConfig, resolution) {
    const socialMedia = wrestler.getComponent('socialMedia');
    const popularity = wrestler.getComponent('popularity');
    
    let baseGrowth = 0;
    
    // Base growth by type
    switch (typeConfig.followerGrowth) {
      case 'low': baseGrowth = randomInt(10, 50); break;
      case 'medium': baseGrowth = randomInt(50, 150); break;
      case 'high': baseGrowth = randomInt(100, 500); break;
      case 'extreme': baseGrowth = randomInt(500, 2000); break;
    }

    // Modifiers
    const overnessMod = (popularity?.overness || 5) / 10;
    baseGrowth = Math.floor(baseGrowth * overnessMod);

    // Resolution modifier
    if (resolution) {
      switch (resolution.outcome) {
        case 'CRITICAL_SUCCESS': baseGrowth *= 3; break;
        case 'SUCCESS': baseGrowth *= 1.5; break;
        case 'FAILURE': baseGrowth *= 0.5; break;
        case 'CRITICAL_FAILURE': baseGrowth = 0; break;
      }
    }

    // Diminishing returns for frequent posters
    const currentFollowers = socialMedia?.followers || 0;
    if (currentFollowers > 10000) {
      baseGrowth = Math.floor(baseGrowth * 0.5);
    }

    return Math.floor(baseGrowth);
  }

  /**
   * Generates post narrative
   * @private
   */
  static generatePostNarrative(wrestler, postType, resolution, scandal, growth) {
    const identity = wrestler.getComponent('identity');
    const name = identity?.name || 'Wrestler';

    const templates = {
      kayfabe: [
        `${name} posted about their upcoming match. Fans are hyped!`,
        `${name} shared a training video. Looking sharp!`,
        `${name} cut a promo on social media. The feud heats up!`
      ],
      personal: [
        `${name} shared a personal story. Fans connect with the real person.`,
        `${name} posted about their family. Heartwarming content.`,
        `${name} gives fans a behind-the-scenes look at their life.`
      ],
      controversial: [
        `${name} posted a hot take! The internet is divided.`,
        `${name} speaks their mind on a controversial topic.`,
        `${name} calls out the industry establishment! Bold move!`
      ],
      viral: [
        `${name} attempts a viral challenge!`,
        `${name} posts something shocking! Will it trend?`,
        `${name} is going for viral fame with this post!`
      ]
    };

    let narrative = templates[postType][randomInt(0, 2)];

    if (resolution) {
      if (resolution.outcome === 'CRITICAL_SUCCESS') {
        narrative += ' The post absolutely EXPLODES! Viral sensation!';
      } else if (resolution.outcome === 'SUCCESS') {
        narrative += ' Good engagement from fans.';
      } else if (resolution.outcome === 'FAILURE') {
        narrative += ' The post gets some attention, but not much.';
      } else if (resolution.outcome === 'CRITICAL_FAILURE') {
        narrative += ' The post backfires. Fans are roasting them in the comments.';
      }
    }

    if (growth > 0) {
      narrative += ` (+${growth} followers)`;
    }

    return narrative;
  }

  /**
   * Processes weekly decay
   * @param {Entity} wrestler - Wrestler entity
   */
  static processWeekly(wrestler) {
    const socialMedia = wrestler.getComponent('socialMedia');
    if (!socialMedia) return;

    // Decay scandal risk
    if (socialMedia.scandalRisk > 0) {
      socialMedia.scandalRisk = Math.max(0, socialMedia.scandalRisk - 5);
    }

    // Remove scandal tag if risk is low
    if (socialMedia.scandalRisk < 20 && wrestler.hasTag('[Scandal]')) {
      wrestler.removeTag('[Scandal]');
    }

    // Check for inactive account penalty
    const currentWeek = gameStateManager.getStateRef().calendar?.absoluteWeek || 0;
    const weeksSincePost = currentWeek - (socialMedia.lastPostWeek || 0);
    
    if (weeksSincePost > 4) {
      // Inactive penalty
      const loss = Math.floor(socialMedia.followers * 0.01);
      socialMedia.followers -= loss;
      
      if (weeksSincePost === 5) {
        gameStateManager.dispatch('ADD_LOG_ENTRY', {
          entry: {
            category: 'personal',
            text: `Social media inactivity causing follower loss (-${loss})`,
            type: 'social'
          }
        });
      }
    }
  }

  /**
   * Gets post types available to wrestler
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object[]} Available post types
   */
  static getAvailablePostTypes(wrestler) {
    return Object.entries(POST_TYPES).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * Gets social media summary
   * @param {Entity} wrestler - Wrestler entity
   * @returns {object} Summary
   */
  static getSummary(wrestler) {
    const socialMedia = wrestler.getComponent('socialMedia');
    if (!socialMedia) return null;

    return {
      followers: socialMedia.followers,
      postFrequency: socialMedia.postFrequency,
      scandalRisk: socialMedia.scandalRisk,
      hasScandal: wrestler.hasTag('[Scandal]'),
      tier: this.getFollowerTier(socialMedia.followers)
    };
  }

  /**
   * Gets follower tier
   * @private
   */
  static getFollowerTier(followers) {
    if (followers >= 1000000) return 'Mega Star';
    if (followers >= 500000) return 'Major Star';
    if (followers >= 100000) return 'Star';
    if (followers >= 50000) return 'Rising Star';
    if (followers >= 10000) return 'Known';
    if (followers >= 1000) return 'Growing';
    return 'Unknown';
  }
}

export default SocialMediaSystem;
