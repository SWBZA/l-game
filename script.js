/* ================================================================
   L-Game — Full Implementation
   ================================================================ */

// ─── Constants ───────────────────────────────────────────────────
const BOARD_SIZE = 4;
const CELLS = ['P1', 'P2', 'N1', 'N2'];
const AI_DELAY_MS = 600;

// ─── L-Piece Orientation Utilities ───────────────────────────────

/**
 * Generate all 8 unique L-tetromino orientations.
 * Base shape (└):
 *   X X       (0,0) (0,1)
 *   X         (1,0)
 *   X         (2,0)
 * Returns an array of orientation objects:
 *   { cells: [[r,c], ...], rows, cols }
 */
function generateOrientations() {
    // Base └ shape: [row, col] relative to anchor (top-left of bounding box)
    const base = [[0, 0], [0, 1], [1, 0], [2, 0]];

    function normalize(cells) {
        const minR = Math.min(...cells.map(c => c[0]));
        const minC = Math.min(...cells.map(c => c[1]));
        const norm = cells.map(([r, c]) => [r - minR, c - minC]);
        norm.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        return norm;
    }

    function rotateCW(cells) {
        // (r,c) → (c, maxR - r) where maxR is max row in current shape
        const maxR = Math.max(...cells.map(c => c[0]));
        return cells.map(([r, c]) => [c, maxR - r]);
    }

    function mirrorH(cells) {
        const maxC = Math.max(...cells.map(c => c[1]));
        return cells.map(([r, c]) => [r, maxC - c]);
    }

    function key(cells) {
        return cells.map(([r, c]) => `${r},${c}`).join(';');
    }

    const seen = new Set();
    const orientations = [];

    // Generate from base and its mirror
    for (const source of [base, mirrorH(base)]) {
        let shape = source.map(p => [...p]);
        for (let rot = 0; rot < 4; rot++) {
            const norm = normalize(shape);
            const k = key(norm);
            if (!seen.has(k)) {
                seen.add(k);
                const rows = Math.max(...norm.map(c => c[0])) + 1;
                const cols = Math.max(...norm.map(c => c[1])) + 1;
                orientations.push({ cells: norm, rows, cols });
            }
            shape = rotateCW(shape);
        }
    }

    return orientations;
}

const L_ORIENTATIONS = generateOrientations();

/** Return all cells occupied by an L-piece placed at anchor (ar, ac) in given orientation */
function getLCells(anchorR, anchorC, orientationIndex) {
    return L_ORIENTATIONS[orientationIndex].cells.map(([dr, dc]) => [anchorR + dr, anchorC + dc]);
}

/** Check if a set of cells (from getLCells) is valid (within board and not overlapping others) */
function isValidLCells(cells, board, excludeCells = []) {
    const excludeSet = new Set(excludeCells.map(([r, c]) => `${r},${c}`));
    for (const [r, c] of cells) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
        if (!excludeSet.has(`${r},${c}`) && board[r][c] !== null) return false;
    }
    return true;
}

/** Compute all valid placements for an L-piece */
function getAllValidPlacements(board, player, currentCells) {
    const currentSet = new Set(currentCells.map(([r, c]) => `${r},${c}`));
    const placements = [];
    const seenKeys = new Set();

    for (let oi = 0; oi < L_ORIENTATIONS.length; oi++) {
        const orient = L_ORIENTATIONS[oi];
        for (let ar = 0; ar <= BOARD_SIZE - orient.rows; ar++) {
            for (let ac = 0; ac <= BOARD_SIZE - orient.cols; ac++) {
                const cells = getLCells(ar, ac, oi);
                const cellsKey = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([r, c]) => `${r},${c}`).join(';');
                if (seenKeys.has(cellsKey)) continue;

                // Must be a different position (covers at least one different square)
                const currentCovered = cells.every(([r, c]) => currentSet.has(`${r},${c}`));
                if (currentCovered) continue;

                // Exclude current L-cells from occupancy check so partial overlaps are allowed
                if (isValidLCells(cells, board, currentCells)) {
                    seenKeys.add(cellsKey);
                    placements.push({ anchorR: ar, anchorC: ac, orientation: oi, cells });
                }
            }
        }
    }
    return placements;
}

/** Check if current player has any legal L-piece move */
function hasLegalMove(board, player, currentCells) {
    return getAllValidPlacements(board, player, currentCells).length > 0;
}

// ─── Game State ──────────────────────────────────────────────────

class LGame {
    constructor() {
        this.board = [];
        this.playerData = {
            P1: null, // { orientation, anchorR, anchorC, cells: [[r,c],...] }
            P2: null
        };
        this.neutrals = {
            N1: null, // { r, c }
            N2: null
        };
        this.currentPlayer = 'P1';
        this.phase = 'L_MOVE';    // 'L_MOVE' | 'NEUTRAL_MOVE' | 'GAME_OVER'
        this.winner = null;
        this.validPlacements = [];
        this.selectedNeutral = null; // 'N1' | 'N2' | null
        this.validNeutralDests = [];
        this.moveCount = 0;
        this.initBoard();
    }

    initBoard() {
        // Empty board
        this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

        // ─── Official starting layout ───────────────────────────────
        // Columns: A(0) B(1) C(2) D(3), Rows: 1(0) 2(1) 3(2) 4(3)
        //
        //     A B C D
        //   1 N1 R R .
        //   2 . G R .
        //   3 . G R .
        //   4 . G G N2
        //
        // Red P1 (Player 1): ┐ shape, covers B1,C1,C2,C3
        //   ┐ = cells [[0,0],[0,1],[1,1],[2,1]], 3×2 bounding box
        const p1OriIdx = L_ORIENTATIONS.findIndex(o =>
            o.rows === 3 && o.cols === 2 &&
            o.cells[0][0] === 0 && o.cells[0][1] === 0 &&
            o.cells[1][0] === 0 && o.cells[1][1] === 1 &&
            o.cells[2][0] === 1 && o.cells[2][1] === 1
        );
        const p1Cells = getLCells(0, 1, p1OriIdx);
        this.playerData.P1 = { orientation: p1OriIdx, anchorR: 0, anchorC: 1, cells: p1Cells };
        for (const [r, c] of p1Cells) this.board[r][c] = 'P1';

        // Green P2 (Player 2): ┘ shape (180° rotated └), covers B2,B3,B4,C4
        //   ┘ = cells [[0,0],[1,0],[2,0],[2,1]], 3×2 bounding box
        const p2OriIdx = L_ORIENTATIONS.findIndex(o =>
            o.rows === 3 && o.cols === 2 &&
            o.cells[0][0] === 0 && o.cells[0][1] === 0 &&
            o.cells[1][0] === 1 && o.cells[1][1] === 0 &&
            o.cells[2][0] === 2 && o.cells[2][1] === 0 &&
            o.cells[3][0] === 2 && o.cells[3][1] === 1
        );
        const p2Cells = getLCells(1, 1, p2OriIdx);
        this.playerData.P2 = { orientation: p2OriIdx, anchorR: 1, anchorC: 1, cells: p2Cells };
        for (const [r, c] of p2Cells) this.board[r][c] = 'P2';

        // Neutral pieces
        this.neutrals.N1 = { r: 0, c: 0 };
        this.board[0][0] = 'N1';
        this.neutrals.N2 = { r: 3, c: 3 };
        this.board[3][3] = 'N2';

        this.currentPlayer = 'P1';
        this.phase = 'L_MOVE';
        this.winner = null;
        this.selectedNeutral = null;

        // Precompute valid placements for current player
        this.refreshValidPlacements();

        // Check if current player has any moves — if not, other player wins
        this.checkInitialWin();
    }

