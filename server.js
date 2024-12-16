// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store all lobbies in memory
// Structure: lobbies[lobbyName] = { 
//   leaderId: socket.id,
//   players: { socketId: { id, nickname }, ... },
//   inGame: false,
//   gameState: null
// }
let lobbies = {};

// Define hands and their rankings
const handRanks = [
  // Singles
  'Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A',

  // Doubles
  'Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A',

  // 2 Pairs (new)
  '2 Pairs 9-10', '2 Pairs 9-J', '2 Pairs 9-Q', '2 Pairs 9-K', '2 Pairs 9-A',
  '2 Pairs 10-J', '2 Pairs 10-Q', '2 Pairs 10-K', '2 Pairs 10-A',
  '2 Pairs J-Q', '2 Pairs J-K', '2 Pairs J-A',
  '2 Pairs Q-K', '2 Pairs Q-A',
  '2 Pairs K-A',

  // Full House (new)
  'Full House 9', 'Full House 10', 'Full House J', 'Full House Q', 'Full House K', 'Full House A',

  // Streets
  'Small Street', 'Big Street',

  // Triples
  'Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A',

  // Quadruple (new)
  'Quadruple 9', 'Quadruple 10', 'Quadruple J', 'Quadruple Q', 'Quadruple K', 'Quadruple A'
];

// Define the hands for each category
const hands = {
  'Singles': ['Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A'],
  'Doubles': ['Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A'],
  '2 Pairs': [
    // You can list all two pair combos that you want to allow
    '2 Pairs 9-10', '2 Pairs 9-J', '2 Pairs 9-Q', '2 Pairs 9-K', '2 Pairs 9-A',
    '2 Pairs 10-J', '2 Pairs 10-Q', '2 Pairs 10-K', '2 Pairs 10-A',
    '2 Pairs J-Q', '2 Pairs J-K', '2 Pairs J-A',
    '2 Pairs Q-K', '2 Pairs Q-A',
    '2 Pairs K-A'
  ],
  'Full Houses': [
    'Full House 9', 'Full House 10', 'Full House J', 'Full House Q', 'Full House K', 'Full House A'
  ],
  'Streets': ['Small Street', 'Big Street'],
  'Triples': ['Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A'],
  'Quadruples': ['Quadruple 9', 'Quadruple 10', 'Quadruple J', 'Quadruple Q', 'Quadruple K', 'Quadruple A']
};


// =============== LOBBY-RELATED FUNCTIONS ===============
function createLobby(lobbyName, leaderId) {
  if (lobbies[lobbyName]) {
    return false; // Lobby name already exists
  }
  lobbies[lobbyName] = {
    leaderId,
    players: {},
    inGame: false,
    gameState: null
  };
  return true;
}

function joinLobby(lobbyName, socketId, nickname) {
  const lobby = lobbies[lobbyName];
  if (!lobby) return { success: false, message: 'Lobby does not exist.' };
  if (lobby.inGame) {
    return { success: false, message: 'Game has already started in this lobby.' };
  }

  lobby.players[socketId] = { id: socketId, nickname };
  return { success: true, message: 'Joined lobby successfully.' };
}

function leaveLobby(socketId) {
  for (let lobbyName in lobbies) {
    const lobby = lobbies[lobbyName];
    if (lobby.players[socketId]) {
      // The player is in this lobby
      delete lobby.players[socketId];
      // If leader leaves, pick a random new leader
      if (lobby.leaderId === socketId) {
        const playerIds = Object.keys(lobby.players);
        if (playerIds.length > 0) {
          const randomIndex = Math.floor(Math.random() * playerIds.length);
          lobby.leaderId = playerIds[randomIndex];
        } else {
          // If no one left, delete lobby
          delete lobbies[lobbyName];
          broadcastLobbies();
          return; 
        }
      }
      updateLobby(lobbyName);
      broadcastLobbies();
      return;
    }
  }
}

