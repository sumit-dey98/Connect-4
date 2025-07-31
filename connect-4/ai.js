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

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        gameState.board[row][col] = aiId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
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

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
        gameState.board[row][col] = aiId;
        if (checkWin(row, col, gameState)) {
            gameState.board[row][col] = 0;
            return col;
        }
        gameState.board[row][col] = 0;
    }

    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
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

    const maxDepth = Math.min(5, 42 - getCurrentMoveCount(gameState));

    for (const col of orderedMoves) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = aiId;

        const score = minimaxAdvanced(maxDepth, false, -Infinity, Infinity,
            gameState.currentPlayerIndex, col, gameState);

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

    const orderedMoves = orderMoves(validCols, aiId, -1, gameState);

    let bestScore = -Infinity;
    let bestCol = orderedMoves[0];

    const maxDepth = Math.min(5, 42 - getCurrentMoveCount(gameState));

    for (const col of orderedMoves) {
        const row = getNextAvailableRow(col, gameState);
        if (row === -1) continue;

        gameState.board[row][col] = aiId;

        const score = minimaxAdvanced(maxDepth, false, -Infinity, Infinity,
            gameState.currentPlayerIndex, col, gameState);

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
            if (winnerInfo.winner === null) return 0;
            if (winnerInfo.winner === originalAI) return 100000 + depth;
            return -100000 - depth;
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
            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI === nextPlayer,
                alpha, beta, originalAI, col, gameState);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const col of orderedCols) {
            const row = getNextAvailableRow(col, gameState);
            gameState.board[row][col] = currentPlayerId;

            const nextPlayer = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            const originalPlayer = gameState.currentPlayerIndex;
            gameState.currentPlayerIndex = nextPlayer;

            const score = minimaxAdvanced(depth - 1, originalAI === nextPlayer,
                alpha, beta, originalAI, col, gameState);

            gameState.currentPlayerIndex = originalPlayer;
            gameState.board[row][col] = 0;

            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
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
    const winCondition = gameState.settings.winCondition;

    const centerCol = Math.floor(cols / 2);
    for (let r = 0; r < rows; r++) {
        if (gameState.board[r][centerCol] === aiId) {
            score += 4 + (rows - r);
        }
    }

    score += evaluateAllWindows(aiId, gameState);
    score += evaluateConnectivity(aiId, gameState);
    score -= evaluateIsolation(aiId, gameState) * 2;
    score += evaluatePositionalAdvantages(aiId, gameState);

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

    if (aiCount > 0 && opponentCount > 0) return 0;

    const winCondition = 4; // Default Connect 4

    if (aiCount === winCondition - 1 && emptyCount === 1) return 1000;
    if (aiCount === winCondition - 2 && emptyCount === 2) return 100;
    if (aiCount === winCondition - 3 && emptyCount === 3) return 10;
    if (aiCount > 0 && emptyCount === winCondition - aiCount) return aiCount * 2;

    if (opponentCount === winCondition - 1 && emptyCount === 1) return -800;
    if (opponentCount === winCondition - 2 && emptyCount === 2) return -80;
    if (opponentCount === winCondition - 3 && emptyCount === 3) return -8;

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

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - winCondition; c++) {
            const window = [];
            for (let i = 0; i < winCondition; i++) {
                window.push(gameState.board[r][c + i]);
            }
            score += evaluateWindowAdvanced(window, aiId);
        }
    }

    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - winCondition; r++) {
            const window = [];
            for (let i = 0; i < winCondition; i++) {
                window.push(gameState.board[r + i][c]);
            }
            score += evaluateWindowAdvanced(window, aiId);
        }
    }

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
                        score += 1;
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
                score += (rows - r);

                if (r < rows - 1 && gameState.board[r + 1][c] !== 0) {
                    score += 2;
                }
            }
        }
    }

    return score;
}

function findImmediateWin(playerId, validCols, gameState) {
    for (const col of validCols) {
        const row = getNextAvailableRow(col, gameState);
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

        scoreA += Math.max(0, 3 - Math.abs(a - center));
        scoreB += Math.max(0, 3 - Math.abs(b - center));

        if (lastMove !== -1) {
            scoreA += Math.max(0, 2 - Math.abs(a - lastMove));
            scoreB += Math.max(0, 2 - Math.abs(b - lastMove));
        }

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

    let left = 0, right = 0;
    for (let c = col - 1; c >= 0 && gameState.board[row][c] === playerId; c--) left++;
    for (let c = col + 1; c < gameState.settings.cols && gameState.board[row][c] === playerId; c++) right++;
    if (left + right + 1 >= winCondition) score += 50;

    let down = 0;
    for (let r = row + 1; r < gameState.settings.rows && gameState.board[r][col] === playerId; r++) down++;
    if (down + 1 >= winCondition) score += 50;

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
    for (let r = 0; r < gameState.settings.rows; r++) {
        for (let c = 0; c < gameState.settings.cols; c++) {
            if (gameState.board[r][c] !== 0) {
                const winner = checkWin(r, c, gameState);
                if (winner) {
                    return { isTerminal: true, winner: winner.id - 1 };
                }
            }
        }
    }
    if (isBoardFull(gameState)) {
        return { isTerminal: true, winner: null };
    }
    return { isTerminal: false, winner: null };
}

function checkWin(r, c, gameState) {
    const playerId = gameState.board[r][c];
    const winLength = gameState.settings.winCondition;
    const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
    ];

    for (const [dr, dc] of directions) {
        if (!gameState.settings.enableDiagonal && (dr === 1 && dc !== 0)) continue;
        const cells = [];
        for (let dir = -1; dir <= 1; dir += 2) {
            for (let i = 1; i < winLength; i++) {
                const nr = r + dr * i * dir;
                const nc = c + dc * i * dir;
                if (nr >= 0 && nr < gameState.settings.rows &&
                    nc >= 0 && nc < gameState.settings.cols &&
                    gameState.board[nr][nc] === playerId) {
                    cells.push([nr, nc]);
                } else {
                    break;
                }
            }
        }
        cells.push([r, c]);
        if (cells.length >= winLength) {
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