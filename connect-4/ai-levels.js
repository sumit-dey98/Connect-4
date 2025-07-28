function aiMove(difficulty) {
    if (gameState.gameOver) return;
    let col;
    switch (difficulty) {
        case 'easy':
            col = getEasyAIMove();
            break;
        case 'medium':
            col = getMediumAIMove();
            break;
        case 'hard':
            col = getHardAIMove();
            break;
        default:
            col = getMediumAIMove();
    }
    if (col !== -1) {
        makeMove(col);
    }
}

function getValidMoves() {
    const validCols = [];
    for (let c = 0; c < gameState.settings.cols; c++) {
        if (getNextAvailableRow(c) !== -1) {
            validCols.push(c);
        }
    }
    return validCols;
}

function getEasyAIMove() {
    const validCols = getValidMoves();
    return validCols.length > 0 ?
        validCols[Math.floor(Math.random() * validCols.length)] : -1;
}

/**
 * Medium AI: Uses strategic heuristics with threat detection and positional play
 */
function getMediumAIMove() {
    const validCols = getValidMoves();
    if (validCols.length === 0) return -1;

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    // 1. Check for immediate winning moves
    for (const col of validCols) {
        const row = getNextAvailableRow(col);
        gameState.board[row][col] = aiId;
        if (checkWin(row, col)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    // 2. Block opponent's winning moves
    for (const col of validCols) {
        const row = getNextAvailableRow(col);
        gameState.board[row][col] = opponentId;
        if (checkWin(row, col)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    // 3. Look for fork opportunities (creating multiple threats)
    const forkMove = findForkOpportunity(aiId, validCols);
    if (forkMove !== -1) return forkMove;

    // 4. Block opponent's fork opportunities
    const blockForkMove = findForkOpportunity(opponentId, validCols);
    if (blockForkMove !== -1) return blockForkMove;

    // 5. Strategic positioning with limited lookahead
    let bestScore = -Infinity;
    let bestCol = validCols[0];

    for (const col of validCols) {
        const row = getNextAvailableRow(col);
        gameState.board[row][col] = aiId;
        
        // Combine immediate board evaluation with shallow minimax
        let score = evaluateBoardAdvanced(aiId) * 2;
        score += minimax(3, false, -Infinity, Infinity, gameState.currentPlayerIndex);
        
        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

/**
 * Hard AI: Uses deep minimax with alpha-beta pruning, move ordering, and advanced heuristics
 */
function getHardAIMove() {
    const validCols = getValidMoves();
    if (validCols.length === 0) return -1;

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    // Immediate tactical checks (same as medium but faster)
    const immediateWin = findImmediateWin(aiId, validCols);
    if (immediateWin !== -1) return immediateWin;

    const blockWin = findImmediateWin(opponentId, validCols);
    if (blockWin !== -1) return blockWin;

    // Order moves by their strategic value for better alpha-beta pruning
    const orderedMoves = orderMoves(validCols, aiId);
    
    let bestScore = -Infinity;
    let bestCol = orderedMoves[0];
    
    // Use iterative deepening for better time management
    const maxDepth = Math.min(8, 42 - getCurrentMoveCount()); // Adaptive depth
    
    for (const col of orderedMoves) {
        const row = getNextAvailableRow(col);
        if (row === -1) continue;

        gameState.board[row][col] = aiId;
        
        // Use advanced minimax with improved pruning
        const score = minimaxAdvanced(maxDepth, false, -Infinity, Infinity, 
                                    gameState.currentPlayerIndex, col);
        
        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

/**
 * Advanced minimax with enhanced pruning and threat detection
 */
function minimaxAdvanced(depth, isMaximizing, alpha, beta, originalAI, lastMove = -1) {
    const winnerInfo = checkForTerminalState();
    
    if (depth === 0 || winnerInfo.isTerminal) {
        if (winnerInfo.isTerminal) {
            if (winnerInfo.winner === null) return 0;
            if (winnerInfo.winner === originalAI) return 100000 + depth;
            return -100000 - depth;
        }
        return evaluateBoardAdvanced(gameState.players[originalAI].id);
    }

    const validCols = getValidMoves();
    const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;
    
    // Enhanced move ordering
    const orderedCols = orderMoves(validCols, currentPlayerId, lastMove);

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const col of orderedCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI === nextPlayer, 
                                        alpha, beta, originalAI, col);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Alpha-beta cutoff
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const col of orderedCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI === nextPlayer, 
                                        alpha, beta, originalAI, col);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Alpha-beta cutoff
        }
        return minScore;
    }
}

/**
 * Finds immediate winning moves
 */
function findImmediateWin(playerId, validCols) {
    for (const col of validCols) {
        const row = getNextAvailableRow(col);
        gameState.board[row][col] = playerId;
        if (checkWin(row, col)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }
    return -1;
}

/**
 * Finds fork opportunities (moves that create multiple winning threats)
 */
function findForkOpportunity(playerId, validCols) {
    for (const col of validCols) {
        const row = getNextAvailableRow(col);
        gameState.board[row][col] = playerId;
        
        let threats = 0;
        for (const testCol of validCols) {
            if (testCol === col) continue;
            const testRow = getNextAvailableRow(testCol);
            if (testRow === -1) continue;
            
            gameState.board[testRow][testCol] = playerId;
            if (checkWin(testRow, testCol)) {
                threats++;
            }
            gameState.board[testRow][testCol] = 0;
        }
        
        gameState.board[row][col] = 0;
        
        if (threats >= 2) return col; // Fork found
    }
    return -1;
}

/**
 * Orders moves for better alpha-beta pruning efficiency
 */
function orderMoves(validCols, playerId, lastMove = -1) {
    const cols = gameState.settings.cols;
    const center = Math.floor(cols / 2);
    
    return validCols.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        
        // Prioritize center columns
        scoreA += Math.max(0, 3 - Math.abs(a - center));
        scoreB += Math.max(0, 3 - Math.abs(b - center));
        
        // Prioritize columns adjacent to last move
        if (lastMove !== -1) {
            scoreA += Math.max(0, 2 - Math.abs(a - lastMove));
            scoreB += Math.max(0, 2 - Math.abs(b - lastMove));
        }
        
        // Quick evaluation of move quality
        const rowA = getNextAvailableRow(a);
        const rowB = getNextAvailableRow(b);
        
        if (rowA !== -1) {
            gameState.board[rowA][a] = playerId;
            scoreA += quickEvaluatePosition(rowA, a, playerId);
            gameState.board[rowA][a] = 0;
        }
        
        if (rowB !== -1) {
            gameState.board[rowB][b] = playerId;
            scoreB += quickEvaluatePosition(rowB, b, playerId);
            gameState.board[rowB][b] = 0;
        }
        
        return scoreB - scoreA; // Higher scores first
    });
}

/**
 * Quick position evaluation for move ordering
 */
function quickEvaluatePosition(row, col, playerId) {
    let score = 0;
    const winCondition = gameState.settings.winCondition;
    
    // Check horizontal potential
    let left = 0, right = 0;
    for (let c = col - 1; c >= 0 && gameState.board[row][c] === playerId; c--) left++;
    for (let c = col + 1; c < gameState.settings.cols && gameState.board[row][c] === playerId; c++) right++;
    if (left + right + 1 >= winCondition) score += 50;
    
    // Check vertical potential
    let down = 0;
    for (let r = row + 1; r < gameState.settings.rows && gameState.board[r][col] === playerId; r++) down++;
    if (down + 1 >= winCondition) score += 50;
    
    return score;
}

/**
 * Get current number of moves played
 */
function getCurrentMoveCount() {
    let count = 0;
    for (let r = 0; r < gameState.settings.rows; r++) {
        for (let c = 0; c < gameState.settings.cols; c++) {
            if (gameState.board[r][c] !== 0) count++;
        }
    }
    return count;
}

/**
 * Enhanced board evaluation with sophisticated heuristics
 */
function evaluateBoardAdvanced(aiId) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;
    const winCondition = gameState.settings.winCondition;

    // Enhanced center column preference with position weighting
    const centerCol = Math.floor(cols / 2);
    for (let r = 0; r < rows; r++) {
        if (gameState.board[r][centerCol] === aiId) {
            score += 4 + (rows - r); // Higher pieces worth more
        }
    }

    // Evaluate all possible windows with enhanced scoring
    score += evaluateAllWindows(aiId);
    
    // Add connectivity bonus (pieces next to each other)
    score += evaluateConnectivity(aiId);
    
    // Penalize isolated pieces
    score -= evaluateIsolation(aiId) * 2;
    
    // Add positional advantages
    score += evaluatePositionalAdvantages(aiId);

    return score;
}

/**
 * Enhanced window evaluation with better threat detection
 */
function evaluateWindowAdvanced(window, aiId) {
    const winCondition = gameState.settings.winCondition;
    let aiCount = 0;
    let opponentCount = 0;
    let emptyCount = 0;

    for (const piece of window) {
        if (piece === aiId) {
            aiCount++;
        } else if (piece === 0) {
            emptyCount++;
        } else {
            opponentCount++;
        }
    }

    if (aiCount > 0 && opponentCount > 0) return 0;

    // Enhanced scoring system
    if (aiCount === winCondition - 1 && emptyCount === 1) return 1000;
    if (aiCount === winCondition - 2 && emptyCount === 2) return 100;
    if (aiCount === winCondition - 3 && emptyCount === 3) return 10;
    if (aiCount > 0 && emptyCount === winCondition - aiCount) return aiCount * 2;

    if (opponentCount === winCondition - 1 && emptyCount === 1) return -800;
    if (opponentCount === winCondition - 2 && emptyCount === 2) return -80;
    if (opponentCount === winCondition - 3 && emptyCount === 3) return -8;

    return 0;
}

/**
 * Evaluates all possible windows on the board
 */
function evaluateAllWindows(aiId) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;
    const winCondition = gameState.settings.winCondition;

    // Horizontal windows
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - winCondition; c++) {
            const window = [];
            for (let i = 0; i < winCondition; i++) {
                window.push(gameState.board[r][c + i]);
            }
            score += evaluateWindowAdvanced(window, aiId);
        }
    }

    // Vertical windows
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - winCondition; r++) {
            const window = [];
            for (let i = 0; i < winCondition; i++) {
                window.push(gameState.board[r + i][c]);
            }
            score += evaluateWindowAdvanced(window, aiId);
        }
    }

    // Diagonal windows (both directions)
    for (let r = 0; r <= rows - winCondition; r++) {
        for (let c = 0; c <= cols - winCondition; c++) {
            const window1 = [], window2 = [];
            for (let i = 0; i < winCondition; i++) {
                window1.push(gameState.board[r + i][c + i]);
                window2.push(gameState.board[r + winCondition - 1 - i][c + i]);
            }
            score += evaluateWindowAdvanced(window1, aiId);
            score += evaluateWindowAdvanced(window2, aiId);
        }
    }

    return score;
}