// Broadcast updated lobby info to everyone
function broadcastLobbies() {
  let allLobbies = [];
  for (let lobbyName in lobbies) {
    const lobby = lobbies[lobbyName];
    allLobbies.push({
      lobbyName,
      leaderId: lobby.leaderId,
      inGame: lobby.inGame,
      players: Object.values(lobby.players).map(p => ({ id: p.id, nickname: p.nickname }))
    });
  }
  io.emit('lobbyListUpdate', allLobbies);
}

// Broadcast updated lobby info to all players in a specific lobby
function updateLobby(lobbyName) {
  const lobby = lobbies[lobbyName];
  if (!lobby) return;

  const playerData = Object.values(lobby.players).map((p) => ({
    id: p.id,
    nickname: p.nickname
  }));

  io.to(lobbyName).emit('lobbyUpdate', {
    lobbyName,
    playerData,
    leaderId: lobby.leaderId,
    inGame: lobby.inGame
  });
}

// =============== GAME-RELATED FUNCTIONS ===============

// Start the game for a particular lobby
function startGame(lobbyName) {
  const lobby = lobbies[lobbyName];
  if (!lobby) return;

  const playerIds = Object.keys(lobby.players);
  if (playerIds.length < 2) {
    io.to(lobbyName).emit('errorMessage', 'Need at least 2 players to start the game.');
    return;
  }

  // Mark lobby as in-game
  lobby.inGame = true;

  // Build an array of player states
  let playersArr = [];
  for (let socketId of playerIds) {
    const pl = lobby.players[socketId];
    playersArr.push({
      id: pl.id,
      nickname: pl.nickname,
      cardCount: 1,
      cards: dealCards(1)
    });
  }

  // Randomly pick a starting player
  const randomIndex = Math.floor(Math.random() * playersArr.length);

  // Prepare playersReady object
  let playersReadyObj = {};
  playersArr.forEach((pl) => {
    playersReadyObj[pl.nickname] = false;
  });

  lobby.gameState = {
    players: playersArr,
    currentPlayerIndex: randomIndex,
    currentHand: null,
    handRanks: handRanks,
    hands: hands,
    statusMessage: `${playersArr[randomIndex].nickname}'s turn.`,
    roundEnded: false,
    revealCards: false,
    selectingHand: false,
    playersReady: playersReadyObj,
    lastRoundLoserIndex: null
  };

  io.to(lobbyName).emit('startGame', lobby.gameState);
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

// Returns the index of the next player's turn
function getNextPlayerIndex(gameState, currentIndex) {
  let nextIndex = (currentIndex + 1) % gameState.players.length;
  return nextIndex;
}

// Check if the hand is possible with given cards
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

  } else if (hand.startsWith('Quadruple')) {
    const value = hand.split(' ')[1];
    return valueCounts[value] >= 4;

  } else if (hand === 'Small Street') {
    return ['9', '10', 'J', 'Q', 'K'].every(val => values.includes(val));

  } else if (hand === 'Big Street') {
    return ['10', 'J', 'Q', 'K', 'A'].every(val => values.includes(val));

  } else if (hand.startsWith('2 Pairs')) {
    // Example: '2 Pairs 9-10'
    // We want to parse the second part to get the two distinct pairs
    // For a robust approach, handle any combos, or parse the substring.
    const splitted = hand.split(' ')[2]; // e.g. '9-10'
    const [v1, v2] = splitted.split('-');
    return (valueCounts[v1] >= 2 && valueCounts[v2] >= 2);

  } else if (hand.startsWith('Full House')) {
    // 'Full House 9' might indicate a triple of 9 + any double
    // But your naming might differ. Suppose "Full House 9" means triple 9 + double X
    const value = hand.split(' ')[2];
    if (valueCounts[value] < 3) return false;
    // Need at least one other value with count >= 2
    return Object.values(valueCounts).some(count => count >= 2 && count !== valueCounts[value]);

  }

  return false;
}


