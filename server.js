/************************************
 * server.js - OBLECH with MongoDB, Bots, Wins, Leaderboard
 ************************************/
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const MONGO_URI = 'mongodb://localhost:27018/oblech'; // Adjust if needed

// ============= MONGOOSE SETUP =============
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("Connected to MongoDB at", MONGO_URI);

  // Reset all 'logged_in' statuses to false on server start:
  await User.updateMany({}, { $set: { logged_in: false } });
  console.log("All users' logged_in status reset to false.");

}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// Define our User schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  nickname: String,
  wins: Number,
  logged_in: Boolean
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

// ============= SESSIONS =============
app.use(session({
  secret: 'mySecretKeyForOBLECH',
  resave: false,
  saveUninitialized: false
}));

// ============= EJS & STATIC =============
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ============= GLOBAL MIDDLEWARE FOR EJS LOCALS =============
app.use((req, res, next) => {
  if (req.session.userEmail) {
    res.locals.userEmail = req.session.userEmail;
    res.locals.nickname = req.session.nickname;
  }
  next();
});

// ============= LOBBIES, BOTS, GAME STATE =============
let lobbies = {}; 
/*
lobbies[lobbyId] = {
  lobbyId,
  leaderEmail,
  players: {
    [email or 'bot:bot1']: {
      email,        // for real users
      nickname,
      score,
      cardCount,
      cards
    }
  },
  inGame: false,
  gameState: {...},
  botCount: 0  // track how many bots in the lobby
}
*/

// ============= HAND & GAME LOGIC =============
const handRanks = [
  'Single 9','Single 10','Single J','Single Q','Single K','Single A',
  'Double 9','Double 10','Double J','Double Q','Double K','Double A',
  '2 Pairs 9-10','2 Pairs 9-J','2 Pairs 9-Q','2 Pairs 9-K','2 Pairs 9-A',
  '2 Pairs 10-J','2 Pairs 10-Q','2 Pairs 10-K','2 Pairs 10-A',
  '2 Pairs J-Q','2 Pairs J-K','2 Pairs J-A',
  '2 Pairs Q-K','2 Pairs Q-A','2 Pairs K-A',
  'Full House 9','Full House 10','Full House J','Full House Q','Full House K','Full House A',
  'Small Street','Big Street',
  'Triple 9','Triple 10','Triple J','Triple Q','Triple K','Triple A',
  'Quadruple 9','Quadruple 10','Quadruple J','Quadruple Q','Quadruple K','Quadruple A'
];

const handsMap = {
  'Singles': ['Single 9', 'Single 10', 'Single J', 'Single Q', 'Single K', 'Single A'],
  'Doubles': ['Double 9', 'Double 10', 'Double J', 'Double Q', 'Double K', 'Double A'],
  '2 Pairs': [
    '2 Pairs 9-10','2 Pairs 9-J','2 Pairs 9-Q','2 Pairs 9-K','2 Pairs 9-A',
    '2 Pairs 10-J','2 Pairs 10-Q','2 Pairs 10-K','2 Pairs 10-A',
    '2 Pairs J-Q','2 Pairs J-K','2 Pairs J-A',
    '2 Pairs Q-K','2 Pairs Q-A',
    '2 Pairs K-A'
  ],
  'Full Houses': [
    'Full House 9','Full House 10','Full House J','Full House Q','Full House K','Full House A'
  ],
  'Streets': ['Small Street', 'Big Street'],
  'Triples': ['Triple 9','Triple 10','Triple J','Triple Q','Triple K','Triple A'],
  'Quadruples': ['Quadruple 9','Quadruple 10','Quadruple J','Quadruple Q','Quadruple K','Quadruple A']
};

function dealCards(count) {
  const suits = ['♠','♣','♦','♥'];
  const values = ['9','10','J','Q','K','A'];
  let cards = [];
  for (let i=0; i<count; i++){
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    cards.push({ suit, value });
  }
  return cards;
}

