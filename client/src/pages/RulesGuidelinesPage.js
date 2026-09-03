import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GameIcon from '../components/common/GameIcon';

// ---------------------------------------------------------------------------
// Content data
// Each game maps to an array of blocks. Block shapes:
//   { type: 'section', num, title }
//   { type: 'p', text }
//   { type: 'ol' | 'ul', items: [ string | { text, sub: [string, ...] } ] }
//   { type: 'table', headers: [...], rows: [[...], ...] }
// ---------------------------------------------------------------------------

const freefireContent = [
  { type: 'p', text: 'COLAB ESPORTS – FREE FIRE MAX TOURNAMENT RULES & GUIDELINES' },

  { type: 'section', num: 1, title: 'General Rules' },
  { type: 'ol', items: [
    'All teams and players participating in a Colab Esports tournament must read and comply with these rules.',
    'Registering for the tournament constitutes acceptance of all applicable rules, guidelines, and decisions made by the tournament administration.',
    'Colab Esports reserves the right to modify tournament formats, schedules, match settings, and rules when operationally necessary.',
    'All participants must regularly check official Colab Esports communication channels for announcements and updates.',
    'Any attempt to exploit unclear wording or loopholes in these rules to gain an unfair competitive advantage may result in penalties.',
  ]},

  { type: 'section', num: 2, title: 'Player Eligibility' },
  { type: 'ol', items: [
    'Players must meet the eligibility requirements announced for the specific tournament.',
    'All registration information must be accurate and verifiable.',
    'Players must compete using their own registered Free Fire MAX account.',
    'Account sharing or impersonating another player is strictly prohibited.',
    'Players may be required to provide additional information to verify their identity and eligibility.',
    'A player may represent only one team during the same tournament unless explicitly approved by Colab Esports.',
    'Eligibility requirements such as age, nationality, account level, rank, or other criteria may be introduced for specific tournaments.',
  ]},
  { type: 'p', text: 'Competitive Free Fire rulebooks commonly establish player eligibility requirements and prohibit participation across multiple teams or the use of false player information.' },

  { type: 'section', num: 3, title: 'Team Roster' },
  { type: 'ol', items: [
    'Each team must have the required number of players specified during registration.',
    'For a standard Battle Royale squad tournament, teams will generally compete with four active players.',
    'Teams may register substitutes if permitted by the specific tournament.',
    'Only officially registered players are permitted to participate.',
    'Any roster change must receive approval from Colab Esports before the applicable roster deadline.',
    'A player cannot play for multiple teams during the same tournament.',
    'Every team must appoint a Team Captain as the primary point of contact with tournament officials.',
  ]},
  { type: 'p', text: 'Unauthorized players may result in match forfeiture, point deductions, or disqualification.' },

  { type: 'section', num: 4, title: 'Team Names and Player IDs' },
  { type: 'ol', items: [
    'Team names and player names must be appropriate and professional.',
    'Names containing offensive, vulgar, discriminatory, hateful, or inappropriate language are prohibited.',
    "Teams may not use names or logos that infringe upon another organization's intellectual property.",
    { text: 'Players must provide their correct:', sub: ['In-game name', 'Free Fire UID', 'Team name'] },
    'Players must not change their registered in-game name during the tournament without prior approval.',
  ]},

  { type: 'section', num: 5, title: 'Tournament Lobby Rules' },
  { type: 'ol', items: [
    'Teams must report to the designated tournament communication channel before their scheduled match.',
    'Players must join the custom room using the information provided by tournament officials.',
    'Room IDs and passwords are confidential and must not be shared with unauthorized individuals.',
    'Only registered players are permitted to enter the official match lobby.',
    'Players must ensure they are ready before the scheduled match start time.',
    'Tournament officials may remove unauthorized players from the room.',
    'Teams that repeatedly delay tournament operations may receive penalties.',
  ]},

  { type: 'section', num: 6, title: 'Match Settings' },
  { type: 'p', text: 'The specific match settings will be announced before the tournament begins.' },
  { type: 'p', text: 'These may include:' },
  { type: 'ul', items: [
    'Game mode', 'Battle Royale or Clash Squad', 'Squad format', 'Number of teams', 'Number of matches',
    'Maps', 'Character restrictions', 'Weapon restrictions, if applicable', 'Tournament stages', 'Qualification criteria',
  ]},
  { type: 'p', text: 'A standard Free Fire Battle Royale competitive match generally involves squads competing for placement and eliminations until a winning team achieves BOOYAH.' },

  { type: 'section', num: 7, title: 'Match Start and Participation' },
  { type: 'ol', items: [
    'Players must use their registered accounts during official matches.',
    'Once the match has started, players are responsible for their own device and internet connection.',
    'Individual internet disconnections will generally not result in a match restart.',
    'Teams must not intentionally delay a match.',
    'Players must follow all instructions provided by tournament officials.',
    'A match may only be restarted if authorized by the tournament administration.',
  ]},

  { type: 'section', num: 8, title: 'Scoring System' },
  { type: 'p', text: 'Unless otherwise specified, Colab Esports may use the following competitive scoring structure:' },
  { type: 'p', text: 'Placement Points', accent: true },
  { type: 'table', headers: ['Placement', 'Points'], rows: [
    ['1st', '12'], ['2nd', '9'], ['3rd', '8'], ['4th', '7'], ['5th', '6'], ['6th', '5'],
    ['7th', '4'], ['8th', '3'], ['9th', '2'], ['10th', '1'], ['11th–12th', '0'],
  ]},
  { type: 'p', text: 'Elimination Points', accent: true },
  { type: 'p', text: 'Each confirmed elimination = 1 point' },
  { type: 'p', text: 'Team Ranking', accent: true },
  { type: 'p', text: 'Teams will be ranked according to their total accumulated points across all matches.' },
  { type: 'p', text: 'Important: Colab Esports may use a different scoring system depending on the tournament format. The scoring system announced for a specific tournament will take precedence over these general rules.', note: true },

  { type: 'section', num: 9, title: 'Tie-Breaking Rules' },
  { type: 'p', text: 'If two or more teams finish with the same number of points, the following criteria may be used:' },
  { type: 'ol', items: [
    'Total BOOYAH victories',
    'Total eliminations',
    'Highest placement achieved',
    'Performance in the most recent match',
    'Performance across previous matches, if necessary',
    'Final decision by tournament officials where a technical ranking issue cannot otherwise be resolved',
  ]},

  { type: 'section', num: 10, title: 'Fair Play and Competitive Integrity' },
  { type: 'p', text: 'All participants must compete fairly and honestly.' },
  { type: 'p', text: 'The following activities are strictly prohibited:' },
  { type: 'ul', items: [
    'Teaming with another team', 'Collusion', 'Match fixing', 'Intentionally losing', 'Pre-arranging match results',
    'Sharing strategic information with opponents', 'Bribery', 'Fraudulent activity', 'Manipulation of tournament results',
    'Gambling or betting related to tournament matches', 'Any action intended to compromise competitive integrity',
  ]},
  { type: 'p', text: 'Professional Free Fire rulebooks place significant emphasis on competitive integrity and can impose sanctions for conduct such as match manipulation, fraud, bribery, or other actions that compromise fair competition.' },

  { type: 'section', num: 11, title: 'Teaming and Collusion' },
  { type: 'p', text: 'Teams must compete independently.' },
  { type: 'p', text: 'The following may be considered teaming or collusion:' },
  { type: 'ul', items: [
    'Two or more teams intentionally cooperating against another team',
    'Avoiding combat through pre-arranged agreements',
    'Sharing enemy locations with another competing team',
    'Coordinating movements through unauthorized communication',
    'Intentionally allowing another team to obtain an unfair advantage',
    'Pre-arranging the outcome of a match',
  ]},
  { type: 'p', text: 'Suspected cases may be investigated using match recordings, spectator footage, POV recordings, and other available evidence.' },

  { type: 'section', num: 12, title: 'Cheating and Unauthorized Software' },
  { type: 'p', text: 'The following are strictly prohibited:' },
  { type: 'ul', items: [
    'Hacks', 'Cheats', 'Modified APKs or game clients', 'Scripts', 'Bots', 'Macros or automation tools',
    'Unauthorized third-party applications', 'Manipulation of game files', 'Exploiting bugs or glitches for an unfair advantage',
  ]},
  { type: 'p', text: 'Only authorized software and game clients may be used during a tournament. Official competitive rules similarly prohibit unauthorized applications, modifications, and game-client tampering.' },
  { type: 'p', text: 'Penalties for Cheating', accent: true },
  { type: 'p', text: 'Depending on the severity of the violation, penalties may include:' },
  { type: 'ul', items: [
    'Point deduction', 'Match forfeiture', 'Immediate disqualification', 'Removal from the tournament',
    'Temporary ban', 'Permanent ban from future Colab Esports events',
  ]},

  { type: 'section', num: 13, title: 'Bug and Glitch Exploitation' },
  { type: 'p', text: 'Players must immediately report significant bugs or technical exploits discovered during a tournament.' },
  { type: 'p', text: 'The intentional use of bugs or glitches to gain an unfair competitive advantage is prohibited.' },
  { type: 'p', text: 'This includes, but is not limited to:' },
  { type: 'ul', items: [
    'Exploiting map errors', 'Using unintended areas of the map', 'Exploiting game mechanics', 'Deliberately abusing known technical errors',
  ]},
  { type: 'p', text: 'Tournament officials will investigate suspected violations before determining the appropriate penalty.' },

  { type: 'section', num: 14, title: 'Communication Rules' },
  { type: 'ol', items: [
    'Active players may communicate with their teammates during a match.',
    'Players may not receive unauthorized tactical assistance from spectators or external individuals.',
    'Communication with opponents for the purpose of collusion is prohibited.',
    'Teams must use designated official communication channels when instructed by Colab Esports.',
    'Coaches, managers, spectators, or other third parties may not provide live competitive information unless explicitly permitted.',
  ]},

  { type: 'section', num: 15, title: 'POV Recording' },
  { type: 'p', text: 'Colab Esports may require players to record their gameplay for competitive integrity purposes.' },
  { type: 'p', text: 'Where POV recording is mandatory:' },
  { type: 'ol', items: [
    'Players must record their gameplay as instructed.',
    'Footage must be clear and continuous.',
    'Players may be required to submit footage following a match.',
    'Edited or manipulated recordings may not be accepted as evidence.',
    'Failure to provide requested footage may result in an investigation or penalty.',
  ]},

  { type: 'section', num: 16, title: 'Technical Issues and Disconnects' },
  { type: 'ol', items: [
    'Players are responsible for ensuring their devices are properly charged and functional.',
    'Players are responsible for maintaining a stable internet connection.',
    'Individual technical or connection problems will generally not result in a match restart.',
    'Major technical issues affecting multiple teams may result in an investigation.',
    'Only the tournament administration may authorize a restart or rehost.',
    'Players must immediately report major technical issues through official channels.',
  ]},

  { type: 'section', num: 17, title: 'Streaming and Broadcast Rights' },
  { type: 'ol', items: [
    'Colab Esports reserves the right to livestream and broadcast tournament matches.',
    'Colab Esports may record and use tournament gameplay, team names, logos, player names, photographs, voice recordings, and other tournament-related material for promotional and operational purposes.',
    'Players and teams may not independently broadcast official tournament matches without prior approval where broadcast restrictions apply.',
    'Unauthorized rebroadcasting or redistribution of official tournament content may result in penalties.',
  ]},
  { type: 'p', text: 'Official Free Fire competition frameworks include provisions governing tournament broadcasts and the use of participant and team materials for promotional purposes.' },

  { type: 'section', num: 18, title: 'Player Conduct and Sportsmanship' },
  { type: 'p', text: 'All participants must maintain professional and respectful behaviour.' },
  { type: 'p', text: 'The following behaviour is prohibited:' },
  { type: 'ul', items: [
    'Harassment', 'Threats', 'Hate speech', 'Discrimination', 'Sexual harassment', 'Excessive abusive language',
    'Personal attacks', 'Intimidation', 'Impersonation', 'Abuse towards tournament officials', 'Deliberately disrupting tournament operations',
  ]},
  { type: 'p', text: "Garena's Free Fire community standards and competitive rulebooks similarly establish expectations around player safety, respectful conduct, and professional behaviour." },

  { type: 'section', num: 19, title: 'Protests and Disputes' },
  { type: 'ol', items: [
    'Teams must submit complaints through the official Colab Esports communication channel.',
    'Protests should be submitted within the time period announced for the specific tournament.',
    { text: 'Teams should provide relevant evidence, including:', sub: ['Screenshots', 'Match recordings', 'POV footage', 'Player IDs', 'Detailed descriptions of the incident'] },
    'False or malicious accusations may result in disciplinary action.',
    'Public harassment of another team while a dispute is under review is prohibited.',
    'The final decision rests with the Colab Esports tournament administration.',
  ]},
  { type: 'p', text: 'Formal protest mechanisms are also used in major professional esports competitions to address disputes and integrity concerns.' },

  { type: 'section', num: 20, title: 'Penalties and Disciplinary Action' },
  { type: 'p', text: 'Depending on the nature and severity of a violation, Colab Esports may issue:' },
  { type: 'ol', items: [
    'Verbal or written warning', 'Point deduction', 'Match penalty', 'Match forfeiture', 'Removal from a tournament stage',
    'Disqualification', 'Temporary suspension', 'Permanent ban from future Colab Esports tournaments', 'Prize forfeiture, where applicable',
  ]},
  { type: 'p', text: 'Serious violations involving cheating, match fixing, account fraud, or deliberate competitive manipulation may result in immediate disqualification.' },

  { type: 'section', num: 21, title: 'Prize Distribution' },
  { type: 'ol', items: [
    'Prize distribution will follow the prize structure announced for the specific tournament.',
    'Winners may be required to complete eligibility or identity verification before receiving prizes.',
    'Disqualified players or teams may lose their eligibility for prizes.',
    'Incorrect or incomplete payment information may delay prize distribution.',
    'Prize disputes must be raised through official Colab Esports channels.',
    'Colab Esports reserves the right to withhold prizes during an active investigation into suspected rule violations.',
  ]},

  { type: 'section', num: 22, title: 'Tournament Administration' },
  { type: 'p', text: 'The Colab Esports tournament administration has the authority to:' },
  { type: 'ul', items: [
    'Enforce tournament rules', 'Investigate suspected violations', 'Review gameplay evidence', 'Issue warnings and penalties',
    'Modify schedules when necessary', 'Rehost or restart matches under exceptional circumstances', 'Resolve tournament disputes',
    'Make final decisions regarding competitive matters',
  ]},
  { type: 'p', text: "The tournament administration's decision shall be final regarding rule interpretation and tournament operations." },

  { type: 'section', num: 23, title: 'Rule Changes' },
  { type: 'p', text: 'Colab Esports reserves the right to update or amend these rules when necessary.' },
  { type: 'p', text: 'Significant changes will be communicated through official Colab Esports platforms or tournament communication channels. Players and teams are responsible for staying informed about the latest applicable rules.' },
];

