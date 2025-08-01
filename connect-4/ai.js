// ai.js - Connect 4 AI Web Worker
self.onmessage = function (e) {
    const { board, settings, players, currentPlayerIndex, difficulty } = e.data;

    const workerGameState = {
        board: board,
        settings: settings,
        players: players,
        currentPlayerIndex: currentPlayerIndex
    };

    let move;
    switch (difficulty) {
        case 'very easy':
            move = getVeryEasyAIMove(workerGameState);
            break;
        case 'easy':
            move = getEasyAIMove(workerGameState);
            break;
        case 'medium':
            move = getMediumAIMove(workerGameState);
            break;
        case 'hard':
            move = getHardAIMove(workerGameState);
            break;
        case 'very hard':
            move = getVeryHardAIMove(workerGameState);
            break;
        default:
            move = getEasyAIMove(workerGameState);
    }

    self.postMessage({ move: move });
};

function getVeryEasyAIMove(gameState) {
    console.log('AI Level 1 Move Made');
    const validCols = getValidMoves(gameState);
    return validCols.length > 0 ?
        validCols[Math.floor(Math.random() * validCols.length)] : -1;
}

function getEasyAIMove(gameState) {
    console.log('AI Level 2 Move Made');
    const validCols = getValidMoves(gameState);
    if (validCols.length === 0) return -1;

    if (Math.random() < 0.3) {
        return validCols[Math.floor(Math.random() * validCols.length)];
    }

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    // Check for winning move
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = aiId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    // Check for blocking move
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = opponentId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    let bestScore = -Infinity;
    let bestCol = validCols[0];

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = aiId;

        let score = evaluateBoardAdvanced(aiId, gameState) * 2;
        score += minimax(2, false, -Infinity, Infinity, gameState.currentPlayerIndex, gameState);

        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

function getMediumAIMove(gameState) {
    console.log('AI Level 3 Move Made');
    const validCols = getValidMoves(gameState);
    if (validCols.length === 0) return -1;

    if (Math.random() < 0.1) {
        return validCols[Math.floor(Math.random() * validCols.length)];
    }

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    // Check for winning move
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = aiId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    // Check for blocking move
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = opponentId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    const blockForkMove = findForkOpportunity(opponentId, validCols, gameState);
    if (blockForkMove !== -1) return blockForkMove;

    let bestScore = -Infinity;
    let bestCol = validCols[0];

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;
        gameState.board[row][col] = aiId;

        let score = evaluateBoardAdvanced(aiId, gameState) * 2;
        score += minimax(3, false, -Infinity, Infinity, gameState.currentPlayerIndex, gameState);

        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

function getHardAIMove(gameState) {
    console.log('AI Level 4 Move Made');
    const validCols = getValidMoves(gameState);
    if (validCols.length === 0) return -1;

    if (Math.random() < 0.02) {
        return validCols[Math.floor(Math.random() * validCols.length)];
    }

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    const immediateWin = findImmediateWin(aiId, validCols, gameState);
    if (immediateWin !== -1) return immediateWin;

    const blockWin = findImmediateWin(opponentId, validCols, gameState);
    if (blockWin !== -1) return blockWin;

    const orderedMoves = orderMoves(validCols, aiId, -1, gameState);

    let bestScore = -Infinity;
    let bestCol = orderedMoves[0];

    const maxDepth = Math.min(6, 42 - getCurrentMoveCount(gameState));

    for (const col of orderedMoves) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = aiId;

        // Switch to next player for minimax
        const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        const originalPlayerIndex = gameState.currentPlayerIndex;
        gameState.currentPlayerIndex = nextPlayerIndex;

        const score = minimaxAdvanced(maxDepth - 1, false, -Infinity, Infinity,
            originalPlayerIndex, col, gameState);

        gameState.currentPlayerIndex = originalPlayerIndex;
        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

function getVeryHardAIMove(gameState) {
    console.log('AI Level 5 Move Made');
    const validCols = getValidMoves(gameState);
    if (validCols.length === 0) return -1;

    const aiId = gameState.players[gameState.currentPlayerIndex].id;
    const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

    const immediateWin = findImmediateWin(aiId, validCols, gameState);
    if (immediateWin !== -1) return immediateWin;

    const blockWin = findImmediateWin(opponentId, validCols, gameState);
    if (blockWin !== -1) return blockWin;

    // Only check forks if not too early or too late in game
    const moveCount = getCurrentMoveCount(gameState);
    if (moveCount > 6 && moveCount < 30) {
        const createFork = findForkOpportunity(aiId, validCols, gameState);
        if (createFork !== -1) return createFork;

        const blockFork = findForkOpportunity(opponentId, validCols, gameState);
        if (blockFork !== -1) return blockFork;
    }

    const orderedMoves = orderMoves(validCols, aiId, -1, gameState);

    let bestScore = -Infinity;
    let bestCol = orderedMoves[0];

    // Reduced depth from 8 to 6 for better performance
    const maxDepth = Math.min(6, 42 - getCurrentMoveCount(gameState));

    for (const col of orderedMoves) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = aiId;

        const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        const originalPlayerIndex = gameState.currentPlayerIndex;
        gameState.currentPlayerIndex = nextPlayerIndex;

        const score = minimaxAdvanced(maxDepth - 1, false, -Infinity, Infinity,
            originalPlayerIndex, col, gameState);

        gameState.currentPlayerIndex = originalPlayerIndex;
        gameState.board[row][col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestCol = col;
        }
    }

    return bestCol;
}

function minimaxAdvanced(depth, isMaximizing, alpha, beta, originalAI, lastMove, gameState) {
    const winnerInfo = checkForTerminalState(gameState);

    if (depth === 0 || winnerInfo.isTerminal) {
        if (winnerInfo.isTerminal) {
            if (winnerInfo.winner === null) return 0; // Draw
            // player ID comparison
            if (winnerInfo.winner === gameState.players[originalAI].id) {
                return 100000 + depth; // AI wins, prefer shorter paths
            }
            return -100000 - depth; // AI loses, prefer longer paths
        }
        return evaluateBoardAdvanced(gameState.players[originalAI].id, gameState);
    }

    const validCols = getValidMoves(gameState);
    const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;

    const orderedCols = orderMoves(validCols, currentPlayerId, lastMove, gameState);

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const col of orderedCols) {
            const row = getNextAvailableRow(col, gameState);
            if (row === -1) continue;

            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI !== nextPlayer,
                alpha, beta, originalAI, col, gameState);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const col of orderedCols) {
            const row = getNextAvailableRow(col, gameState);
            if (row === -1) continue;

            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI !== nextPlayer,
                alpha, beta, originalAI, col, gameState);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return minScore;
    }
}