function isHandPossible(hand, cards) {
  const values = cards.map(c => c.value);
  const valueCounts = {};
  values.forEach(v => {
    valueCounts[v] = (valueCounts[v]||0)+1;
  });
  if (hand.startsWith('Single')) {
    const val = hand.split(' ')[1];
    return values.includes(val);
  } else if (hand.startsWith('Double')) {
    const val = hand.split(' ')[1];
    return valueCounts[val]>=2;
  } else if (hand.startsWith('Triple')) {
    const val = hand.split(' ')[1];
    return valueCounts[val]>=3;
  } else if (hand.startsWith('Quadruple')) {
    const val = hand.split(' ')[1];
    return valueCounts[val]>=4;
  } else if (hand==='Small Street') {
    return ['9','10','J','Q','K'].every(x=>values.includes(x));
  } else if (hand==='Big Street') {
    return ['10','J','Q','K','A'].every(x=>values.includes(x));
  } else if (hand.startsWith('2 Pairs')) {
    const splitted = hand.split(' ')[2];
    const [v1,v2] = splitted.split('-');
    return (valueCounts[v1]>=2 && valueCounts[v2]>=2);
  } else if (hand.startsWith('Full House')) {
    const val = hand.split(' ')[2];
    if (!valueCounts[val] || valueCounts[val]<3) return false;
    // Need another val >=2
    return Object.entries(valueCounts).some(([k,ct]) => k!==val && ct>=2);
  }
  return false;
}

function getNextPlayerIndex(gs, i){
  return (i+1)%gs.players.length;
}

function incrementCardCount(gs, i){
  gs.players[i].cardCount++;
}

// ============= AUTH & MIDDLEWARE =============
async function requireLogin(req, res, next) {
  if (!req.session.userEmail) {
    return res.redirect('/login');
  }
  next();
}

// ============= BOT LOGIC =============
function isBot(playerEmail) {
  // We store bots internally as "bot:bot1" or something
  return playerEmail.startsWith("bot:");
}

// A small function to find valid hands that beat the currentHand
function getAllValidTrumpHands(currentHand, allHandRanks) {
  const currentIndex = currentHand ? handRanks.indexOf(currentHand) : -1;
  // Return only the hands that rank higher
  return allHandRanks.filter(h => handRanks.indexOf(h) > currentIndex);
}

function makeRandomBotMove(lobby) {
  const gs = lobby.gameState;

  if (!gs || gs.roundEnded) {
    return;  // The round already ended, do nothing
  }

  const currentIndex = gs.currentPlayerIndex;
  const currentPlayer = gs.players[currentIndex];

  if (!isBot(currentPlayer.email)) return; // not a bot

  // blockingSleep(1000);

  // If no hand is declared yet (currentHand === null), the bot CANNOT check.
  // Instead, it picks a random hand from the entire handRanks to 'declare'.
  if (!gs.currentHand) {
    const randomHand = handRanks[Math.floor(Math.random() * handRanks.length)];
    handleTrumpMove(lobby, randomHand);
    updateLobbyPlayersFromGameState(lobby);
    io.to(lobby.lobbyId).emit('gameStateUpdate', {
      lobbyId: lobby.lobbyId,
      gameState: lobby.gameState
    });
    return;
  }

  // Otherwise (if there IS a currentHand) we do the normal logic:
  const allHigherHands = getAllValidTrumpHands(gs.currentHand, handRanks);

  if (allHigherHands.length === 0) {
    // Must check
    handleCheckMove(lobby);
  } else {
    // 1/3 chance check, 2/3 chance trump
    const r = Math.random();
    if (r < 0.3333) {
      handleCheckMove(lobby);
      console.log("the bot checked randomly");
    } else {
      const randIdx = Math.floor(Math.random() * allHigherHands.length);
      handleTrumpMove(lobby, allHigherHands[randIdx]);
    }
  }

  updateLobbyPlayersFromGameState(lobby);
  io.to(lobby.lobbyId).emit('gameStateUpdate', {
    lobbyId: lobby.lobbyId,
    gameState: lobby.gameState
  });
}

// We'll call makeRandomBotMove if it's the bot's turn after any move or next round or etc.

// ============= SERVER ROUTES =============

// GET login page
app.get('/login', (req, res) => {
  // If user is already logged in, redirect home
  if (req.session.userEmail) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// POST login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  //debug
  console.log("Login attempt for:", email, password);
  
  //add a line here, that will list all of the users in the database.
  const allUsers = await User.find({});
  console.log("All users in DB:", allUsers);

  if (!email || !password) {
    return res.render('login', { error: 'Please provide email and password.' });
  }

  // Try to find user in DB
  let userDoc = await User.findOne({ email, password }).exec();
  if (!userDoc) {
    return res.render('login', { error: 'Invalid credentials.' });
  }
  if (userDoc.logged_in) {
    // Already logged in
    return res.render('login', { error: 'User already logged in on another device.' });
  }
  if (/bot/i.test(userDoc.nickname)) {
    // Nickname includes "bot"? Disallow login
    return res.render('login', { error: 'Cannot login as a bot account.' });
  }

  // Mark user as logged in
  userDoc.logged_in = true;
  await userDoc.save();

  // Save session
  req.session.userEmail = userDoc.email;
  req.session.nickname = userDoc.nickname;

  res.redirect('/');
});