const bgmiContent = [
  { type: 'p', text: 'COLAB ESPORTS BGMI TOURNAMENT RULES & GUIDELINES' },

  { type: 'section', num: 1, title: 'General Rules' },
  { type: 'ol', items: [
    'By registering for a Colab Esports tournament, all players and teams agree to comply with these rules and any additional instructions issued by the tournament administration.',
    'Colab Esports reserves the right to modify tournament rules, schedules, formats, or match timings when necessary.',
    'All decisions made by the tournament administration and match officials shall be final.',
    'Players are responsible for regularly checking official Colab Esports communication channels for announcements and updates.',
    'Participation in the tournament constitutes acceptance of all applicable rules and guidelines.',
  ]},

  { type: 'section', num: 2, title: 'Player Eligibility' },
  { type: 'ol', items: [
    'All participants must meet the eligibility requirements specified for the particular tournament.',
    'Players must provide accurate registration information, including their BGMI ID and in-game name.',
    "A player may not participate using another person's BGMI account.",
    'Players found using false identities, incorrect information, or unauthorized accounts may be immediately disqualified.',
    'Players may be required to provide identification or additional verification if requested by tournament officials.',
    'A player may represent only one registered team during a tournament unless explicitly approved by Colab Esports.',
  ]},
  { type: 'p', text: 'Official BGMI competition rules also place importance on player eligibility, identity verification and accurate registration information.' },

  { type: 'section', num: 3, title: 'Team Roster' },
  { type: 'ol', items: [
    'Each team must consist of the number of players specified in the tournament registration requirements.',
    'The registered roster must be finalized before the tournament begins.',
    'Only registered players may participate in official tournament matches.',
    'Any roster change or substitute must receive prior approval from the tournament administration.',
    'Using an unregistered or unauthorized player may result in match forfeiture or disqualification.',
    'Every team must appoint a designated Team Captain who will serve as the primary point of contact with tournament officials.',
  ]},

  { type: 'section', num: 4, title: 'Team Names and In-Game Names' },
  { type: 'ol', items: [
    'Every team must have a unique and appropriate team name.',
    { text: 'Team names, logos, and player names must not contain:', sub: ['Offensive or abusive language', 'Hate speech or discriminatory content', 'Explicit or inappropriate material', 'Unauthorized trademarks or intellectual property'] },
    'Players may be required to follow a specific in-game naming format for tournament identification.',
    'Players must not change their registered in-game name during the tournament without approval from tournament officials.',
  ]},
  { type: 'p', text: 'Official BGMI competition rules similarly regulate team identities, gamer tags and inappropriate or unauthorized use of names and intellectual property.' },

  { type: 'section', num: 5, title: 'Match Rules' },
  { type: 'p', text: '5.1 Match Lobby', accent: true },
  { type: 'ol', items: [
    'Teams must report to the designated lobby or communication channel before the scheduled match time.',
    'Teams are expected to be ready before the match lobby is created.',
    'Late teams may face penalties or forfeiture at the discretion of tournament officials.',
    'Only authorized players may enter the tournament room.',
    'Room IDs and passwords must not be shared with unauthorized individuals.',
  ]},
  { type: 'p', text: '5.2 Match Settings', accent: true },
  { type: 'p', text: 'Unless otherwise announced for a specific tournament, match settings will be communicated by Colab Esports before the event.' },
  { type: 'p', text: 'The tournament administration will determine:' },
  { type: 'ul', items: [
    'Match mode', 'Perspective (TPP/FPP)', 'Maps', 'Number of matches', 'Match schedule', 'Tournament stages', 'Advancement criteria',
  ]},
  { type: 'p', text: 'The official match format for a particular Colab Esports tournament will take precedence over general guidelines.' },
  { type: 'p', text: '5.3 Match Start', accent: true },
  { type: 'ol', items: [
    'Players must join the room using their registered accounts.',
    'Teams must verify their presence before the match begins.',
    'Once the match has officially started, players are responsible for any connection or device issues on their side unless a tournament-wide technical issue occurs.',
    'Players must not intentionally delay the start of a match.',
  ]},

  { type: 'section', num: 6, title: 'Scoring System' },
  { type: 'p', text: 'Colab Esports may use a placement-and-elimination-based scoring system.' },
  { type: 'p', text: 'A standard competitive structure can include:' },
  { type: 'p', text: 'Placement Points', accent: true },
  { type: 'table', headers: ['Placement', 'Points'], rows: [
    ['1st', '10'], ['2nd', '6'], ['3rd', '5'], ['4th', '4'], ['5th', '3'], ['6th', '2'], ['7th–8th', '1'], ['9th–16th', '0'],
  ]},
  { type: 'p', text: 'Elimination Points', accent: true },
  { type: 'ul', items: ['Each confirmed elimination: 1 Point'] },
  { type: 'p', text: 'Ranking', accent: true },
  { type: 'p', text: 'Teams will be ranked according to their total accumulated points across all designated matches.' },
  { type: 'p', text: 'Colab Esports may modify the scoring structure depending on the tournament format. The official scoring system for each tournament will be announced before the competition begins.', note: true },

  { type: 'section', num: 7, title: 'Tie-Breaking Rules' },
  { type: 'p', text: 'If two or more teams have the same total number of points, the following criteria may be used to determine rankings:' },
  { type: 'ol', items: [
    'Total Winner Winner Chicken Dinners', 'Total placement points', 'Total eliminations',
    'Best performance in the most recent match', 'Additional tie-breaker criteria determined by tournament officials',
  ]},
  { type: 'p', text: 'The exact tie-breaking method may vary depending on the tournament format.' },

  { type: 'section', num: 8, title: 'Fair Play and Competitive Integrity' },
  { type: 'p', text: 'All teams and players must compete fairly and to the best of their ability.' },
  { type: 'p', text: 'The following activities are strictly prohibited:' },
  { type: 'ul', items: [
    'Teaming or collusion with other teams', 'Match fixing', 'Intentionally losing a match',
    'Sharing information with competing teams for an unfair advantage', 'Pre-arranged match outcomes', 'Bribery',
    'Gambling related to tournament matches', 'Exploiting tournament systems or rules for unfair advantages',
  ]},
  { type: 'p', text: 'Official BGMI competition rules similarly emphasize professional conduct, competitive integrity and prohibit collusion, match manipulation, bribery and gambling related to tournament matches.' },

  { type: 'section', num: 9, title: 'Cheating and Unauthorized Software' },
  { type: 'p', text: 'The following are strictly prohibited:' },
  { type: 'ol', items: [
    'Hacks, cheats, scripts, bots, or modified game clients.',
    'Unauthorized third-party applications that provide a competitive advantage.',
    'Exploiting bugs or glitches intentionally.',
    'Unauthorized game modifications.',
    'Account sharing.',
    'Any form of manipulation that provides an unfair competitive advantage.',
  ]},
  { type: 'p', text: 'Players suspected of cheating may be investigated by Colab Esports.' },
  { type: 'p', text: 'Penalties may include:' },
  { type: 'ul', items: [
    'Warning', 'Match penalty', 'Point deduction', 'Match forfeiture', 'Tournament disqualification',
    'Temporary or permanent ban from future Colab Esports events',
  ]},

  { type: 'section', num: 10, title: 'Communication Rules' },
  { type: 'ol', items: [
    'Players may communicate with their active teammates during a match.',
    'Communication with unauthorized third parties during an active match is prohibited.',
    'Players must not receive live tactical information or assistance from spectators, coaches, managers, or any external individual unless specifically permitted by the tournament format.',
    'Teams must use official tournament communication channels when instructed to do so.',
  ]},
  { type: 'p', text: 'Official BGMI rules also restrict unauthorized third-party communication during active tournament games to protect competitive integrity.' },

  { type: 'section', num: 11, title: 'Streaming and Content Rights' },
  { type: 'ol', items: [
    'Players may not independently broadcast or stream tournament matches without prior approval from Colab Esports.',
    'Colab Esports reserves the right to livestream, record, broadcast, photograph, and create promotional content related to the tournament.',
    'By participating, players grant Colab Esports the right to use their team name, player name, gameplay footage, voice, image, and tournament-related content for promotional and operational purposes.',
    'Unauthorized rebroadcasting of official tournament streams may result in penalties.',
  ]},
  { type: 'p', text: 'Official BGMI competitions also restrict unauthorized streaming and broadcasting of tournament matches.' },

  { type: 'section', num: 12, title: 'POV Recording Requirements' },
  { type: 'p', text: 'If POV recording is mandatory for a particular tournament:' },
  { type: 'ol', items: [
    "Players must record their gameplay as instructed by tournament officials.",
    "Recordings must clearly show the player's gameplay and relevant in-game information.",
    'Players may be required to submit POV footage during or after a match.',
    'Failure to provide requested footage may result in investigation or penalties.',
    'Edited, manipulated, or incomplete footage may be rejected.',
  ]},

  { type: 'section', num: 13, title: 'Technical Issues and Disconnects' },
  { type: 'ol', items: [
    'Players are responsible for ensuring that their device, internet connection, battery, and game application are functioning properly before a match.',
    'Individual device or internet problems will generally not result in a match restart.',
    'Players must immediately report major technical issues to tournament officials through the designated communication channel.',
    "Match officials may decide to restart or rehost a match if a significant technical issue affects multiple participants or the tournament's competitive integrity.",
    'The decision to restart or continue a match rests solely with the tournament administration.',
  ]},
  { type: 'p', text: 'Official BGMI rulebooks provide for tournament-organizer decisions regarding rehosts or restarts in certain significant technical situations.' },

  { type: 'section', num: 14, title: 'Protests and Disputes' },
  { type: 'ol', items: [
    'Any complaint or protest must be submitted through the official channel designated by Colab Esports.',
    { text: 'Teams should provide relevant evidence, including:', sub: ['Screenshots', 'Video footage', 'POV recordings', 'Match details'] },
    'False accusations against players or teams may result in disciplinary action.',
    'Public arguments or harassment regarding tournament decisions should be avoided.',
    'The final decision regarding disputes rests with the tournament administration.',
  ]},

  { type: 'section', num: 15, title: 'Player Conduct' },
  { type: 'p', text: 'All participants must maintain professional and respectful behaviour.' },
  { type: 'p', text: 'The following may result in penalties:' },
  { type: 'ul', items: [
    'Harassment', 'Threats', 'Hate speech', 'Discriminatory language', 'Excessive abusive behaviour', 'Sexual harassment',
    'Impersonation', 'Intentionally disrupting tournament operations', 'Abuse directed towards officials, players, staff, or spectators',
  ]},
  { type: 'p', text: 'Professional conduct and good sportsmanship are fundamental principles of official BGMI competition rules.' },

  { type: 'section', num: 16, title: 'Penalties and Disqualification' },
  { type: 'p', text: 'Depending on the severity of a violation, Colab Esports may impose one or more of the following penalties:' },
  { type: 'ol', items: [
    'Official warning', 'Point deduction', 'Match penalty', 'Match forfeiture', 'Removal from a tournament stage',
    'Disqualification', 'Temporary suspension', 'Permanent ban from future Colab Esports tournaments',
    'Withholding or forfeiture of prizes where permitted under applicable terms and laws',
  ]},
  { type: 'p', text: 'Serious violations involving cheating, match manipulation or fraudulent activity may result in immediate disqualification.' },

  { type: 'section', num: 17, title: 'Prize Distribution' },
  { type: 'ol', items: [
    'Prize distribution will follow the terms announced for the specific tournament.',
    'Winning players may be required to complete verification before receiving prizes.',
    'Providing incorrect payment or identity information may delay prize distribution.',
    'A disqualified team may lose its eligibility for prizes.',
    'Prize-related disputes must be raised through official Colab Esports communication channels.',
  ]},

  { type: 'section', num: 18, title: 'Tournament Administration' },
  { type: 'p', text: 'Colab Esports tournament officials have the authority to:' },
  { type: 'ul', items: [
    'Enforce tournament rules', 'Investigate potential violations', 'Review evidence', 'Issue warnings and penalties',
    'Modify schedules due to operational requirements', 'Restart or cancel matches when necessary', 'Make final decisions regarding tournament disputes',
  ]},
  { type: 'p', text: "The administration's decision shall be final in matters concerning tournament operations and rule enforcement." },

  { type: 'section', num: 19, title: 'Rule Amendments' },
  { type: 'p', text: 'Colab Esports reserves the right to update, modify, or amend these rules when necessary.' },
  { type: 'p', text: 'Any significant rule changes will be communicated through official Colab Esports channels. Continued participation in the tournament after the announcement of revised rules may constitute acceptance of those changes.' },
];