// =============== SOCKET HANDLERS ===============
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  broadcastLobbies(); // Send current lobby list to newly connected user

  // Lobby creation
  socket.on('createLobby', ({ lobbyName, nickname }) => {
    if (!lobbyName || !nickname) {
      socket.emit('errorMessage', 'Invalid lobby creation data.');
      return;
    }

    const success = createLobby(lobbyName, socket.id);
    if (!success) {
      socket.emit('errorMessage', 'Lobby name already exists.');
      return;
    }

    // Join the newly created lobby
    socket.join(lobbyName);
    const joinResult = joinLobby(lobbyName, socket.id, nickname);
    if (!joinResult.success) {
      socket.emit('errorMessage', joinResult.message);
      return;
    }

    updateLobby(lobbyName);
    broadcastLobbies();
  });

  // Lobby joining
  socket.on('joinLobby', ({ lobbyName, nickname }) => {
    if (!lobbyName || !nickname) {
      socket.emit('errorMessage', 'Invalid lobby join data.');
      return;
    }

    if (!lobbies[lobbyName]) {
      socket.emit('errorMessage', 'Lobby does not exist.');
      broadcastLobbies();
      return;
    }

    socket.join(lobbyName);
    const joinResult = joinLobby(lobbyName, socket.id, nickname);
    if (!joinResult.success) {
      socket.emit('errorMessage', joinResult.message);
      return;
    }

    updateLobby(lobbyName);
    broadcastLobbies();
  });

  // Start lobby game (only lobby leader can do this)
  socket.on('startLobbyGame', (lobbyName) => {
    const lobby = lobbies[lobbyName];
    if (!lobby) {
      socket.emit('errorMessage', 'Lobby does not exist.');
      return;
    }
    if (lobby.leaderId !== socket.id) {
      socket.emit('errorMessage', 'Only the lobby leader can start the game.');
      return;
    }

    startGame(lobbyName);
    updateLobby(lobbyName);
    broadcastLobbies();
  });

  // Exit (or leave) the lobby
  socket.on('exitLobby', () => {
    leaveLobby(socket.id);
  });

  // Handle player moves (check/trump)
  socket.on('playerMove', (data) => {
    const { lobbyName, move, selectedHand } = data;
    const lobby = lobbies[lobbyName];
    if (!lobby || !lobby.gameState) {
      socket.emit('errorMessage', 'Game not found or not started.');
      return;
    }

    const gameState = lobby.gameState;
    if (gameState.roundEnded) {
      socket.emit('errorMessage', 'Round has ended or game not started.');
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (socket.id !== currentPlayer.id) {
      socket.emit('errorMessage', 'Not your turn.');
      return;
    }

    if (move === 'check') {
      handleCheckMove(lobbyName);
    } else if (move === 'trump') {
      if (gameState.currentHand === null) {
        if (selectedHand) {
          handleTrumpMove(lobbyName, selectedHand);
        } else {
          gameState.selectingHand = true;
          io.to(socket.id).emit('updateGameState', gameState);
        }
      } else {
        if (selectedHand) {
          handleTrumpMove(lobbyName, selectedHand);
        } else {
          gameState.selectingHand = true;
          io.to(socket.id).emit('updateGameState', gameState);
        }
      }
    }
  });

  // Handle proceed to next round
  socket.on('proceedNextRound', (lobbyName) => {
    const lobby = lobbies[lobbyName];
    if (!lobby || !lobby.gameState) return;

    const gameState = lobby.gameState;
    const player = lobby.players[socket.id];
    if (!player) return;

    gameState.playersReady[player.nickname] = true;

    if (Object.values(gameState.playersReady).every(ready => ready)) {
      // Reset for next round
      gameState.roundEnded = false;
      gameState.revealCards = false;
      for (let nickname in gameState.playersReady) {
        gameState.playersReady[nickname] = false;
      }

      // Deal new cards
      gameState.players.forEach((pl) => {
        pl.cards = dealCards(pl.cardCount);
      });

      // Set the losing player as the starting player (if we had a lastRoundLoserIndex)
      if (gameState.lastRoundLoserIndex !== null) {
        gameState.currentPlayerIndex = gameState.lastRoundLoserIndex;
      }
      gameState.currentHand = null;
      const currentNickname = gameState.players[gameState.currentPlayerIndex].nickname;
      gameState.statusMessage = `${currentNickname}'s turn.`;

      io.to(lobbyName).emit('updateGameState', gameState);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    leaveLobby(socket.id);
  });
});