// GET logout
app.get('/logout', async (req, res) => {
  if (req.session.userEmail) {
    let email = req.session.userEmail;
    // Mark user as logged_out in DB
    let userDoc = await User.findOne({ email }).exec();
    if (userDoc) {
      userDoc.logged_in = false;
      await userDoc.save();
    }
  }
  req.session.destroy();
  res.redirect('/login');
});

// GET index (require login)
app.get('/', requireLogin, (req, res) => {
  res.render('index');
});

// GET how-to-play (require login)
app.get('/how-to-play', requireLogin, (req, res) => {
  res.render('howToPlay');
});

// GET leaderboard
app.get('/leaderboard', requireLogin, async (req, res) => {
  // get all users sorted by wins desc
  let allUsers = await User.find().sort({ wins: -1 }).exec();
  res.render('leaderboard', { allUsers });
});

// GET lobbies
app.get('/lobbies', requireLogin, (req, res) => {
  res.render('lobbies', { lobbies });
});

// WAITING ROOM
app.get('/lobbies/:lobbyId/waiting', requireLogin, (req, res) => {
  const { lobbyId } = req.params;
  const lb = lobbies[lobbyId];
  if (!lb) {
    return res.send(`Lobby with ID ${lobbyId} does not exist.`);
  }
  if (lb.inGame) {
    return res.redirect(`/lobbies/${lobbyId}/playing`);
  }
  res.render('waitingRoom', { lobby: lb });
});

// PLAYING
app.get('/lobbies/:lobbyId/playing', requireLogin, (req, res) => {
  const { lobbyId } = req.params;
  const lb = lobbies[lobbyId];
  if (!lb) {
    return res.send(`Lobby with ID ${lobbyId} does not exist.`);
  }
  if (!lb.inGame) {
    return res.redirect(`/lobbies/${lobbyId}/waiting`);
  }
  const gameState = lb.gameState;
  res.render('playing', {
    lobby: lb,
    gameState
  });
});