function minimax(depth, isMaximizing, alpha, beta, originalAI, gameState) {
    return minimaxAdvanced(depth, isMaximizing, alpha, beta, originalAI, -1, gameState);
}

function evaluateBoardAdvanced(aiId, gameState) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    // Center column preference
    const centerCol = Math.floor(cols / 2);
    for (let r = 0; r < rows; r++) {
        if (gameState.board[r][centerCol] === aiId) {
            score += 6 + (rows - r);
        }
    }

    // Evaluate all possible winning lines
    score += evaluateAllWindows(aiId, gameState);

    // Connectivity bonus
    score += evaluateConnectivity(aiId, gameState);

    // Penalize isolated pieces
    score -= evaluateIsolation(aiId, gameState) * 3;

    // Positional advantages
    score += evaluatePositionalAdvantages(aiId, gameState);

    // Height advantage (lower pieces are more stable)
    score += evaluateHeightAdvantage(aiId, gameState);

    return score;
}

function evaluateBoard(aiId, gameState) {
    return evaluateBoardAdvanced(aiId, gameState);
}

function evaluateWindowAdvanced(window, aiId) {
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

    // Can't win if opponent has pieces in this window
    if (aiCount > 0 && opponentCount > 0) return 0;

    const winCondition = 4; // Default Connect 4

    // AI scoring
    if (aiCount === winCondition - 1 && emptyCount === 1) return 1000;
    if (aiCount === winCondition - 2 && emptyCount === 2) return 100;
    if (aiCount === winCondition - 3 && emptyCount === 3) return 10;
    if (aiCount > 0 && emptyCount === winCondition - aiCount) return aiCount * 3;

    // Opponent threat scoring (aggressive blocking)
    if (opponentCount === winCondition - 1 && emptyCount === 1) return -900;
    if (opponentCount === winCondition - 2 && emptyCount === 2) return -90;
    if (opponentCount === winCondition - 3 && emptyCount === 3) return -9;

    return 0;
}

