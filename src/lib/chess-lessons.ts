export interface LessonStep {
  move: string;
  color: 'w' | 'b';
  text: string;
}

export interface Lesson {
  id: string;
  category: 'opening' | 'middlegame' | 'endgame' | 'tactics' | 'strategy';
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  startingFen: string; // FEN position where the lesson starts
  moves: LessonStep[];
}

export const chessLessons: Lesson[] = [
  // === OPENING LESSONS ===
  {
    id: 'italian-game',
    category: 'opening',
    title: 'Italian Game',
    description: 'Learn the classical Italian Game opening with Bc4',
    difficulty: 'beginner',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { move: 'e4', color: 'w', text: 'Start with e4 to control the center and open lines for your pieces.' },
      { move: 'e5', color: 'b', text: 'Black mirrors with e5, creating symmetry.' },
      { move: 'Nf3', color: 'w', text: 'Develop your knight to f3, attacking e5 and developing toward the center.' },
      { move: 'Nc6', color: 'b', text: 'Black defends e5 with Nc6.' },
      { move: 'Bc4', color: 'w', text: 'The Italian Game! Bishop to c4 targets f7, the weakest point in Black\'s position. This aims for rapid development and attack.' }
    ]
  },
  {
    id: 'sicilian-defense',
    category: 'opening',
    title: 'Sicilian Defense',
    description: 'Master the aggressive Sicilian Defense',
    difficulty: 'intermediate',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { move: 'e4', color: 'w', text: 'White opens with e4.' },
      { move: 'c5', color: 'b', text: 'The Sicilian Defense! Black counters from the side, preparing asymmetric play and fighting for the center.' },
      { move: 'Nf3', color: 'w', text: 'Develop the knight, preparing d4 to open the center.' },
      { move: 'd6', color: 'b', text: 'Black supports the center with d6, preparing to develop pieces.' },
      { move: 'd4', color: 'w', text: 'White strikes in the center with d4, forcing a trade.' },
      { move: 'cxd4', color: 'b', text: 'Black captures on d4.' },
      { move: 'Nxd4', color: 'w', text: 'Recapture with the knight. The Open Sicilian position is reached - dynamic and sharp play ahead!' }
    ]
  },
  {
    id: 'queens-gambit',
    category: 'opening',
    title: "Queen's Gambit",
    description: "Learn the classic Queen's Gambit opening",
    difficulty: 'beginner',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { move: 'd4', color: 'w', text: 'Start with d4, controlling the center from a safe distance.' },
      { move: 'd5', color: 'b', text: 'Black mirrors with d5, establishing central control.' },
      { move: 'c4', color: 'w', text: "The Queen's Gambit! Offer a pawn to undermine Black's center. This isn't a true gambit - White can usually regain the pawn." },
      { move: 'e6', color: 'b', text: 'Black declines the gambit with e6, keeping a solid position and preparing to develop the light-squared bishop.' },
      { move: 'Nc3', color: 'w', text: 'Develop the knight to c3, maintaining pressure on d5 and preparing further development.' }
    ]
  },
  {
    id: 'kings-indian-defense',
    category: 'opening',
    title: "King's Indian Defense Setup",
    description: 'Learn the hypermodern King\'s Indian Defense',
    difficulty: 'advanced',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { move: 'd4', color: 'w', text: 'White starts with d4.' },
      { move: 'Nf6', color: 'b', text: 'Black develops the knight, following hypermodern principles - control the center from afar.' },
      { move: 'c4', color: 'w', text: 'White expands in the center with c4.' },
      { move: 'g6', color: 'b', text: 'Black prepares to fianchetto the king\'s bishop - a key feature of the King\'s Indian Defense.' },
      { move: 'Nc3', color: 'w', text: 'White develops naturally.' },
      { move: 'Bg7', color: 'w', text: 'The fianchetto is complete! The bishop on g7 will exert long-term pressure on the center and queenside.' }
    ]
  },
  {
    id: 'ruy-lopez',
    category: 'opening',
    title: 'Ruy Lopez (Spanish Opening)',
    description: 'Learn the classical Ruy Lopez opening',
    difficulty: 'intermediate',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { move: 'e4', color: 'w', text: 'Open with e4, the king\'s pawn.' },
      { move: 'e5', color: 'b', text: 'Black responds symmetrically with e5.' },
      { move: 'Nf3', color: 'w', text: 'Develop the knight, attacking e5.' },
      { move: 'Nc6', color: 'b', text: 'Black defends the e5 pawn.' },
      { move: 'Bb5', color: 'w', text: 'The Ruy Lopez! This bishop move puts pressure on the knight that defends e5. One of the oldest and most respected openings in chess.' }
    ]
  },

  // === MIDDLEGAME LESSONS ===
  {
    id: 'pawn-breaks',
    category: 'middlegame',
    title: 'Effective Pawn Breaks',
    description: 'Learn when and how to break open the position',
    difficulty: 'intermediate',
    startingFen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8',
    moves: [
      { move: 'd4', color: 'w', text: 'The d4 pawn break! This opens the center and activates your pieces. Notice how this gains space and creates threats.' },
      { move: 'exd4', color: 'b', text: 'Black captures the pawn.' },
      { move: 'Nxd4', color: 'w', text: 'Recapture with the knight. Your pieces are now more active, and you control key central squares. Pawn breaks are essential for creating opportunities!' }
    ]
  },
  {
    id: 'piece-coordination',
    category: 'middlegame',
    title: 'Piece Coordination',
    description: 'Learn how to coordinate your pieces for maximum effect',
    difficulty: 'intermediate',
    startingFen: 'r2q1rk1/ppp2ppp/2n2n2/3p4/1b1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 9',
    moves: [
      { move: 'Qe2', color: 'w', text: 'Connect your rooks and prepare to double on the e-file. Good piece coordination means your pieces support each other.' },
      { move: 'Be7', color: 'b', text: 'Black develops the bishop.' },
      { move: 'Rad1', color: 'w', text: 'Activate the rook, putting pressure on the d5 pawn. Now all your pieces are working together - this is the essence of good coordination!' }
    ]
  },
  {
    id: 'weak-squares',
    category: 'middlegame',
    title: 'Exploiting Weak Squares',
    description: 'Identify and exploit weak squares in the opponent\'s position',
    difficulty: 'advanced',
    startingFen: 'r1bq1rk1/pp3ppp/2n1pn2/3p4/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 8',
    moves: [
      { move: 'Bd3', color: 'w', text: 'Develop the bishop, preparing to castle. Notice the weak d5 square in Black\'s position.' },
      { move: 'O-O', color: 'b', text: 'Black castles.' },
      { move: 'O-O', color: 'w', text: 'Castle to safety.' },
      { move: 'Re8', color: 'b', text: 'Black activates the rook.' },
      { move: 'Ne5', color: 'w', text: 'Occupy the weak e5 square! This centralized knight controls many key squares. Weak squares are holes in the opponent\'s pawn structure that can\'t be defended by pawns.' }
    ]
  },

  // === ENDGAME LESSONS ===
  {
    id: 'king-and-pawn-endgame',
    category: 'endgame',
    title: 'King and Pawn Endgame Basics',
    description: 'Master the fundamental king and pawn endgame',
    difficulty: 'beginner',
    startingFen: '8/8/8/4k3/4P3/4K3/8/8 w - - 0 1',
    moves: [
      { move: 'Kd3', color: 'w', text: 'In king and pawn endgames, your king must be active! Move forward to support the pawn.' },
      { move: 'Kd6', color: 'b', text: 'Black\'s king also advances.' },
      { move: 'Ke3', color: 'w', text: 'Stay in front or beside your pawn. The key is to use your king to escort the pawn to promotion.' },
      { move: 'Ke5', color: 'b', text: 'Black tries to blockade the pawn.' },
      { move: 'Kf3', color: 'w', text: 'Maneuver your king to support the pawn advance. Remember: the king is a powerful piece in the endgame!' }
    ]
  },
  {
    id: 'rook-endgame-basics',
    category: 'endgame',
    title: 'Rook Endgame: The Lucena Position',
    description: 'Learn the winning technique in rook endgames',
    difficulty: 'intermediate',
    startingFen: '1K6/1P6/8/8/8/8/6r1/4k3 w - - 0 1',
    moves: [
      { move: 'Ka7', color: 'w', text: 'In rook endgames with a passed pawn, use your king to help advance the pawn. The key is to shield your king from checks.' },
      { move: 'Ra2+', color: 'b', text: 'Black gives checks from behind.' },
      { move: 'Kb6', color: 'w', text: 'Advance the king, getting closer to promoting the pawn. Rook endgames require precise technique!' }
    ]
  },
  {
    id: 'opposition',
    category: 'endgame',
    title: 'The Opposition Concept',
    description: 'Master the crucial concept of opposition',
    difficulty: 'intermediate',
    startingFen: '8/8/8/3k4/8/3K4/8/8 w - - 0 1',
    moves: [
      { move: 'Ke3', color: 'w', text: 'When the kings face each other with one square between them, we have "opposition". The player NOT to move has the opposition and gains an advantage.' },
      { move: 'Ke5', color: 'b', text: 'Black moves first and loses the opposition.' },
      { move: 'Kf3', color: 'w', text: 'Maintain the opposition! This concept is critical in many king and pawn endgames. The side with the opposition can often penetrate the opponent\'s position.' }
    ]
  },
  {
    id: 'queen-vs-pawn',
    category: 'endgame',
    title: 'Queen vs Pawn on 7th Rank',
    description: 'Learn when the pawn on 7th can hold a draw',
    difficulty: 'advanced',
    startingFen: '8/8/8/8/8/4Q3/1k6/1K6 w - - 0 1',
    moves: [
      { move: 'Qe2+', color: 'w', text: 'The queen must give checks to prevent the pawn from promoting. If the pawn is on a2, b2, g2, or h2, and the defending king is in front, it can be a draw!' },
      { move: 'Ka1', color: 'b', text: 'The king hides in front of the pawn - a typical drawing fortress.' },
      { move: 'Qd1+', color: 'w', text: 'Continue checking, but if Black\'s king stays on a1 or a2, it\'s often a stalemate trap. Understanding these special cases is crucial!' }
    ]
  },

  // === TACTICAL LESSONS ===
  {
    id: 'pin-tactic',
    category: 'tactics',
    title: 'The Pin Tactic',
    description: 'Learn how to use pins to win material',
    difficulty: 'beginner',
    startingFen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
    moves: [
      { move: 'Bb5', color: 'w', text: 'Pin the knight to the king! The knight on c6 cannot move without exposing the king to check. This is an absolute pin - one of the most powerful tactical weapons.' },
      { move: 'a6', color: 'b', text: 'Black attacks the bishop.' },
      { move: 'Bxc6', color: 'w', text: 'Win the knight! The pin allowed us to capture it. Pins restrict the mobility of pieces and can lead to material gain.' }
    ]
  },
  {
    id: 'fork-tactic',
    category: 'tactics',
    title: 'The Knight Fork',
    description: 'Master the devastating knight fork',
    difficulty: 'beginner',
    startingFen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1',
    moves: [
      { move: 'd5', color: 'w', text: 'Push the pawn to attack the knight.' },
      { move: 'Ne7', color: 'b', text: 'The knight retreats.' },
      { move: 'Nxe5', color: 'w', text: 'Capture the pawn, and if Black recaptures...' },
      { move: 'Nxe5', color: 'b', text: 'Black takes back.' },
      { move: 'Qh5', color: 'w', text: 'Attack f7 and threaten the knight! This demonstrates how tactical sequences can win material. Look for fork opportunities!' }
    ]
  },
  {
    id: 'skewer-tactic',
    category: 'tactics',
    title: 'The Skewer Tactic',
    description: 'Learn the powerful skewer (reverse pin)',
    difficulty: 'intermediate',
    startingFen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1',
    moves: [
      { move: 'Bxf7+', color: 'w', text: 'Sacrifice the bishop to expose the king!' },
      { move: 'Kxf7', color: 'b', text: 'The king must capture.' },
      { move: 'Ng5+', color: 'w', text: 'Check the king! This is a skewer - the king must move, and then we can capture the queen behind it. A skewer attacks a valuable piece, forcing it to move and exposing a piece behind it.' }
    ]
  },
  {
    id: 'discovered-attack',
    category: 'tactics',
    title: 'Discovered Attack',
    description: 'Unleash devastating discovered attacks',
    difficulty: 'intermediate',
    startingFen: 'r1bq1rk1/ppp2ppp/2n2n2/3p4/1b1P4/2NBP3/PPP1NPPP/R1BQK2R w KQ - 0 1',
    moves: [
      { move: 'Nf5', color: 'w', text: 'Move the knight with tempo, and the bishop on c1 now attacks the queen! This is a discovered attack - moving one piece reveals an attack from another.' },
      { move: 'Qe8', color: 'b', text: 'The queen must move.' },
      { move: 'Nxe7+', color: 'w', text: 'Win material with check! Discovered attacks can be particularly powerful when combined with checks or threats.' }
    ]
  },
  {
    id: 'double-attack',
    category: 'tactics',
    title: 'Double Attack Pattern',
    description: 'Learn to attack two pieces at once',
    difficulty: 'beginner',
    startingFen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    moves: [
      { move: 'Ng5', color: 'w', text: 'Attack f7 with both the knight and bishop! When you attack two pieces simultaneously, your opponent can only defend one.' },
      { move: 'd5', color: 'b', text: 'Black counterattacks in the center.' },
      { move: 'exd5', color: 'w', text: 'Take the pawn, maintaining pressure on f7. Double attacks create impossible defensive situations!' }
    ]
  },
  {
    id: 'removing-defender',
    category: 'tactics',
    title: 'Removing the Defender',
    description: 'Eliminate key defensive pieces',
    difficulty: 'advanced',
    startingFen: 'r2qkb1r/ppp2ppp/2n5/3pPb2/3Pn3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1',
    moves: [
      { move: 'Nxe4', color: 'w', text: 'Capture the knight that defends the f5 bishop!' },
      { move: 'dxe4', color: 'b', text: 'Black recaptures with the pawn.' },
      { move: 'Bxf5', color: 'w', text: 'Now capture the undefended bishop! This technique of removing the defender before capturing is very common in chess tactics.' }
    ]
  },

  // === STRATEGY LESSONS ===
  {
    id: 'weak-pawns',
    category: 'strategy',
    title: 'Weak Pawn Structures',
    description: 'Identify and exploit weak pawns',
    difficulty: 'intermediate',
    startingFen: 'r2qkb1r/pp3ppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 1',
    moves: [
      { move: 'cxd5', color: 'w', text: 'Exchange pawns to create an isolated d5 pawn for Black. Isolated pawns are weak because they can\'t be defended by other pawns.' },
      { move: 'exd5', color: 'b', text: 'Black recaptures, and now d5 is isolated.' },
      { move: 'Bd3', color: 'w', text: 'Develop and prepare to attack the weak d5 pawn repeatedly. In the long term, isolated pawns become serious weaknesses!' }
    ]
  },
  {
    id: 'space-advantage',
    category: 'strategy',
    title: 'Space Advantage Strategy',
    description: 'Use space to restrict opponent pieces',
    difficulty: 'advanced',
    startingFen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 1',
    moves: [
      { move: 'e5', color: 'w', text: 'Gain space with e5! This advances your pawn, cramping Black\'s position and limiting piece mobility.' },
      { move: 'Nfd7', color: 'b', text: 'The knight is forced to a passive square.' },
      { move: 'f4', color: 'w', text: 'Continue gaining space! With more space, your pieces have more squares to operate, while your opponent\'s pieces are cramped.' }
    ]
  },
  {
    id: 'bishop-pair',
    category: 'strategy',
    title: 'The Bishop Pair Advantage',
    description: 'Learn how to leverage the two bishops',
    difficulty: 'intermediate',
    startingFen: 'r1bq1rk1/ppp2ppp/2n2n2/3p4/1b1P4/2NBPN2/PPP2PPP/R1BQK2R w KQ - 0 1',
    moves: [
      { move: 'Bxc6', color: 'w', text: 'Trade your knight for Black\'s bishop. This gives you the bishop pair.' },
      { move: 'bxc6', color: 'b', text: 'Black recaptures.' },
      { move: 'O-O', color: 'w', text: 'Castle and enjoy the bishop pair! In open positions, two bishops are often stronger than two knights or bishop + knight because they control long diagonals.' }
    ]
  },
  {
    id: 'open-files',
    category: 'strategy',
    title: 'Controlling Open Files',
    description: 'Master rook placement on open files',
    difficulty: 'intermediate',
    startingFen: 'r2qr1k1/ppp2ppp/2n2n2/3p4/1b1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
    moves: [
      { move: 'Rc1', color: 'w', text: 'Seize the open c-file with your rook! Open files are highways for rooks.' },
      { move: 'Rc8', color: 'b', text: 'Black contests the file.' },
      { move: 'Qb3', color: 'w', text: 'Support your control of the c-file and apply pressure. Controlling open files gives you attacking chances and penetration routes.' }
    ]
  },
  {
    id: 'minority-attack',
    category: 'strategy',
    title: 'Minority Attack Technique',
    description: 'Learn the classic minority attack strategy',
    difficulty: 'advanced',
    startingFen: 'r2qkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 1',
    moves: [
      { move: 'b4', color: 'w', text: 'Start the minority attack! Advance your queenside pawns (2 vs 3) to create weaknesses in Black\'s pawn structure.' },
      { move: 'a6', color: 'b', text: 'Black tries to slow down the attack.' },
      { move: 'b5', color: 'w', text: 'Push forward! This will force Black to make a decision about the c6 pawn.' },
      { move: 'axb5', color: 'b', text: 'Black exchanges.' },
      { move: 'cxb5', color: 'w', text: 'Now the c6 pawn is backward and weak! The minority attack aims to create permanent structural weaknesses in the opponent\'s position.' }
    ]
  },
  {
    id: 'prophylaxis',
    category: 'strategy',
    title: 'Prophylactic Thinking',
    description: 'Prevent opponent plans before they happen',
    difficulty: 'advanced',
    startingFen: 'r1bq1rk1/ppp2ppp/2np1n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1',
    moves: [
      { move: 'a3', color: 'w', text: 'Prophylaxis! Before Black can play ...Ba5, we prevent it. Prophylactic moves prevent opponent threats before they materialize.' },
      { move: 'Bc5', color: 'b', text: 'Black moves the bishop anyway.' },
      { move: 'b4', color: 'w', text: 'Now we can attack the bishop. By preventing ...Ba5, we maintained the option to push b4. Good prophylaxis requires anticipating your opponent\'s plans!' }
    ]
  }
];

export function getLessonsByCategory(category: Lesson['category']): Lesson[] {
  return chessLessons.filter(lesson => lesson.category === category);
}

export function getLessonsByDifficulty(difficulty: Lesson['difficulty']): Lesson[] {
  return chessLessons.filter(lesson => lesson.difficulty === difficulty);
}

export function getLessonById(id: string): Lesson | undefined {
  return chessLessons.find(lesson => lesson.id === id);
}