// ============= SINGLE-ENDPOINT GAME LOGIC =============
app.post('/api/game', requireLogin, async (req, res) => {
  const userEmail = req.session.userEmail;
  const userNickname = req.session.nickname;
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'No action specified.' });
  }

  switch(action) {

    // createLobby
    case 'createLobby': {
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
        gameState: null,
        botCount: 0
      };
      io.emit('lobbyListUpdate', getAllLobbiesData());
      return res.json({ success: true, lobbyId: newLobbyId });
    }

    // joinLobby
    case 'joinLobby': {
      const { lobbyId } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb) {
        return res.status(404).json({ error: 'Lobby does not exist.' });
      }
      if (lb.inGame) {
        return res.status(400).json({ error: 'Game already started.' });
      }
      if (!lb.players[userEmail]) {
        lb.players[userEmail] = {
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

    // addBot
    case 'addBot': {
      const { lobbyId, botNickname } = req.body; // e.g. 'bot1'
      const lb = lobbies[lobbyId];
      if (!lb) return res.status(404).json({ error: 'Lobby not found.' });
      // only leader can add
      if (lb.leaderEmail !== userEmail) {
        return res.status(403).json({ error: 'Only the lobby leader can add bots.' });
      }
      if (lb.botCount >= 1) {
        return res.status(400).json({ error: 'Max number of bots is 1.' });
      }
      lb.botCount++;
      // We store them as "bot:bot1" etc. in players
      lb.players[`bot:${botNickname}`] = {
        email: `bot:${botNickname}`,
        nickname: botNickname,
        score: 0,
        cardCount: 0,
        cards: []
      };
      io.to(lobbyId).emit('lobbyUpdated', getLobbyData(lobbyId));
      return res.json({ success: true, message: 'Bot added.' });
    }

    // removeBot
    case 'removeBot': {
      const { lobbyId, botNickname } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb) return res.status(404).json({ error: 'Lobby not found.' });
      if (lb.leaderEmail !== userEmail) {
        return res.status(403).json({ error: 'Only the lobby leader can remove bots.' });
      }
      if (lb.botCount <= 0) {
        return res.status(400).json({ error: 'No bots to remove.' });
      }
      const botKey = `bot:${botNickname}`;
      if (!lb.players[botKey]) {
        return res.status(404).json({ error: 'Bot not found in this lobby.' });
      }
      delete lb.players[botKey];
      lb.botCount--;
      io.to(lobbyId).emit('lobbyUpdated', getLobbyData(lobbyId));
      return res.json({ success: true, message: 'Bot removed.' });
    }

    // startGame
    case 'startGame': {
      const { lobbyId } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb) return res.status(404).json({ error: 'Lobby not found.' });
      if (lb.leaderEmail !== userEmail) {
        return res.status(403).json({ error: 'Only the lobby leader can start the game.' });
      }
      const allPlayers = Object.keys(lb.players);
      if (allPlayers.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 players.' });
      }
      lb.inGame = true;
      // Build array
      let arr = allPlayers.map(k => {
        let p = lb.players[k];
        return {
          email: p.email,
          nickname: p.nickname,
          cardCount: 1,
          cards: dealCards(1),
          score: p.score
        };
      });
      const randomIndex = Math.floor(Math.random()*arr.length);
      let playersReadyObj={};
      arr.forEach(pl => playersReadyObj[pl.email]=false);

      lb.gameState = {
        players: arr,
        currentPlayerIndex: randomIndex,
        currentHand: null,
        handRanks,
        handsMap,
        statusMessage: `${arr[randomIndex].nickname}'s turn.`,
        roundEnded: false,
        revealCards: false,
        selectingHand: false,
        playersReady: playersReadyObj,
        lastRoundLoserIndex: null
      };
      // Save states
      arr.forEach(pl => {
        lb.players[pl.email].cardCount=pl.cardCount;
        lb.players[pl.email].cards=pl.cards;
      });
      io.emit('lobbyListUpdate', getAllLobbiesData());
      io.to(lobbyId).emit('lobbyStarted', { lobbyId });

        // Force any changes to be synced
        updateLobbyPlayersFromGameState(lb);

        // If the newly chosen first player is a bot, let them move
        doBotMoveIfNeeded(lb);

      return res.json({ success: true, lobbyId });
    }

    // makeMove
    case 'makeMove': {
      const { lobbyId, move, selectedHand } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb || !lb.gameState) {
        return res.status(404).json({ error: 'Game not found or not started.' });
      }
      let gs = lb.gameState;
      if (gs.roundEnded) {
        return res.status(400).json({ error: 'Round ended, wait for next round.' });
      }
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      if (currentPlayer.email !== userEmail) {
        return res.status(403).json({ error: 'Not your turn.' });
      }
      if (move==='check') {
        try {
          handleCheckMove(lb);
        } catch(e) {
          return res.status(400).json({ error: e.message });
        }
      } else if (move==='trump') {
        if (selectedHand) {
          handleTrumpMove(lb, selectedHand);
        } else {
          gs.selectingHand = true;
        }
      }
      updateLobbyPlayersFromGameState(lb);
      io.to(lobbyId).emit('gameStateUpdate', { lobbyId, gameState: lb.gameState });

      // After each user move, check if next is a bot:
      doBotMoveIfNeeded(lb);

      return res.json({ success: true, statusMessage: gs.statusMessage });
    }

    // proceedNextRound
    case 'proceedNextRound': {
      const { lobbyId } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb || !lb.gameState) {
        return res.status(404).json({ error: 'Game not found or not started.' });
      }
      let gs = lb.gameState;
      if (gs.playersReady[userEmail]===undefined) {
        return res.status(400).json({ error: 'User not found in this game.' });
      }
      gs.playersReady[userEmail] = true;
      const allReady = Object.values(gs.playersReady).every(v=>v===true);
      if (allReady) {
        gs.roundEnded=false;
        gs.revealCards=false;
        for (let em in gs.playersReady) {
          gs.playersReady[em]=false;
        }
        gs.players.forEach(pl => {
          pl.cards = dealCards(pl.cardCount);
        });
        if (gs.lastRoundLoserIndex!==null) {
          if (gs.lastRoundLoserIndex>=gs.players.length) {
            gs.lastRoundLoserIndex=0;
          }
          gs.currentPlayerIndex=gs.lastRoundLoserIndex;
        }
        gs.currentHand=null;
        const currPl = gs.players[gs.currentPlayerIndex];
        gs.statusMessage = `${currPl.nickname}'s turn.`;
      }
      updateLobbyPlayersFromGameState(lb);
      io.to(lobbyId).emit('gameStateUpdate',{ lobbyId, gameState: lb.gameState });
      // If it's a bot next, do that move
      doBotMoveIfNeeded(lb);
      return res.json({ success: true });
    }

    // exitLobby
    case 'exitLobby': {
      const { lobbyId } = req.body;
      const lb = lobbies[lobbyId];
      if (!lb) {
        return res.json({ success: true, message: 'Lobby does not exist or removed.' });
      }
      if (lb.players[userEmail]) {
        delete lb.players[userEmail];
      }
      if (lb.leaderEmail===userEmail) {
        const remain = Object.keys(lb.players);
        if (remain.length>0) {
          lb.leaderEmail=remain[0];
        } else {
          delete lobbies[lobbyId];
          io.emit('lobbyListUpdate', getAllLobbiesData());
          return res.json({ success: true, message:'Lobby removed, no players left.'});
        }
      }
      io.emit('lobbyListUpdate', getAllLobbiesData());
      io.to(lobbyId).emit('lobbyUpdated', getLobbyData(lobbyId));
      return res.json({ success: true });
    }

    default:
      return res.status(400).json({ error:`Unknown action: ${action}`});
  }
});

