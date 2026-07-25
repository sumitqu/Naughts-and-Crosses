/* ---------- Firebase refs ---------- */
const auth = firebase.auth();
const db = firebase.database();

/* ---------- Constants ---------- */
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];
const MAX_MARKS_PER_PLAYER = 3;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

/* ---------- DOM ---------- */
const screens = {
  name: document.getElementById('screenName'),
  lobby: document.getElementById('screenLobby'),
  waiting: document.getElementById('screenWaiting'),
  game: document.getElementById('screenGame')
};

const nameInput = document.getElementById('nameInput');
const nameContinueBtn = document.getElementById('nameContinueBtn');
const nameError = document.getElementById('nameError');

const createRoomBtn = document.getElementById('createRoomBtn');
const joinCodeInput = document.getElementById('joinCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const lobbyError = document.getElementById('lobbyError');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const cancelWaitingBtn = document.getElementById('cancelWaitingBtn');

const activeRoomCode = document.getElementById('activeRoomCode');
const boardEl = document.getElementById('board');
const statusText = document.getElementById('statusText');
const chipX = document.getElementById('chipX');
const chipO = document.getElementById('chipO');
const nameXEl = document.getElementById('nameX');
const nameOEl = document.getElementById('nameO');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const soundBtn = document.getElementById('soundBtn');

const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const rematchBtn = document.getElementById('rematchBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');

const toastEl = document.getElementById('toast');

const tingSound = document.getElementById('tingSound');
const gameoverSound = document.getElementById('gameoverSound');
const bgMusic = document.getElementById('bgMusic');

/* ---------- State ---------- */
let playerName = '';
let roomCode = null;
let mySymbol = null; // 'X' or 'O'
let roomRef = null;
let roomListener = null;
let soundOn = false;
let lastStatus = null; // used to detect status transitions (waiting -> active etc.)
let cellEls = [];

/* ---------- Screen switching ---------- */
function showScreen(name) {
  Object.values(screens).forEach(el => el.classList.remove('visible'));
  screens[name].classList.add('visible');
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  setTimeout(() => toastEl.classList.remove('visible'), 2600);
}

/* ---------- Board build (once) ---------- */
function buildBoard() {
  boardEl.innerHTML = '';
  cellEls = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.addEventListener('click', () => attemptMove(i));
    boardEl.appendChild(cell);
    cellEls.push(cell);
  }
}
buildBoard();

/* ---------- Auth ---------- */
auth.signInAnonymously().catch(err => {
  console.error(err);
  showToast('Could not connect. Check your internet connection.');
});

/* ---------- Name screen ---------- */
nameContinueBtn.addEventListener('click', () => {
  const val = nameInput.value.trim();
  if (!val) {
    nameError.textContent = 'Please enter a name.';
    return;
  }
  playerName = val.slice(0, 16);
  nameError.textContent = '';
  showScreen('lobby');
});

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') nameContinueBtn.click();
});

/* ---------- Lobby: create room ---------- */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

createRoomBtn.addEventListener('click', async () => {
  lobbyError.textContent = '';
  createRoomBtn.disabled = true;
  try {
    let code = generateRoomCode();

    // Extremely unlikely, but make sure we don't collide with an existing room.
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await db.ref('rooms/' + code).get();
      if (!snap.exists()) break;
      code = generateRoomCode();
    }

    const initialRoom = {
      status: 'waiting',
      players: {
        X: { name: playerName, joinedAt: Date.now() }
      },
      board: {},
      moveQueues: { X: [], O: [] },
      currentPlayer: 'X',
      winner: null,
      winLine: null,
      createdAt: Date.now()
    };

    await db.ref('rooms/' + code).set(initialRoom);

    roomCode = code;
    mySymbol = 'X';
    roomCodeDisplay.textContent = code;

    db.ref(`rooms/${code}/players/X`).onDisconnect().remove();

    showScreen('waiting');
    attachRoomListener();
  } catch (err) {
    console.error(err);
    lobbyError.textContent = 'Could not create room. Try again.';
  } finally {
    createRoomBtn.disabled = false;
  }
});

