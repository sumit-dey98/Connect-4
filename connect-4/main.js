document.addEventListener('DOMContentLoaded', () => {
    const SAVE_FILE_VERSION = "1.0";
    const DEFAULT_PLAYER_COLORS = ['#ff0000', '#00ff00', '#ffff00', '#FF5F1F', '#0000ff', '#00ffff', '#ff00ff', '#ffffff', '#000000'];
    const ANIMATION_DURATION = 500;

    const elements = {
        gameBoard: document.getElementById('game-board'),
        statusMessage: document.getElementById('status-message'),
        timerDisplay: document.getElementById('timer-display'),
        boardContainer: document.getElementById('game-board-container'),
        winnerModal: document.getElementById('winner-modal'),
        winnerMessage: document.getElementById('winner-message'),
        historyList: document.getElementById('history-list'),
        fallingDiscLayer: document.getElementById('falling-disc-layer'),
        boardVisualLayer: document.getElementById('board-visual-layer'),

        lightModeBtn: document.getElementById('light-mode-btn'),
        darkModeBtn: document.getElementById('dark-mode-btn'),
        boardColorSelect: document.getElementById('board-color'),
        gameModeSelect: document.getElementById('game-mode'),
        timedOptions: document.getElementById('timed-options'),
        timeLimitSelect: document.getElementById('time-limit'),
        turnTimeLimitSelect: document.getElementById('turn-time-limit'),
        fixedTurnOptions: document.getElementById('fixed-turn-options'),
        turnLimitInput: document.getElementById('turn-limit'),
        playerModeSelect: document.getElementById('player-mode'),
        aiSettingsContainer: document.getElementById('ai-settings-container'),
        playerNamesContainer: document.getElementById('player-names-container'),
        playerColorsContainer: document.getElementById('player-colors-container'),
        boardColsInput: document.getElementById('board-cols'),
        boardRowsInput: document.getElementById('board-rows'),
        winConditionInput: document.getElementById('win-condition'),
        enableDiagonalCheckbox: document.getElementById('enable-diagonal'),
        startGameBtn: window.innerWidth > 480
            ? document.getElementById('start-game-btn')
            : document.getElementById('start-game-btn-mobile'),

        pauseBtn: document.getElementById('pause-btn'),
        undoBtn: document.getElementById('undo-btn'),
        saveBtn: document.getElementById('save-btn'),
        loadGameInput: document.getElementById('load-game-input'),
        playAgainBtn: document.getElementById('play-again-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),

        enableSoundCheckbox: document.getElementById('enable-sound'),

        discDropSound: document.getElementById('disc-drop-sound'),
        winSound: document.getElementById('win-sound'),
        computerWinSound: document.getElementById('computer-win-sound'),
        buttonClickSound: document.getElementById('button-click-sound'),
        columnHoverSound: document.getElementById('column-hover-sound'),
        errorSound: document.getElementById('error-sound')
    };

    let gameState = {};
    let currentFocusedColumn = 0;

    function getDefaultGameState() {
        return {
            version: SAVE_FILE_VERSION,
            board: [],
            players: [],
            currentPlayerIndex: 0,
            gameOver: false,
            isPaused: false,
            winner: null,
            winningCells: [],
            moveHistory: [],
            lastHintColumn: -1,
            isInputEnabled: true,

            settings: {
                rows: 6,
                cols: 7,
                winCondition: 4,
                enableDiagonal: true,
                gameMode: 'classic',
                timeLimit: 120,
                turnTimeLimit: 10,
                turnLimit: 15,
                playerMode: 'vs_com',
            },

            timers: {
                gameTimerId: null,
                turnTimerId: null,
                remainingGameTime: 120,
                remainingTurnTime: 0,
                gamePaused: false,
                turnPaused: false,
            },

            turnsTaken: [],
        };
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function validateSettings() {
        const rows = parseInt(elements.boardRowsInput.value);
        const cols = parseInt(elements.boardColsInput.value);
        const winCondition = parseInt(elements.winConditionInput.value);

        if (rows < 4 || rows > 15 || cols < 4 || cols > 15) {
            alert('Board dimensions must be between 4 and 15');
            return false;
        }

        if (winCondition < 3 || winCondition > Math.min(rows, cols)) {
            alert(`Win condition must be between 3 and ${Math.min(rows, cols)} (the smallest board dimension)`);
            return false;
        }
        return true;
    }

    function moveColumnFocus(direction) {
        currentFocusedColumn += direction;
        if (currentFocusedColumn < 0) currentFocusedColumn = gameState.settings.cols - 1;
        if (currentFocusedColumn >= gameState.settings.cols) currentFocusedColumn = 0;
        updateColumnHighlight();
    }

    function updateColumnHighlight() {
        document.querySelectorAll('.keyboard-focus').forEach(el => {
            el.classList.remove('keyboard-focus');
        });
        for (let r = 0; r < gameState.settings.rows; r++) {
            const cell = elements.gameBoard.querySelector(`[data-row='${r}'][data-col='${currentFocusedColumn}']`);
            if (cell) {
                cell.classList.add('keyboard-focus');
            }
        }
    }

    function getUniqueColors() {
        const playerCount = getPlayerCount();
        const colors = [];
        const usedColors = new Set();

        for (let i = 0; i < playerCount; i++) {
            const input = document.getElementById(`player-${i + 1}-color`);
            let color = input ? input.value : DEFAULT_PLAYER_COLORS[i];
            let counter = 0;
            while (usedColors.has(color) && counter < 10) {
                const hue = Math.floor(Math.random() * 360);
                color = `hsl(${hue}, 70%, 50%)`;
                counter++;
            }
            if (counter >= 10) {
                color = DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
            }
            colors.push(color);
            usedColors.add(color);
        }
        return colors;
    }

    function init() {
        gameState = getDefaultGameState();
        updatePlayerInputs();
        setupEventListeners();
        updateAudioSettings();
        startGame();
    }

    function setupEventListeners() {
        elements.lightModeBtn.addEventListener('click', () => {
            document.body.className = 'light bg-[var(--background)] text-[var(--text)]';
        });
        elements.darkModeBtn.addEventListener('click', () => {
            document.body.className = 'dark bg-[var(--background)] text-[var(--text)]';
        });

        elements.boardColorSelect.addEventListener('change', (e) => {
            elements.boardVisualLayer.style.backgroundColor = e.target.value;
        });
        elements.gameModeSelect.addEventListener('change', updateGameModeOptionsVisibility);
        elements.playerModeSelect.addEventListener('change', updatePlayerInputs);
        elements.startGameBtn.addEventListener('click', startGame);

        const debouncedValidation = debounce(() => {
            validateInputs();
        }, 300);
        [elements.boardRowsInput, elements.boardColsInput, elements.winConditionInput].forEach(input => {
            input.addEventListener('input', debouncedValidation);
        });

        elements.pauseBtn.addEventListener('click', togglePause);
        elements.undoBtn.addEventListener('click', undoMove);
        elements.saveBtn.addEventListener('click', saveGame);
        elements.loadGameInput.addEventListener('change', loadGame);

        elements.playAgainBtn.addEventListener('click', () => {
            hideModal();
            startGame();
        });
        elements.closeModalBtn.addEventListener('click', () => {
            hideModal();
        });

        document.addEventListener('keydown', handleKeyboard);

        const debouncedResize = debounce(() => {
            if (gameState.board && gameState.board.length > 0) {
                elements.fallingDiscLayer.innerHTML = '';
                renderBoard();
            }
        }, 250);

        window.addEventListener('beforeunload', (e) => {
            if (!gameState.gameOver && gameState.moveHistory.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        window.addEventListener('resize', debouncedResize);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.color-dropdown')) {
                document.querySelectorAll('.color-dropdown-content').forEach(content => {
                    content.classList.remove('show');
                });
            }
        });

        elements.enableSoundCheckbox.addEventListener('change', updateAudioSettings);

        const buttonsWithSound = [
            elements.startGameBtn, elements.pauseBtn, elements.undoBtn, elements.saveBtn, elements.playAgainBtn,
            elements.closeModalBtn, elements.lightModeBtn, elements.darkModeBtn
        ];

        buttonsWithSound.forEach(button => {
            if (button) {
                button.addEventListener('click', () => {
                    playSound(elements.buttonClickSound, 0.3);
                });
            }
        });
    }

    function handleKeyboard(e) {
        const activeElement = document.activeElement;
        const isFormElement = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.tagName === 'BUTTON' ||
            activeElement.hasAttribute('contenteditable') ||
            activeElement.closest('.color-dropdown') ||
            activeElement.closest('aside')
        );

        if (e.key === ' ') {
            if (!isFormElement) {
                e.preventDefault();
                togglePause();
            }
            return;
        }

        if (gameState.gameOver || gameState.isPaused || !gameState.isInputEnabled || isFormElement) return;

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) return;

        if (e.key >= '1' && e.key <= '9') {
            const col = parseInt(e.key) - 1;
            if (col < gameState.settings.cols) makeMove(col);
        } else if (e.key === 'h' || e.key === 'H') {
            showHint();
        } else if (e.key === 'u' || e.key === 'U') {
            undoMove();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            moveColumnFocus(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            moveColumnFocus(1);
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            makeMove(currentFocusedColumn);
        }
    }

    function updateGameModeOptionsVisibility() {
        const mode = elements.gameModeSelect.value;
        elements.timedOptions.classList.toggle('hidden', mode !== 'timed');
        elements.fixedTurnOptions.classList.toggle('hidden', mode !== 'fixed_turn');
    }

    function updatePlayerInputs() {
        elements.playerColorsContainer.innerHTML = '';
        const playerCount = getPlayerCount();
        for (let i = 0; i < playerCount; i++) {
            const playerType = getPlayerType(i);
            const defaultName = playerType === 'Computer' ? 'Computer' : `Player ${i + 1}`;

            const label = document.createElement('label');
            label.className = 'block font-medium mb-1';
            label.textContent = playerType;

            const inputContainer = document.createElement('div');
            inputContainer.className = 'flex gap-2 mb-3';

            const colorDropdown = document.createElement('div');
            colorDropdown.className = 'color-dropdown';
            colorDropdown.id = `player-${i + 1}-color-dropdown`;

            const currentColor = gameState.players && gameState.players[i] ?
                gameState.players[i].color : DEFAULT_PLAYER_COLORS[i];

            const dropdownButton = document.createElement('div');
            dropdownButton.className = 'color-dropdown-button';
            dropdownButton.style.backgroundColor = currentColor;
            dropdownButton.setAttribute('tabindex', '0');
            dropdownButton.setAttribute('role', 'button');
            dropdownButton.setAttribute('aria-label', `Select color for ${getPlayerType(i)}`);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'color-dropdown-content';

            DEFAULT_PLAYER_COLORS.forEach(color => {
                const colorOption = document.createElement('div');
                colorOption.className = 'color-option';
                colorOption.style.backgroundColor = color;
                if (color === currentColor) {
                    colorOption.classList.add('selected');
                }

                colorOption.addEventListener('click', () => {
                    dropdownButton.style.backgroundColor = color;

                    dropdownContent.querySelectorAll('.color-option').forEach(opt =>
                        opt.classList.remove('selected'));
                    colorOption.classList.add('selected');

                    if (gameState.players && gameState.players[i]) {
                        gameState.players[i].color = color;
                        renderBoard();
                        updateDisplay();
                        updateMoveHistory();
                    }

                    dropdownContent.classList.remove('show');
                });

                dropdownContent.appendChild(colorOption);
            });

            dropdownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.color-dropdown-content').forEach(content => {
                    if (content !== dropdownContent) {
                        content.classList.remove('show');
                    }
                });
                dropdownContent.classList.toggle('show');
            });

            dropdownButton.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dropdownButton.click();
                }
            });

            colorDropdown.appendChild(dropdownButton);
            colorDropdown.appendChild(dropdownContent);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.id = `player-${i + 1}-name`;
            nameInput.className = 'flex-1 p-2 rounded bg-white dark:bg-gray-700 border focus-visible:focus';
            nameInput.value = gameState.players && gameState.players[i] ?
                gameState.players[i].name : defaultName;
            nameInput.placeholder = defaultName;

            colorDropdown.addEventListener('change', (e) => {
                if (gameState.players && gameState.players[i]) {
                    gameState.players[i].color = e.target.value;
                    renderBoard();
                    updateDisplay();
                    updateMoveHistory();
                }
            });

            nameInput.addEventListener('input', (e) => {
                if (gameState.players && gameState.players[i]) {
                    gameState.players[i].name = e.target.value || defaultName;
                    updateDisplay();
                    updateMoveHistory();
                }
            });

            inputContainer.appendChild(colorDropdown);
            inputContainer.appendChild(nameInput);

            elements.playerColorsContainer.appendChild(inputContainer);
        }

        updateAISettings();
    }

    function updateAISettings() {
        elements.aiSettingsContainer.innerHTML = '';
        if (elements.playerModeSelect.value === 'vs_com') {
            elements.aiSettingsContainer.classList.remove('hidden');

            const label = document.createElement('label');
            label.className = 'block font-medium mb-1';
            label.textContent = 'AI Difficulty ';

            const select = document.createElement('select');
            select.id = 'ai-difficulty';
            select.className = 'w-full p-2 rounded bg-white dark:bg-gray-700 border focus-visible:focus';
            ['very easy', 'easy', 'medium', 'hard', 'very hard'].forEach(difficulty => {
                const option = document.createElement('option');
                option.value = difficulty;
                option.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
                select.appendChild(option);
            });

            const aiInfoBtn = document.createElement('span');
            aiInfoBtn.textContent = '?';
            aiInfoBtn.className = 'ml-2 cursor-pointer text-blue-400 hover:text-blue-300 font-bold text-lg';
            aiInfoBtn.style.cursor = 'pointer';

            label.appendChild(aiInfoBtn);
            elements.aiSettingsContainer.appendChild(label);
            elements.aiSettingsContainer.appendChild(select);

            const aiInfoModal = document.getElementById('com-info-modal');

            aiInfoBtn.addEventListener('click', () => {
                aiInfoModal.classList.add('flex');
                aiInfoModal.classList.remove('hidden');
            });

            const closeBtn = document.getElementById('close-com-info-btn');
            closeBtn.addEventListener('click', () => {
                aiInfoModal.classList.add('hidden');
                aiInfoModal.classList.remove('flex');
            });

        } else {
            elements.aiSettingsContainer.classList.add('hidden');
        }
    }
    function getPlayerCount() {
        const mode = elements.playerModeSelect.value;
        switch (mode) {
            case 'vs_com':
            case '2_player':
                return 2;
            case '3_player':
                return 3;
            case '4_player':
                return 4;
            default:
                return 2;
        }
    }

    function getPlayerType(index) {
        if (elements.playerModeSelect.value === 'vs_com' && index === 1) {
            return 'Computer';
        }
        return `Player ${index + 1}`;
    }

    function validateInputs() {
        const rows = parseInt(elements.boardRowsInput.value);
        const cols = parseInt(elements.boardColsInput.value);
        const winCondition = parseInt(elements.winConditionInput.value);
        if (winCondition > Math.min(rows, cols)) {
            elements.winConditionInput.value = Math.min(rows, cols);
        }
    }

    function playSound(audioElement, volume = null) {
        if (!elements.enableSoundCheckbox.checked) return;

        try {
            audioElement.currentTime = 0;

            const volumeLevel = volume !== null ? volume : 1.0;
            audioElement.volume = Math.max(0, Math.min(1, volumeLevel));

            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Audio play failed:', error);
                });
            }
        } catch (error) {
            console.log('Audio error:', error);
        }
    }

    function updateAudioSettings() {
        const soundEnabled = elements.enableSoundCheckbox.checked;

        const volume = soundEnabled ? 1.0 : 0;

        if (elements.discDropSound) elements.discDropSound.volume = volume;
        if (elements.winSound) elements.winSound.volume = volume;
        if (elements.computerWinSound) elements.computerWinSound.volume = volume;
        if (elements.buttonClickSound) elements.buttonClickSound.volume = volume;
        if (elements.columnHoverSound) elements.columnHoverSound.volume = volume;
        if (elements.errorSound) elements.errorSound.volume = volume;
    }

    function startGame() {
        console.log('New Game Started');

        if (!validateSettings()) return;
        cleanupGame();
        gameState = getDefaultGameState();

        gameState.settings.rows = parseInt(elements.boardRowsInput.value);
        gameState.settings.cols = parseInt(elements.boardColsInput.value);
        gameState.settings.winCondition = parseInt(elements.winConditionInput.value);
        gameState.settings.enableDiagonal = elements.enableDiagonalCheckbox.checked;
        gameState.settings.gameMode = elements.gameModeSelect.value;
        gameState.settings.timeLimit = parseInt(elements.timeLimitSelect.value);
        gameState.settings.turnTimeLimit = parseInt(elements.turnTimeLimitSelect.value);
        gameState.settings.turnLimit = parseInt(elements.turnLimitInput.value);
        gameState.settings.playerMode = elements.playerModeSelect.value;

        const playerCount = getPlayerCount();
        const colors = getUniqueColors();
        gameState.players = [];
        gameState.turnsTaken = [];
        for (let i = 0; i < playerCount; i++) {
            const isAI = elements.playerModeSelect.value === 'vs_com' && i === 1;

            const nameInput = document.getElementById(`player-${i + 1}-name`);
            const playerName = nameInput ? nameInput.value.trim() || (isAI ? 'Computer' : `Player ${i + 1}`) : (isAI ? 'Computer' : `Player ${i + 1}`);

            gameState.players.push({
                id: i + 1,
                name: playerName,
                color: colors[i],
                isAI: isAI,
                difficulty: isAI ? document.getElementById('ai-difficulty')?.value || 'easy' : null,
            });

            gameState.turnsTaken.push(0);
        }

        gameState.board = Array(gameState.settings.rows).fill(null).map(() =>
            Array(gameState.settings.cols).fill(0)
        );

        elements.boardVisualLayer.style.backgroundColor = elements.boardColorSelect.value;

        if (gameState.settings.gameMode === 'timed') {
            gameState.timers.remainingGameTime = gameState.settings.timeLimit;
            gameState.timers.remainingTurnTime = gameState.settings.turnTimeLimit;
        }

        renderBoard();
        updateDisplay();
        elements.winnerModal.classList.add('hidden');
        elements.undoBtn.disabled = true;
        elements.historyList.innerHTML = '';

        if (gameState.settings.gameMode === 'timed') {
            startGameTimer();
        }
        currentFocusedColumn = Math.floor(gameState.settings.cols / 2);
        updateColumnHighlight();

        const initialPlayer = gameState.players[gameState.currentPlayerIndex];
        if (initialPlayer && initialPlayer.isAI) {
            setInteractionState(false);
            setTimeout(() => aiMove(initialPlayer.difficulty), 1000);
        } else {
            setInteractionState(true);
        }
    }

    function cleanupGame() {
        clearTimers();
        if (elements.fallingDiscLayer) {
            elements.fallingDiscLayer.innerHTML = '';
        }
        if (gameState && gameState.timers) {
            gameState.timers.gamePaused = false;
            gameState.timers.turnPaused = false;
        }
    }

    function renderBoard() {
        const aspectRatio = `${gameState.settings.cols}/${gameState.settings.rows}`;
        elements.boardContainer.style.setProperty('--board-aspect-ratio', aspectRatio);
        elements.gameBoard.innerHTML = '';

        elements.gameBoard.style.gridTemplateColumns = `repeat(${gameState.settings.cols}, 1fr)`;
        elements.gameBoard.style.gridTemplateRows = `repeat(${gameState.settings.rows}, 1fr)`;

        const boardComputedStyle = window.getComputedStyle(elements.gameBoard);
        const boardPaddingLeft = parseFloat(boardComputedStyle.paddingLeft);
        const boardPaddingTop = parseFloat(boardComputedStyle.paddingTop);
        let gap = 12;
        if (window.innerWidth < 576) {
            gap = 6;
        }

        const boardContentWidth = elements.gameBoard.clientWidth - boardPaddingLeft - parseFloat(boardComputedStyle.paddingRight);
        const boardContentHeight = elements.gameBoard.clientHeight - boardPaddingTop - parseFloat(boardComputedStyle.paddingBottom);

        const cellWidth = (boardContentWidth - (gameState.settings.cols - 1) * gap) / gameState.settings.cols;
        const cellHeight = (boardContentHeight - (gameState.settings.rows - 1) * gap) / gameState.settings.rows;

        const discDiameter = (cellWidth * 0.9);
        const holeRadius = discDiameter / 2;

        const maskGradients = [];
        maskGradients.push('linear-gradient(black, black)');

        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                const xCenter = boardPaddingLeft + c * (cellWidth + gap) + cellWidth / 2;
                const yCenter = boardPaddingTop + r * (cellHeight + gap) + cellHeight / 2;

                maskGradients.push(`radial-gradient(circle ${holeRadius}px at ${xCenter}px ${yCenter}px, black ${holeRadius * 0.95}px, transparent ${holeRadius * 1}px)`);

                const cell = document.createElement('div');
                cell.className = 'cell aspect-square flex justify-center items-center';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);

                if (r === 0) {
                    cell.addEventListener('click', () => handleCellClick(c));
                    cell.addEventListener('mouseenter', () => highlightColumn(c, true));
                    cell.addEventListener('mouseleave', () => highlightColumn(c, false));
                    cell.tabIndex = 0;
                    cell.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCellClick(c);
                        }
                    });
                }
                elements.gameBoard.appendChild(cell);

                const playerOwner = gameState.board[r][c];
                if (playerOwner > 0) {
                    const disc = document.createElement('div');
                    disc.className = 'disc';
                    disc.style.backgroundColor = gameState.players[playerOwner - 1].color;
                    disc.setAttribute('aria-label', `${gameState.players[playerOwner - 1].name} disc`);
                    cell.appendChild(disc);
                }
            }
        }

        requestAnimationFrame(() => {
            const maskValue = maskGradients.join(', ');
            elements.boardVisualLayer.style.maskImage = maskValue;
            elements.boardVisualLayer.style.webkitMaskImage = maskValue;
        });

        highlightWinningCells();
    }

    function highlightColumn(col, highlight) {
        if (gameState.gameOver || gameState.isPaused) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) return;

        for (let r = 0; r < gameState.settings.rows; r++) {
            const cell = elements.gameBoard.querySelector(`[data-row='${r}'][data-col='${col}']`);
            if (cell) {
                if (highlight && getNextAvailableRow(col) !== -1) {
                    cell.classList.add('column-highlight');
                } else {
                    cell.classList.remove('column-highlight');
                }
            }
        }

        if (highlight && getNextAvailableRow(col) !== -1) {
            const cell = elements.gameBoard.querySelector(`[data-row='0'][data-col='${col}']`);
            if (cell && !cell.dataset.hoverSoundPlayed) {
                playSound(elements.columnHoverSound, 0.2);
                cell.dataset.hoverSoundPlayed = 'true';
                setTimeout(() => {
                    delete cell.dataset.hoverSoundPlayed;
                }, 200);
            }
        }
    }

    function highlightWinningCells() {
        gameState.winningCells.forEach(([r, c]) => {
            const cell = elements.gameBoard.querySelector(`[data-row='${r}'][data-col='${c}']`);
            const disc = cell?.querySelector('.disc');
            if (disc) {
                disc.classList.add('winning-disc');
            }
        });
    }

    function handleCellClick(col) {
        if (gameState.gameOver || gameState.isPaused) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) return;
        makeMove(col);
    }

    function makeMove(col) {
        if (gameState.gameOver) return;
        const row = getNextAvailableRow(col);
        if (row === -1) {
            playSound(elements.errorSound, 0.4);
            return;
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        setInteractionState(false);

        gameState.moveHistory.push({
            player: gameState.currentPlayerIndex,
            col: col,
            row: row,
            boardState: gameState.board.map(row => [...row])
        });

        animateDiscDrop(col, row, currentPlayer.color, () => {
            gameState.board[row][col] = currentPlayer.id;
            updateMoveHistory();
            elements.undoBtn.disabled = false;

            const winner = checkWin(row, col);
            if (winner) {
                endGame(`${winner.name} wins!`, winner);
                return;
            }

            if (isBoardFull()) {
                endGame("It's a draw!");
                return;
            }

            if (gameState.settings.gameMode === 'fixed_turn' &&
                (gameState.turnsTaken[gameState.currentPlayerIndex] + 1) >= gameState.settings.turnLimit) {

                let allPlayersFinished = true;
                for (let i = 0; i < gameState.players.length; i++) {
                    const turnsForPlayer = i === gameState.currentPlayerIndex ?
                        gameState.turnsTaken[i] + 1 : gameState.turnsTaken[i];
                    if (turnsForPlayer < gameState.settings.turnLimit) {
                        allPlayersFinished = false;
                        break;
                    }
                }

                if (allPlayersFinished) {
                    const result = determineFixedTurnWinner();
                    endGame(result.message, result.winner);
                    return;
                }
            }

            nextTurn();
        });
    }

    function animateDiscDrop(col, targetRow, color, callback) {
        const fallingLayerRect = elements.fallingDiscLayer.getBoundingClientRect();
        const gameBoardRect = elements.gameBoard.getBoundingClientRect();
        const offsetLeft = gameBoardRect.left - fallingLayerRect.left;

        const boardComputedStyle = window.getComputedStyle(elements.gameBoard);
        const boardPaddingLeft = parseFloat(boardComputedStyle.paddingLeft);
        const boardPaddingRight = parseFloat(boardComputedStyle.paddingRight);
        let gap = 12;
        if (window.innerWidth < 480) {
            gap = 6;
        }

        const boardContentWidth = elements.gameBoard.clientWidth - boardPaddingLeft - boardPaddingRight;
        const cellWidth = (boardContentWidth - (gameState.settings.cols - 1) * gap) / gameState.settings.cols;

        const discLeft = offsetLeft + boardPaddingLeft + col * (cellWidth + gap) + cellWidth / 2;
        const discSize = (cellWidth * 0.9) + 6;

        const fallingDisc = document.createElement('div');
        fallingDisc.className = 'falling-disc disc';
        fallingDisc.style.backgroundColor = color;
        fallingDisc.style.width = `${discSize}px`;
        fallingDisc.style.height = `${discSize}px`;
        fallingDisc.style.willChange = 'transform';

        fallingDisc.style.left = `${discLeft}px`;
        fallingDisc.style.top = '0px';
        fallingDisc.style.transform = `translate(-50%, -${discSize * 2}px)`;

        elements.fallingDiscLayer.appendChild(fallingDisc);

        const offsetTop = gameBoardRect.top - fallingLayerRect.top;

        const boardPaddingTop = parseFloat(boardComputedStyle.paddingTop);
        const boardPaddingBottom = parseFloat(boardComputedStyle.paddingBottom);
        const boardContentHeight = elements.gameBoard.clientHeight - boardPaddingTop - boardPaddingBottom;
        const cellHeight = (boardContentHeight - (gameState.settings.rows - 1) * gap) / gameState.settings.rows;

        let targetTop = boardPaddingTop + targetRow * (cellHeight + gap) + gap / 2;
        if (window.innerWidth < 480) {
            targetTop = boardPaddingTop + targetRow * (cellHeight + gap);
        }


        const finalCellCenterTop = offsetTop + boardPaddingTop + targetRow * (cellHeight + gap) + cellHeight / 2;

        const fallDistance = targetTop + (discSize * 2);
        let fallTime = Math.min(600, Math.max(300, Math.abs(fallDistance) * 1.0));
        if(window.innerWidth < 576) {
            fallTime *= 1.75;
        }

        fallingDisc.style.transition = `transform ${fallTime}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;

        fallingDisc.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5), inset 0 0px 8px rgba(255, 255, 255, 0.3)';

        requestAnimationFrame(() => {
            fallingDisc.style.transform = `translate(-50%, ${targetTop}px)`;
        });

        setTimeout(() => {
            playSound(elements.discDropSound, 0.6);

            fallingDisc.style.transition = 'transform 120ms ease-out';
            fallingDisc.style.transform = `translate(-50%, ${targetTop - (targetTop * 0.005)}px)`;

            setTimeout(() => {
                fallingDisc.style.transition = 'transform 80ms ease-in';
                fallingDisc.style.transform = `translate(-50%, ${targetTop}px)`;

                setTimeout(() => {
                    fallingDisc.style.boxShadow = 'inset 0 0px 8px rgba(255, 255, 255, 0.5), inset 0px 0px 15px rgba(0, 0, 0, 0.3)';

                    fallingDisc.style.transition = 'transform 200ms ease-out, opacity 150ms ease-out';
                    fallingDisc.style.transform = `translate(-50%, calc(${finalCellCenterTop}px - 50% - 0px))`;


                    setTimeout(() => {
                        fallingDisc.style.opacity = '0';

                        callback();

                        setTimeout(() => {
                            fallingDisc.style.willChange = 'auto';
                            fallingDisc.remove();
                        }, 150);
                    }, 200);
                }, 80);
            }, 120);
        }, fallTime);
    }

    function setInteractionState(enabled) {
        gameState.isInputEnabled = enabled;
        elements.gameBoard.style.pointerEvents = enabled ? 'auto' : 'none';
        document.querySelectorAll('.cell').forEach(cell => {
            cell.tabIndex = enabled ? 0 : -1;
        });
    }

    function getNextAvailableRow(col) {
        for (let r = gameState.settings.rows - 1; r >= 0; r--) {
            if (gameState.board[r][col] === 0) {
                return r;
            }
        }
        return -1;
    }

    function isBoardFull() {
        return gameState.board[0].every(cell => cell !== 0);
    }

    function checkWin(r, c) {
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
                gameState.winningCells = cells.slice(0, winLength);
                return gameState.players[playerId - 1];
            }
        }
        return null;
    }

    function checkFixedTurnEnd() {
        return gameState.turnsTaken.every(turns => turns >= gameState.settings.turnLimit);
    }

    function determineFixedTurnWinner() {
        const discCounts = Array(gameState.players.length).fill(0);
        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                if (gameState.board[r][c] > 0) {
                    discCounts[gameState.board[r][c] - 1]++;
                }
            }
        }
        const maxDiscs = Math.max(...discCounts);
        const winners = gameState.players.filter((p, i) => discCounts[i] === maxDiscs);
        if (winners.length > 1) {
            return {
                message: "It's a draw!",
                winner: null
            };
        } else {
            return {
                message: `${winners[0].name} wins with ${maxDiscs} discs!`,
                winner: winners[0]
            };
        }
    }

    function nextTurn() {
        gameState.turnsTaken[gameState.currentPlayerIndex]++;

        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.lastHintColumn = -1;

        if (gameState.settings.gameMode === 'timed' && gameState.settings.turnTimeLimit > 0) {
            resetTurnTimer();
            startTurnTimer();
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];

        if (!gameState.gameOver) {
            if (currentPlayer.isAI) {
                setInteractionState(false);
                setTimeout(() => aiMove(currentPlayer.difficulty), 1000);
            } else {
                setInteractionState(true);
            }
        } else {
            setInteractionState(true);
        }

        updateDisplay();
    }

    function endGame(message, winner = null) {
        if (winner) {
            if (winner.isAI) {
                playSound(elements.computerWinSound, 0.8);
            } else {
                playSound(elements.winSound, 0.8);
            }
        } else {
            playSound(elements.buttonClickSound, 0.5);
        }

        gameState.gameOver = true;
        gameState.gameOverMessage = message;
        gameState.winner = winner;
        clearTimers();

        setInteractionState(true);

        elements.winnerMessage.textContent = message;
        showModal();
        updateDisplay();
        console.log(elements.winnerMessage.textContent);
    }

    function showModal() {
        elements.winnerModal.classList.remove('hidden');

        elements.playAgainBtn.focus();

        document.addEventListener('keydown', handleModalKeydown);

        elements.winnerModal.previouslyFocused = document.activeElement;
    }

    function hideModal() {
        elements.winnerModal.classList.add('hidden');

        document.removeEventListener('keydown', handleModalKeydown);

        document.querySelectorAll('.column-highlight').forEach(el => {
            el.classList.remove('column-highlight');
        });
        document.querySelectorAll('.hint-highlight').forEach(el => {
            el.classList.remove('hint-highlight');
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (gameState.board && gameState.board.length > 0) {
                    renderBoard();
                }
            });
        });

        if (elements.winnerModal.previouslyFocused) {
            elements.winnerModal.previouslyFocused.focus();
            elements.winnerModal.previouslyFocused = null;
        }
    }

    function handleModalKeydown(e) {
        if (e.key === 'Escape') {
            hideModal();
        }

        if (e.key === 'Tab') {
            const focusableElements = elements.winnerModal.querySelectorAll('button');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    function updateDisplay() {
        updateStatus();
        updateTimerDisplay();
    }

    function updateStatus() {
        if (gameState.gameOver) {
            elements.statusMessage.textContent = gameState.winner ?
                `Game Over - ${gameState.winner.name} wins!` : 'Game Over - Draw!';
            return;
        }

        if (gameState.isPaused) {
            elements.statusMessage.textContent = 'Game Paused';
        } else {
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            if (currentPlayer) {
                let statusText = `${currentPlayer.name}'s Turn`;
                if (gameState.settings.gameMode === 'fixed_turn') {
                    statusText += ` (${gameState.turnsTaken[gameState.currentPlayerIndex] + 1}/${gameState.settings.turnLimit})`;
                }
                elements.statusMessage.innerHTML = `
                <span class="inline-block w-5 h-5 rounded-full mr-2"
                      style="background-color: ${currentPlayer.color};"
                      aria-hidden="true"></span>
                ${statusText}
            `;
            } else {
                elements.statusMessage.textContent = 'Starting Game...';
            }
        }
    }

    function updateTimerDisplay() {
        if (gameState.settings.gameMode !== 'timed') {
            elements.timerDisplay.textContent = '';
            return;
        }
        const gameMinutes = Math.floor(gameState.timers.remainingGameTime / 60);
        const gameSeconds = gameState.timers.remainingGameTime % 60;
        let display = `Game: ${gameMinutes}:${gameSeconds.toString().padStart(2, '0')}`;
        if (gameState.settings.turnTimeLimit > 0) {
            display += ` | Turn: ${gameState.timers.remainingTurnTime}s`;
        }
        elements.timerDisplay.textContent = display;
    }

    function updateMoveHistory() {
        const history = gameState.moveHistory.slice(-10);
        elements.historyList.innerHTML = history.map((move, index) => {
            const moveNumber = gameState.moveHistory.length - history.length + index + 1;
            const player = gameState.players[move.player];
            return `<div class="mb-1">
                        <span style="color: ${player.color};">●</span>
                        Move ${moveNumber}: ${player.name} → Column ${move.col + 1}
                    </div>`;
        }).join('');

        requestAnimationFrame(() => {
            renderBoard();
        });
    }

    function clearTimers() {
        if (gameState && gameState.timers) {
            if (gameState.timers.gameTimerId) {
                clearInterval(gameState.timers.gameTimerId);
                gameState.timers.gameTimerId = null;
            }
            if (gameState.timers.turnTimerId) {
                clearInterval(gameState.timers.turnTimerId);
                gameState.timers.turnTimerId = null;
            }
        }
    }

    function startGameTimer() {
        if (gameState.timers.gameTimerId) {
            clearInterval(gameState.timers.gameTimerId);
        }

        gameState.timers.gameTimerId = setInterval(() => {
            if (gameState.gameOver || gameState.isPaused) {
                return;
            }

            gameState.timers.remainingGameTime--;
            updateTimerDisplay();

            if (gameState.timers.remainingGameTime <= 0) {
                clearInterval(gameState.timers.gameTimerId);
                gameState.timers.gameTimerId = null;
                endGame("Time's up! It's a draw!");
            }
        }, 1000);
    }

    function startTurnTimer() {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) {
            return;
        }

        if (gameState.timers.turnTimerId) {
            clearInterval(gameState.timers.turnTimerId);
        }

        if (gameState.settings.turnTimeLimit <= 0) {
            return;
        }

        gameState.timers.turnTimerId = setInterval(() => {
            if (gameState.gameOver || gameState.isPaused) {
                clearInterval(gameState.timers.turnTimerId);
                gameState.timers.turnTimerId = null;
                return;
            }

            gameState.timers.remainingTurnTime--;
            updateTimerDisplay();

            if (gameState.timers.remainingTurnTime <= 0) {
                clearInterval(gameState.timers.turnTimerId);
                gameState.timers.turnTimerId = null;
                playSound(elements.errorSound, 0.4);
                nextTurn();
            }
        }, 1000);
    }

    function resetTurnTimer() {
        if (gameState.timers.turnTimerId) {
            clearInterval(gameState.timers.turnTimerId);
            gameState.timers.turnTimerId = null;
        }
        gameState.timers.remainingTurnTime = gameState.settings.turnTimeLimit;
    }

    function aiMove(difficulty) {
        if (gameState.gameOver) return;
        let col;
        switch (difficulty) {
            case 'very easy':
                col = getVeryEasyAIMove();
                break;
            case 'easy':
                col = getEasyAIMove();
                break;
            case 'medium':
                col = getMediumAIMove();
                break;
            case 'hard':
                col = getHardAIMove();
                break;
            case 'very hard':
                col = getVeryHardAIMove();
                break;
            default:
                col = getEasyAIMove();
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

    function getVeryEasyAIMove() {
        console.log('AI Level 1 Move Made');
        const validCols = getValidMoves();
        return validCols.length > 0 ?
            validCols[Math.floor(Math.random() * validCols.length)] : -1;
    }

    function getEasyAIMove() {
        console.log('AI Level 2 Move Made');
        const validCols = getValidMoves();
        if (validCols.length === 0) return -1;

        if (Math.random() < 0.3) {
            return validCols[Math.floor(Math.random() * validCols.length)];
        }

        const aiId = gameState.players[gameState.currentPlayerIndex].id;
        const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = aiId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                return col;
            }
            gameState.board[row][col] = 0;
        }

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = opponentId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                return col;
            }
            gameState.board[row][col] = 0;
        }

        let bestScore = -Infinity;
        let bestCol = validCols[0];

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = aiId;

            let score = evaluateBoardAdvanced(aiId) * 2;
            score += minimax(2, false, -Infinity, Infinity, gameState.currentPlayerIndex);

            gameState.board[row][col] = 0;

            if (score > bestScore) {
                bestScore = score;
                bestCol = col;
            }
        }

        return bestCol;
    }

    function getMediumAIMove() {
        console.log('AI Level 3 Move Made');
        const validCols = getValidMoves();
        if (validCols.length === 0) return -1;

        if (Math.random() < 0.1) {
            return validCols[Math.floor(Math.random() * validCols.length)];
        }

        const aiId = gameState.players[gameState.currentPlayerIndex].id;
        const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = aiId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                return col;
            }
            gameState.board[row][col] = 0;
        }

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = opponentId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                return col;
            }
            gameState.board[row][col] = 0;
        }

        const blockForkMove = findForkOpportunity(opponentId, validCols);
        if (blockForkMove !== -1) return blockForkMove;

        let bestScore = -Infinity;
        let bestCol = validCols[0];

        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = aiId;

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

    function getHardAIMove() {
        console.log('AI Level 4 Move Made');
        const validCols = getValidMoves();
        if (validCols.length === 0) return -1;

        if (Math.random() < 0.05) {
            return validCols[Math.floor(Math.random() * validCols.length)];
        }

        const aiId = gameState.players[gameState.currentPlayerIndex].id;
        const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

        const immediateWin = findImmediateWin(aiId, validCols);
        if (immediateWin !== -1) return immediateWin;

        const blockWin = findImmediateWin(opponentId, validCols);
        if (blockWin !== -1) return blockWin;

        const orderedMoves = orderMoves(validCols, aiId);

        let bestScore = -Infinity;
        let bestCol = orderedMoves[0];

        const maxDepth = Math.min(4, 42 - getCurrentMoveCount());

        for (const col of orderedMoves) {
            const row = getNextAvailableRow(col);
            if (row === -1) continue;

            gameState.board[row][col] = aiId;

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

    function getVeryHardAIMove() {
        console.log('AI Level 5 Move Made');
        const validCols = getValidMoves();
        if (validCols.length === 0) return -1;

        const aiId = gameState.players[gameState.currentPlayerIndex].id;
        const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;

        const immediateWin = findImmediateWin(aiId, validCols);
        if (immediateWin !== -1) return immediateWin;

        const blockWin = findImmediateWin(opponentId, validCols);
        if (blockWin !== -1) return blockWin;

        const orderedMoves = orderMoves(validCols, aiId);

        let bestScore = -Infinity;
        let bestCol = orderedMoves[0];

        const maxDepth = Math.min(4, 42 - getCurrentMoveCount());

        for (const col of orderedMoves) {
            const row = getNextAvailableRow(col);
            if (row === -1) continue;

            gameState.board[row][col] = aiId;

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
                if (beta <= alpha) break;
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
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

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

            if (threats >= 2) return col;
        }
        return -1;
    }

    function orderMoves(validCols, playerId, lastMove = -1) {
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

            return scoreB - scoreA;
        });
    }

    function quickEvaluatePosition(row, col, playerId) {
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

    function getCurrentMoveCount() {
        let count = 0;
        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                if (gameState.board[r][c] !== 0) count++;
            }
        }
        return count;
    }

    function evaluateBoardAdvanced(aiId) {
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

        score += evaluateAllWindows(aiId);

        score += evaluateConnectivity(aiId);

        score -= evaluateIsolation(aiId) * 2;

        score += evaluatePositionalAdvantages(aiId);

        return score;
    }

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

        if (aiCount === winCondition - 1 && emptyCount === 1) return 1000;
        if (aiCount === winCondition - 2 && emptyCount === 2) return 100;
        if (aiCount === winCondition - 3 && emptyCount === 3) return 10;
        if (aiCount > 0 && emptyCount === winCondition - aiCount) return aiCount * 2;

        if (opponentCount === winCondition - 1 && emptyCount === 1) return -800;
        if (opponentCount === winCondition - 2 && emptyCount === 2) return -80;
        if (opponentCount === winCondition - 3 && emptyCount === 3) return -8;

        return 0;
    }

    function evaluateAllWindows(aiId) {
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

    function evaluateConnectivity(aiId) {
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

    function evaluatePositionalAdvantages(aiId) {
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

    function evaluateWindow(window, aiId) {
        return evaluateWindowAdvanced(window, aiId);
    }

    function evaluateBoard(aiId) {
        return evaluateBoardAdvanced(aiId);
    }

    function minimax(depth, isMaximizing, alpha, beta, originalAI) {
        return minimaxAdvanced(depth, isMaximizing, alpha, beta, originalAI);
    }
    function togglePause() {
        if (gameState.gameOver) return;

        gameState.isPaused = !gameState.isPaused;
        elements.pauseBtn.textContent = gameState.isPaused ? 'Resume' : 'Pause';

        if (gameState.isPaused) {
            gameState.timers.gamePaused = gameState.timers.gameTimerId !== null;
            gameState.timers.turnPaused = gameState.timers.turnTimerId !== null;

            clearTimers();
        } else {
            if (gameState.settings.gameMode === 'timed') {
                if (gameState.timers.gamePaused && gameState.timers.remainingGameTime > 0) {
                    startGameTimer();
                }
                if (gameState.timers.turnPaused && gameState.timers.remainingTurnTime > 0) {
                    startTurnTimer();
                }
            }
            gameState.timers.gamePaused = false;
            gameState.timers.turnPaused = false;
        }
        updateDisplay();
    }

    function undoMove() {
        if (gameState.moveHistory.length === 0 || gameState.gameOver) return;
        const lastMove = gameState.moveHistory.pop();
        gameState.board = lastMove.boardState;
        gameState.turnsTaken[lastMove.player]--;
        gameState.currentPlayerIndex = lastMove.player;
        gameState.winningCells = [];
        renderBoard();
        updateMoveHistory();
        elements.undoBtn.disabled = gameState.moveHistory.length === 0;
        updateDisplay();
    }

    function showHint() {
        if (gameState.gameOver || gameState.isPaused) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.isAI) return;

        document.querySelectorAll('.hint-highlight').forEach(el => {
            el.classList.remove('hint-highlight');
        });

        const col = getMediumAIMove();
        if (col !== -1) {
            gameState.lastHintColumn = col;
            for (let r = 0; r < gameState.settings.rows; r++) {
                const cell = elements.gameBoard.querySelector(`[data-row='${r}'][data-col='${col}']`);
                if (cell) {
                    cell.classList.add('column-highlight');
                    setTimeout(() => {
                        cell.classList.remove('column-highlight');
                    }, 2000);
                }
            }
        }
    }

    function saveGame() {
        if (!gameState.isPaused && !gameState.gameOver) {
            alert('Please pause the game before saving.');
            return;
        }
        try {
            const saveData = {
                version: SAVE_FILE_VERSION,
                gameState: gameState,
                timestamp: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(saveData, null, 2)], {
                type: 'application/json'
            });
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            const filename = `connect4_${gameState.settings.gameMode}_${timestamp}.json`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save game. Please try again.');
        }
    }

    function loadGame(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const saveData = JSON.parse(e.target.result);
                if (!saveData.version || !saveData.gameState) {
                    throw new Error('Invalid save file format');
                }
                if (saveData.version !== SAVE_FILE_VERSION) {
                    if (!confirm('This save file is from a different version. Loading may cause issues. Continue?')) {
                        return;
                    }
                }
                cleanupGame();
                gameState = saveData.gameState;

                elements.boardRowsInput.value = gameState.settings.rows;
                elements.boardColsInput.value = gameState.settings.cols;
                elements.winConditionInput.value = gameState.settings.winCondition;
                elements.enableDiagonalCheckbox.checked = gameState.settings.enableDiagonal;
                elements.gameModeSelect.value = gameState.settings.gameMode;
                elements.timeLimitSelect.value = gameState.settings.timeLimit;
                elements.turnTimeLimitSelect.value = gameState.settings.turnTimeLimit;
                elements.turnLimitInput.value = gameState.settings.turnLimit;
                elements.playerModeSelect.value = gameState.settings.playerMode;

                updateGameModeOptionsVisibility();
                updatePlayerInputs();

                elements.boardVisualLayer.style.backgroundColor = elements.boardColorSelect.value;

                renderBoard();
                updateMoveHistory();
                updateDisplay();

                if (gameState.settings.gameMode === 'timed' && !gameState.gameOver) {
                    if (!gameState.isPaused) {
                        startGameTimer();
                        if (gameState.settings.turnTimeLimit > 0) {
                            startTurnTimer();
                        }
                    }
                }
                elements.pauseBtn.textContent = gameState.isPaused ? 'Resume' : 'Pause';
                elements.undoBtn.disabled = gameState.moveHistory.length === 0;
                event.target.value = '';
                alert('Game loaded successfully!');

            } catch (error) {
                console.error('Load failed:', error);
                alert('Failed to load game file. Please check the file and try again.');
            }
        };
        reader.readAsText(file);
    }

    document.querySelectorAll('details').forEach(details => {
        const content = details.querySelector('.details-content');

        details.addEventListener('toggle', () => {
            if (details.open) {
                const height = content.scrollHeight;
                details.style.setProperty('--content-height', height + 'px');
            }
        });
    });

    init();
});