    /** Refresh valid L-piece placements for current player */
    refreshValidPlacements() {
        const data = this.playerData[this.currentPlayer];
        this.validPlacements = getAllValidPlacements(this.board, this.currentPlayer, data.cells);
    }

    /** Check if current player has any L-piece move; if not, game over */
    checkInitialWin() {
        if (this.validPlacements.length === 0) {
            this.phase = 'GAME_OVER';
            this.winner = this.currentPlayer === 'P1' ? 'P2' : 'P1';
        }
    }

    /** Attempt to place the current player's L-piece at a given placement */
    placeLPiece(placement) {
        if (this.phase !== 'L_MOVE') return false;

        const data = this.playerData[this.currentPlayer];
        // Remove old cells
        for (const [r, c] of data.cells) {
            if (this.board[r][c] === this.currentPlayer) {
                this.board[r][c] = null;
            }
        }

        // Place new cells
        for (const [r, c] of placement.cells) {
            this.board[r][c] = this.currentPlayer;
        }

        // Update player data
        data.anchorR = placement.anchorR;
        data.anchorC = placement.anchorC;
        data.orientation = placement.orientation;
        data.cells = placement.cells;

        this.moveCount++;

        // Transition to neutral move phase
        this.phase = 'NEUTRAL_MOVE';
        this.selectedNeutral = null;
        this.validNeutralDests = [];
        this.validPlacements = [];
        return true;
    }

    /** Get neutral piece IDs that are movable */
    getMovableNeutrals() {
        return ['N1', 'N2'].filter(id => {
            const pos = this.neutrals[id];
            return pos !== null;
        });
    }

    /** Get valid destination cells for a neutral piece */
    getValidNeutralDests(neutralId) {
        const pos = this.neutrals[neutralId];
        if (!pos) return [];
        const dests = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board[r][c] === null) {
                    dests.push({ r, c });
                }
            }
        }
        return dests;
    }

    /** Select a neutral piece to move */
    selectNeutral(neutralId) {
        if (this.phase !== 'NEUTRAL_MOVE') return false;
        if (!this.getMovableNeutrals().includes(neutralId)) return false;

        this.selectedNeutral = neutralId;
        this.validNeutralDests = this.getValidNeutralDests(neutralId);
        return true;
    }

    /** Place the selected neutral piece at a destination */
    placeNeutral(destR, destC) {
        if (this.phase !== 'NEUTRAL_MOVE' || !this.selectedNeutral) return false;

        const valid = this.validNeutralDests.some(d => d.r === destR && d.c === destC);
        if (!valid) return false;

        const id = this.selectedNeutral;
        const oldPos = this.neutrals[id];

        // Remove from old position
        if (oldPos && this.board[oldPos.r][oldPos.c] === id) {
            this.board[oldPos.r][oldPos.c] = null;
        }

        // Place at new position
        this.board[destR][destC] = id;
        this.neutrals[id] = { r: destR, c: destC };

        this.selectedNeutral = null;
        this.validNeutralDests = [];

        // End turn
        this.endTurn();
        return true;
    }

    /** Skip neutral move */
    skipNeutral() {
        if (this.phase !== 'NEUTRAL_MOVE') return false;
        this.selectedNeutral = null;
        this.validNeutralDests = [];
        this.endTurn();
        return true;
    }

    /** End current player's turn and switch */
    endTurn() {
        this.currentPlayer = this.currentPlayer === 'P1' ? 'P2' : 'P1';
        this.phase = 'L_MOVE';
        this.selectedNeutral = null;
        this.validNeutralDests = [];

        this.refreshValidPlacements();
        this.checkInitialWin();
    }

    /** Get the cells of the current player's L-piece */
    getCurrentLCells() {
        return this.playerData[this.currentPlayer].cells;
    }

    /** Check if game is over */
    isGameOver() {
        return this.phase === 'GAME_OVER';
    }

    /** Reset the game */
    reset() {
        this.initBoard();
    }
}

// ─── UI Controller ──────────────────────────────────────────────

// ─── AI Opponent ─────────────────────────────────────────────────

/**
 * Dispatcher — returns a move based on the selected difficulty.
 */
function computeAIMove(game, difficulty) {
    if (difficulty === 'easy') return computeAIMoveEasy(game);
    if (difficulty === 'hard') return computeAIMoveHard(game);
    return computeAIMoveMedium(game); // default: medium
}

/**
 * Easy AI: pick a random legal move.
 */
function computeAIMoveEasy(game) {
    const player = game.currentPlayer;
    const data = game.playerData[player];
    const placements = getAllValidPlacements(game.board, player, data.cells);
    if (placements.length === 0) return null;

    // Pick a random L-piece placement
    const placement = placements[Math.floor(Math.random() * placements.length)];

    // Build temporary board with this placement applied
    const boardClone = game.board.map(row => [...row]);
    for (const [r, c] of data.cells) {
        if (boardClone[r][c] === player) boardClone[r][c] = null;
    }
    for (const [r, c] of placement.cells) {
        boardClone[r][c] = player;
    }

    // Generate valid neutral options after this L placement
    const neutralOptions = [{ type: 'skip' }];
    for (const nid of ['N1', 'N2']) {
        const pos = game.neutrals[nid];
        if (!pos) continue;
        if (boardClone[pos.r][pos.c] === nid) boardClone[pos.r][pos.c] = null;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (boardClone[r][c] === null) {
                    neutralOptions.push({ type: 'move', id: nid, r, c });
                }
            }
        }
        boardClone[pos.r][pos.c] = nid;
    }

    const neutralAction = neutralOptions[Math.floor(Math.random() * neutralOptions.length)];
    return { placement, neutralAction };
}

