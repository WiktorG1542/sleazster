// script.js
const socket = io();

let nickname = '';
let players = {};
let availableCards = new Set();

// Event listeners for UI elements
document.getElementById('joinGame').addEventListener('click', joinGame);
document.getElementById('startGame').addEventListener('click', startGame);
document.getElementById('playRound').addEventListener('click', playRound);
document.getElementById('resetGame').addEventListener('click', resetGame);

// Join the game with a nickname
function joinGame() {
  const nicknameInput = document.getElementById('nickname');
  nickname = nicknameInput.value.trim();
  if (nickname) {
    socket.emit('register', nickname);
    document.getElementById('nicknameContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
  } else {
    alert('Please enter a nickname.');
  }
}

// Start the game
function startGame() {
  socket.emit('startGame');
}

// Play a round
function playRound() {
  socket.emit('playRound');
}

// Reset the game
function resetGame() {
  socket.emit('resetGame');
}

// Initialize the card grid
function initGrid() {
  const cardGrid = document.getElementById('cardGrid');
  cardGrid.innerHTML = '';
  const suits = ['♠', '♣', '♦', '♥'];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];

  suits.forEach((suit) => {
    values.forEach((value) => {
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('card');
      cardDiv.id = `${value}${suit}`;
      cardDiv.innerText = `${value}${suit}`;
      cardGrid.appendChild(cardDiv);
    });
  });
}

// Update the card grid based on available cards
function updateGrid(currentCards = []) {
  document.querySelectorAll('.card').forEach((card) => {
    const cardId = card.id;
    if (!availableCards.has(cardId)) {
      card.classList.add('picked');
      card.classList.remove('current');
    } else {
      card.classList.remove('picked');
    }
    card.classList.remove('current');
  });

  // Highlight current cards
  currentCards.forEach((card) => {
    const cardDiv = document.getElementById(`${card.value}${card.suit}`);
    if (cardDiv) {
      cardDiv.classList.add('current');
    }
  });
}

// Update the player list UI
function updatePlayerList() {
  const playerListDiv = document.getElementById('playerList');
  playerListDiv.innerHTML = '<h2>Players:</h2>';
  for (let playerId in players) {
    const player = players[playerId];
    const playerDiv = document.createElement('div');
    playerDiv.innerText = `${player.nickname}: ${player.score}`;
    playerListDiv.appendChild(playerDiv);
  }
}

// Socket.io event handlers

// Update players when a new player joins or someone disconnects
socket.on('updatePlayers', (updatedPlayers) => {
  players = updatedPlayers;
  updatePlayerList();
});

// Game started
socket.on('gameStarted', () => {
  // Hide lobby, show game area
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';

  initGrid();
  availableCards = new Set([...document.querySelectorAll('.card')].map((card) => card.id));
  document.getElementById('status').innerText = 'Game has started!';
  document.getElementById('playRound').style.display = 'inline';
});

// Round result
socket.on('roundResult', (data) => {
  players = data.players;
  availableCards = new Set(data.availableCards);
  updatePlayerList();

  const currentCards = Object.values(data.drawnCards);
  updateGrid(currentCards);

  let roundStatus = 'Round results:\n';
  for (let playerId in data.drawnCards) {
    const card = data.drawnCards[playerId];
    roundStatus += `${players[playerId].nickname} drew ${card.value}${card.suit}\n`;
  }

  // Display round winner(s)
  if (data.roundWinners.length === 1) {
    roundStatus += `Winner: ${players[data.roundWinners[0]].nickname}`;
  } else {
    roundStatus += `It's a tie between: ${data.roundWinners.map(id => players[id].nickname).join(', ')}`;
  }

  document.getElementById('status').innerText = roundStatus;
});

// Game over
socket.on('gameOver', (data) => {
  players = data.players;
  updatePlayerList();

  let finalMessage = `Game Over! Winner(s): ${data.winners.join(', ')}`;
  document.getElementById('status').innerText = finalMessage;
  document.getElementById('playRound').style.display = 'none';
  document.getElementById('resetGame').style.display = 'inline';
});

// Game reset
socket.on('gameReset', (updatedPlayers) => {
  // Update players with reset scores
  players = updatedPlayers;
  updatePlayerList();
  document.getElementById('lobby').style.display = 'block';
  document.getElementById('gameArea').style.display = 'none';
  document.getElementById('playRound').style.display = 'none';
  document.getElementById('resetGame').style.display = 'none';
  document.getElementById('status').innerText = 'Waiting for players...';
});

// Error handling
socket.on('errorMessage', (message) => {
  alert(message);
});
