document.addEventListener('DOMContentLoaded', () => {
    const SAVE_FILE_VERSION = "1.0";
    const DEFAULT_PLAYER_COLORS = ['#ff0000', '#00ff00', '#ffff00', '#FF5F1F', '#0000ff', '#00ffff', '#ff00ff', '#ffffff', '#000000'];
    const ANIMATION_DURATION = 500;

    // Cached DOM elements and computed values
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
        lightModeCheck: document.getElementById('light-mode-check'),
        darkModeBtn: document.getElementById('dark-mode-btn'),
        darkModeCheck: document.getElementById('dark-mode-check'),

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

        enableShadowCheckbox: document.getElementById('enable-shadow'),
        enableSoundCheckbox: document.getElementById('enable-sound'),
        enableDiscDesignCheckbox: document.getElementById('enable-disc-design'),

        discDropSound: document.getElementById('disc-drop-sound'),
        winSound: document.getElementById('win-sound'),
        computerWinSound: document.getElementById('computer-win-sound'),
        buttonClickSound: document.getElementById('button-click-sound'),
        columnHoverSound: document.getElementById('column-hover-sound'),
        errorSound: document.getElementById('error-sound')
    };

    // Performance optimization caches
    const renderCache = {
        boardDimensions: null,
        cellDimensions: null,
        maskGradients: null,
        lastBoardState: null,
        cellElements: new Map(),
        discPool: [],
        availableDiscs: [],
        pendingUpdates: new Set(),
        frameId: null
    };

    let gameState = {};
    let currentFocusedColumn = 0;
    let aiWorker = null;
    let workerSupported = false;

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

    // batch update system
    function scheduleBoardUpdate() {
        if (renderCache.frameId) return;

        renderCache.frameId = requestAnimationFrame(() => {
            if (renderCache.pendingUpdates.size > 0) {
                performBatchUpdates();
                renderCache.pendingUpdates.clear();
            }
            renderCache.frameId = null;
        });
    }

    function performBatchUpdates() {
        const updates = Array.from(renderCache.pendingUpdates);
        const fragment = document.createDocumentFragment();

        updates.forEach(update => {
            const [row, col] = update.split(',').map(Number);
            updateCell(row, col, fragment);
        });

        if (fragment.children.length > 0) {
            elements.gameBoard.appendChild(fragment);
        }
    }

    function updateCell(row, col, fragment = null) {
        const cellKey = `${row},${col}`;
        let cell = renderCache.cellElements.get(cellKey);

        if (!cell) {
            cell = createCell(row, col);
            renderCache.cellElements.set(cellKey, cell);
        }

        const playerOwner = gameState.board[row][col];
        const existingDisc = cell.querySelector('.disc');

        if (playerOwner > 0) {
            if (!existingDisc) {
                const disc = createDisc(gameState.players[playerOwner - 1].color, gameState.players[playerOwner - 1].name);
                cell.appendChild(disc);
            } else {
                // Update existing disc
                existingDisc.style.backgroundColor = gameState.players[playerOwner - 1].color;
                existingDisc.setAttribute('aria-label', `${gameState.players[playerOwner - 1].name} disc`);
            }
        } else if (existingDisc) {
            // Remove disc if cell is empty
            recycleDisc(existingDisc);
            cell.removeChild(existingDisc);
        }

        if (fragment && !cell.parentNode) {
            fragment.appendChild(cell);
        }
    }

    function createCell(row, col) {
        const cell = document.createElement('div');
        cell.className = 'cell aspect-square flex justify-center items-center';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`);

        if (row === 0) {
            cell.addEventListener('click', () => handleCellClick(col));
            cell.addEventListener('mouseenter', () => highlightColumn(col, true));
            cell.addEventListener('mouseleave', () => highlightColumn(col, false));
            cell.tabIndex = 0;
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCellClick(col);
                }
            });
        }

        return cell;
    }

    function createDisc(color, playerName) {
        let disc;

        if (renderCache.availableDiscs.length > 0) {
            disc = renderCache.availableDiscs.pop();
        } else {
            disc = document.createElement('div');
            disc.className = 'disc';
            renderCache.discPool.push(disc);
        }

        disc.style.backgroundColor = color;
        disc.setAttribute('aria-label', `${playerName} disc`);
        disc.classList.remove('winning-disc');

        return disc;
    }

    function recycleDisc(disc) {
        disc.classList.remove('winning-disc');
        renderCache.availableDiscs.push(disc);
    }

    // board dimension calculations
    function calculateBoardDimensions() {
        if (!gameState.settings) return null;

        const boardRect = elements.gameBoard.getBoundingClientRect();
        const boardStyle = window.getComputedStyle(elements.gameBoard);
        const paddingLeft = parseFloat(boardStyle.paddingLeft);
        const paddingTop = parseFloat(boardStyle.paddingTop);
        const paddingRight = parseFloat(boardStyle.paddingRight);
        const paddingBottom = parseFloat(boardStyle.paddingBottom);

        const gap = window.innerWidth < 576 ? 6 : 12;
        const contentWidth = boardRect.width - paddingLeft - paddingRight;
        const contentHeight = boardRect.height - paddingTop - paddingBottom;

        const cellWidth = (contentWidth - (gameState.settings.cols - 1) * gap) / gameState.settings.cols;
        const cellHeight = (contentHeight - (gameState.settings.rows - 1) * gap) / gameState.settings.rows;

        return {
            boardRect,
            paddingLeft,
            paddingTop,
            paddingRight,
            paddingBottom,
            gap,
            contentWidth,
            contentHeight,
            cellWidth,
            cellHeight,
            discDiameter: cellWidth * 0.9
        };
    }

    function getCachedDimensions() {
        if (!renderCache.boardDimensions) {
            renderCache.boardDimensions = calculateBoardDimensions();
        }
        return renderCache.boardDimensions;
    }

    function invalidateCache() {
        renderCache.boardDimensions = null;
        renderCache.cellDimensions = null;
        renderCache.maskGradients = null;
        renderCache.lastBoardState = null;
    }

    function validateSettings() {
        const rows = parseInt(elements.boardRowsInput.value);
        const cols = parseInt(elements.boardColsInput.value);
        const winCondition = parseInt(elements.winConditionInput.value);

        if (rows < 5 || rows > 10 || cols < 5 || cols > 10) {
            alert('Board dimensions must be between 5 and 10');
            return false;
        }

        if (winCondition < 3 || winCondition > 6) {
            alert(`Number of discs to must be set between 3 and 6`);
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
            const cellKey = `${r},${currentFocusedColumn}`;
            const cell = renderCache.cellElements.get(cellKey);
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

    function initializeAI() {
        if (typeof Worker !== 'undefined') {
            try {
                aiWorker = new Worker('ai.js');
                aiWorker.onmessage = handleAIResponse;
                aiWorker.onerror = handleAIError;
                return true;
            } catch (error) {
                console.log('Web Worker not supported, using fallback AI');
                return false;
            }
        }
        return false;
    }

    function handleAIResponse(e) {
        const thinking = document.querySelector('.ai-thinking');
        if (thinking) thinking.remove();

        const { move } = e.data;
        if (move !== -1 && !gameState.gameOver) {
            makeMove(move);
        }
    }

    function handleAIError(error) {
        console.error('AI Worker error:', error);
        const thinking = document.querySelector('.ai-thinking');
        if (thinking) thinking.remove();

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        setTimeout(() => {
            const col = getAIMoveSync(currentPlayer.difficulty);
            if (col !== -1 && !gameState.gameOver) {
                makeMove(col);
            }
        }, 500);
    }

    function setupEventListeners() {
        // Theme switching
        elements.lightModeBtn.addEventListener('click', () => {
            document.body.className = 'light bg-[var(--background)] text-[var(--text)]';
            elements.lightModeCheck.classList.remove('hidden');
            elements.darkModeCheck.classList.add('hidden');
            updateShadowSettings();
        });

        elements.darkModeBtn.addEventListener('click', () => {
            document.body.className = 'dark bg-[var(--background)] text-[var(--text)]';
            elements.lightModeCheck.classList.add('hidden');
            elements.darkModeCheck.classList.remove('hidden');
            updateShadowSettings();
        });

        // Game settings
        elements.boardColorSelect.addEventListener('change', (e) => {
            elements.boardVisualLayer.style.backgroundColor = e.target.value;
        });

        elements.gameModeSelect.addEventListener('change', updateGameModeOptionsVisibility);
        elements.playerModeSelect.addEventListener('change', updatePlayerInputs);
        elements.startGameBtn.addEventListener('click', startGame);

        // Input validation with optimized debouncing
        const debouncedValidation = debounce(() => {
            validateInputs();
        }, 300);

        [elements.boardRowsInput, elements.boardColsInput, elements.winConditionInput].forEach(input => {
            input.addEventListener('input', debouncedValidation);
        });

        // Game controls
        elements.pauseBtn.addEventListener('click', togglePause);
        elements.undoBtn.addEventListener('click', undoMove);
        elements.saveBtn.addEventListener('click', saveGame);
        elements.loadGameInput.addEventListener('change', loadGame);

        // Modal controls
        elements.playAgainBtn.addEventListener('click', () => {
            hideModal();
            startGame();
        });
        elements.closeModalBtn.addEventListener('click', hideModal);

        // Keyboard handling
        document.addEventListener('keydown', handleKeyboard);

        // Optimized resize handler
        const debouncedResize = debounce(() => {
            invalidateCache();
            if (gameState.board && gameState.board.length > 0) {
                elements.fallingDiscLayer.innerHTML = '';
                renderBoard();
            }
        }, 500);

        window.addEventListener('beforeunload', (e) => {
            if (!gameState.gameOver && gameState.moveHistory.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        window.addEventListener('resize', debouncedResize);

        // Color dropdown handling
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.color-dropdown')) {
                document.querySelectorAll('.color-dropdown-content').forEach(content => {
                    content.classList.remove('show');
                });
            }
        });

        // Settings
        elements.enableShadowCheckbox.addEventListener('change', updateShadowSettings);
        elements.enableDiscDesignCheckbox.addEventListener('change', updateDiscDesignSettings);
        elements.enableSoundCheckbox.addEventListener('change', updateAudioSettings);

        // Button sound effects
        const buttonsWithSound = [
            elements.startGameBtn, elements.pauseBtn, elements.undoBtn, elements.saveBtn,
            elements.playAgainBtn, elements.closeModalBtn, elements.lightModeBtn, elements.darkModeBtn
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

    // Optimized player input management
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

        [elements.discDropSound, elements.winSound, elements.computerWinSound,
        elements.buttonClickSound, elements.columnHoverSound, elements.errorSound].forEach(audio => {
            if (audio) audio.volume = volume;
        });
    }

    function updateShadowSettings() {
        const shadowEnabled = elements.enableShadowCheckbox.checked;
        document.body.classList.toggle('shadow-toggle', !shadowEnabled);
    }

    function updateDiscDesignSettings() {
        const discDesignEnabled = elements.enableDiscDesignCheckbox.checked;
        document.documentElement.style.setProperty('--after-display', discDesignEnabled ? 'block' : 'none');
    }

    function init() {
        gameState = getDefaultGameState();
        updatePlayerInputs();
        setupEventListeners();
        updateShadowSettings();
        updateAudioSettings();
        updateDiscDesignSettings();

        workerSupported = initializeAI();
        console.log('AI Loaded:', workerSupported);

        startGame();
    }

    function startGame() {
        console.log('New Game Started');

        if (!validateSettings()) return;
        cleanupGame();
        gameState = getDefaultGameState();

        // Cache settings
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

        invalidateCache();
        renderBoard();
        updateDisplay();
        elements.winnerModal.classList.add('hidden');
        elements.undoBtn.disabled = true;
        elements.historyList.innerHTML = '';

        if (gameState.settings.gameMode === 'timed') {
            startGameTimer();
            // 
            if (gameState.settings.turnTimeLimit > 0) {
                startTurnTimer();
            }
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

        // Clear falling disc layer
        if (elements.fallingDiscLayer) {
            elements.fallingDiscLayer.innerHTML = '';
        }

        // Reset timer states
        if (gameState && gameState.timers) {
            gameState.timers.gamePaused = false;
            gameState.timers.turnPaused = false;
        }

        // Cancel any pending render operations
        if (renderCache.frameId) {
            cancelAnimationFrame(renderCache.frameId);
            renderCache.frameId = null;
        }

        // Clear all caches - for preventing memory leaks
        renderCache.cellElements.clear();
        renderCache.pendingUpdates.clear();
        invalidateCache();

        // Reset disc pooling system
        renderCache.availableDiscs.length = 0;
        renderCache.discPool.length = 0;
    }

    // Optimized incremental board rendering
    function renderBoard() {
        const dimensions = getCachedDimensions();
        if (!dimensions) return;

        const aspectRatio = `${gameState.settings.cols}/${gameState.settings.rows}`;
        elements.boardContainer.style.setProperty('--board-aspect-ratio', aspectRatio);

        // Check if we need to rebuild the grid structure
        const currentGridCols = elements.gameBoard.style.gridTemplateColumns;
        const currentGridRows = elements.gameBoard.style.gridTemplateRows;
        const newGridCols = `repeat(${gameState.settings.cols}, 1fr)`;
        const newGridRows = `repeat(${gameState.settings.rows}, 1fr)`;
        const expectedCellCount = gameState.settings.rows * gameState.settings.cols;

        const needsGridRebuild = (
            currentGridCols !== newGridCols ||
            currentGridRows !== newGridRows ||
            renderCache.cellElements.size !== expectedCellCount ||
            elements.gameBoard.children.length !== expectedCellCount
        );

        if (needsGridRebuild) {
            // Full rebuild needed - dimensions changed
            // console.log('Rebuilding grid structure');
            elements.gameBoard.innerHTML = '';
            renderCache.cellElements.clear();

            // Set new grid template
            elements.gameBoard.style.gridTemplateColumns = newGridCols;
            elements.gameBoard.style.gridTemplateRows = newGridRows;

            // Create all cells at once using DocumentFragment
            const fragment = document.createDocumentFragment();
            for (let r = 0; r < gameState.settings.rows; r++) {
                for (let c = 0; c < gameState.settings.cols; c++) {
                    const cell = createCell(r, c);
                    const cellKey = `${r},${c}`;
                    renderCache.cellElements.set(cellKey, cell);
                    fragment.appendChild(cell);
                }
            }
            elements.gameBoard.appendChild(fragment);

            // Force mask gradient regeneration
            renderCache.maskGradients = null;
            renderCache.lastBoardState = null;
        }

        // Generate or update mask gradients if needed
        if (!renderCache.maskGradients || !renderCache.lastBoardState ||
            !arraysEqual(renderCache.lastBoardState, gameState.board)) {
            generateMaskGradients();
        }

        // Update cell contents incrementally
        scheduleIncrementalBoardUpdate();

        // Update additional display elements
        highlightWinningCells();
        colNoDisplay();
    }

    function arraysEqual(arr1, arr2) {
        if (!arr1 || !arr2) return false;
        if (arr1.length !== arr2.length) return false;

        for (let i = 0; i < arr1.length; i++) {
            if (!arr1[i] || !arr2[i]) return false;
            if (arr1[i].length !== arr2[i].length) return false;
            for (let j = 0; j < arr1[i].length; j++) {
                if (arr1[i][j] !== arr2[i][j]) return false;
            }
        }
        return true;
    }

    function scheduleIncrementalBoardUpdate() {
        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                renderCache.pendingUpdates.add(`${r},${c}`);
            }
        }
        scheduleBoardUpdate();
    }

    function generateMaskGradients() {
        renderCache.boardDimensions = null; // Force recalc
        const dimensions = getCachedDimensions();

        const maskGradients = ['linear-gradient(black, black)'];
        const holeRadius = dimensions.discDiameter / 2;

        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                const xCenter = dimensions.paddingLeft + c * (dimensions.cellWidth + dimensions.gap) + dimensions.cellWidth / 2;
                const yCenter = dimensions.paddingTop + r * (dimensions.cellHeight + dimensions.gap) + dimensions.cellHeight / 2;

                maskGradients.push(`radial-gradient(circle ${holeRadius}px at ${xCenter}px ${yCenter}px, black ${holeRadius * 0.95}px, transparent ${holeRadius * 1}px)`);
            }
        }

        renderCache.maskGradients = maskGradients.join(', ');

        requestAnimationFrame(() => {
            elements.boardVisualLayer.style.maskImage = renderCache.maskGradients;
            elements.boardVisualLayer.style.webkitMaskImage = renderCache.maskGradients;
        });

        renderCache.lastBoardState = gameState.board.map(row => [...row]);
    }

    function colNoDisplay() {
        const colNoContainer = document.getElementById('col-no-display');

        // Only rebuild if column count changed
        if (colNoContainer.children.length !== gameState.settings.cols) {
            colNoContainer.innerHTML = '';
            colNoContainer.classList.add('grid');
            colNoContainer.style.gridTemplateColumns = `repeat(${gameState.settings.cols}, 1fr)`;

            const fragment = document.createDocumentFragment();
            for (let c = 0; c < gameState.settings.cols; c++) {
                const colNo = document.createElement('h3');
                colNo.textContent = `${c + 1}`;
                fragment.appendChild(colNo);
            }
            colNoContainer.appendChild(fragment);
        }
    }

    function highlightColumn(col, highlight) {
        if (gameState.gameOver || gameState.isPaused) return;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) return;

        const shouldHighlight = highlight && getNextAvailableRow(col) !== -1;

        for (let r = 0; r < gameState.settings.rows; r++) {
            const cellKey = `${r},${col}`;
            const cell = renderCache.cellElements.get(cellKey);
            if (cell) {
                cell.classList.toggle('column-highlight', shouldHighlight);
            }
        }

        if (shouldHighlight) {
            const topCellKey = `0,${col}`;
            const topCell = renderCache.cellElements.get(topCellKey);
            if (topCell && !topCell.dataset.hoverSoundPlayed) {
                playSound(elements.columnHoverSound, 0.2);
                topCell.dataset.hoverSoundPlayed = 'true';
                setTimeout(() => {
                    delete topCell.dataset.hoverSoundPlayed;
                }, 200);
            }
        }
    }

    function highlightWinningCells() {
        gameState.winningCells.forEach(([r, c]) => {
            const cellKey = `${r},${c}`;
            const cell = renderCache.cellElements.get(cellKey);
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

            // Update only the affected cell
            renderCache.pendingUpdates.add(`${row},${col}`);
            scheduleBoardUpdate();

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

    // Optimized disc drop animation with GPU acceleration
    function animateDiscDrop(col, targetRow, color, callback) {
        const dimensions = getCachedDimensions();
        if (!dimensions) return;

        const fallingLayerRect = elements.fallingDiscLayer.getBoundingClientRect();
        const gameBoardRect = elements.gameBoard.getBoundingClientRect();
        const offsetLeft = gameBoardRect.left - fallingLayerRect.left;
        const offsetTop = gameBoardRect.top - fallingLayerRect.top;

        const discLeft = offsetLeft + dimensions.paddingLeft + col * (dimensions.cellWidth + dimensions.gap) + dimensions.cellWidth / 2;
        const discSize = dimensions.discDiameter + 6;

        let fallingDisc;
        if (renderCache.availableDiscs.length > 0) {
            fallingDisc = renderCache.availableDiscs.pop();
            fallingDisc.className = 'falling-disc disc';
        } else {
            fallingDisc = document.createElement('div');
            fallingDisc.className = 'falling-disc disc';
        }

        // transform and will-change for GPU acceleration
        fallingDisc.style.willChange = 'transform';
        fallingDisc.style.backgroundColor = color;
        fallingDisc.style.width = `${discSize}px`;
        fallingDisc.style.height = `${discSize}px`;
        fallingDisc.style.position = 'absolute';
        fallingDisc.style.left = `${discLeft}px`;
        fallingDisc.style.top = '0px';
        fallingDisc.style.transform = `translate(-50%, -${discSize * 2}px)`;
        fallingDisc.style.opacity = '1';

        elements.fallingDiscLayer.appendChild(fallingDisc);

        let targetTop = dimensions.paddingTop + targetRow * (dimensions.cellHeight + dimensions.gap) + dimensions.gap / 2;
        if (window.innerWidth < 480) {
            targetTop = dimensions.paddingTop + targetRow * (dimensions.cellHeight + dimensions.gap);
        }

        const finalCellCenterTop = offsetTop + dimensions.paddingTop + targetRow * (dimensions.cellHeight + dimensions.gap) + dimensions.cellHeight / 2;

        const fallDistance = targetTop + (discSize * 2);
        let fallTime = Math.min(600, Math.max(300, Math.abs(fallDistance) * 1.0));
        if (window.innerWidth < 576) {
            fallTime *= 1.75;
        }

        fallingDisc.style.transition = `transform ${fallTime}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        fallingDisc.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5), inset 0 0px 8px rgba(255, 255, 255, 0.3)';

        requestAnimationFrame(() => {
            fallingDisc.style.transform = `translate(-50%, ${targetTop}px)`;
        });

        const bounceEnabled = document.getElementById('enable-bounce')?.checked || false;

        setTimeout(() => {
            playSound(elements.discDropSound, 0.6);

            if (bounceEnabled) {
                fallingDisc.style.transition = 'transform 120ms ease-out';
                fallingDisc.style.transform = `translate(-50%, ${targetTop - (targetTop * 0.005)}px)`;

                setTimeout(() => {
                    fallingDisc.style.transition = 'transform 80ms ease-in';
                    fallingDisc.style.transform = `translate(-50%, ${targetTop}px)`;

                    setTimeout(() => {
                        finishAnimation();
                    }, 80);
                }, 120);
            } else {
                finishAnimation();
            }

            function finishAnimation() {
                // Mark this disc as finishing to prevent duplicate cleanup
                if (fallingDisc.dataset.finishing) return;
                fallingDisc.dataset.finishing = 'true';

                fallingDisc.style.boxShadow = 'inset 0 0px 8px rgba(255, 255, 255, 0.5), inset 0px 0px 15px rgba(0, 0, 0, 0.3)';
                fallingDisc.style.transition = 'transform 200ms ease-out, opacity 150ms ease-out';
                fallingDisc.style.transform = `translate(-50%, calc(${finalCellCenterTop}px - 50% - 0px))`;

                setTimeout(() => {
                    fallingDisc.style.opacity = '0';
                    callback();

                    setTimeout(() => {
                        // Final cleanup with safety checks
                        if (fallingDisc && fallingDisc.parentNode && fallingDisc.parentNode === elements.fallingDiscLayer) {
                            fallingDisc.style.willChange = 'auto';
                            elements.fallingDiscLayer.removeChild(fallingDisc);
                            // Reset disc state before returning to pool
                            fallingDisc.className = 'disc';
                            fallingDisc.style.cssText = '';
                            delete fallingDisc.dataset.finishing;
                            renderCache.availableDiscs.push(fallingDisc);
                        }
                    }, 150);
                }, 200);
            }
        }, fallTime);
    }

    function setInteractionState(enabled) {
        gameState.isInputEnabled = enabled;
        elements.gameBoard.style.pointerEvents = enabled ? 'auto' : 'none';

        // Batch DOM updates
        requestAnimationFrame(() => {
            renderCache.cellElements.forEach(cell => {
                if (cell.dataset.row === '0') {
                    cell.tabIndex = enabled ? 0 : -1;
                }
            });
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

        // Batch DOM updates
        requestAnimationFrame(() => {
            document.querySelectorAll('.column-highlight').forEach(el => {
                el.classList.remove('column-highlight');
            });
            document.querySelectorAll('.hint-highlight').forEach(el => {
                el.classList.remove('hint-highlight');
            });

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
        const historyHTML = history.map((move, index) => {
            const moveNumber = gameState.moveHistory.length - history.length + index + 1;
            const player = gameState.players[move.player];
            return `<div class="mb-1">
                        <span style="color: ${player.color};">●</span>
                        Move ${moveNumber}: ${player.name} → Column ${move.col + 1}
                    </div>`;
        }).join('');

        if (elements.historyList.innerHTML !== historyHTML) {
            elements.historyList.innerHTML = historyHTML;
        }
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

        elements.statusMessage.innerHTML += '&nbsp; <span class="ai-thinking"> &circlearrowright;</span>';

        if (aiWorker && workerSupported) {
            aiWorker.postMessage({
                board: gameState.board,
                settings: gameState.settings,
                players: gameState.players,
                currentPlayerIndex: gameState.currentPlayerIndex,
                difficulty: difficulty
            });
        } else {
            setTimeout(() => {
                const thinking = document.querySelector('.ai-thinking');
                if (thinking) thinking.remove();

                const col = getAIMoveSync(difficulty);
                if (col !== -1 && !gameState.gameOver) {
                    makeMove(col);
                }
            }, 500);
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

    function getAIMoveSync(difficulty) {
        const validCols = getValidMoves();
        if (validCols.length === 0) return -1;

        switch (difficulty) {
            case 'very easy':
                return validCols[Math.floor(Math.random() * validCols.length)];
            case 'easy':
            case 'medium':
                return getSimpleAIMove(validCols, 2);
            case 'hard':
            case 'very hard':
                return getSimpleAIMove(validCols, 3);
            default:
                return validCols[Math.floor(Math.random() * validCols.length)];
        }
    }

    function getSimpleAIMove(validCols, maxDepth) {
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

        const centerCol = Math.floor(gameState.settings.cols / 2);
        if (validCols.includes(centerCol)) {
            return centerCol;
        }
        return validCols[Math.floor(Math.random() * validCols.length)];
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

        // Clear and rebuild affected cells
        renderCache.pendingUpdates.clear();
        for (let r = 0; r < gameState.settings.rows; r++) {
            for (let c = 0; c < gameState.settings.cols; c++) {
                renderCache.pendingUpdates.add(`${r},${c}`);
            }
        }
        scheduleBoardUpdate();

        updateMoveHistory();
        elements.undoBtn.disabled = gameState.moveHistory.length === 0;
        updateDisplay();
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

                // Update UI elements
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

                invalidateCache();
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

    function showHint() {
        if (gameState.gameOver || gameState.isPaused) return;

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isAI) return;

        // Clear previous hints
        document.querySelectorAll('.hint-highlight').forEach(el => {
            el.classList.remove('hint-highlight');
        });

        // Simple hint: suggest a random valid move
        const validCols = getValidMoves();
        if (validCols.length === 0) return;

        // Try to find a winning move first
        const aiId = currentPlayer.id;
        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = aiId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                highlightHintColumn(col);
                return;
            }
            gameState.board[row][col] = 0;
        }

        // Check for blocking moves
        const opponentId = gameState.players[(gameState.currentPlayerIndex + 1) % gameState.players.length].id;
        for (const col of validCols) {
            const row = getNextAvailableRow(col);
            gameState.board[row][col] = opponentId;
            if (checkWin(row, col)) {
                gameState.board[row][col] = 0;
                highlightHintColumn(col);
                return;
            }
            gameState.board[row][col] = 0;
        }

        // Otherwise suggest center or random
        const centerCol = Math.floor(gameState.settings.cols / 2);
        const hintCol = validCols.includes(centerCol) ? centerCol : validCols[Math.floor(Math.random() * validCols.length)];
        highlightHintColumn(hintCol);
    }

    function highlightHintColumn(col) {
        gameState.lastHintColumn = col;
        for (let r = 0; r < gameState.settings.rows; r++) {
            const cellKey = `${r},${col}`;
            const cell = renderCache.cellElements.get(cellKey);
            if (cell) {
                cell.classList.add('hint-highlight');
            }
        }

        // Remove hint after 3 seconds
        setTimeout(() => {
            if (gameState.lastHintColumn === col) {
                document.querySelectorAll('.hint-highlight').forEach(el => {
                    el.classList.remove('hint-highlight');
                });
                gameState.lastHintColumn = -1;
            }
        }, 3000);
    }

    // Handle details expansion animations
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