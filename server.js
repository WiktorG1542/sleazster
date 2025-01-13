/************************************
 * server.js - OBLECH with login & sessions
 ************************************/
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// ============= SESSIONS SETUP =============
app.use(session({
  secret: 'mySecretKeyForOBLECH',
  resave: false,
  saveUninitialized: false
}));

// ============= EJS & STATIC SETUP =============
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ============= IN-MEMORY STORAGE =============
// Instead of a DB, we keep simple structures in memory.
// For real production, you'd replace these with a database.

let users = {};   
/* 
Structure: 
users[email] = { 
  email, 
  nickname 
}
*/

let lobbies = {}; 
/* 
Structure: 
lobbies[lobbyId] = {
  lobbyId,
  leaderEmail,       // who created/owns the lobby
  players: { 
    [email]: { email, nickname, score, cardCount, cards }
  },
  inGame: false,
  gameState: null
}
*/

// ============= HAND & GAME LOGIC =============
const handRanks = [
  'Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A',
  'Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A',
  '2 Pairs 9-10', '2 Pairs 9-J', '2 Pairs 9-Q', '2 Pairs 9-K', '2 Pairs 9-A',
  '2 Pairs 10-J', '2 Pairs 10-Q', '2 Pairs 10-K', '2 Pairs 10-A',
  '2 Pairs J-Q', '2 Pairs J-K', '2 Pairs J-A',
  '2 Pairs Q-K', '2 Pairs Q-A', '2 Pairs K-A',
  'Full House 9', 'Full House 10', 'Full House J', 'Full House Q', 'Full House K', 'Full House A',
  'Small Street', 'Big Street',
  'Triple 9', 'Triple 10', 'Triple J', 'Triple Q', 'Triple K', 'Triple A',
  'Quadruple 9', 'Quadruple 10', 'Quadruple J', 'Quadruple Q', 'Quadruple K', 'Quadruple A'
];

