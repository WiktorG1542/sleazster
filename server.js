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

// Serve the different pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/how-to-play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'howtoplay.html'));
});
app.get('/lobbies', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lobbies.html'));
});

// Store all lobbies in memory
// Structure: 
// lobbies[lobbyName] = { 
//   leaderId: socket.id,
//   players: { 
//       socketId: { id, nickname, score }, ... 
//   },
//   inGame: false,
//   gameState: null
// }
let lobbies = {};

const handRanks = [
  'Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A',
  'Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A',
  '2 Pairs 9-10', '2 Pairs 9-J', '2 Pairs 9-Q', '2 Pairs 9-K', '2 Pairs 9-A',
  '2 Pairs 10-J', '2 Pairs 10-Q', '2 Pairs 10-K', '2 Pairs 10-A',
  '2 Pairs J-Q', '2 Pairs J-K', '2 Pairs J-A',
  '2 Pairs Q-K', '2 Pairs Q-A',
  '2 Pairs K-A',
  'Full House 9', 'Full House 10', 'Full House J', 'Full House Q', 'Full House K', 'Full House A',
  'Small Street', 'Big Street',
  'Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A',
  'Quadruple 9', 'Quadruple 10', 'Quadruple J', 'Quadruple Q', 'Quadruple K', 'Quadruple A'
];

const hands = {
  'Singles': ['Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A'],
  'Doubles': ['Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A'],
  '2 Pairs': [
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

  // If player already exists, do not overwrite score. Otherwise, set score=0.
  if (!lobby.players[socketId]) {
    lobby.players[socketId] = { id: socketId, nickname, score: 0 };
  } else {
    // Update nickname if changed, keep score
    lobby.players[socketId].nickname = nickname;
  }

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
      
      // Also remove socket from that lobby room
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        s.leave(lobbyName);
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
    const leaderNickname = lobby.players[lobby.leaderId]?.nickname || 'Unknown';

    allLobbies.push({
      lobbyName,
      leaderNickname,
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
      cards: dealCards(1),
      score: pl.score // Keep their existing score (0 at start)
    });
  }

  // Randomly pick a starting player
  const randomIndex = Math.floor(Math.random() * playersArr.length);

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

// After a game ends, start a new game with the same set of players, keep their scores.
function restartGame(lobbyName) {
  const lobby = lobbies[lobbyName];
  if (!lobby) return;

  const playerIds = Object.keys(lobby.players);
  if (playerIds.length < 2) {
    // If less than 2 players remain, can't restart the game
    lobby.inGame = false;
    lobby.gameState = null;
    updateLobby(lobbyName);
    broadcastLobbies();
    return;
  }

  lobby.inGame = true;

  let playersArr = [];
  for (let socketId of playerIds) {
    const pl = lobby.players[socketId];
    playersArr.push({
      id: pl.id,
      nickname: pl.nickname,
      cardCount: 1,
      cards: dealCards(1),
      score: pl.score // Keep updated score
    });
  }

  // Random start player
  const randomIndex = Math.floor(Math.random() * playersArr.length);

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

  io.to(lobbyName).emit('updateGameState', lobby.gameState);
}

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

function getNextPlayerIndex(gameState, currentIndex) {
  let nextIndex = (currentIndex + 1) % gameState.players.length;
  return nextIndex;
}

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
    const splitted = hand.split(' ')[2]; 
    const [v1, v2] = splitted.split('-');
    return (valueCounts[v1] >= 2 && valueCounts[v2] >= 2);

  } else if (hand.startsWith('Full House')) {
    const value = hand.split(' ')[2];
    if (valueCounts[value] < 3) return false;
    // Need at least one other value >= 2
    return Object.entries(valueCounts).some(([val, count]) => val !== value && count >= 2);
  }

  return false;
}

