const fs = require('fs');
const path = require('path');

const eventsPath = path.join(__dirname, '..', 'js', 'data', 'events.json');
const raw = fs.readFileSync(eventsPath, 'utf8');
const existing = JSON.parse(raw);

const baseEvents = existing.filter(e => !String(e.id || '').startsWith('exp_'));

const randFrom = (arr, i) => arr[i % arr.length];

function checkedOutcomes(i, good = 'The move pays off and shifts momentum in your favor.', bad = 'The gamble misses and creates new problems.') {
  const statOptions = [
    { type: 'stat', component: 'popularity', stat: 'overness', value: 4 },
    { type: 'stat', component: 'popularity', stat: 'momentum', value: 8 },
    { type: 'stat', component: 'lifestyle', stat: 'burnout', value: -8 },
    { type: 'money', value: 1200 }
  ];
  const failOptions = [
    { type: 'stat', component: 'popularity', stat: 'momentum', value: -6 },
    { type: 'stat', component: 'lifestyle', stat: 'burnout', value: 6 },
    { type: 'money', value: -700 },
    { type: 'stat', component: 'condition', stat: 'mentalHealth', value: -5 }
  ];

  return {
    critSuccess: {
      narrative: `${good} You overdeliver and become a talking point all week.`,
      effects: [statOptions[i % statOptions.length], { type: 'stat', component: 'popularity', stat: 'momentum', value: 10 }]
    },
    success: {
      narrative: good,
      effects: [statOptions[(i + 1) % statOptions.length]]
    },
    failure: {
      narrative: bad,
      effects: [failOptions[i % failOptions.length]]
    },
    critFailure: {
      narrative: `${bad} The fallout is immediate and public.`,
      effects: [failOptions[(i + 1) % failOptions.length], { type: 'stat', component: 'popularity', stat: 'overness', value: -3 }]
    }
  };
}

function makeContextEvents() {
  const contexts = [
    {
      key: 'free_agent',
      titleBase: 'Independent Grind',
      req: { requiresContract: false },
      descriptions: ['A local promoter offers a risky opportunity with upside.', 'A regional show wants you in a high-pressure spot.', 'An indie partner asks for a favor that could raise your profile.']
    },
    {
      key: 'contracted',
      titleBase: 'Locker Room Politics',
      req: { requiresContract: true },
      descriptions: ['A production decision puts you in a political crossfire backstage.', 'A veteran tests your professionalism in front of management.', 'A producer quietly asks for your read on the card.']
    },
    {
      key: 'champion',
      titleBase: 'Champion Pressure',
      req: { isChampion: true },
      descriptions: ['Media pressure rises as your title reign gets more attention.', 'Management asks you to carry extra promotional load as champion.', 'A challenger campaign starts gaining traction online.']
    },
    {
      key: 'feud',
      titleBase: 'Feud Escalation',
      req: { activeFeud: true },
      descriptions: ['Tension spills into pre-show production meetings.', 'Your rival baits you with a public shot at your credibility.', 'Security has to separate both camps after rehearsal.']
    },
    {
      key: 'burnout',
      titleBase: 'Fatigue Spiral',
      req: { minBurnout: 60 },
      descriptions: ['Your body is sending clear warning signs before call time.', 'Sleep debt starts affecting your reaction speed and focus.', 'You feel yourself dragging through drills and media obligations.']
    },
    {
      key: 'injury',
      titleBase: 'Playing Hurt',
      req: { hasInjury: true },
      descriptions: ['Medical staff recommends a conservative approach for tonight.', 'Your injury gets noticed by people who can affect your push.', 'A trainer offers a short-term workaround with long-term risk.']
    },
    {
      key: 'hot',
      titleBase: 'White-Hot Momentum',
      req: { minOverness: 70, minMomentum: 65 },
      descriptions: ['You are trending and every decision gets amplified.', 'Sponsors want appearances and your schedule gets crowded.', 'Creative has three different directions for your character this week.']
    },
    {
      key: 'slump',
      titleBase: 'Creative Slump',
      req: { maxMomentum: 35 },
      descriptions: ['Management asks whether you can reinvent quickly.', 'A weak segment has people questioning your current direction.', 'Agents and scouts see this as a pivot moment for your career.']
    },
    {
      key: 'low_cash',
      titleBase: 'Money Crunch',
      req: { maxBankBalance: 800 },
      descriptions: ['Bills stack up and every decision now has a cash impact.', 'A short-term payday appears, but the terms are ugly.', 'You need income this week and your options are not ideal.']
    },
    {
      key: 'wealth',
      titleBase: 'Leverage Window',
      req: { minBankBalance: 12000 },
      descriptions: ['You can afford to play the long game on negotiations.', 'Your financial cushion lets you reject low-value asks.', 'People around you start bringing premium opportunities.']
    },
    {
      key: 'face',
      titleBase: 'Hero Optics',
      req: { alignmentIn: ['Face'] },
      descriptions: ['Fans expect you to lead by example in a tense moment.', 'A charity appearance conflicts with your recovery plan.', 'A locker-room dispute needs a respected voice to settle it.']
    },
    {
      key: 'heel',
      titleBase: 'Villain Heat',
      req: { alignmentIn: ['Heel'] },
      descriptions: ['Production wants you to push the crowd reaction harder.', 'A sponsor questions whether your character is too volatile.', 'A segment gives you a chance to generate serious heat.']
    },
    {
      key: 'tech_skill',
      titleBase: 'In-Ring Specialist',
      req: { minRingAvg: 78 },
      descriptions: ['A high-workrate match is offered with strong upside.', 'Coaches want you to mentor someone ahead of a major card.', 'Your drills are drawing praise from veterans backstage.']
    }
  ];

  const actions = [
    { text: 'Take the aggressive route', stat: 'charisma', dc: 13 },
    { text: 'Play it safe and protect value', stat: 'psychology', dc: 12 },
    { text: 'Make a bold public statement', stat: 'micSkills', dc: 14 },
    { text: 'Handle it quietly behind the scenes', stat: 'acting', dc: 11 }
  ];

  const conservativeNarratives = [
    'You stabilize the situation and keep options open.',
    'You avoid unnecessary risk and maintain trust.',
    'You keep your profile steady while minimizing downside.'
  ];

  const generated = [];
  let idx = 0;

  for (const ctx of contexts) {
    for (let i = 0; i < 18; i++) {
      const a = actions[(i + idx) % actions.length];
      const id = `exp_${ctx.key}_${String(i + 1).padStart(3, '0')}`;
      const title = `${ctx.titleBase} ${i + 1}`;
      const description = randFrom(ctx.descriptions, i + idx);

      generated.push({
        id,
        title,
        weight: 2 + (i % 3),
        cooldownWeeks: 6 + (i % 5),
        requirements: ctx.req,
        choices: [
          {
            text: a.text,
            check: { stat: a.stat, dc: a.dc },
            outcomes: checkedOutcomes(i + idx)
          },
          {
            text: 'Take the conservative option',
            outcomes: {
              success: {
                narrative: randFrom(conservativeNarratives, i),
                effects: [{ type: 'stat', component: 'popularity', stat: 'momentum', value: 2 }]
              }
            }
          },
          {
            text: 'Decline involvement',
            outcomes: {
              success: {
                narrative: 'You step back and avoid immediate risk, but miss potential upside.',
                effects: [{ type: 'stat', component: 'popularity', stat: 'overness', value: -1 }]
              }
            }
          }
        ],
        description
      });
      idx++;
    }
  }

  return generated;
}