/**
 * Evaluates piece connectivity (bonus for adjacent pieces)
 */
function evaluateConnectivity(aiId) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] === aiId) {
                // Check adjacent positions
                const directions = [
                    [0, 1], [1, 0], [1, 1], [1, -1],
                    [0, -1], [-1, 0], [-1, -1], [-1, 1]
                ];
                
                for (const [dr, dc] of directions) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        gameState.board[nr][nc] === aiId) {
                        score += 1;
                    }
                }
            }
        }
    }
    
    return score;
}

/**
 * Penalizes isolated pieces
 */
function evaluateIsolation(aiId) {
    let isolatedPieces = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] === aiId) {
                let hasNeighbor = false;
                const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                
                for (const [dr, dc] of directions) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        gameState.board[nr][nc] === aiId) {
                        hasNeighbor = true;
                        break;
                    }
                }
                
                if (!hasNeighbor) isolatedPieces++;
            }
        }
    }
    
    return isolatedPieces;
}

/**
 * Evaluates positional advantages
 */
function evaluatePositionalAdvantages(aiId) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] === aiId) {
                // Prefer lower rows (more stable)
                score += (rows - r);
                
                // Prefer positions that control key areas
                if (r < rows - 1 && gameState.board[r + 1][c] !== 0) {
                    score += 2; // Supported piece bonus
                }
            }
        }
    }
    
    return score;
}

function checkForTerminalState() {
    for (let r = 0; r < gameState.settings.rows; r++) {
        for (let c = 0; c < gameState.settings.cols; c++) {
            if (gameState.board[r][c] !== 0) {
                const winner = checkWin(r, c);
                if (winner) {
                    return { isTerminal: true, winner: winner.id - 1 };
                }
            }
        }
    }
    if (isBoardFull()) {
        return { isTerminal: true, winner: null };
    }
    return { isTerminal: false, winner: null };
}

// Keep original functions for compatibility
function evaluateWindow(window, aiId) {
    return evaluateWindowAdvanced(window, aiId);
}

function evaluateBoard(aiId) {
    return evaluateBoardAdvanced(aiId);
}

function minimax(depth, isMaximizing, alpha, beta, originalAI) {
    return minimaxAdvanced(depth, isMaximizing, alpha, beta, originalAI);
}