const valorantContent = [
  { type: 'p', text: 'COLAB ESPORTS – VALORANT TOURNAMENT RULES & GUIDELINES' },

  { type: 'section', num: 1, title: 'General Rules' },
  { type: 'ol', items: [
    'All participating players and teams must comply with the rules and regulations established by Colab Esports.',
    'By registering for the tournament, players agree to follow all tournament rules and instructions issued by tournament officials.',
    'Colab Esports reserves the right to modify the tournament format, schedule, rules, or match procedures when reasonably necessary.',
    'Players and teams are responsible for checking official Colab Esports communication channels for updates.',
    'Tournament officials have the authority to interpret and enforce these rules.',
    'Any attempt to deliberately exploit a loophole or ambiguity in the rules to gain an unfair advantage may result in penalties.',
  ]},

  { type: 'section', num: 2, title: 'Player Eligibility' },
  { type: 'ol', items: [
    'All players must meet the eligibility requirements announced for the specific tournament.',
    { text: 'Players must provide accurate registration information, including their:', sub: ['Full name, where required', 'Riot ID', 'VALORANT account details, where required', 'Contact information'] },
    'Players must compete using their own registered Riot account.',
    'Account sharing or impersonation is strictly prohibited.',
    'A player may represent only one team in the same tournament unless specifically approved by Colab Esports.',
    'Players may be required to complete identity or account verification before participating.',
    'Providing false information may result in immediate disqualification.',
  ]},

  { type: 'section', num: 3, title: 'Team Roster' },
  { type: 'ol', items: [
    'A standard VALORANT competitive team consists of five active players.',
    'Teams may register substitute players if permitted by the tournament format.',
    'Only officially registered players may participate in tournament matches.',
    'A team must designate one player as the Team Captain.',
    'The Team Captain will act as the primary point of contact between the team and tournament officials.',
    'Unregistered players may not participate under any circumstances without prior approval.',
    'Roster changes after the registration deadline may only be permitted at the discretion of Colab Esports.',
  ]},

  { type: 'section', num: 4, title: 'Tournament Format' },
  { type: 'p', text: 'The format of each tournament will be announced before the competition begins.' },
  { type: 'p', text: 'Depending on the event, Colab Esports may use:' },
  { type: 'ul', items: [
    'Single Elimination', 'Double Elimination', 'Round Robin', 'Group Stage', 'Swiss Stage', 'Playoffs',
    'Best-of-One (BO1)', 'Best-of-Three (BO3)', 'Best-of-Five (BO5)',
  ]},
  { type: 'p', text: 'The tournament-specific format announced by Colab Esports will take precedence over the general rules.' },

  { type: 'section', num: 5, title: 'Match Format' },
  { type: 'p', text: 'Unless otherwise announced:' },
  { type: 'p', text: 'Best-of-One (BO1)', accent: true },
  { type: 'ul', items: ['The team that wins the map wins the match.'] },
  { type: 'p', text: 'Best-of-Three (BO3)', accent: true },
  { type: 'ul', items: ['The first team to win two maps wins the match.'] },
  { type: 'p', text: 'Best-of-Five (BO5)', accent: true },
  { type: 'ul', items: ['The first team to win three maps wins the match.'] },
  { type: 'p', text: 'A normal VALORANT competitive map is played until one team wins the required number of rounds, subject to the applicable overtime format.' },

  { type: 'section', num: 6, title: 'Map Selection and Veto Process' },
  { type: 'p', text: 'For multi-map matches, the map selection process will be conducted according to the tournament format.' },
  { type: 'p', text: 'A standard process may include:' },
  { type: 'ol', items: [
    'Team A bans one map.', 'Team B bans one map.', 'Team A selects the first map.', 'Team B selects the second map.',
    'Remaining maps are selected or used as decider maps.',
  ]},
  { type: 'p', text: 'The exact veto process may vary depending on whether the match is BO1, BO3, or BO5.' },
  { type: 'p', text: 'Important: The map pool used for the tournament will be announced by Colab Esports before the tournament begins.', note: true },

  { type: 'section', num: 7, title: 'Side Selection' },
  { type: 'p', text: 'Side selection may be determined through:' },
  { type: 'ul', items: [
    'A coin toss', 'Map veto advantage', 'Higher tournament seed', 'Previous match performance', 'Tournament-specific procedures',
  ]},
  { type: 'p', text: 'For a selected map, the team receiving side-selection priority may choose to begin on either the Attacking or Defending side.' },

  { type: 'section', num: 8, title: 'Match Lobby and Check-In' },
  { type: 'ol', items: [
    'Teams must report to the designated tournament channel before their scheduled match.',
    'Teams should complete check-in according to the schedule provided by Colab Esports.',
    'All five active players must be prepared before the scheduled match time.',
    'Players must join the correct custom game lobby.',
    'Lobby details must not be shared with unauthorized individuals.',
    'Teams that fail to appear within the permitted waiting period may forfeit the match.',
    'Repeated delays may result in disciplinary action.',
  ]},

  { type: 'section', num: 9, title: 'Game Settings' },
  { type: 'p', text: 'Tournament matches will be played using the game settings specified by Colab Esports.' },
  { type: 'p', text: 'These may include:' },
  { type: 'ul', items: [
    'Custom Game mode', 'Tournament Mode, where available', 'Appropriate competitive map pool', 'Standard competitive round settings',
    'Overtime settings', 'Spectator settings', 'Observer permissions',
  ]},
  { type: 'p', text: 'Players must not alter tournament settings without authorization.' },

  { type: 'section', num: 10, title: 'Agents and Agent Selection' },
  { type: 'ol', items: [
    'Players may only use agents available and permitted in the tournament.',
    'Colab Esports may restrict newly released agents if competitive stability requires it.',
    'Players must follow the agent selection procedures announced for the event.',
    'Players must not use unauthorized methods to manipulate agent selection or game mechanics.',
  ]},

  { type: 'section', num: 11, title: 'Competitive Integrity and Fair Play' },
  { type: 'p', text: 'All players and teams must compete honestly and to the best of their abilities.' },
  { type: 'p', text: 'The following activities are strictly prohibited:' },
  { type: 'ul', items: [
    'Cheating', 'Match fixing', 'Collusion', 'Intentionally losing a match', 'Bribery', 'Fraudulent activity', 'Account sharing',
    'Impersonation', 'Unauthorized external assistance', 'Betting or gambling related to the tournament', 'Deliberately manipulating match results',
  ]},
  { type: 'p', text: "Riot Games' competitive regulations emphasize fair competition, sportsmanship and maintaining the integrity of the competitive environment." },

  { type: 'section', num: 12, title: 'Cheating and Unauthorized Software' },
  { type: 'p', text: 'The following are strictly prohibited:' },
  { type: 'ul', items: [
    'Aimbots', 'Wallhacks', 'Triggerbots', 'Scripts', 'Macros that provide an unfair advantage', 'Modified game clients',
    'Unauthorized third-party software', 'Hardware or software designed to provide an unfair competitive advantage',
    'Exploiting bugs or glitches', 'Any attempt to manipulate the game or match outcome',
  ]},
  { type: 'p', text: 'Any player suspected of cheating may be investigated by Colab Esports.' },
  { type: 'p', text: "Riot's policies prohibit products and tools that provide players with unfair competitive advantages." },
  { type: 'p', text: 'Possible Penalties', accent: true },
  { type: 'ul', items: [
    'Warning', 'Round or map penalty', 'Match forfeiture', 'Point deduction', 'Immediate disqualification',
    'Temporary suspension', 'Permanent ban from future Colab Esports events',
  ]},
  { type: 'p', text: 'Serious cheating violations may result in immediate removal from the tournament.' },

  { type: 'section', num: 13, title: 'Exploitation of Bugs and Glitches' },
  { type: 'p', text: 'Players must not intentionally exploit bugs or unintended game mechanics to gain an unfair advantage.' },
  { type: 'p', text: 'This includes:' },
  { type: 'ul', items: [
    'Accessing unintended areas of a map', 'Exploiting map geometry', 'Exploiting agent abilities in unintended ways',
    'Abusing known technical issues', 'Deliberately manipulating game mechanics',
  ]},
  { type: 'p', text: 'Players should immediately report significant bugs or exploits to tournament officials.' },
  { type: 'p', text: 'Tournament officials will determine whether the incident warrants a warning, penalty, replay, or further disciplinary action.' },

  { type: 'section', num: 14, title: 'Communication Rules' },
  { type: 'p', text: 'During an active match:' },
  { type: 'ol', items: [
    'Players may communicate with their active teammates.',
    'Players may not receive tactical information or assistance from unauthorized individuals.',
    'Coaches, managers, spectators, friends, or other third parties may not provide live information unless specifically permitted.',
    'Communication intended to facilitate collusion with an opposing team is prohibited.',
    'Players must follow instructions regarding official voice communication platforms.',
  ]},

  { type: 'section', num: 15, title: 'Coaching and External Assistance' },
  { type: 'p', text: 'Unless specifically allowed by the tournament:' },
  { type: 'ol', items: [
    'Only active players may communicate during a live round.',
    'Coaches may communicate with players only during permitted periods.',
    'Coaches or external individuals may not provide tactical information during active gameplay.',
    'Unauthorized coaching or outside assistance may result in penalties for the player and/or team.',
  ]},

  { type: 'section', num: 16, title: 'Pauses and Technical Issues' },
  { type: 'p', text: 'Technical Pauses', accent: true },
  { type: 'p', text: 'A team may request a pause only when permitted under the tournament rules.' },
  { type: 'p', text: 'Possible reasons may include:' },
  { type: 'ul', items: ['Significant game-related technical issues', 'Major hardware problems', 'Serious connection issues affecting a player'] },
  { type: 'p', text: 'Player Responsibility', accent: true },
  { type: 'p', text: 'Players are responsible for ensuring that they have:' },
  { type: 'ul', items: [
    'A stable internet connection', 'A functioning PC or gaming device', 'Working peripherals',
    'Sufficient power backup where possible', 'An updated VALORANT game client',
  ]},
  { type: 'p', text: 'Individual connection issues may not automatically result in a match restart.' },
  { type: 'p', text: 'The tournament administration will determine whether a pause, remake, or continuation of the match is appropriate.' },

  { type: 'section', num: 17, title: 'Disconnects' },
  { type: 'ol', items: [
    'Players experiencing a disconnect must immediately inform tournament officials when possible.',
    'Teams must follow instructions provided by tournament administrators.',
    'A disconnected player may reconnect if technically possible.',
    "A match will not automatically be restarted because of an individual player's connection issue.",
    'Any remake decision will be made solely by the tournament administration.',
  ]},

  { type: 'section', num: 18, title: 'Match Restart and Remake' },
  { type: 'p', text: 'A match or map may only be restarted when authorized by tournament officials.' },
  { type: 'p', text: 'Possible reasons include:' },
  { type: 'ul', items: ['Major server problems', 'Tournament-wide technical issues', 'Critical game errors', 'Significant administrative errors'] },
  { type: 'p', text: 'The decision to restart, remake, or continue a match rests with Colab Esports.' },

  { type: 'section', num: 19, title: 'Spectators and Observers' },
  { type: 'ol', items: [
    'Only authorized tournament officials, observers, broadcasters, and approved personnel may spectate official matches.',
    'Unauthorized spectators are prohibited.',
    'Spectators must not communicate live game information to active players.',
    'Any player receiving unfair information from a spectator may be subject to investigation and penalties.',
  ]},

  { type: 'section', num: 20, title: 'Player Conduct and Sportsmanship' },
  { type: 'p', text: 'All participants must maintain professional and respectful behaviour.' },
  { type: 'p', text: 'The following behaviour is prohibited:' },
  { type: 'ul', items: [
    'Harassment', 'Hate speech', 'Discrimination', 'Threats', 'Sexual harassment', 'Excessive abusive behaviour',
    'Bullying', 'Personal attacks', 'Intimidation', 'Unsportsmanlike conduct', 'Abuse directed towards tournament officials',
  ]},
  { type: 'p', text: "Riot Games' current Esports Global Code of Conduct establishes standards intended to promote a safe, respectful and trustworthy competitive environment." },

  { type: 'section', num: 21, title: 'In-Game Behaviour' },
  { type: 'p', text: 'Players must not intentionally disrupt the competitive experience.' },
  { type: 'p', text: 'The following may result in penalties:' },
  { type: 'ul', items: [
    'Excessive abusive chat', 'Intentionally delaying a match', 'Intentionally disconnecting', 'Refusing to follow tournament instructions',
    'Deliberately throwing rounds or matches', 'Exploiting game mechanics for unfair advantages', 'Unsportsmanlike behaviour towards opponents or officials',
  ]},
  { type: 'p', text: 'Friendly competitive banter may be permitted, but it must not become harassment, discrimination, or abuse.' },

  { type: 'section', num: 22, title: 'Streaming and Broadcasting Rights' },
  { type: 'ol', items: [
    'Colab Esports reserves the right to livestream and broadcast tournament matches.',
    'Colab Esports may record gameplay, voice communications, player names, team names, logos, photographs, and other tournament-related material.',
    'Participants may not independently broadcast tournament matches if prohibited by the specific event rules.',
    'Unauthorized restreaming of an official broadcast may result in penalties.',
    'Colab Esports may use tournament footage for promotional, marketing, and archival purposes.',
  ]},

  { type: 'section', num: 23, title: 'Protests and Disputes' },
  { type: 'ol', items: [
    'Teams must submit disputes through the official communication channel designated by Colab Esports.',
    'Protests should include relevant evidence.',
    { text: 'Evidence may include:', sub: ['Screenshots', 'Video recordings', 'Match recordings', 'Stream footage', 'Relevant timestamps'] },
    'False or malicious accusations may result in disciplinary action.',
    'Teams must not publicly harass or threaten another team while a dispute is under investigation.',
    'The final decision regarding a dispute rests with the Colab Esports tournament administration.',
  ]},

  { type: 'section', num: 24, title: 'Penalties and Disqualification' },
  { type: 'p', text: 'Depending on the severity of a violation, Colab Esports may impose:' },
  { type: 'ol', items: [
    'Verbal warning', 'Official warning', 'Round penalty', 'Map penalty', 'Match forfeiture', 'Point deduction',
    'Tournament disqualification', 'Temporary suspension', 'Permanent ban from future Colab Esports tournaments', 'Prize forfeiture where applicable',
  ]},
  { type: 'p', text: 'Serious violations involving cheating, match manipulation, or fraud may result in immediate disqualification.' },

  { type: 'section', num: 25, title: 'Prize Distribution' },
  { type: 'ol', items: [
    'Prize distribution will follow the prize structure announced for the specific tournament.',
    'Winning players or teams may be required to complete verification before prizes are distributed.',
    'A disqualified player or team may lose eligibility for tournament prizes.',
    'Incorrect or incomplete payment information may delay prize distribution.',
    'Colab Esports reserves the right to withhold prizes while investigating serious rule violations.',
  ]},

  { type: 'section', num: 26, title: 'Tournament Administration' },
  { type: 'p', text: 'Colab Esports tournament officials have the authority to:' },
  { type: 'ul', items: [
    'Enforce tournament rules', 'Investigate suspected violations', 'Review match evidence', 'Issue warnings and penalties',
    'Modify match schedules where necessary', 'Resolve technical disputes', 'Authorize match remakes', 'Disqualify players or teams',
    'Make final decisions regarding tournament operations',
  ]},

  { type: 'section', num: 27, title: 'Rule Amendments' },
  { type: 'p', text: 'Colab Esports reserves the right to modify or update these rules when necessary.' },
  { type: 'p', text: 'Any significant changes will be communicated through official Colab Esports communication channels. Participants are responsible for reviewing the latest applicable tournament rules.' },
];