cancelWaitingBtn.addEventListener('click', async () => {
  if (roomRef) {
    await db.ref(`rooms/${roomCode}/players/X`).remove().catch(() => {});
    detachRoomListener();
  }
  roomCode = null;
  mySymbol = null;
  showScreen('lobby');
});

/* ---------- Lobby: join room ---------- */
joinCodeInput.addEventListener('input', () => {
  joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

joinRoomBtn.addEventListener('click', async () => {
  lobbyError.textContent = '';
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length < 4) {
    lobbyError.textContent = 'Enter the 5-character room code.';
    return;
  }

  joinRoomBtn.disabled = true;
  const ref = db.ref('rooms/' + code);

  try {
    const result = await ref.transaction(room => {
      if (room === null) return room; // room does not exist -> abort, handled below
      if (room.status === 'finished') {
        // allow rejoining a finished room only if a seat is actually open
      }
      if (room.players && room.players.O) {
        return; // full -> abort transaction
      }
      room.players = room.players || {};
      room.players.O = { name: playerName, joinedAt: Date.now() };
      room.status = 'active';
      return room;
    });

    if (!result.committed || !result.snapshot.exists()) {
      lobbyError.textContent = 'Room not found or already full.';
      return;
    }

    roomCode = code;
    mySymbol = 'O';
    db.ref(`rooms/${code}/players/O`).onDisconnect().remove();

    attachRoomListener();
  } catch (err) {
    console.error(err);
    lobbyError.textContent = 'Could not join room. Try again.';
  } finally {
    joinRoomBtn.disabled = false;
  }
});

/* ---------- Room listener ---------- */
function attachRoomListener() {
  roomRef = db.ref('rooms/' + roomCode);
  lastStatus = null;
  roomListener = roomRef.on('value', snap => {
    const room = snap.val();
    if (!room) {
      showToast('Room closed.');
      returnToLobby();
      return;
    }
    render(room);
  });
}

function detachRoomListener() {
  if (roomRef && roomListener) {
    roomRef.off('value', roomListener);
  }
  roomRef = null;
  roomListener = null;
}

function returnToLobby() {
  detachRoomListener();
  winOverlay.classList.remove('visible');
  roomCode = null;
  mySymbol = null;
  joinCodeInput.value = '';
  showScreen('lobby');
}

/* ---------- Render room state ---------- */
function render(room) {
  activeRoomCode.textContent = roomCode;

  const nameX = room.players && room.players.X ? room.players.X.name : 'Player 1';
  const nameO = room.players && room.players.O ? room.players.O.name : 'Waiting...';
  nameXEl.textContent = nameX + (mySymbol === 'X' ? ' (you)' : '');
  nameOEl.textContent = nameO + (mySymbol === 'O' ? ' (you)' : '');

  const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
  const opponentPresent = room.players && room.players[opponentSymbol];

  if (room.status === 'waiting') {
    showScreen('waiting');
    roomCodeDisplay.textContent = roomCode;
    lastStatus = room.status;
    return;
  }

  if (screens.game.classList.contains('visible') === false) {
    showScreen('game');
  }

  if (lastStatus === 'waiting' && room.status === 'active') {
    showToast('Opponent joined! Game on.');
  }
  if (lastStatus === 'active' && !opponentPresent && room.status !== 'finished') {
    showToast('Opponent disconnected.');
  }
  lastStatus = room.status;

  // Board
  const board = room.board || {};
  cellEls.forEach((cell, i) => {
    cell.classList.remove('mark-x', 'mark-o', 'fading', 'win-cell');
    const val = board[i];
    if (val === 'X') {
      cell.textContent = '✕';
      cell.classList.add('mark-x');
    } else if (val === 'O') {
      cell.textContent = '◯';
      cell.classList.add('mark-o');
    } else {
      cell.textContent = '';
    }
  });

  const moveQueues = room.moveQueues || { X: [], O: [] };
  ['X', 'O'].forEach(sym => {
    const queue = moveQueues[sym] || [];
    if (queue.length === MAX_MARKS_PER_PLAYER) {
      cellEls[queue[0]].classList.add('fading');
    }
  });

  chipX.classList.toggle('active', room.currentPlayer === 'X' && room.status === 'active');
  chipO.classList.toggle('active', room.currentPlayer === 'O' && room.status === 'active');

  if (room.status === 'active') {
    if (room.currentPlayer === mySymbol) {
      statusText.textContent = 'Your turn';
    } else {
      statusText.textContent = `${room.currentPlayer === 'X' ? nameX : nameO}'s turn`;
    }
  }

  if (room.status === 'finished' && room.winLine) {
    room.winLine.forEach(i => cellEls[i].classList.add('win-cell'));
    const winnerName = room.winner === 'X' ? nameX : nameO;
    const iWon = room.winner === mySymbol;
    winText.textContent = iWon ? 'You win! 🎉' : `${winnerName} wins!`;
    if (!winOverlay.classList.contains('visible')) {
      playSound(gameoverSound);
      winOverlay.classList.add('visible');
    }
    statusText.textContent = `${winnerName} won`;
  } else {
    winOverlay.classList.remove('visible');
  }
}

/* ---------- Moves (Firebase transaction) ---------- */
function attemptMove(index) {
  if (!roomRef || !mySymbol) return;

  roomRef.transaction(room => {
    if (!room) return room;
    if (room.status !== 'active') return; // abort — game not live
    if (room.currentPlayer !== mySymbol) return; // abort — not your turn
    room.board = room.board || {};
    if (room.board[index]) return; // abort — occupied

    room.moveQueues = room.moveQueues || { X: [], O: [] };
    const queue = room.moveQueues[mySymbol] || [];

    if (queue.length === MAX_MARKS_PER_PLAYER) {
      const oldest = queue.shift();
      delete room.board[oldest];
    }

    room.board[index] = mySymbol;
    queue.push(index);
    room.moveQueues[mySymbol] = queue;

    const winLine = getWinningLine(room.board, mySymbol);
    if (winLine) {
      room.status = 'finished';
      room.winner = mySymbol;
      room.winLine = winLine;
    } else {
      room.currentPlayer = mySymbol === 'X' ? 'O' : 'X';
    }

    return room;
  }).then(result => {
    if (result.committed) {
      const room = result.snapshot.val();
      if (room && room.status !== 'finished') {
        playSound(tingSound);
      }
    }
  }).catch(err => console.error(err));
}

function getWinningLine(board, player) {
  return WIN_LINES.find(line => line.every(i => board[i] === player)) || null;
}

/* ---------- Rematch / leave ---------- */
rematchBtn.addEventListener('click', () => {
  if (!roomRef) return;
  roomRef.update({
    board: {},
    moveQueues: { X: [], O: [] },
    currentPlayer: 'X',
    status: 'active',
    winner: null,
    winLine: null
  }).catch(err => console.error(err));
});

backToLobbyBtn.addEventListener('click', async () => {
  if (roomRef && mySymbol) {
    await db.ref(`rooms/${roomCode}/players/${mySymbol}`).remove().catch(() => {});
  }
  returnToLobby();
});

leaveRoomBtn.addEventListener('click', async () => {
  if (roomRef && mySymbol) {
    await db.ref(`rooms/${roomCode}/players/${mySymbol}`).remove().catch(() => {});
  }
  returnToLobby();
});

/* ---------- Sound ---------- */
function playSound(el) {
  if (!soundOn) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.textContent = soundOn ? '🔊 Sound' : '🔈 Sound';
  if (soundOn) {
    bgMusic.volume = 0.35;
    bgMusic.play().catch(() => {});
  } else {
    bgMusic.pause();
  }
});
