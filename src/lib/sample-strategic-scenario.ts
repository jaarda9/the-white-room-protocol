import { SocialScenario } from './types';

export const STRATEGIC_MANIPULATION_SCENARIO: SocialScenario = {
  id: 'strategic-manipulation-01',
  title: 'The Information Broker',
  description: 'A powerful competitor seeks your alliance. Use Ayanokoji-style manipulation tactics to gain the upper hand.',
  difficulty: 4,
  xp: 250,
  hiddenRewards: {
    INT: 3,
    PER: 2,
    WIS: 3
  },
  context: 'You\'ve been approached by a rival company CEO who wants to discuss a potential merger. Your goal is to extract maximum value while maintaining strategic control.',
  initialNodeId: 'opening',
  nodes: {
    opening: {
      id: 'opening',
      speaker: 'CEO Marcus',
      text: '"Thank you for meeting me. I\'ll be direct - your company has something we need, and we have resources you could use. Let\'s discuss terms."',
      context: 'Conference room. Marcus maintains eye contact, confident posture.',
      choices: [
        {
          id: 'appear-eager',
          text: '"I appreciate your directness. What exactly are you proposing?"',
          nextNodeId: 'weak-position',
          skillCheck: { attribute: 'PER', difficulty: 1 }
        },
        {
          id: 'create-uncertainty',
          text: '"I\'m curious what brought you to me specifically. You have other options, don\'t you?"',
          nextNodeId: 'leverage-position',
          skillCheck: { attribute: 'INT', difficulty: 2 }
        },
        {
          id: 'establish-frame',
          text: '[Pause briefly, then smile] "Before we discuss anything, help me understand - what timeline are you working with?"',
          nextNodeId: 'control-position',
          skillCheck: { attribute: 'WIS', difficulty: 3 }
        }
      ],
      hiddenCues: [
        'Marcus shifted weight slightly when mentioning "resources" - possible weakness in their position',
        'The word "need" indicates urgency on their end',
        'He\'s seeking validation by mentioning your company first'
      ],
      isEndNode: false
    },

    'weak-position': {
      id: 'weak-position',
      speaker: 'CEO Marcus',
      text: '"Perfect. We\'re prepared to offer a 40-60 split in our favor, given our larger market presence. This is a generous starting point."',
      context: 'Marcus leans back, more relaxed now.',
      choices: [
        {
          id: 'accept-frame',
          text: '"That seems reasonable. Let\'s discuss the details."',
          nextNodeId: 'bad-ending'
        },
        {
          id: 'challenge-frame',
          text: '"I notice you said \'starting point.\' What factors would change that split?"',
          nextNodeId: 'recovery-attempt'
        }
      ],
      hiddenCues: [
        'He immediately proposed unfavorable terms - testing your boundaries',
        'His body language became more dominant after your eager response'
      ],
      isEndNode: false
    },

    'leverage-position': {
      id: 'leverage-position',
      speaker: 'CEO Marcus',
      text: '[Slight pause] "Well, your tech stack is unique. But you\'re right - we\'ve spoken to others. None with your specific capabilities though."',
      context: 'Marcus adjusts his collar - subtle discomfort.',
      choices: [
        {
          id: 'press-advantage',
          text: '[Lean back casually] "I see. And these \'capabilities\' - how critical are they to your timeline?"',
          nextNodeId: 'strong-position',
          skillCheck: { attribute: 'INT', difficulty: 3 }
        },
        {
          id: 'show-interest',
          text: '"I\'m glad our capabilities align with your needs. What are you thinking for structure?"',
          nextNodeId: 'neutral-position'
        }
      ],
      hiddenCues: [
        'The word "unique" indicates they have limited alternatives',
        'Defensive body language when alternatives mentioned',
        'He\'s trying to maintain appearance of choice while revealing dependency'
      ],
      isEndNode: false
    },

    'control-position': {
      id: 'control-position',
      speaker: 'CEO Marcus',
      text: '[Eyes narrow slightly] "We\'re hoping to finalize within the quarter. Market conditions, you understand."',
      context: 'Marcus mirrors your posture - you\'ve established equal footing.',
      choices: [
        {
          id: 'leverage-timeline',
          text: '"Interesting. That\'s... aggressive. What happens if you miss that window?"',
          nextNodeId: 'strategic-advantage',
          skillCheck: { attribute: 'WIS', difficulty: 4 }
        },
        {
          id: 'offer-timeline',
          text: '"I can work with that timeline. Let\'s discuss what each side brings."',
          nextNodeId: 'good-position'
        }
      ],
      hiddenCues: [
        'The pause before answering indicates the timeline is critical',
        'He\'s trying to frame urgency as market-driven, not company-specific',
        'Your framing shift has made him match your energy - respect established'
      ],
      isEndNode: false
    },

    'strategic-advantage': {
      id: 'strategic-advantage',
      speaker: 'CEO Marcus',
      text: '[Long pause] "... We lose a significant funding opportunity. The investors want to see the merger before they commit."',
      context: 'Marcus broke - revealed the real pressure.',
      choices: [
        {
          id: 'apply-pressure',
          text: '[Nod slowly] "I see. So this isn\'t about market conditions - it\'s about your funding round."',
          nextNodeId: 'optimal-ending',
          skillCheck: { attribute: 'INT', difficulty: 4 }
        },
        {
          id: 'ease-pressure',
          text: '"That\'s understandable. Let\'s structure this so it works for both our timelines."',
          nextNodeId: 'good-ending'
        }
      ],
      hiddenCues: [
        'Complete honesty - you\'ve broken through his negotiation stance',
        'He\'s now dependent on you agreeing quickly',
        'The power dynamic has completely reversed'
      ],
      isEndNode: false
    },

    'strong-position': {
      id: 'strong-position',
      speaker: 'CEO Marcus',
      text: '"[Sighs] Okay, cards on the table. We need your AI infrastructure for our next product line. We\'ve been... unsuccessful replicating it."',
      context: 'Marcus surrenders information - you\'ve gained leverage.',
      choices: [
        {
          id: 'maximize-value',
          text: '"I appreciate the honesty. Given that dependency, I think we need to revisit what fair terms look like here."',
          nextNodeId: 'optimal-ending'
        },
        {
          id: 'fair-deal',
          text: '"Thank you for being direct. Let\'s structure something equitable where both teams can shine."',
          nextNodeId: 'good-ending'
        }
      ],
      hiddenCues: [
        'They\'ve attempted and failed to replicate your tech',
        'Your capabilities are critical path for their strategy',
        'He\'s abandoned negotiation tactics for honest discussion'
      ],
      isEndNode: false
    },

    'optimal-ending': {
      id: 'optimal-ending',
      speaker: 'Narrator',
      text: 'Perfect execution. You\'ve used strategic questioning, timeline leverage, and information control to dominate the negotiation. Marcus agrees to 65-35 in your favor, board representation, and IP protection clauses.',
      context: 'Ayanokoji-level manipulation: complete control without visible aggression.',
      choices: [],
      isEndNode: true
    },

    'good-ending': {
      id: 'good-ending',
      speaker: 'Narrator',
      text: 'Strong performance. You identified pressure points and gained leverage, but chose collaborative resolution. You agree to 50-50 split with strong governance rights and mutual respect established.',
      context: 'Effective strategic positioning with collaborative execution.',
      choices: [],
      isEndNode: true
    },

    'neutral-position': {
      id: 'neutral-position',
      speaker: 'CEO Marcus',
      text: '"We\'re thinking 45-55, our favor, given market position. But we\'re flexible on governance structure."',
      context: 'Standard negotiation continues.',
      choices: [
        {
          id: 'counter-offer',
          text: '"Given our unique capabilities you mentioned, I\'d suggest 55-45 in our favor is more aligned."',
          nextNodeId: 'compromise-ending'
        },
        {
          id: 'accept-structure',
          text: '"Let\'s focus on governance then. What are you thinking?"',
          nextNodeId: 'decent-ending'
        }
      ],
      hiddenCues: [
        'He anchored high but signaled flexibility',
        'Governance is his real priority'
      ],
      isEndNode: false
    },

    'good-position': {
      id: 'good-position',
      speaker: 'CEO Marcus',
      text: '"Agreed. We need your platform architecture. You need our distribution network and capital. I\'m thinking 50-50 partnership with joint board seats."',
      context: 'Honest negotiation established.',
      choices: [
        {
          id: 'accept-fair',
          text: '"That sounds like a solid foundation. Let\'s hammer out the details."',
          nextNodeId: 'good-ending'
        },
        {
          id: 'optimize-terms',
          text: '"50-50 works, but given the critical nature of our tech in your timeline, I\'d want IP protections and first-refusal rights."',
          nextNodeId: 'optimal-ending'
        }
      ],
      hiddenCues: [
        'He\'s offering fair terms immediately',
        'Still opportunity to optimize without appearing greedy'
      ],
      isEndNode: false
    },

    'recovery-attempt': {
      id: 'recovery-attempt',
      speaker: 'CEO Marcus',
      text: '"Fair question. If your metrics are strong, we could adjust. But we\'d need full visibility into your operations."',
      context: 'Attempting to regain control through information requests.',
      choices: [
        {
          id: 'redirect',
          text: '"Let\'s start with high-level strategic fit. What specific capabilities drew you to us?"',
          nextNodeId: 'neutral-position'
        },
        {
          id: 'share-info',
          text: '"I can share some metrics. What specifically would you need to see?"',
          nextNodeId: 'decent-ending'
        }
      ],
      hiddenCues: [
        'He\'s trying to shift to information extraction',
        'Full visibility request is excessive for this stage'
      ],
      isEndNode: false
    },

    'compromise-ending': {
      id: 'compromise-ending',
      speaker: 'Narrator',
      text: 'Solid outcome. After negotiation, you settle on 52-48 split in your favor with standard protections. Good business deal with mutual benefits.',
      context: 'Professional negotiation with favorable terms.',
      choices: [],
      isEndNode: true
    },

    'decent-ending': {
      id: 'decent-ending',
      speaker: 'Narrator',
      text: 'Acceptable result. 50-50 partnership established with standard governance. Fair deal, but you left some value on the table.',
      context: 'Equitable agreement without maximizing advantage.',
      choices: [],
      isEndNode: true
    },

    'bad-ending': {
      id: 'bad-ending',
      speaker: 'Narrator',
      text: 'Suboptimal outcome. By showing eagerness and accepting their frame, you agreed to 40-60 split. They controlled the negotiation from start to finish.',
      context: 'Failed to recognize and exploit leverage opportunities.',
      choices: [],
      isEndNode: true
    }
  },
  objectives: {
    primary: 'Extract maximum value through strategic manipulation',
    secondary: ['Identify pressure points', 'Control information flow', 'Maintain strategic frame']
  },
  optimalPath: ['opening', 'control-position', 'strategic-advantage', 'optimal-ending']
};
