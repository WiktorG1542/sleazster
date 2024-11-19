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
let gameState = null;

// Define hands and their rankings
const handRanks = [
  'Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A',
  'Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A',
  'Small Street', 'Big Street',
  'Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A'
];

// Define the hands for each category
const hands = {
  'Singles': ['Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A'],
  'Doubles': ['Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A'],
  'Streets': ['Small Street', 'Big Street'],
  'Triples': ['Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A']
};

// Function to start the game when two players are connected
function startGame() {
  const playerIds = Object.keys(players);
  const randomIndex = Math.floor(Math.random() * playerIds.length);
  const startingPlayerId = playerIds[randomIndex];

  gameState = {
    player1: {
      id: playerIds[0],
      nickname: players[playerIds[0]].nickname,
      cardCount: 1,
      cards: dealCards(1),
    },
    player2: {
      id: playerIds[1],
      nickname: players[playerIds[1]].nickname,
      cardCount: 1,
      cards: dealCards(1),
    },
    currentPlayer: players[startingPlayerId].nickname,
    currentHand: null,
    handRanks: handRanks,
    hands: hands,
    statusMessage: `${players[startingPlayerId].nickname}'s turn.`,
    roundEnded: false,
    revealCards: false,
    selectingHand: false,
    playersReady: {
      [players[playerIds[0]].nickname]: false,
      [players[playerIds[1]].nickname]: false
    }
  };

  // Notify players that the game has started
  io.emit('startGame', gameState);
}

// Deal a number of random cards to a player
function dealCards(count) {
  const suits = ['♠', '♣', '♦', '♥'];
  const values = ['9', '10', 'J', 'Q', 'K', 'A'];
  let cards = [];
  for (let i = 0; i < count; i++) {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    cards.push({ suit, value });
  }
  return cards;
}

// Handle client connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle player registration
  socket.on('register', (nickname) => {
    if (Object.keys(players).length < 2) {
      players[socket.id] = {
        id: socket.id,
        nickname: nickname
      };
      console.log(`Player registered: ${nickname}`);

      // Start the game when two players are connected
      if (Object.keys(players).length === 2) {
        startGame();
      }
    } else {
      socket.emit('errorMessage', 'Game is full.');
    }
  });

  // Handle player moves
  socket.on('playerMove', (data) => {
    if (!gameState || gameState.roundEnded) {
      socket.emit('errorMessage', 'Round has ended or game not started.');
      return;
    }

    const player = players[socket.id];
    if (player.nickname !== gameState.currentPlayer) {
      socket.emit('errorMessage', 'Not your turn.');
      return;
    }

    if (data.move === 'check') {
      // Handle check move
      handleCheckMove(socket);
    } else if (data.move === 'trump') {
      // Handle trump move
      if (gameState.currentHand === null) {
        if (data.selectedHand) {
          handleTrumpMove(socket, data.selectedHand);
        } else {
          gameState.selectingHand = true;
          io.to(socket.id).emit('updateGameState', gameState); // Send only to the current player
        }
      } else {
        if (data.selectedHand) {
          handleTrumpMove(socket, data.selectedHand);
        } else {
          gameState.selectingHand = true;
          io.to(socket.id).emit('updateGameState', gameState); // Send only to the current player
        }
      }
    }
  });

  // Handle proceed to next round
  socket.on('proceedNextRound', () => {
    const player = players[socket.id];
    gameState.playersReady[player.nickname] = true;
    if (Object.values(gameState.playersReady).every(ready => ready)) {
      // Reset for next round
      gameState.roundEnded = false;
      gameState.revealCards = false;
      gameState.playersReady = {
        [gameState.player1.nickname]: false,
        [gameState.player2.nickname]: false
      };
      // Deal new cards
      gameState.player1.cards = dealCards(gameState.player1.cardCount);
      gameState.player2.cards = dealCards(gameState.player2.cardCount);
      // Swap starting player
      gameState.currentPlayer = (gameState.currentPlayer === gameState.player1.nickname) ? gameState.player2.nickname : gameState.player1.nickname;
      gameState.currentHand = null;
      gameState.statusMessage = `${gameState.currentPlayer}'s turn.`;
      io.emit('updateGameState', gameState);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    // End game if a player disconnects
    io.emit('errorMessage', 'A player has disconnected. Game will reset.');
    players = {};
    gameState = null;
  });
});

