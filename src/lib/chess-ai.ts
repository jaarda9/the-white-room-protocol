import { Chess, Square } from 'chess.js';

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100,  // Pawn
  n: 320,  // Knight
  b: 330,  // Bishop
  r: 500,  // Rook
  q: 900,  // Queen
  k: 20000 // King
};

// Piece-square tables for positional evaluation
// Values are from White's perspective (reversed for Black)

const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLE_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

const KING_END_TABLE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
];

function getPieceSquareTable(piece: string): number[] {
  switch (piece) {
    case 'p': return PAWN_TABLE;
    case 'n': return KNIGHT_TABLE;
    case 'b': return BISHOP_TABLE;
    case 'r': return ROOK_TABLE;
    case 'q': return QUEEN_TABLE;
    case 'k': return KING_MIDDLE_TABLE; // Will switch to end game table later
    default: return Array(64).fill(0);
  }
}

function isEndgame(game: Chess): boolean {
  // Simple endgame detection: queens traded or very few pieces
  const board = game.board();
  let pieceCount = 0;
  let queenCount = 0;
  
  for (const row of board) {
    for (const square of row) {
      if (square && square.type !== 'k') {
        pieceCount++;
        if (square.type === 'q') queenCount++;
      }
    }
  }
  
  return queenCount === 0 || pieceCount <= 6;
}

function evaluatePosition(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -99999 : 99999;
  }
  
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0;
  }
  
  let evaluation = 0;
  const board = game.board();
  const endgame = isEndgame(game);
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const pieceValue = PIECE_VALUES[piece.type];
      const table = piece.type === 'k' && endgame ? KING_END_TABLE : getPieceSquareTable(piece.type);
      
      // Calculate position index (flip for black)
      const positionIndex = piece.color === 'w' 
        ? row * 8 + col 
        : (7 - row) * 8 + col;
      
      const positionValue = table[positionIndex];
      const totalValue = pieceValue + positionValue;
      
      evaluation += piece.color === 'w' ? totalValue : -totalValue;
    }
  }
  
  // Bonus for mobility (number of legal moves)
  const mobilityBonus = game.moves().length;
  evaluation += game.turn() === 'w' ? mobilityBonus * 2 : -mobilityBonus * 2;
  
  return evaluation;
}

function orderMoves(game: Chess) {
  const moves = game.moves({ verbose: true });
  
  // Sort moves: captures first, then checks, then others
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    
    // Prioritize captures
    if (a.captured) {
      scoreA += PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece];
    }
    if (b.captured) {
      scoreB += PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece];
    }
    
    // Prioritize promotions
    if (a.promotion) scoreA += 900;
    if (b.promotion) scoreB += 900;
    
    return scoreB - scoreA;
  });
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluatePosition(game);
  }
  
  const moves = orderMoves(game);
  
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      
      if (beta <= alpha) {
        break; // Beta cutoff
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      
      if (beta <= alpha) {
        break; // Alpha cutoff
      }
    }
    return minEval;
  }
}

export function getBestMove(game: Chess, depth: number = 4): string | null {
  const moves = orderMoves(game);
  if (moves.length === 0) return null;
  
  let bestMove = moves[0];
  let bestValue = -Infinity;
  const isMaximizing = game.turn() === 'b'; // AI plays as black
  
  for (const move of moves) {
    game.move(move);
    const value = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
    game.undo();
    
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  
  return bestMove.san;
}

export function getHintMove(game: Chess): string | null {
  // Use depth 3 for hints to be faster
  const moves = orderMoves(game);
  if (moves.length === 0) return null;
  
  let bestMove = moves[0];
  let bestValue = -Infinity;
  const isMaximizing = game.turn() === 'w'; // Hint for white
  
  for (const move of moves) {
    game.move(move);
    const value = minimax(game, 3, -Infinity, Infinity, !isMaximizing);
    game.undo();
    
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  
  return bestMove.san;
}

export function evaluateCurrentPosition(game: Chess): {
  score: number;
  advantage: 'white' | 'black' | 'equal';
  evaluation: string;
} {
  const score = evaluatePosition(game);
  const normalizedScore = score / 100; // Convert to pawn units
  
  let advantage: 'white' | 'black' | 'equal';
  if (Math.abs(normalizedScore) < 0.5) {
    advantage = 'equal';
  } else if (normalizedScore > 0) {
    advantage = 'white';
  } else {
    advantage = 'black';
  }
  
  const absScore = Math.abs(normalizedScore).toFixed(1);
  let evaluation: string;
  
  if (advantage === 'equal') {
    evaluation = 'Equal position';
  } else if (Math.abs(normalizedScore) < 1) {
    evaluation = `Slight advantage for ${advantage} (+${absScore})`;
  } else if (Math.abs(normalizedScore) < 3) {
    evaluation = `Clear advantage for ${advantage} (+${absScore})`;
  } else {
    evaluation = `Winning for ${advantage} (+${absScore})`;
  }
  
  return { score: normalizedScore, advantage, evaluation };
}