/**
 * Medium AI: one-ply lookahead evaluating opponent mobility.
 * For each L-piece placement + neutral option, count the opponent's
 * legal moves (lower = better) and own future moves (higher = better).
 */
function computeAIMoveMedium(game) {
    const player = game.currentPlayer;
    const data = game.playerData[player];
    const placements = getAllValidPlacements(game.board, player, data.cells);

    if (placements.length === 0) return null;

    let bestScore = Infinity;
    let bestMove = null;

    for (const placement of placements) {
        // Clone the relevant state for simulation
        const boardClone = game.board.map(row => [...row]);
        const pDataClone = {
            P1: { ...game.playerData.P1, cells: [...game.playerData.P1.cells] },
            P2: { ...game.playerData.P2, cells: [...game.playerData.P2.cells] }
        };
        const neutralClone = {
            N1: { ...game.neutrals.N1 },
            N2: { ...game.neutrals.N2 }
        };

        // Apply L-piece placement
        for (const [r, c] of data.cells) {
            if (boardClone[r][c] === player) boardClone[r][c] = null;
        }
        for (const [r, c] of placement.cells) {
            boardClone[r][c] = player;
        }
        pDataClone[player].cells = placement.cells;

        // Generate neutral options: skip, or move each neutral to any empty cell
        const neutralOptions = [{ type: 'skip' }];
        for (const nid of ['N1', 'N2']) {
            const pos = neutralClone[nid];
            if (!pos) continue;
            if (boardClone[pos.r][pos.c] === nid) boardClone[pos.r][pos.c] = null;
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (boardClone[r][c] === null) {
                        neutralOptions.push({ type: 'move', id: nid, r, c });
                    }
                }
            }
            boardClone[pos.r][pos.c] = nid;
        }

        for (const nOpt of neutralOptions) {
            const simBoard = boardClone.map(row => [...row]);
            const simNeutral = { N1: { ...neutralClone.N1 }, N2: { ...neutralClone.N2 } };

            if (nOpt.type === 'move') {
                const oldPos = simNeutral[nOpt.id];
                if (oldPos && simBoard[oldPos.r][oldPos.c] === nOpt.id) {
                    simBoard[oldPos.r][oldPos.c] = null;
                }
                simBoard[nOpt.r][nOpt.c] = nOpt.id;
                simNeutral[nOpt.id] = { r: nOpt.r, c: nOpt.c };
            }

            // Count opponent's legal moves
            const opponent = player === 'P1' ? 'P2' : 'P1';
            const opponentCells = pDataClone[opponent].cells;
            const oppMoves = getAllValidPlacements(simBoard, opponent, opponentCells).length;

            // Primary score: opponent mobility (lower = better)
            // Secondary tiebreaker: own mobility after the move (higher = better)
            const ownMoves = getAllValidPlacements(simBoard, player, placement.cells).length;
            const score = oppMoves * 1000 - ownMoves;

            if (score < bestScore || (score === bestScore && Math.random() < 0.2)) {
                bestScore = score;
                bestMove = { placement, neutralAction: nOpt };
            }
        }
    }

    return bestMove;
}

/**
 * Hard AI: two-ply minimax.
 * For each of the AI's (L + neutral) moves, simulates the opponent's
 * best response, then evaluates how many legal moves the AI would have
 * left. Picks the move that maximizes the AI's minimum future mobility.
 */