// =============== HELPER FUNCTIONS FOR MOVES ===============
function handleCheckMove(lobbyName) {
  const lobby = lobbies[lobbyName];
  const gameState = lobby.gameState;
  const currentIndex = gameState.currentPlayerIndex;
  const currentPlayer = gameState.players[currentIndex];

  if (gameState.currentHand === null) {
    io.to(currentPlayer.id).emit('errorMessage', 'Cannot check before any hand is declared.');
    return;
  }

  gameState.roundEnded = true;
  gameState.revealCards = true;
  const currentHandIndex = handRanks.indexOf(gameState.currentHand);

  // Combine all cards from all players
  let allCards = [];
  gameState.players.forEach(pl => {
    allCards = allCards.concat(pl.cards);
  });
  const handPossible = isHandPossible(gameState.currentHand, allCards);

  if (handPossible) {
    // The hand exists, the player who called check loses
    incrementCardCount(gameState, currentIndex);
    gameState.lastRoundLoserIndex = currentIndex;
    gameState.statusMessage = `${currentPlayer.nickname} checked and the hand was there. ${currentPlayer.nickname} loses the round.`;
  } else {
    // The hand does not exist, the previous player in turn order is the 'loser'
    let previousIndex = (currentIndex - 1 + gameState.players.length) % gameState.players.length;
    incrementCardCount(gameState, previousIndex);
    gameState.lastRoundLoserIndex = previousIndex;
    let loserNickname = gameState.players[previousIndex].nickname;
    gameState.statusMessage = `${currentPlayer.nickname} checked and the hand was not there. ${loserNickname} loses the round.`;
  }

  // Check for game over
  let losers = gameState.players.filter(pl => pl.cardCount >= 6);
  if (losers.length > 0) {
    // If multiple players remain, pick the one(s) with fewer than 6 cards as winners
    let potentialWinners = gameState.players.filter(pl => pl.cardCount < 6);
    if (potentialWinners.length === 0) {
      io.to(lobbyName).emit('gameOver', { winner: 'No winners (tie or all busted)' });
    } else {
      potentialWinners.sort((a, b) => a.cardCount - b.cardCount);
      const winner = potentialWinners[0].nickname;
      io.to(lobbyName).emit('gameOver', { winner });
    }
    lobby.gameState = null;
    lobby.inGame = false;
    updateLobby(lobbyName);
    broadcastLobbies();
  } else {
    io.to(lobbyName).emit('updateGameState', gameState);
  }
}

function handleTrumpMove(lobbyName, selectedHand) {
  const lobby = lobbies[lobbyName];
  const gameState = lobby.gameState;
  const currentIndex = gameState.currentPlayerIndex;

  const currentHandIndex = gameState.currentHand ? handRanks.indexOf(gameState.currentHand) : -1;
  const selectedHandIndex = handRanks.indexOf(selectedHand);

  if (selectedHandIndex > currentHandIndex) {
    // Valid trump
    gameState.currentHand = selectedHand;
    const currentPlayer = gameState.players[currentIndex];
    gameState.statusMessage = `${currentPlayer.nickname} trumped with ${selectedHand}.`;
    gameState.selectingHand = false;

    // Switch turn to next player
    gameState.currentPlayerIndex = getNextPlayerIndex(gameState, currentIndex);
    io.to(lobbyName).emit('updateGameState', gameState);
  } else {
    // Invalid trump
    io.to(gameState.players[currentIndex].id).emit('errorMessage', 'Selected hand does not beat the current hand.');
  }
}

function incrementCardCount(gameState, playerIndex) {
  gameState.players[playerIndex].cardCount += 1;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