// =============== SOCKET HANDLERS ===============
io.on('connection', (socket) => {
  broadcastLobbies(); // Send current lobby list to newly connected user
  console.log(`Player connected: ${socket.id}`);

  // Before joining a new lobby, leave any old lobby (if present)
  function leaveAllLobbiesForSocket() {
    for (let lobbyName in lobbies) {
      if (lobbies[lobbyName].players[socket.id]) {
        leaveLobby(socket.id);
      }
    }
  }

  socket.on('createLobby', ({ lobbyName, nickname }) => {
    if (!lobbyName || !nickname) {
      socket.emit('errorMessage', 'Invalid lobby creation data.');
      return;
    }

    leaveAllLobbiesForSocket(); // Ensure clean state

    const success = createLobby(lobbyName, socket.id);
    if (!success) {
      socket.emit('errorMessage', 'Lobby name already exists.');
      return;
    }

    const joinResult = joinLobby(lobbyName, socket.id, nickname);
    if (!joinResult.success) {
      socket.emit('errorMessage', joinResult.message);
      return;
    }

    socket.join(lobbyName);
    updateLobby(lobbyName);
    broadcastLobbies();
  });

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

    leaveAllLobbiesForSocket(); // Ensure clean state

    const joinResult = joinLobby(lobbyName, socket.id, nickname);
    if (!joinResult.success) {
      socket.emit('errorMessage', joinResult.message);
      return;
    }
    socket.join(lobbyName);
    updateLobby(lobbyName);
    broadcastLobbies();
  });

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

  socket.on('exitLobby', () => {
    leaveLobby(socket.id);
  });

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
      if (selectedHand) {
        handleTrumpMove(lobbyName, selectedHand);
      } else {
        gameState.selectingHand = true;
        io.to(socket.id).emit('updateGameState', gameState);
      }
    }
  });

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

      // Deal new cards for remaining players
      gameState.players.forEach((pl) => {
        pl.cards = dealCards(pl.cardCount);
      });

      // If we have a loser from last round, start from them
      if (gameState.lastRoundLoserIndex !== null) {
        if (gameState.lastRoundLoserIndex >= gameState.players.length) {
          // If the loser index is out of range due to removals, wrap it
          gameState.lastRoundLoserIndex = 0;
        }
        gameState.currentPlayerIndex = gameState.lastRoundLoserIndex;
      }
      gameState.currentHand = null;
      const currentNickname = gameState.players[gameState.currentPlayerIndex].nickname;
      gameState.statusMessage = `${currentNickname}'s turn.`;

      io.to(lobbyName).emit('updateGameState', gameState);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    leaveLobby(socket.id);
  });
});

// =============== HELPER FUNCTIONS FOR MOVES & GAME LOGIC ===============
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

  // Combine all cards
  let allCards = [];
  gameState.players.forEach(pl => {
    allCards = allCards.concat(pl.cards);
  });
  const handPossible = isHandPossible(gameState.currentHand, allCards);

  let loserIndex;
  if (handPossible) {
    // The checking player loses
    incrementCardCount(gameState, currentIndex);
    loserIndex = currentIndex;
    gameState.statusMessage = `${currentPlayer.nickname} checked and the hand was there. ${currentPlayer.nickname} loses the round.`;
  } else {
    // The previous player loses
    let previousIndex = (currentIndex - 1 + gameState.players.length) % gameState.players.length;
    incrementCardCount(gameState, previousIndex);
    loserIndex = previousIndex;
    let loserNickname = gameState.players[previousIndex].nickname;
    gameState.statusMessage = `${currentPlayer.nickname} checked and the hand was not there. ${loserNickname} loses the round.`;
  }

  gameState.lastRoundLoserIndex = loserIndex;

  // Remove any players who have 6 or more cards (they are out)
  gameState.players = gameState.players.filter(pl => pl.cardCount < 6);

  // Check how many players remain
  if (gameState.players.length === 1) {
    // One player remains -> they are the winner
    const winner = gameState.players[0];
    // Increment their score in lobby
    const lobby = lobbies[lobbyName];
    lobby.players[winner.id].score += 1;
    // Restart the game with the same players, same scores
    restartGame(lobbyName);
  } else if (gameState.players.length === 0) {
    // No players left? Strange scenario, but could happen if all lost simultaneously.
    // No winner scenario: just restart?
    const lobby = lobbies[lobbyName];
    // Just pick no winner scenario. Or end game with no winner.
    // We'll just restart a new game. Nobody gets score.
    restartGame(lobbyName);
  } else {
    // Multiple players remain, continue the game after they click proceed.
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