// ============= SOCKET.IO HANDLERS =============
io.on('connection', (socket) => {
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
    const lb = lobbies[lobbyId];
    if (lb && lb.inGame && lb.gameState) {
      socket.emit('gameStateUpdate', { 
        lobbyId, 
        gameState: lb.gameState 
      });
    }
  });
  socket.on('leaveLobbyRoom', (lobbyId) => {
    socket.leave(lobbyId);
  });
});

// ============= HELPER FUNCTIONS =============
function generateRandomLobbyId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function handleCheckMove(lobby) {
  let gs = lobby.gameState;
  const ci = gs.currentPlayerIndex;
  const cp = gs.players[ci];
  if (gs.currentHand===null) {
    throw new Error('No hand has been declared yet. You cannot check now.');
  }
  gs.roundEnded=true;
  gs.revealCards=true;
  const handPossible = isHandPossible(gs.currentHand, gs.players.flatMap(p=>p.cards));
  let loserIndex;
  if (handPossible) {
    incrementCardCount(gs, ci);
    loserIndex=ci;
    gs.statusMessage=`${cp.nickname} checked. The hand was present! ${cp.nickname} loses.`;
    // console.log(cp.nickname, "${cp.nickname} checked. The hand was present! ${cp.nickname} loses.")
  } else {
    let prevIndex=(ci-1+gs.players.length)%gs.players.length;
    incrementCardCount(gs, prevIndex);
    loserIndex=prevIndex;
    gs.statusMessage=`${cp.nickname} checked. The hand was NOT there. ${gs.players[prevIndex].nickname} loses.`;
    // console.log(cp.nickname, "${cp.nickname} checked. The hand was NOT there! ${previous guy} loses.")
  }
  gs.lastRoundLoserIndex=loserIndex;
  gs.players = gs.players.filter(p=>p.cardCount<6);
  // If only one left, that's the winner
  if (gs.players.length===1) {
    let winner=gs.players[0];
    winner.score++;
    if (lobby.players[winner.email]) {
      lobby.players[winner.email].score++;
    }
    // increment DB wins
    if (!isBot(winner.email)) {
      User.findOne({ email:winner.email }).then(doc=>{
        if(doc) {
          doc.wins++;
          doc.save();
        }
      });
    }
    // restart game
    restartGame(lobby);
  } else if (gs.players.length===0) {
    // no winners? just restart
    restartGame(lobby);
  } else {
    // if roundEnded is true, they do "proceedNextRound"
  }
  doBotProceedIfNeeded(lobby);
}

function handleTrumpMove(lobby, selectedHand) {
  let gs = lobby.gameState;
  const ci = gs.currentPlayerIndex;
  const cp = gs.players[ci];
  const currentIndex=gs.currentHand?handRanks.indexOf(gs.currentHand):-1;
  const selectedIndex=handRanks.indexOf(selectedHand);
  if (selectedIndex>currentIndex) {
    gs.currentHand=selectedHand;
    const nextIndex=getNextPlayerIndex(gs, ci);
    const nextPlayer=gs.players[nextIndex];
    gs.statusMessage=`${cp.nickname} trumped with ${selectedHand}. Now it's ${nextPlayer.nickname}'s turn.`;
    gs.selectingHand=false;
    gs.currentPlayerIndex=nextIndex;
  } else {
    gs.statusMessage=`Selected hand (${selectedHand}) does not beat the current hand (${gs.currentHand||'none'}).`;
  }
}