function makeArcEvents() {
  const arcNames = [
    'Network Deal', 'Locker Revolt', 'Brand Pivot', 'Press Investigation', 'Mentor Betrayal',
    'Production Coup', 'Sponsor Crisis', 'Gym Alliance', 'Manager Power Play', 'Stolen Finish',
    'Contract Leak', 'Comeback Tour', 'Faction Proposal', 'Travel Meltdown', 'Medical Controversy',
    'Fan Backlash', 'Media War', 'Title Committee', 'Veteran Ultimatum', 'Rookie Movement',
    'Streaming Pitch', 'Docuseries Access', 'Training Camp Rift', 'Agent Conflict', 'Boardroom Split',
    'Main Event Vote', 'Talent Exchange', 'Venue Breakdown', 'Commentary Feud', 'Cross-Promo Standoff'
  ];

  const generated = [];

  for (let i = 0; i < arcNames.length; i++) {
    const key = `arc_${String(i + 1).padStart(2, '0')}`;
    const stage1 = `${key}_s1`; 
    const stage2 = `${key}_s2`;
    const done = `${key}_done`;

    generated.push({
      id: `exp_${key}_stage1`,
      title: `${arcNames[i]} - Opening Move`,
      weight: 2,
      cooldownWeeks: 8,
      requirements: {
        excludesFlags: [done],
        minOverness: i % 2 === 0 ? 35 : 20
      },
      choices: [
        {
          text: 'Commit to the long play',
          check: { stat: 'charisma', dc: 12 + (i % 3) },
          outcomes: {
            critSuccess: {
              narrative: 'You secure early leverage and establish control over the arc.',
              effects: [
                { type: 'event_flag', flag: stage1, action: 'set' },
                { type: 'stat', component: 'popularity', stat: 'momentum', value: 10 }
              ]
            },
            success: {
              narrative: 'You open the arc with favorable positioning.',
              effects: [
                { type: 'event_flag', flag: stage1, action: 'set' },
                { type: 'stat', component: 'popularity', stat: 'momentum', value: 5 }
              ]
            },
            failure: {
              narrative: 'You hesitate, and rivals get first strike.',
              effects: [{ type: 'stat', component: 'popularity', stat: 'momentum', value: -4 }]
            },
            critFailure: {
              narrative: 'Your opening move backfires publicly.',
              effects: [
                { type: 'stat', component: 'popularity', stat: 'overness', value: -4 },
                { type: 'stat', component: 'lifestyle', stat: 'burnout', value: 8 }
              ]
            }
          }
        },
        {
          text: 'Keep it quiet for now',
          outcomes: {
            success: {
              narrative: 'You hold position and gather more information.',
              effects: [{ type: 'stat', component: 'popularity', stat: 'momentum', value: 1 }]
            }
          }
        }
      ],
      description: `A new storyline thread opens: ${arcNames[i]}. Early choices will shape later outcomes.`
    });

    generated.push({
      id: `exp_${key}_stage2`,
      title: `${arcNames[i]} - Escalation`,
      weight: 2,
      cooldownWeeks: 8,
      requirements: {
        requiresFlags: [stage1],
        excludesFlags: [done]
      },
      choices: [
        {
          text: 'Escalate and force resolution',
          check: { stat: 'micSkills', dc: 13 + (i % 2) },
          outcomes: {
            success: {
              narrative: 'The conflict escalates on your terms.',
              effects: [
                { type: 'event_flag', flag: stage2, action: 'set' },
                { type: 'stat', component: 'popularity', stat: 'overness', value: 4 }
              ]
            },
            failure: {
              narrative: 'The escalation stalls and costs you momentum.',
              effects: [{ type: 'stat', component: 'popularity', stat: 'momentum', value: -5 }]
            }
          }
        },
        {
          text: 'Backchannel compromise',
          outcomes: {
            success: {
              narrative: 'You negotiate partial control and avoid major fallout.',
              effects: [
                { type: 'event_flag', flag: stage2, action: 'set' },
                { type: 'money', value: 500 }
              ]
            }
          }
        }
      ],
      description: `The ${arcNames[i]} thread reaches a tipping point.`
    });

    generated.push({
      id: `exp_${key}_stage3`,
      title: `${arcNames[i]} - Finale`,
      weight: 2,
      cooldownWeeks: 10,
      requirements: {
        requiresFlags: [stage2],
        excludesFlags: [done]
      },
      choices: [
        {
          text: 'Go for the decisive finish',
          check: { stat: 'charisma', dc: 14 },
          outcomes: {
            critSuccess: {
              narrative: 'You close the arc with maximum impact and major leverage.',
              effects: [
                { type: 'event_flag', flag: done, action: 'set' },
                { type: 'event_flag', flag: stage1, action: 'clear' },
                { type: 'event_flag', flag: stage2, action: 'clear' },
                { type: 'stat', component: 'popularity', stat: 'overness', value: 8 },
                { type: 'money', value: 2500 }
              ]
            },
            success: {
              narrative: 'You finish the arc cleanly and come out ahead.',
              effects: [
                { type: 'event_flag', flag: done, action: 'set' },
                { type: 'event_flag', flag: stage1, action: 'clear' },
                { type: 'event_flag', flag: stage2, action: 'clear' },
                { type: 'stat', component: 'popularity', stat: 'momentum', value: 8 }
              ]
            },
            failure: {
              narrative: 'The finish falls flat, but the chapter closes.',
              effects: [
                { type: 'event_flag', flag: done, action: 'set' },
                { type: 'event_flag', flag: stage1, action: 'clear' },
                { type: 'event_flag', flag: stage2, action: 'clear' },
                { type: 'stat', component: 'popularity', stat: 'momentum', value: -4 }
              ]
            },
            critFailure: {
              narrative: 'The finale implodes and leaves scars across the locker room.',
              effects: [
                { type: 'event_flag', flag: done, action: 'set' },
                { type: 'event_flag', flag: stage1, action: 'clear' },
                { type: 'event_flag', flag: stage2, action: 'clear' },
                { type: 'stat', component: 'popularity', stat: 'overness', value: -6 },
                { type: 'stat', component: 'condition', stat: 'mentalHealth', value: -8 }
              ]
            }
          }
        },
        {
          text: 'Take the safe ending',
          outcomes: {
            success: {
              narrative: 'You close the issue quietly and preserve stability.',
              effects: [
                { type: 'event_flag', flag: done, action: 'set' },
                { type: 'event_flag', flag: stage1, action: 'clear' },
                { type: 'event_flag', flag: stage2, action: 'clear' },
                { type: 'stat', component: 'popularity', stat: 'momentum', value: 3 }
              ]
            }
          }
        }
      ],
      description: `The ${arcNames[i]} storyline reaches its final decision point.`
    });
  }

  return generated;
}

const expanded = [...baseEvents, ...makeContextEvents(), ...makeArcEvents()];
fs.writeFileSync(eventsPath, JSON.stringify(expanded, null, 2) + '\n', 'utf8');

console.log(`Base events: ${baseEvents.length}`);
console.log(`Generated events: ${expanded.length - baseEvents.length}`);
console.log(`Total events: ${expanded.length}`);