const GAMES = [
  { key: 'freefire', label: 'Free Fire', gameType: 'freefire', content: freefireContent },
  { key: 'bgmi', label: 'BGMI', gameType: 'bgmi', content: bgmiContent },
  { key: 'valorant', label: 'Valorant', gameType: 'valorant', content: valorantContent },
];

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

const ListItem = ({ item }) => {
  if (typeof item === 'string') return <li>{item}</li>;
  return (
    <li>
      {item.text}
      <ul className="list-[circle] list-inside pl-6 mt-1 space-y-1">
        {item.sub.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </li>
  );
};

const Block = ({ block }) => {
  switch (block.type) {
    case 'section':
      return (
        <h2 className="text-2xl font-bold text-white mt-10 mb-4 pb-2 border-b border-gray-700">
          {block.num}. {block.title}
        </h2>
      );
    case 'p':
      if (block.accent) {
        return <p className="text-gaming-neon font-semibold mt-4">{block.text}</p>;
      }
      if (block.note) {
        return (
          <p className="text-gaming-gold bg-gaming-gold/10 border border-gaming-gold/30 rounded-lg px-4 py-3 my-2">
            {block.text}
          </p>
        );
      }
      return <p className="text-gray-300 leading-relaxed">{block.text}</p>;
    case 'ol':
      return (
        <ol className="list-decimal list-inside space-y-2 pl-2 text-gray-300 leading-relaxed">
          {block.items.map((item, i) => <ListItem key={i} item={item} />)}
        </ol>
      );
    case 'ul':
      return (
        <ul className="list-disc list-inside space-y-2 pl-2 text-gray-300 leading-relaxed">
          {block.items.map((item, i) => <ListItem key={i} item={item} />)}
        </ul>
      );
    case 'table':
      return (
        <div className="overflow-x-auto my-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-600">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-gaming-neon font-semibold py-2 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800">
                  {row.map((cell, j) => (
                    <td key={j} className="text-gray-300 py-2 px-4">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const RulesGuidelinesPage = () => {
  const [activeGame, setActiveGame] = useState(GAMES[0].key);
  const current = GAMES.find((g) => g.key === activeGame);

  return (
    <div className="min-h-screen bg-gaming-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-gaming font-bold text-white mb-2">
          Rules &amp; Guidelines
        </h1>
        <p className="text-gray-400 mb-10">
          Tournament rules and competitive guidelines for each game on Colab Esports.
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-gray-700 mb-10">
          {GAMES.map((game) => (
            <button
              key={game.key}
              onClick={() => setActiveGame(game.key)}
              className={`relative flex items-center gap-2 pb-3 font-gaming text-base transition-colors duration-200 ${
                activeGame === game.key ? 'text-gaming-neon' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <GameIcon gameType={game.gameType} size="sm" />
              {game.label}
              {activeGame === game.key && (
                <motion.div
                  layoutId="rules-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-gaming-neon"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={activeGame}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {current.content.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default RulesGuidelinesPage;
