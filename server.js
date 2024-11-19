// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const PORT = 3000;

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = {};
let deck = [];
let availableCards = new Set();
let gameInProgress = false;

// Function to create and shuffle a new deck
function createDeck() {
  const suits = ['♠', '♣', '♦', '♥'];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  let newDeck = [];
  for (let suit of suits) {
    for (let value of values) {
      newDeck.push({ suit, value });
    }
  }
  return newDeck.sort(() => Math.random() - 0.5);
}

// Handle client connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle player registration
  socket.on('register', (nickname) => {
    players[socket.id] = {
      nickname,
      score: 0,
    };
    console.log(`Player registered: ${nickname}`);

    // Update all clients with the current players
    io.emit('updatePlayers', players);
  });

  // Handle 'startGame' event
  socket.on('startGame', () => {
    if (Object.keys(players).length < 2) {
      socket.emit('errorMessage', 'Need at least 2 players to start the game.');
      return;
    }
    if (!gameInProgress) {
      startGame();
    }
  });

  // Handle 'playRound' event from clients
  socket.on('playRound', () => {
    if (gameInProgress) {
      playRound();
    }
  });

  // Handle 'resetGame' event
  socket.on('resetGame', () => {
    // Remove the check for gameInProgress
    resetGame();
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('updatePlayers', players);

    // If game is in progress and players are less than 2, end the game
    if (gameInProgress && Object.keys(players).length < 2) {
      endGameDueToDisconnect();
    }
  });
});

function startGame() {
  gameInProgress = true;
  deck = createDeck();
  availableCards = new Set(deck.map((card) => `${card.value}${card.suit}`));
  io.emit('gameStarted');
}

function playRound() {
  if (deck.length < Object.keys(players).length) {
    endGame();
    return;
  }

  let drawnCards = {};
  for (let playerId in players) {
    const card = deck.pop();
    availableCards.delete(`${card.value}${card.suit}`);
    drawnCards[playerId] = card;
  }

  // Determine the winner of the round
  let highestValue = -1;
  let roundWinners = [];
  for (let playerId in drawnCards) {
    let value = getNumericValue(drawnCards[playerId].value);
    if (value > highestValue) {
      highestValue = value;
      roundWinners = [playerId];
    } else if (value === highestValue) {
      roundWinners.push(playerId);
    }
  }

  // Update scores
  roundWinners.forEach((playerId) => {
    players[playerId].score += 1;
  });

  // Send round results to all clients
  io.emit('roundResult', {
    drawnCards,
    players,
    availableCards: Array.from(availableCards),
    roundWinners,
  });

  if (deck.length < Object.keys(players).length) {
    endGame();
  }
}

function endGame() {
  gameInProgress = false;

  // Determine the overall winner(s)
  let highestScore = -1;
  let winners = [];
  for (let playerId in players) {
    let score = players[playerId].score;
    if (score > highestScore) {
      highestScore = score;
      winners = [players[playerId].nickname];
    } else if (score === highestScore) {
      winners.push(players[playerId].nickname);
    }
  }

  io.emit('gameOver', {
    winners,
    players,
  });
}

function endGameDueToDisconnect() {
  gameInProgress = false;
  io.emit('errorMessage', 'Game ended due to insufficient players.');
  resetGame();
}

function resetGame() {
  // Reset player scores
  for (let playerId in players) {
    players[playerId].score = 0;
  }
  deck = [];
  availableCards = new Set();
  gameInProgress = false;
  // Send updated players to clients
  io.emit('gameReset', players);
}

function getNumericValue(value) {
  if (value === 'J') return 11;
  if (value === 'Q') return 12;
  if (value === 'K') return 13;
  if (value === 'A') return 14;
  return parseInt(value);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
