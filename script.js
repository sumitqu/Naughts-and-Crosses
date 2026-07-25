const boardEl = document.getElementById('board');
const statusText = document.getElementById('statusText');
const chipX = document.getElementById('chipX');
const chipO = document.getElementById('chipO');
const resetBtn = document.getElementById('resetBtn');
const soundBtn = document.getElementById('soundBtn');
const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');

const tingSound = document.getElementById('tingSound');
const gameoverSound = document.getElementById('gameoverSound');
const bgMusic = document.getElementById('bgMusic');

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const MAX_MARKS_PER_PLAYER = 3;

let board = Array(9).fill(null);
let moveQueues = { X: [], O: [] };
let currentPlayer = 'X';
let gameOver = false;
let soundOn = false;

const cellEls = [];

function buildBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('data-index', i);
    cell.addEventListener('click', () => handleCellClick(i));
    boardEl.appendChild(cell);
    cellEls.push(cell);
  }
}

function playSound(el) {
  if (!soundOn) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

function handleCellClick(index) {
  if (gameOver || board[index] !== null) return;

  const queue = moveQueues[currentPlayer];

  // If this player already has 3 marks on the board, the oldest fades away.
  if (queue.length === MAX_MARKS_PER_PLAYER) {
    const oldestIndex = queue.shift();
    board[oldestIndex] = null;
  }

  board[index] = currentPlayer;
  queue.push(index);

  renderBoard();

  const winningLine = getWinningLine(currentPlayer);
  if (winningLine) {
    endGame(currentPlayer, winningLine);
    return;
  }

  playSound(tingSound);
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  updateStatus();
}

function getWinningLine(player) {
  return WIN_LINES.find(line => line.every(i => board[i] === player)) || null;
}

function renderBoard() {
  cellEls.forEach((cell, i) => {
    cell.classList.remove('mark-x', 'mark-o', 'fading');
    if (board[i] === 'X') {
      cell.textContent = '✕';
      cell.classList.add('mark-x');
    } else if (board[i] === 'O') {
      cell.textContent = '◯';
      cell.classList.add('mark-o');
    } else {
      cell.textContent = '';
    }
  });

  // Mark whichever piece will fade next for each player at 3 marks.
  ['X', 'O'].forEach(player => {
    const queue = moveQueues[player];
    if (queue.length === MAX_MARKS_PER_PLAYER) {
      cellEls[queue[0]].classList.add('fading');
    }
  });
}

function updateStatus() {
  statusText.textContent = currentPlayer === 'X' ? 'Player 1\u2019s turn' : 'Player 2\u2019s turn';
  chipX.classList.toggle('active', currentPlayer === 'X');
  chipO.classList.toggle('active', currentPlayer === 'O');
}

function endGame(winner, line) {
  gameOver = true;
  line.forEach(i => cellEls[i].classList.add(winner === 'X' ? 'mark-x' : 'mark-o'));
  playSound(gameoverSound);
  winText.textContent = winner === 'X' ? 'Player 1 wins!' : 'Player 2 wins!';
  winOverlay.classList.add('visible');
}

function resetGame() {
  board = Array(9).fill(null);
  moveQueues = { X: [], O: [] };
  currentPlayer = 'X';
  gameOver = false;
  winOverlay.classList.remove('visible');
  renderBoard();
  updateStatus();
}

resetBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.textContent = soundOn ? '🔊 Sound' : '🔈 Sound';
  if (soundOn) {
    bgMusic.volume = 0.4;
    bgMusic.play().catch(() => {});
  } else {
    bgMusic.pause();
  }
});

buildBoard();
renderBoard();
updateStatus();