function computeAIMoveHard(game) {
    const player = game.currentPlayer;
    const data = game.playerData[player];
    const placements = getAllValidPlacements(game.board, player, data.cells);
    if (placements.length === 0) return null;

    let bestScore = -Infinity;
    let bestMove = null;

    for (const placement of placements) {
        // Clone state
        const boardClone = game.board.map(row => [...row]);
        const pDataClone = {
            P1: { ...game.playerData.P1, cells: [...game.playerData.P1.cells] },
            P2: { ...game.playerData.P2, cells: [...game.playerData.P2.cells] }
        };
        const neutralClone = {
            N1: { ...game.neutrals.N1 },
            N2: { ...game.neutrals.N2 }
        };

        // Apply L-piece placement
        for (const [r, c] of data.cells) {
            if (boardClone[r][c] === player) boardClone[r][c] = null;
        }
        for (const [r, c] of placement.cells) {
            boardClone[r][c] = player;
        }
        pDataClone[player].cells = placement.cells;

        // Generate neutral options
        const neutralOptions = [{ type: 'skip' }];
        for (const nid of ['N1', 'N2']) {
            const pos = neutralClone[nid];
            if (!pos) continue;
            if (boardClone[pos.r][pos.c] === nid) boardClone[pos.r][pos.c] = null;
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (boardClone[r][c] === null) {
                        neutralOptions.push({ type: 'move', id: nid, r, c });
                    }
                }
            }
            boardClone[pos.r][pos.c] = nid;
        }

        for (const nOpt of neutralOptions) {
            // Apply AI's neutral option
            const simBoard = boardClone.map(row => [...row]);
            const simNeutral = { N1: { ...neutralClone.N1 }, N2: { ...neutralClone.N2 } };

            if (nOpt.type === 'move') {
                const oldPos = simNeutral[nOpt.id];
                if (oldPos && simBoard[oldPos.r][oldPos.c] === nOpt.id) {
                    simBoard[oldPos.r][oldPos.c] = null;
                }
                simBoard[nOpt.r][nOpt.c] = nOpt.id;
                simNeutral[nOpt.id] = { r: nOpt.r, c: nOpt.c };
            }

            // ─── Two-ply: simulate opponent's best response ───
            const opponent = player === 'P1' ? 'P2' : 'P1';
            const oppCells = pDataClone[opponent].cells;

            const oppPlacements = getAllValidPlacements(simBoard, opponent, oppCells);

            if (oppPlacements.length === 0) {
                // Opponent has no legal L moves → AI wins immediately
                const score = 1000000;
                if (score > bestScore || (score === bestScore && Math.random() < 0.2)) {
                    bestScore = score;
                    bestMove = { placement, neutralAction: nOpt };
                }
                continue;
            }

            // Opponent will choose the response that minimizes AI's future mobility
            let worstOutcomeForAI = Infinity;

            for (const oppPlacement of oppPlacements) {
                const simBoard2 = simBoard.map(row => [...row]);
                const pDataClone2 = {
                    P1: { ...pDataClone.P1, cells: [...pDataClone.P1.cells] },
                    P2: { ...pDataClone.P2, cells: [...pDataClone.P2.cells] }
                };
                const neutralClone2 = {
                    N1: { ...simNeutral.N1 },
                    N2: { ...simNeutral.N2 }
                };

                // Apply opponent L-piece
                for (const [r, c] of oppCells) {
                    if (simBoard2[r][c] === opponent) simBoard2[r][c] = null;
                }
                for (const [r, c] of oppPlacement.cells) {
                    simBoard2[r][c] = opponent;
                }
                pDataClone2[opponent].cells = oppPlacement.cells;

                // Generate opponent neutral options
                const oppNeutralOptions = [{ type: 'skip' }];
                for (const nid of ['N1', 'N2']) {
                    const pos = neutralClone2[nid];
                    if (!pos) continue;
                    if (simBoard2[pos.r][pos.c] === nid) simBoard2[pos.r][pos.c] = null;
                    for (let r = 0; r < BOARD_SIZE; r++) {
                        for (let c = 0; c < BOARD_SIZE; c++) {
                            if (simBoard2[r][c] === null) {
                                oppNeutralOptions.push({ type: 'move', id: nid, r, c });
                            }
                        }
                    }
                    simBoard2[pos.r][pos.c] = nid;
                }

                // Find opponent's best neutral option (minimizes AI's future moves)
                let bestOppOutcome = Infinity;
                for (const oppNOpt of oppNeutralOptions) {
                    const simBoard3 = simBoard2.map(row => [...row]);
                    const simNeutral3 = { ...neutralClone2 };

                    if (oppNOpt.type === 'move') {
                        const oldPos = simNeutral3[oppNOpt.id];
                        if (oldPos && simBoard3[oldPos.r][oldPos.c] === oppNOpt.id) {
                            simBoard3[oldPos.r][oldPos.c] = null;
                        }
                        simBoard3[oppNOpt.r][oppNOpt.c] = oppNOpt.id;
                        simNeutral3[oppNOpt.id] = { r: oppNOpt.r, c: oppNOpt.c };
                    }

                    // Count AI's legal moves after opponent's full move
                    const aiMoves = getAllValidPlacements(simBoard3, player, placement.cells).length;

                    if (aiMoves < bestOppOutcome) {
                        bestOppOutcome = aiMoves;
                    }
                }

                if (bestOppOutcome < worstOutcomeForAI) {
                    worstOutcomeForAI = bestOppOutcome;
                }
            }

            // Score: higher = better for AI
            // worstOutcomeForAI = AI's legal moves after opponent's best response
            // Negate so higher score = more moves for AI
            const score = -worstOutcomeForAI;

            if (score > bestScore || (score === bestScore && Math.random() < 0.2)) {
                bestScore = score;
                bestMove = { placement, neutralAction: nOpt };
            }
        }
    }

    return bestMove;
}

// ─── UI Controller ──────────────────────────────────────────────

class LGameUI {
    constructor() {
        this.game = new LGame();
        this.aiMode = true;
        this.aiGoesFirst = false; // false = human is P1 (goes first), true = AI is P1
        this.aiThinking = false;
        this.boardEl = document.getElementById('board');
        this.turnText = document.getElementById('turn-text');
        this.phaseText = document.getElementById('phase-text');
        this.messagesEl = document.getElementById('messages');
        this.skipBtn = document.getElementById('skip-neutral-btn');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.modeBtn = document.getElementById('mode-btn');
        this.gameResult = document.getElementById('game-result');
        this.winnerText = document.getElementById('winner-text');
        this.p1Label = document.getElementById('player1-label');
        this.p2Label = document.getElementById('player2-label');
        this.p1Status = document.getElementById('p1-status');
        this.p2Status = document.getElementById('p2-status');
        this.firstBtn = document.getElementById('first-btn');
        this.secondBtn = document.getElementById('second-btn');
        this.firstMoveGroup = document.getElementById('first-move-group');

        // Difficulty selector
        this.difficulty = 'medium';
        this.easyBtn = document.getElementById('easy-btn');
        this.mediumBtn = document.getElementById('medium-btn');
        this.hardBtn = document.getElementById('hard-btn');
        this.difficultyGroup = document.getElementById('difficulty-group');

        this.skipBtn.addEventListener('click', () => this.handleSkip());
        this.newGameBtn.addEventListener('click', () => this.handleNewGame());
        if (this.modeBtn) {
            this.modeBtn.addEventListener('click', () => this.toggleMode());
        }
        if (this.firstBtn) {
            this.firstBtn.addEventListener('click', () => this.handleFirstMoveChoice(false));
        }
        if (this.secondBtn) {
            this.secondBtn.addEventListener('click', () => this.handleFirstMoveChoice(true));
        }
        if (this.easyBtn) {
            this.easyBtn.addEventListener('click', () => this.handleDifficultyChoice('easy'));
        }
        if (this.mediumBtn) {
            this.mediumBtn.addEventListener('click', () => this.handleDifficultyChoice('medium'));
        }
        if (this.hardBtn) {
            this.hardBtn.addEventListener('click', () => this.handleDifficultyChoice('hard'));
        }

        // Hover state: the currently hovered placement object
        this.hoveredPlacement = null;

        // Animation state
        this.animating = false;
        this.animationState = null;

        // Overlay animation state
        this.overlayNewOnlyCells = null; // Set<"r,c"> — suppress these cells during overlay flight
        this.activeOverlay = null;

        this.render();
        // Show first-move and difficulty groups if in AI mode
        if (this.firstMoveGroup) {
            this.firstMoveGroup.classList.toggle('hidden', !this.aiMode);
        }
        if (this.difficultyGroup) {
            this.difficultyGroup.classList.toggle('hidden', !this.aiMode);
        }
        this.triggerAIIfNeeded();
    }

    render() {
        this.renderBoard();
        this.renderUI();
    }