const handsMap = {
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

function getNextPlayerIndex(gameState, currentIndex) {
  return (currentIndex + 1) % gameState.players.length;
}

function incrementCardCount(gameState, playerIndex) {
  gameState.players[playerIndex].cardCount += 1;
}

function generateRandomLobbyId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++){
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ============= AUTH MIDDLEWARE =============
function requireLogin(req, res, next) {
  if (!req.session.userEmail) {
    return res.redirect('/login');
  }
  next();
}

app.use((req, res, next) => {
  if (req.session.userEmail) {
    res.locals.userEmail = req.session.userEmail;
    res.locals.nickname = req.session.nickname;
  }
  next();
});

// ============= EXPRESS ROUTES (LOGIN & PAGES) =============

// GET login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// POST login
app.post('/login', (req, res) => {
  const { email, nickname } = req.body;
  if (!email || !nickname) {
    return res.render('login', { error: 'Please provide email and nickname.' });
  }
  // Check if user already exists with that email
  if (users[email] && users[email].nickname !== nickname) {
    return res.render('login', { error: 'This email is taken with a different nickname.' });
  }
  // If user does not exist, create it
  if (!users[email]) {
    users[email] = { email, nickname };
  }
  // Store in session
  req.session.userEmail = email;
  req.session.nickname = nickname;
  // Redirect to main
  res.redirect('/');
});

// Log out
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Index - requires login
app.get('/', requireLogin, (req, res) => {
  res.render('index', { nickname: req.session.nickname });
});

// How to Play - also requires login
app.get('/how-to-play', requireLogin, (req, res) => {
  res.render('howToPlay');
});

// Lobbies
app.get('/lobbies', requireLogin, (req, res) => {
  // user is guaranteed to be logged in
  res.render('lobbies', { lobbies, userEmail: req.session.userEmail });
});

// WAITING ROOM
app.get('/lobbies/:lobbyId/waiting', requireLogin, (req, res) => {
  const { lobbyId } = req.params;
  const lobby = lobbies[lobbyId];
  if (!lobby) {
    return res.send(`Lobby with ID ${lobbyId} does not exist.`);
  }
  if (lobby.inGame) {
    return res.redirect(`/lobbies/${lobbyId}/playing`);
  }
  res.render('waitingRoom', { lobby });
});

// PLAYING
app.get('/lobbies/:lobbyId/playing', requireLogin, (req, res) => {
  const { lobbyId } = req.params;
  const lobby = lobbies[lobbyId];
  if (!lobby) {
    return res.send(`Lobby with ID ${lobbyId} does not exist.`);
  }
  if (!lobby.inGame) {
    return res.redirect(`/lobbies/${lobbyId}/waiting`);
  }

  const gameState = lobby.gameState;
  res.render('playing', {
    lobby,
    gameState,
    userEmail: req.session.userEmail
  });
});

// ============= SINGLE-ENDPOINT GAME LOGIC =============
app.post('/api/game', requireLogin, (req, res) => {
  // Because we used requireLogin, we know req.session.userEmail is set
  const userEmail = req.session.userEmail;
  const userNickname = req.session.nickname;
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'No action specified.' });
  }

  switch(action) {

    // Create Lobby
    case 'createLobby': {
      // The userEmail is the leader
      const newLobbyId = generateRandomLobbyId();
      lobbies[newLobbyId] = {
        lobbyId: newLobbyId,
        leaderEmail: userEmail,
        players: {
          [userEmail]: {
            email: userEmail,
            nickname: userNickname,
            score: 0,
            cardCount: 0,
            cards: []
          }
        },
        inGame: false,
        gameState: null
      };
      // Notify everyone
      io.emit('lobbyListUpdate', getAllLobbiesData());
      return res.json({ success: true, lobbyId: newLobbyId });
    }

    // Join Lobby
    case 'joinLobby': {
      const { lobbyId } = req.body;
      if (!lobbies[lobbyId]) {
        return res.status(404).json({ error: 'Lobby does not exist.' });
      }
      let lobby = lobbies[lobbyId];
      if (lobby.inGame) {
        return res.status(400).json({ error: 'Game already started.' });
      }
      // Add user if not in already
      if (!lobby.players[userEmail]) {
        lobby.players[userEmail] = {
          email: userEmail,
          nickname: userNickname,
          score: 0,
          cardCount: 0,
          cards: []
        };
      }
      io.emit('lobbyListUpdate', getAllLobbiesData());
      io.to(lobbyId).emit('lobbyUpdated', getLobbyData(lobbyId));
      return res.json({ success: true, lobbyId });
    }

    // Start Game
    case 'startGame': {
      const { lobbyId } = req.body;
      const lobby = lobbies[lobbyId];
      if (!lobby) return res.status(404).json({ error: 'Lobby not found.' });
      if (lobby.leaderEmail !== userEmail) {
        return res.status(403).json({ error: 'Only the lobby leader can start the game.' });
      }
      const playerEmails = Object.keys(lobby.players);
      if (playerEmails.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 players.' });
      }

      lobby.inGame = true;
      let playersArr = playerEmails.map(em => {
        const p = lobby.players[em];
        return {
          email: p.email,
          nickname: p.nickname,
          cardCount: 1,
          cards: dealCards(1),
          score: p.score
        };
      });
      const randomIndex = Math.floor(Math.random() * playersArr.length);

      let playersReadyObj = {};
      playersArr.forEach(pl => {
        playersReadyObj[pl.email] = false;
      });

      lobby.gameState = {
        players: playersArr,
        currentPlayerIndex: randomIndex,
        currentHand: null,
        handRanks,
        handsMap,
        statusMessage: `${playersArr[randomIndex].nickname}'s turn.`,
        roundEnded: false,
        revealCards: false,
        selectingHand: false,
        playersReady: playersReadyObj,
        lastRoundLoserIndex: null
      };

      // Update lobby's player card states
      playersArr.forEach(pl => {
        lobby.players[pl.email].cardCount = pl.cardCount;
        lobby.players[pl.email].cards = pl.cards;
      });

      io.emit('lobbyListUpdate', getAllLobbiesData());
      io.to(lobbyId).emit('lobbyStarted', { lobbyId });
      return res.json({ success: true, lobbyId });
    }

    // Make Move
    case 'makeMove': {
      const { lobbyId, move, selectedHand } = req.body;
      const lobby = lobbies[lobbyId];
      if (!lobby || !lobby.gameState) {
        return res.status(404).json({ error: 'Game not found or not started.' });
      }
      let gs = lobby.gameState;
      if (gs.roundEnded) {
        return res.status(400).json({ error: 'Round ended, wait for next round.' });
      }

      // Identify the current player
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      if (currentPlayer.email !== userEmail) {
        return res.status(403).json({ error: 'Not your turn.' });
      }

      if (move === 'check') {
        try {
          handleCheckMove(lobby);
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      } else if (move === 'trump') {
        if (selectedHand) {
          handleTrumpMove(lobby, selectedHand);
        } else {
          gs.selectingHand = true;
        }
      }

      updateLobbyPlayersFromGameState(lobby);
      io.to(lobbyId).emit('gameStateUpdate', { lobbyId, gameState: lobby.gameState });
      return res.json({ success: true, statusMessage: gs.statusMessage });
    }

    // Proceed Next Round
    case 'proceedNextRound': {
      const { lobbyId } = req.body;
      const lobby = lobbies[lobbyId];
      if (!lobby || !lobby.gameState) {
        return res.status(404).json({ error: 'Game not found or not started.' });
      }
      let gs = lobby.gameState;

      // Mark the user as ready
      if (gs.playersReady[userEmail] === undefined) {
        return res.status(400).json({ error: 'User not found in this game.' });
      }
      gs.playersReady[userEmail] = true;

      // Check if all are ready
      const allReady = Object.values(gs.playersReady).every(v => v === true);
      if (allReady) {
        gs.roundEnded = false;
        gs.revealCards = false;
        for (let em in gs.playersReady) {
          gs.playersReady[em] = false;
        }
        gs.players.forEach(pl => {
          pl.cards = dealCards(pl.cardCount);
        });
        if (gs.lastRoundLoserIndex !== null) {
          if (gs.lastRoundLoserIndex >= gs.players.length) {
            gs.lastRoundLoserIndex = 0;
          }
          gs.currentPlayerIndex = gs.lastRoundLoserIndex;
        }
        gs.currentHand = null;
        const currentNickname = gs.players[gs.currentPlayerIndex].nickname;
        gs.statusMessage = `${currentNickname}'s turn.`;
      }

      updateLobbyPlayersFromGameState(lobby);
      io.to(lobbyId).emit('gameStateUpdate', { lobbyId, gameState: lobby.gameState });
      return res.json({ success: true });
    }

    // Exit Lobby
    case 'exitLobby': {
      const { lobbyId } = req.body;
      const lobby = lobbies[lobbyId];
      if (!lobby) {
        return res.json({ success: true, message: 'Lobby does not exist or removed.' });
      }
      if (lobby.players[userEmail]) {
        delete lobby.players[userEmail];
      }
      if (lobby.leaderEmail === userEmail) {
        const remaining = Object.keys(lobby.players);
        if (remaining.length > 0) {
          lobby.leaderEmail = remaining[0];  // pick a random or first
        } else {
          // remove entire lobby
          delete lobbies[lobbyId];
          io.emit('lobbyListUpdate', getAllLobbiesData());
          return res.json({ success: true, message: 'Lobby removed, no players left.' });
        }
      }
      io.emit('lobbyListUpdate', getAllLobbiesData());
      io.to(lobbyId).emit('lobbyUpdated', getLobbyData(lobbyId));
      return res.json({ success: true });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

/************************************
 * SOCKET.IO HANDLERS
 ************************************/
io.on('connection', (socket) => {
  // user can join a "lobbyList" room or "lobbyId" room
  socket.on('joinLobbyList', () => {
    socket.join('lobbyList');
    socket.emit('lobbyListUpdate', getAllLobbiesData());
  });
  socket.on('leaveLobbyList', () => {
    socket.leave('lobbyList');
  });

  socket.on('joinLobbyRoom', (lobbyId) => {
    socket.join(lobbyId);
    socket.emit('lobbyUpdated', getLobbyData(lobbyId));
    // If in game, also send state
    const lb = lobbies[lobbyId];
    if (lb && lb.inGame && lb.gameState) {
      socket.emit('gameStateUpdate', { lobbyId, gameState: lb.gameState });
    }
  });
  socket.on('leaveLobbyRoom', (lobbyId) => {
    socket.leave(lobbyId);
  });
});

// ============= GAME LOGIC HELPER FUNCTIONS =============
function handleCheckMove(lobby) {
  let gs = lobby.gameState;
  const currentIndex = gs.currentPlayerIndex;
  const currentPlayer = gs.players[currentIndex];

  if (gs.currentHand === null) {
    // gs.statusMessage = 'Cannot check before any hand is declared.';
    // return;
    // Instead of setting statusMessage, just return an error
    throw new Error('No hand has been declared yet. You cannot check now.');
  }

  gs.roundEnded = true;
  gs.revealCards = true;

  const handPossible = isHandPossible(gs.currentHand, gs.players.flatMap(pl => pl.cards));

  let loserIndex;
  if (handPossible) {
    incrementCardCount(gs, currentIndex);
    loserIndex = currentIndex;
    gs.statusMessage = `${currentPlayer.nickname} checked. The hand was present! ${currentPlayer.nickname} loses.`;
  } else {
    let prevIndex = (currentIndex - 1 + gs.players.length) % gs.players.length;
    incrementCardCount(gs, prevIndex);
    loserIndex = prevIndex;
    gs.statusMessage = `${currentPlayer.nickname} checked. The hand was NOT there. ${gs.players[prevIndex].nickname} loses.`;
  }

  gs.lastRoundLoserIndex = loserIndex;
  // Remove players with 6+ cards
  gs.players = gs.players.filter(pl => pl.cardCount < 6);

  // If only one left, they get +1 score
  if (gs.players.length === 1) {
    const winner = gs.players[0];
    lobby.players[winner.email].score += 1;
    restartGame(lobby);
  } else if (gs.players.length === 0) {
    restartGame(lobby);
  }
}

function handleTrumpMove(lobby, selectedHand) {
  let gs = lobby.gameState;
  const currentIndex = gs.currentPlayerIndex;
  const currentHandIndex = gs.currentHand ? handRanks.indexOf(gs.currentHand) : -1;
  const selectedHandIndex = handRanks.indexOf(selectedHand);

  if (selectedHandIndex > currentHandIndex) {
    gs.currentHand = selectedHand;
    const currentPlayer = gs.players[currentIndex];
    gs.selectingHand = false;
    const nextIndex = getNextPlayerIndex(gs, currentIndex);
    const nextPlayer = gs.players[nextIndex];
    gs.currentPlayerIndex = nextIndex;
    gs.statusMessage = `${currentPlayer.nickname} trumped with ${selectedHand}. Now it's ${nextPlayer.nickname}'s turn.`;
  } else {
    gs.statusMessage = `Selected hand (${selectedHand}) does not beat the current hand (${gs.currentHand || 'none'}).`;
  }
}

function restartGame(lobby) {
  const playerEmails = Object.keys(lobby.players);
  if (playerEmails.length < 2) {
    lobby.inGame = false;
    lobby.gameState = null;
    return;
  }
  lobby.inGame = true;

  let playersArr = playerEmails.map(em => {
    const pData = lobby.players[em];
    return {
      email: pData.email,
      nickname: pData.nickname,
      cardCount: 1,
      cards: dealCards(1),
      score: pData.score
    };
  });

  const randomIndex = Math.floor(Math.random() * playersArr.length);
  let playersReadyObj = {};
  playersArr.forEach(pl => {
    playersReadyObj[pl.email] = false;
  });

  lobby.gameState = {
    players: playersArr,
    currentPlayerIndex: randomIndex,
    currentHand: null,
    handRanks,
    handsMap,
    statusMessage: `${playersArr[randomIndex].nickname}'s turn.`,
    roundEnded: false,
    revealCards: false,
    selectingHand: false,
    playersReady: playersReadyObj,
    lastRoundLoserIndex: null
  };

  updateLobbyPlayersFromGameState(lobby);
}

function updateLobbyPlayersFromGameState(lobby) {
  let gs = lobby.gameState;
  if (!gs) return;
  gs.players.forEach(pl => {
    lobby.players[pl.email].cardCount = pl.cardCount;
    lobby.players[pl.email].cards = pl.cards;
    lobby.players[pl.email].score = pl.score;
  });
}

// ============= BROADCAST / DATA HELPER FUNCTIONS =============
function getAllLobbiesData() {
  let arr = [];
  for (let lId in lobbies) {
    const lb = lobbies[lId];
    arr.push({
      lobbyId: lb.lobbyId,
      leaderNickname: lb.players[lb.leaderEmail]?.nickname || 'unknown',
      leaderEmail: lb.leaderEmail,
      inGame: lb.inGame,
      players: Object.values(lb.players).map(p => ({
        email: p.email,
        nickname: p.nickname
      }))
    });
  }
  return arr;
}

function getLobbyData(lobbyId) {
  const lb = lobbies[lobbyId];
  if (!lb) return null;
  return {
    lobbyId: lb.lobbyId,
    leaderEmail: lb.leaderEmail,
    players: lb.players,
    inGame: lb.inGame
  };
}

// ============= START SERVER =============
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