function evaluateWindow(window, aiId) {
    return evaluateWindowAdvanced(window, aiId);
}

function evaluateAllWindows(aiId, gameState) {
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

    // Diagonal windows
    if (gameState.settings.enableDiagonal) {
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
    }

    return score;
}

function evaluateConnectivity(aiId, gameState) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] === aiId) {
                const directions = [
                    [0, 1], [1, 0], [1, 1], [1, -1],
                    [0, -1], [-1, 0], [-1, -1], [-1, 1]
                ];

                for (const [dr, dc] of directions) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        gameState.board[nr][nc] === aiId) {
                        score += 2;
                    }
                }
            }
        }
    }

    return score;
}

function evaluateIsolation(aiId, gameState) {
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

function evaluatePositionalAdvantages(aiId, gameState) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] === aiId) {
                // Height advantage (lower is better)
                score += (rows - r) * 2;

                // Stability bonus (has support below)
                if (r < rows - 1 && gameState.board[r + 1][c] !== 0) {
                    score += 3;
                }
            }
        }
    }

    return score;
}

function evaluateHeightAdvantage(aiId, gameState) {
    let score = 0;
    const rows = gameState.settings.rows;
    const cols = gameState.settings.cols;

    for (let c = 0; c < cols; c++) {
        let aiPieces = 0;
        let opponentPieces = 0;

        for (let r = rows - 1; r >= 0; r--) {
            if (gameState.board[r][c] === aiId) {
                aiPieces++;
                score += (rows - r);
            } else if (gameState.board[r][c] !== 0) {
                opponentPieces++;
            }
        }

        // Bonus for controlling columns
        if (aiPieces > opponentPieces) {
            score += 5;
        }
    }

    return score;
}

function findImmediateWin(playerId, validCols, gameState) {
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = playerId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }
    return -1;
}

function findForkOpportunity(playerId, validCols, gameState) {
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = playerId;

        let threats = 0;
        for (const testCol of validCols) {
            if (testCol === col) continue;
            const testRow = getNextAvailableRow(testCol, gameState);
            if (testRow === -1) continue;

            gameState.board[testRow][testCol] = playerId;
            if (checkWin(testRow, testCol, gameState)) {
                threats++;
            }
            gameState.board[testRow][testCol] = 0;
        }

        gameState.board[row][col] = 0;

        if (threats >= 2) return col;
    }
    return -1;
}

function orderMoves(validCols, playerId, lastMove, gameState) {
    const cols = gameState.settings.cols;
    const center = Math.floor(cols / 2);

    return validCols.sort((a, b) => {
        let scoreA = 0, scoreB = 0;

        // Center preference
        scoreA += Math.max(0, 4 - Math.abs(a - center));
        scoreB += Math.max(0, 4 - Math.abs(b - center));

        // Proximity to last move
        if (lastMove !== -1) {
            scoreA += Math.max(0, 3 - Math.abs(a - lastMove));
            scoreB += Math.max(0, 3 - Math.abs(b - lastMove));
        }

        // Quick position evaluation
        const rowA = getNextAvailableRow(a, gameState);
        const rowB = getNextAvailableRow(b, gameState);

        if (rowA !== -1) {
            gameState.board[rowA][a] = playerId;
            scoreA += quickEvaluatePosition(rowA, a, playerId, gameState);
            gameState.board[rowA][a] = 0;
        }

        if (rowB !== -1) {
            gameState.board[rowB][b] = playerId;
            scoreB += quickEvaluatePosition(rowB, b, playerId, gameState);
            gameState.board[rowB][b] = 0;
        }

        return scoreB - scoreA;
    });
}