function restartGame(lobby) {
  const allEmails = Object.keys(lobby.players);
  if (allEmails.length<2) {
    lobby.inGame=false;
    lobby.gameState=null;
    return;
  }
  lobby.inGame=true;
  let arr= allEmails.map(e=>{
    let p=lobby.players[e];
    return {
      email:p.email,
      nickname:p.nickname,
      cardCount:1,
      cards:dealCards(1),
      score:p.score
    };
  });
  const randomIndex=Math.floor(Math.random()*arr.length);
  let playersReadyObj={};
  arr.forEach(pl => {
    playersReadyObj[pl.email]=false;
  });

  lobby.gameState={
    players:arr,
    currentPlayerIndex:randomIndex,
    currentHand:null,
    handRanks,
    handsMap,
    statusMessage:`${arr[randomIndex].nickname}'s turn.`,
    roundEnded:false,
    revealCards:false,
    selectingHand:false,
    playersReady:playersReadyObj,
    lastRoundLoserIndex:null
  };
  updateLobbyPlayersFromGameState(lobby);
}

// sync with lobby players
function updateLobbyPlayersFromGameState(lb) {
  let gs=lb.gameState;
  if(!gs) return;
  gs.players.forEach(pl=>{
    lb.players[pl.email].cardCount=pl.cardCount;
    lb.players[pl.email].cards=pl.cards;
    lb.players[pl.email].score=pl.score;
  });
}

// returns array of lobbies
function getAllLobbiesData(){
  let arr=[];
  for(let lid in lobbies){
    const lb = lobbies[lid];
    arr.push({
      lobbyId: lb.lobbyId,
      leaderNickname: lb.players[lb.leaderEmail]?.nickname||'unknown',
      leaderEmail: lb.leaderEmail,
      inGame: lb.inGame,
      players: Object.values(lb.players).map(p=>({
        email:p.email,
        nickname:p.nickname
      }))
    });
  }
  return arr;
}

// returns minimal data for one lobby
function getLobbyData(lobbyId) {
  const lb = lobbies[lobbyId];
  if(!lb) return null;
  return {
    lobbyId: lb.lobbyId,
    leaderEmail: lb.leaderEmail,
    players: lb.players,
    inGame: lb.inGame
  };
}

function doBotProceedIfNeeded(lobby) {
  const gs = lobby.gameState;
  if (!gs || !gs.roundEnded) return;

  // Mark each bot as ready, after a short delay
  gs.players.forEach(pl => {
    if (isBot(pl.email)) {
      // setTimeout so there's a short "pause" 
      setTimeout(() => {
        gs.playersReady[pl.email] = true;

        // Now check if ALL are ready
        const allReady = Object.values(gs.playersReady).every(v => v === true);
        if (allReady) {
          // This is effectively the same logic as "proceedNextRound"
          gs.roundEnded = false;
          gs.revealCards = false;
          Object.keys(gs.playersReady).forEach(em => {
            gs.playersReady[em] = false;
          });
          gs.players.forEach(p => {
            p.cards = dealCards(p.cardCount);
          });
          if (gs.lastRoundLoserIndex !== null) {
            if (gs.lastRoundLoserIndex >= gs.players.length) {
              gs.lastRoundLoserIndex = 0;
            }
            gs.currentPlayerIndex = gs.lastRoundLoserIndex;
          }
          gs.currentHand = null;
          const currPl = gs.players[gs.currentPlayerIndex];
          gs.statusMessage = `${currPl.nickname}'s turn.`;

          // Sync with lobby
          updateLobbyPlayersFromGameState(lobby);
          // Broadcast new state
          io.to(lobby.lobbyId).emit('gameStateUpdate', {
            lobbyId: lobby.lobbyId,
            gameState: lobby.gameState
          });
          
          // If the new turn is a bot, do a bot move
          doBotMoveIfNeeded(lobby);
        }
      }, 2000); // 2s delay, adjust as you want
    }
  });
}

// after each move or next round, see if it's a bot's turn
function doBotMoveIfNeeded(lb) {
  const gs = lb.gameState;
  if(!gs||gs.roundEnded) return; // no move
  const currentPl = gs.players[gs.currentPlayerIndex];
  if(isBot(currentPl.email)) {
    // do the bot's move after a small delay
    // setTimeout(()=>{
    makeRandomBotMove(lb);
    // }, 1000);
  }
}

// A blocking sleep for `ms` milliseconds - used in bot moves to see what's going on
function blockingSleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // do nothing, just block
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