function handleCheckMove(socket) {
  
  if (gameState.currentHand === null) {
    // No hand to check, send error message
    socket.emit('errorMessage', 'Cannot check before any hand is declared.');
    return;
  }

  gameState.roundEnded = true;
  gameState.revealCards = true;
  const currentHandIndex = handRanks.indexOf(gameState.currentHand);

  // Verify if the hand is possible with the combined cards
  const allCards = gameState.player1.cards.concat(gameState.player2.cards);
  const handPossible = isHandPossible(gameState.currentHand, allCards);

  if (handPossible) {
    // The hand exists, player who called check loses
    incrementCardCount(gameState.currentPlayer);
    gameState.statusMessage = `${gameState.currentPlayer} checked and the hand was there. ${gameState.currentPlayer} loses the round.`;
  } else {
    // The hand does not exist, the other player loses
    const otherPlayer = getOtherPlayer(gameState.currentPlayer);
    incrementCardCount(otherPlayer.nickname);
    gameState.statusMessage = `${gameState.currentPlayer} checked and the hand was not there. ${otherPlayer.nickname} loses the round.`;
  }

  // Check for game over
  if (gameState.player1.cardCount >= 6 || gameState.player2.cardCount >= 6) {
    const winner = gameState.player1.cardCount >= 6 ? gameState.player2.nickname : gameState.player1.nickname;
    io.emit('gameOver', { winner: winner });
    gameState = null;
  } else {
    io.emit('updateGameState', gameState);
  }
}

function handleTrumpMove(socket, selectedHand) {
  const currentHandIndex = gameState.currentHand ? handRanks.indexOf(gameState.currentHand) : -1;
  const selectedHandIndex = handRanks.indexOf(selectedHand);

  if (selectedHandIndex > currentHandIndex) {
    // Valid trump
    gameState.currentHand = selectedHand;
    gameState.statusMessage = `${gameState.currentPlayer} trumped with ${selectedHand}.`;
    // Switch turn to other player
    gameState.currentPlayer = getOtherPlayer(gameState.currentPlayer).nickname;
    gameState.selectingHand = false;
    io.emit('updateGameState', gameState);
  } else {
    // Invalid trump
    socket.emit('errorMessage', 'Selected hand does not beat the current hand.');
  }
}

function incrementCardCount(nickname) {
  if (gameState.player1.nickname === nickname) {
    gameState.player1.cardCount += 1;
  } else if (gameState.player2.nickname === nickname) {
    gameState.player2.cardCount += 1;
  }
}

function getOtherPlayer(nickname) {
  if (gameState.player1.nickname === nickname) {
    return gameState.player2;
  } else {
    return gameState.player1;
  }
}

// Function to check if a hand is possible with given cards
function isHandPossible(hand, cards) {
  const values = cards.map(card => card.value);
  const valueCounts = {};
  values.forEach(value => {
    valueCounts[value] = (valueCounts[value] || 0) + 1;
  });

  if (hand.startsWith('Single')) {
    const value = hand.split(' ')[1];
    return values.includes(value);
  } else if (hand.startsWith('Double')) {
    const value = hand.split(' ')[1];
    return valueCounts[value] >= 2;
  } else if (hand.startsWith('Triple')) {
    const value = hand.split(' ')[1];
    return valueCounts[value] >= 3;
  } else if (hand === 'Small Street') {
    return ['9', '10', 'J', 'Q', 'K'].every(val => values.includes(val));
  } else if (hand === 'Big Street') {
    return ['10', 'J', 'Q', 'K', 'A'].every(val => values.includes(val));
  }
  return false;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