    /**
     * Animate a move and render with ghost/enter effects.
     * Call AFTER game state has been updated.
     * @param {Array|null} oldLCells - old L-piece cells [[r,c],...] or null
     * @param {Array|null} newLCells - new L-piece cells [[r,c],...] or null
     * @param {string|null} player - 'P1' or 'P2'
     * @param {object|null} oldNeutral - old neutral position {r,c} or null
     * @param {object|null} newNeutral - new neutral position {r,c} or null
     * @param {function} callback - called after animation completes
     */
    animateAndRender(oldLCells, newLCells, player, oldNeutral, newNeutral, callback) {
        this.animating = true;

        const doNeutralThenCallback = () => {
            if (oldNeutral && newNeutral) {
                this.animationState = { oldNeutral, newNeutral };
                this.render();
                setTimeout(() => {
                    this.animating = false;
                    this.animationState = null;
                    if (callback) callback();
                }, 600);
            } else {
                this.animating = false;
                if (callback) callback();
            }
        };

        if (oldLCells && newLCells && player) {
            this.animateLPieceTransition(oldLCells, newLCells, player, doNeutralThenCallback);
        } else {
            doNeutralThenCallback();
        }
    }

    animateLPieceTransition(oldCells, newCells, player, callback) {
        const boardWrapper = this.boardEl.parentElement;
        const color = player === 'P1' ? '#e94560' : '#0f8a5f';

        // Render board with new state, but suppress cells that only appear in the new position
        // so they stay empty while the overlay piece flies in from the old position
        const oldSet = new Set(oldCells.map(([r, c]) => `${r},${c}`));
        this.overlayNewOnlyCells = new Set(
            newCells.filter(([r, c]) => !oldSet.has(`${r},${c}`)).map(([r, c]) => `${r},${c}`)
        );
        this.render();

        // Measure cell positions relative to board-wrapper after render
        const wRect = boardWrapper.getBoundingClientRect();
        const getCellRect = (r, c) => {
            const el = this.boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return { x: rect.left - wRect.left, y: rect.top - wRect.top, w: rect.width, h: rect.height };
        };

        const oldRects = oldCells.map(([r, c]) => getCellRect(r, c));
        const newRects = newCells.map(([r, c]) => getCellRect(r, c));

        // Match each old cell to its nearest new cell (greedy nearest-neighbour)
        const usedNew = new Set();
        const matched = oldRects.map(oRect => {
            if (!oRect) return 0;
            const oc = { x: oRect.x + oRect.w / 2, y: oRect.y + oRect.h / 2 };
            let bestDist = Infinity, bestJ = 0;
            newRects.forEach((nRect, j) => {
                if (usedNew.has(j) || !nRect) return;
                const nc = { x: nRect.x + nRect.w / 2, y: nRect.y + nRect.h / 2 };
                const d = Math.hypot(nc.x - oc.x, nc.y - oc.y);
                if (d < bestDist) { bestDist = d; bestJ = j; }
            });
            usedNew.add(bestJ);
            return bestJ;
        });

        // Compute centroid movement for tilt
        const validOld = oldRects.filter(Boolean);
        const validNew = newRects.filter(Boolean);
        const oldCx = validOld.reduce((s, r) => s + r.x + r.w / 2, 0) / validOld.length;
        const oldCy = validOld.reduce((s, r) => s + r.y + r.h / 2, 0) / validOld.length;
        const newCx = validNew.reduce((s, r) => s + r.x + r.w / 2, 0) / validNew.length;
        const newCy = validNew.reduce((s, r) => s + r.y + r.h / 2, 0) / validNew.length;
        const travelDist = Math.hypot(newCx - oldCx, newCy - oldCy);
        const tiltDeg = travelDist > 10 ? ((newCx - oldCx) / travelDist) * 14 : 0;

        // Build overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:100;overflow:visible;';
        boardWrapper.appendChild(overlay);
        this.activeOverlay = overlay;

        const LIFT = 11;
        const LIFT_MS = 140, FLY_MS = 330, STAMP_MS = 120, SETTLE_MS = 80;

        // Create one absolutely-positioned div per old cell
        const cellAnims = oldRects.map((oRect, i) => {
            const nRect = (matched[i] != null && newRects[matched[i]]) ? newRects[matched[i]] : oRect;
            const tdx = nRect.x - oRect.x;
            const tdy = nRect.y - oRect.y;
            const el = document.createElement('div');
            el.style.cssText = [
                `position:absolute`,
                `left:${oRect.x}px`,
                `top:${oRect.y}px`,
                `width:${oRect.w}px`,
                `height:${oRect.h}px`,
                `background:${color}`,
                `border-radius:6px`,
                `box-shadow:inset 0 -3px 0 rgba(0,0,0,0.2),inset 0 2px 0 rgba(255,255,255,0.15)`,
                `transform-origin:center center`,
                `will-change:transform,filter,box-shadow`,
            ].join(';');
            overlay.appendChild(el);
            return { el, tdx, tdy };
        });

        // Phase 1 — Lift: piece rises off the board
        requestAnimationFrame(() => {
            cellAnims.forEach(({ el }) => {
                el.style.transition = `transform ${LIFT_MS}ms cubic-bezier(0.4,0,0.6,1),filter ${LIFT_MS}ms ease,box-shadow ${LIFT_MS}ms ease`;
                el.style.transform = `translateY(-${LIFT}px) scale(1.07)`;
                el.style.filter = 'brightness(1.3)';
                el.style.boxShadow = '0 16px 24px rgba(0,0,0,0.5),inset 0 -3px 0 rgba(0,0,0,0.2),inset 0 2px 0 rgba(255,255,255,0.2)';
            });

            // Phase 2 — Fly: each cell slides to its matched destination while still aloft
            setTimeout(() => {
                cellAnims.forEach(({ el, tdx, tdy }) => {
                    el.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.4,0,0.2,1),filter ${FLY_MS}ms ease`;
                    el.style.transform = `translate(${tdx}px,${tdy - LIFT}px) scale(1.07) rotate(${tiltDeg}deg)`;
                });

                // Phase 3 — Stamp: land with downward momentum and upright
                setTimeout(() => {
                    cellAnims.forEach(({ el, tdx, tdy }) => {
                        el.style.transition = `transform ${STAMP_MS}ms ease-in,filter ${STAMP_MS}ms ease,box-shadow ${STAMP_MS}ms ease`;
                        el.style.transform = `translate(${tdx}px,${tdy + 4}px) scale(0.96) rotate(0deg)`;
                        el.style.filter = 'brightness(1)';
                        el.style.boxShadow = 'inset 0 -3px 0 rgba(0,0,0,0.2),inset 0 2px 0 rgba(255,255,255,0.15)';
                    });

                    // Phase 4 — Settle: spring to exact final position
                    setTimeout(() => {
                        cellAnims.forEach(({ el, tdx, tdy }) => {
                            el.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.34,1.56,0.64,1)`;
                            el.style.transform = `translate(${tdx}px,${tdy}px) scale(1)`;
                        });

                        setTimeout(() => {
                            this.overlayNewOnlyCells = null;
                            this.activeOverlay = null;
                            overlay.remove();
                            callback();
                        }, SETTLE_MS);
                    }, STAMP_MS);
                }, FLY_MS);
            }, LIFT_MS);
        });
    }

    renderBoard() {
        this.boardEl.innerHTML = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                this.updateCellAppearance(cell, r, c);
                cell.addEventListener('click', () => this.handleCellClick(r, c));
                cell.addEventListener('mouseenter', () => this.handleCellHover(r, c));
                cell.addEventListener('mouseleave', () => this.handleCellLeave());
                this.boardEl.appendChild(cell);
            }
        }
        // Board-level mouseleave: clear stale hover when mouse exits the board entirely
        this.boardEl.addEventListener('mouseleave', () => {
            if (this.hoveredPlacement) {
                this.hoveredPlacement = null;
            }
        });
    }

    /**
     * Lightweight hover-only visual update — toggles .hovered-placement
     * and .hover-piece on existing cells WITHOUT rebuilding the DOM.
     * This avoids flickering caused by full renderBoard() on every hover change.
     */
    updateHoverDisplay() {
        const cells = this.boardEl.querySelectorAll('.cell');
        const isP1 = !this.game.isGameOver() && this.game.currentPlayer === 'P1';

        for (const cell of cells) {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);

            const isHovered = this.hoveredPlacement !== null &&
                this.hoveredPlacement.cells.some(([pr, pc]) => pr === r && pc === c);

            // Remove existing hover classes/elements
            cell.classList.remove('hovered-placement');
            const existingHover = cell.querySelector('.hover-piece');
            if (existingHover) existingHover.remove();

            // Add hover preview if this cell is part of the current placement
            if (isHovered && !this.game.isGameOver() && this.game.phase === 'L_MOVE') {
                cell.classList.add('hovered-placement');
                const hoverPiece = document.createElement('div');
                hoverPiece.className = `hover-piece hover-${isP1 ? 'p1' : 'p2'}`;
                cell.appendChild(hoverPiece);
            }
        }
    }

    updateCellAppearance(cell, r, c) {
        const val = this.game.board[r][c];
        const isGameOver = this.game.isGameOver();
        const anim = this.animationState;

        // Clear dynamic classes
        cell.className = 'cell';
        cell.innerHTML = '';

        // During an overlay flight, suppress cells that only exist at the NEW position —
        // the overlay piece will fly in to cover them; revealing them early would ruin the effect.
        const displayVal = (this.overlayNewOnlyCells && this.overlayNewOnlyCells.has(`${r},${c}`))
            ? null : val;

        // Determine if this cell is part of the hovered placement
        const isHovered = this.hoveredPlacement !== null &&
            this.hoveredPlacement.cells.some(([pr, pc]) => pr === r && pc === c);

        // Helper: check if a cell was in the old L-piece position (for animation ghosts)
        const isOldLCell = anim && anim.oldLCells &&
            anim.oldLCells.some(([or, oc]) => or === r && oc === c);
        const isNewLCell = anim && anim.newLCells &&
            anim.newLCells.some(([nr, nc]) => nr === r && nc === c);
        const isOnlyOld = isOldLCell && !isNewLCell;

        // Piece rendering (hide pieces under hovered preview)
        if (displayVal === 'P1' && !isHovered) {
            const piece = document.createElement('div');
            piece.className = 'piece piece-p1';
            // Add entering animation to new L-cells not previously occupied
            if (anim && anim.newLCells && isNewLCell && !isOldLCell) {
                piece.classList.add('entering');
            }
            cell.appendChild(piece);
            cell.classList.add('has-l-piece');
        } else if (displayVal === 'P2' && !isHovered) {
            const piece = document.createElement('div');
            piece.className = 'piece piece-p2';
            if (anim && anim.newLCells && isNewLCell && !isOldLCell) {
                piece.classList.add('entering');
            }
            cell.appendChild(piece);
            cell.classList.add('has-l-piece');
        } else if (displayVal === 'N1' || displayVal === 'N2') {
            if (!isHovered) {
                const piece = document.createElement('div');
                piece.className = 'piece piece-neutral';
                // Add entering animation to neutral at its new position
                if (anim && anim.newNeutral &&
                    anim.newNeutral.r === r && anim.newNeutral.c === c) {
                    piece.classList.add('entering');
                }
                cell.appendChild(piece);
            }
        }

        // Ghost piece at old L-piece position (fading out)
        if (isOnlyOld) {
            const ghost = document.createElement('div');
            const ghostPlayer = anim.player === 'P1' ? 'p1' : 'p2';
            ghost.className = `piece-ghost ghost-${ghostPlayer}`;
            cell.appendChild(ghost);
        }

        // Ghost piece at old neutral position (fading out)
        if (anim && anim.oldNeutral &&
            r === anim.oldNeutral.r && c === anim.oldNeutral.c &&
            !(anim.newNeutral && anim.newNeutral.r === r && anim.newNeutral.c === c)) {
            const ghost = document.createElement('div');
            ghost.className = 'piece-ghost ghost-neutral';
            cell.appendChild(ghost);
        }

        if (isGameOver) return;

        // L-piece phase: only show hover preview — no pre-highlighted squares
        if (this.game.phase === 'L_MOVE') {
            const isP1 = this.game.currentPlayer === 'P1';

            // Hovered placement: draw full L-piece shape on all its cells
            if (isHovered) {
                cell.classList.add('hovered-placement');
                const hoverPiece = document.createElement('div');
                hoverPiece.className = `hover-piece hover-${isP1 ? 'p1' : 'p2'}`;
                cell.appendChild(hoverPiece);
            }
        }

        // Neutral phase: highlight clickable neutrals
        if (this.game.phase === 'NEUTRAL_MOVE') {
            if (val === 'N1' || val === 'N2') {
                if (this.game.getMovableNeutrals().includes(val)) {
                    cell.classList.add('clickable-neutral');
                }
            }
            // Highlight selected neutral
            if (this.game.selectedNeutral && val === this.game.selectedNeutral) {
                cell.classList.add('selected-neutral');
            }
            // Valid neutral destinations
            if (this.game.selectedNeutral && val === null) {
                const isValid = this.game.validNeutralDests.some(d => d.r === r && d.c === c);
                if (isValid) {
                    cell.classList.add('valid-neutral-dest');
                }
            }
        }
    }

    renderUI() {
        const p = this.game.currentPlayer;
        const pColor = p === 'P1' ? 'Player 1' : 'Player 2';
        const isAiTurn = this.aiMode && !this.game.isGameOver() &&
            ((this.aiGoesFirst && p === 'P1') || (!this.aiGoesFirst && p === 'P2'));

        this.turnText.textContent = isAiTurn ? 'AI is thinking...' : `${pColor}'s Turn`;
        this.turnText.style.color = p === 'P1' ? '#e94560' : '#0f8a5f';
        if (isAiTurn) this.turnText.style.color = '#888';

        // Phase text
        if (this.game.isGameOver()) {
            this.phaseText.textContent = 'Game Over';
        } else if (isAiTurn) {
            this.phaseText.textContent = 'Computer is calculating its move...';
        } else if (this.game.phase === 'L_MOVE') {
            this.phaseText.textContent = 'Hover empty squares to preview, then click to place your L-piece';
        } else {
            this.phaseText.textContent = 'Move a neutral piece (click it) or skip';
        }

        // Active player label
        this.p1Label.classList.toggle('active', this.game.currentPlayer === 'P1' && !this.game.isGameOver() && !isAiTurn);
        this.p2Label.classList.toggle('active', this.game.currentPlayer === 'P2' && !this.game.isGameOver() && !isAiTurn);

        // Move count / status
        const p1Moves = Math.ceil(this.game.moveCount / 2);
        const p2Moves = Math.floor(this.game.moveCount / 2);
        this.p1Status.textContent = `Moves: ${p1Moves}`;
        this.p2Status.textContent = `Moves: ${p2Moves}`;

        // Mode button label
        if (this.modeBtn) {
            this.modeBtn.textContent = this.aiMode ? 'vs AI' : 'vs Human';
            this.modeBtn.classList.toggle('active', this.aiMode);
        }

        // Skip button (hidden during AI thinking)
        if (this.game.phase === 'NEUTRAL_MOVE' && !this.game.isGameOver() && !isAiTurn) {
            this.skipBtn.classList.remove('hidden');
        } else {
            this.skipBtn.classList.add('hidden');
        }

        // Game result (below board)
        if (this.game.isGameOver()) {
            this.gameResult.classList.remove('hidden');
            let winnerLabel;
            if (this.aiMode) {
                // Human wins when (winner is P1 AND human is P1) OR (winner is P2 AND human is P2)
                // Human is P1 when !aiGoesFirst, P2 when aiGoesFirst
                const humanWon = (this.game.winner === 'P1') !== this.aiGoesFirst;
                winnerLabel = humanWon ? 'You' : 'AI';
            } else {
                winnerLabel = this.game.winner === 'P1' ? 'Player 1' : 'Player 2';
            }
            this.winnerText.textContent = winnerLabel === 'You' ? 'You win!' : `${winnerLabel} wins!`;
            this.winnerText.style.color = this.game.winner === 'P1' ? '#e94560' : '#0f8a5f';
        } else {
            this.gameResult.classList.add('hidden');
        }

        // Footer hint
        this.showMessage('', '');
    }

    showMessage(text, type = 'info') {
        this.messagesEl.textContent = text;
        this.messagesEl.className = type;
    }

    triggerAIIfNeeded() {
        if (this.aiThinking) return;
        if (this.game.isGameOver()) return;
        if (!this.aiMode) return;

        const isAiPlayer = (this.aiGoesFirst && this.game.currentPlayer === 'P1') ||
                           (!this.aiGoesFirst && this.game.currentPlayer === 'P2');
        if (!isAiPlayer) return;

        this.aiThinking = true;
        this.render();

        setTimeout(() => {
            this.executeAIMove();
        }, AI_DELAY_MS);
    }

    executeAIMove() {
        if (this.game.isGameOver()) {
            this.aiThinking = false;
            this.render();
            return;
        }

        const move = computeAIMove(this.game, this.difficulty);
        if (!move) {
            this.aiThinking = false;
            this.render();
            return;
        }

        // Capture old positions before applying moves
        const player = this.game.currentPlayer;
        const oldLCells = this.game.playerData[player].cells.map(c => [...c]);
        const newLCells = move.placement.cells;

        let oldNeutral = null;
        let newNeutral = null;
        if (move.neutralAction.type === 'move') {
            oldNeutral = { ...this.game.neutrals[move.neutralAction.id] };
            newNeutral = { r: move.neutralAction.r, c: move.neutralAction.c };
        }

        // Execute L-piece move
        this.game.placeLPiece(move.placement);

        // Execute neutral move or skip
        if (move.neutralAction.type === 'move') {
            this.game.selectNeutral(move.neutralAction.id);
            this.game.placeNeutral(move.neutralAction.r, move.neutralAction.c);
        } else {
            this.game.skipNeutral();
        }

        this.aiThinking = false;
        this.hoveredPlacement = null;

        // Animate both L-piece and neutral moves simultaneously
        this.animateAndRender(oldLCells, newLCells, player, oldNeutral, newNeutral, () => {
            this.render();
            this.triggerAIIfNeeded();
        });
    }

    toggleMode() {
        this.aiMode = !this.aiMode;
        if (this.modeBtn) {
            this.modeBtn.textContent = this.aiMode ? 'vs AI' : 'vs Human';
        }
        // Show/hide first-move and difficulty selection
        if (this.firstMoveGroup) {
            this.firstMoveGroup.classList.toggle('hidden', !this.aiMode);
        }
        if (this.difficultyGroup) {
            this.difficultyGroup.classList.toggle('hidden', !this.aiMode);
        }
        this.showMessage(this.aiMode ? 'Switched to AI mode' : 'Switched to Player vs Player mode', 'info');
        this.render();
    }

    handleFirstMoveChoice(goesFirst) {
        if (this.aiGoesFirst === goesFirst) return;
        this.aiGoesFirst = goesFirst;
        if (this.firstBtn) this.firstBtn.classList.toggle('active', !goesFirst);
        if (this.secondBtn) this.secondBtn.classList.toggle('active', goesFirst);
        this.handleNewGame();
    }

    handleDifficultyChoice(level) {
        if (this.difficulty === level) return;
        this.difficulty = level;
        if (this.easyBtn) this.easyBtn.classList.toggle('active', level === 'easy');
        if (this.mediumBtn) this.mediumBtn.classList.toggle('active', level === 'medium');
        if (this.hardBtn) this.hardBtn.classList.toggle('active', level === 'hard');
        this.showMessage(`Difficulty set to ${level.charAt(0).toUpperCase() + level.slice(1)}`, 'info');
    }

    handleCellHover(r, c) {
        if (this.animating || this.aiThinking || this.game.isGameOver() || this.game.phase !== 'L_MOVE') {
            if (this.hoveredPlacement) {
                this.hoveredPlacement = null;
                this.updateHoverDisplay();
            }
            return;
        }

        // Find placements covering this cell
        const covering = this.game.validPlacements.filter(p =>
            p.cells.some(([pr, pc]) => pr === r && pc === c)
        );

        if (covering.length === 0) {
            if (this.hoveredPlacement) {
                this.hoveredPlacement = null;
                this.updateHoverDisplay();
            }
            return;
        }

        // Sort: same orientation first, then others
        const currentOrient = this.game.playerData[this.game.currentPlayer].orientation;
        covering.sort((a, b) => {
            if (a.orientation === currentOrient) return -1;
            if (b.orientation === currentOrient) return 1;
            return 0;
        });

        // Cycle through placements on repeated hover of same cell
        // so the user can discover all legal orientations covering this cell
        if (!this._hoverCycle) this._hoverCycle = {};
        const cellKey = `${r},${c}`;
        let idx = this._hoverCycle[cellKey] || 0;
        if (idx >= covering.length) idx = 0;
        const chosen = covering[idx];
        this._hoverCycle[cellKey] = idx + 1; // advance for next hover

        if (this.hoveredPlacement !== chosen) {
            this.hoveredPlacement = chosen;
            this.updateHoverDisplay();
        }
    }

    handleCellLeave() {
        if (this.hoveredPlacement) {
            this.hoveredPlacement = null;
            this.updateHoverDisplay();
        }
    }

    handleCellClick(r, c) {
        if (this.animating || this.aiThinking || this.game.isGameOver()) return;

        if (this.game.phase === 'L_MOVE') {
            // If we have a hovered placement, use it directly
            if (this.hoveredPlacement) {
                const oldCells = this.game.playerData[this.game.currentPlayer].cells.map(c => [...c]);
                const newCells = this.hoveredPlacement.cells;
                const player = this.game.currentPlayer;

                this.game.placeLPiece(this.hoveredPlacement);
                this.hoveredPlacement = null;

                this.animateAndRender(oldCells, newCells, player, null, null, () => {
                    this.showMessage('L-piece moved!', 'info');
                    this.render();
                    this.triggerAIIfNeeded();
                });
                return;
            }
            this.handleLMoveClick(r, c);
            return;
        } else if (this.game.phase === 'NEUTRAL_MOVE') {
            this.handleNeutralClick(r, c);
            return;
        }

        this.render();
        this.triggerAIIfNeeded();
    }

    handleLMoveClick(r, c) {
        // Find which valid placement the user clicked on
        const clickedPlacements = this.game.validPlacements.filter(p =>
            p.cells.some(([pr, pc]) => pr === r && pc === c)
        );

        if (clickedPlacements.length === 0) {
            this.showMessage('Select a highlighted position for your L-piece', 'error');
            return;
        }

        // Pick a placement
        let chosenPlacement;
        if (clickedPlacements.length > 1) {
            // Try to find the one with the same orientation as current (less jarring)
            chosenPlacement = clickedPlacements.find(p =>
                p.orientation === this.game.playerData[this.game.currentPlayer].orientation
            ) || clickedPlacements[0];
        } else {
            chosenPlacement = clickedPlacements[0];
        }

        const oldCells = this.game.playerData[this.game.currentPlayer].cells.map(c => [...c]);
        const newCells = chosenPlacement.cells;
        const player = this.game.currentPlayer;

        this.game.placeLPiece(chosenPlacement);

        this.animateAndRender(oldCells, newCells, player, null, null, () => {
            this.showMessage('L-piece moved!', 'info');
            this.render();
            if (this.game.isGameOver() || this.game.phase !== 'NEUTRAL_MOVE') {
                this.triggerAIIfNeeded();
            }
        });
    }

    handleNeutralClick(r, c) {
        const val = this.game.board[r][c];

        // If no neutral is selected yet
        if (!this.game.selectedNeutral) {
            if (val === 'N1' || val === 'N2') {
                if (this.game.getMovableNeutrals().includes(val)) {
                    this.game.selectNeutral(val);
                    this.showMessage(`Selected neutral piece — click an empty cell to place it`, 'info');
                    this.render();
                }
            } else {
                this.showMessage('Click a neutral piece (highlighted) to move it, or skip', 'error');
            }
            return;
        }

        // A neutral is selected — try to place it
        const oldNeutral = { ...this.game.neutrals[this.game.selectedNeutral] };
        const newNeutral = { r, c };
        const success = this.game.placeNeutral(r, c);
        if (success) {
            this.animateAndRender(null, null, null, oldNeutral, newNeutral, () => {
                this.showMessage('Neutral piece moved!', 'info');
                this.render();
                this.triggerAIIfNeeded();
            });
        } else {
            this.showMessage('Cannot place the neutral piece there', 'error');
            this.render();
        }
    }

    handleSkip() {
        if (this.animating) return;
        if (this.game.phase === 'NEUTRAL_MOVE') {
            this.game.skipNeutral();
            this.showMessage('Turn skipped', 'info');
            this.render();
            this.triggerAIIfNeeded();
        }
    }

    handleNewGame() {
        this.animating = false;
        this.animationState = null;
        this.overlayNewOnlyCells = null;
        if (this.activeOverlay) {
            this.activeOverlay.remove();
            this.activeOverlay = null;
        }
        this.aiThinking = false;
        this.hoveredPlacement = null;
        this._hoverCycle = {};
        this.game.reset();
        this.showMessage('New game started!', 'info');
        this.render();
        this.triggerAIIfNeeded();
    }
}

// ─── Initialize ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    new LGameUI();
});