function quickEvaluatePosition(row, col, playerId, gameState) {
    let score = 0;
    const winCondition = gameState.settings.winCondition;

    // Check horizontal potential
    let left = 0, right = 0;
    for (let c = col - 1; c >= 0 && gameState.board[row][c] === playerId; c--) left++;
    for (let c = col + 1; c < gameState.settings.cols && gameState.board[row][c] === playerId; c++) right++;
    if (left + right + 1 >= winCondition) score += 100;
    else score += (left + right) * 10;

    // Check vertical potential
    let down = 0;
    for (let r = row + 1; r < gameState.settings.rows && gameState.board[r][col] === playerId; r++) down++;
    if (down + 1 >= winCondition) score += 100;
    else score += down * 10;

    // Check diagonal potential if enabled
    if (gameState.settings.enableDiagonal) {
        const directions = [[1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            let count1 = 0, count2 = 0;

            // Count in one direction
            for (let i = 1; i < winCondition; i++) {
                const nr = row + dr * i;
                const nc = col + dc * i;
                if (nr >= 0 && nr < gameState.settings.rows &&
                    nc >= 0 && nc < gameState.settings.cols &&
                    gameState.board[nr][nc] === playerId) {
                    count1++;
                } else break;
            }

            // Count in opposite direction
            for (let i = 1; i < winCondition; i++) {
                const nr = row - dr * i;
                const nc = col - dc * i;
                if (nr >= 0 && nr < gameState.settings.rows &&
                    nc >= 0 && nc < gameState.settings.cols &&
                    gameState.board[nr][nc] === playerId) {
                    count2++;
                } else break;
            }

            if (count1 + count2 + 1 >= winCondition) score += 100;
            else score += (count1 + count2) * 10;
        }
    }

    return score;
}

function getCurrentMoveCount(gameState) {
    let count = 0;
    for (let r = 0; r < gameState.settings.rows; r++) {
        for (let c = 0; c < gameState.settings.cols; c++) {
            if (gameState.board[r][c] !== 0) count++;
        }
    }
    return count;
}

function checkForTerminalState(gameState) {
    // Check for wins
    for (let r = 0; r < gameState.settings.rows; r++) {
        for (let c = 0; c < gameState.settings.cols; c++) {
            if (gameState.board[r][c] !== 0) {
                const winner = checkWin(r, c, gameState);
                if (winner) {
                    return { isTerminal: true, winner: winner.id };
                }
            }
        }
    }

    // Check for draw
    if (isBoardFull(gameState)) {
        return { isTerminal: true, winner: null };
    }

    return { isTerminal: false, winner: null };
}

function checkWin(r, c, gameState) {
    const playerId = gameState.board[r][c];
    if (playerId === 0) return null;

    const winLength = gameState.settings.winCondition;
    const directions = [
        [0, 1],   // horizontal
        [1, 0],   // vertical
        [1, 1],   // diagonal /
        [1, -1]   // diagonal \
    ];

    for (const [dr, dc] of directions) {
        if (!gameState.settings.enableDiagonal && (dr === 1 && dc !== 0)) continue;

        let count = 1; // Count the current piece

        // Count in positive direction
        for (let i = 1; i < winLength; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr >= 0 && nr < gameState.settings.rows &&
                nc >= 0 && nc < gameState.settings.cols &&
                gameState.board[nr][nc] === playerId) {
                count++;
            } else {
                break;
            }
        }

        // Count in negative direction
        for (let i = 1; i < winLength; i++) {
            const nr = r - dr * i;
            const nc = c - dc * i;
            if (nr >= 0 && nr < gameState.settings.rows &&
                nc >= 0 && nc < gameState.settings.cols &&
                gameState.board[nr][nc] === playerId) {
                count++;
            } else {
                break;
            }
        }

        if (count >= winLength) {
            return gameState.players[playerId - 1];
        }
    }
    return null;
}

function getNextAvailableRow(col, gameState) {
    for (let r = gameState.settings.rows - 1; r >= 0; r--) {
        if (gameState.board[r][col] === 0) {
            return r;
        }
    }
    return -1;
}

function isBoardFull(gameState) {
    return gameState.board[0].every(cell => cell !== 0);
}

function getValidMoves(gameState) {
    const validCols = [];
    for (let c = 0; c < gameState.settings.cols; c++) {
        if (getNextAvailableRow(c, gameState) !== -1) {
            validCols.push(c);
        }
    }
    return validCols;
}