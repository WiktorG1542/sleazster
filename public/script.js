// script.js
const socket = io();

let nickname = '';
let gameState = null;

// Event listeners for UI elements
document.getElementById('joinGame').addEventListener('click', joinGame);
document.getElementById('checkButton').addEventListener('click', checkMove);
document.getElementById('trumpButton').addEventListener('click', trumpMove);
document.getElementById('proceedButton').addEventListener('click', proceedNextRound);

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

// Handle 'startGame' event from server
socket.on('startGame', (data) => {
  gameState = data;
  updateUI();
});

// Update game state
socket.on('updateGameState', (data) => {
  gameState = data;
  updateUI();
});

// Update UI based on game state
function updateUI() {
  if (!gameState) return;

  // Update player info
  const player1Name = document.getElementById('player1Name');
  const player1Score = document.getElementById('player1Score');
  const player1Cards = document.getElementById('player1Cards');

  const player2Name = document.getElementById('player2Name');
  const player2Score = document.getElementById('player2Score');
  const player2Cards = document.getElementById('player2Cards');

  player1Name.innerText = gameState.player1.nickname;
  player1Score.innerText = `Cards: ${gameState.player1.cardCount}`;
  player1Cards.innerHTML = generateCardHTML(
    gameState.player1.cards,
    gameState.revealCards,
    gameState.player1.nickname === nickname // Determine if this is the current user
  );

  player2Name.innerText = gameState.player2.nickname;
  player2Score.innerText = `Cards: ${gameState.player2.cardCount}`;
  player2Cards.innerHTML = generateCardHTML(
    gameState.player2.cards,
    gameState.revealCards,
    gameState.player2.nickname === nickname // Determine if this is the current user
  );

  // Update action buttons
  const actionButtons = document.getElementById('actionButtons');
  const checkButton = document.getElementById('checkButton');
  const trumpButton = document.getElementById('trumpButton');

  if (gameState.currentPlayer === nickname && !gameState.roundEnded) {
    actionButtons.style.display = 'block';

    if (gameState.currentHand === null) {
      // Disable the "CHECK" button at the start of the round
      checkButton.disabled = true;
      checkButton.classList.add('disabled');
    } else {
      checkButton.disabled = false;
      checkButton.classList.remove('disabled');
    }
  } else {
    actionButtons.style.display = 'none';
  }

  // Update status message
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.innerText = gameState.statusMessage;

  // Update proceed button
  const proceedContainer = document.getElementById('proceedContainer');
  const proceedButton = document.getElementById('proceedButton');
  if (gameState.roundEnded) {
    proceedContainer.style.display = 'block';
    if (gameState.playersReady[nickname]) {
      proceedButton.disabled = true;
      proceedButton.classList.add('disabled');
    } else {
      proceedButton.disabled = false;
      proceedButton.classList.remove('disabled');
    }
  } else {
    proceedContainer.style.display = 'none';
  }

  // Update hand selection grid
  const handSelection = document.getElementById('handSelection');
  if (gameState.selectingHand && gameState.currentPlayer === nickname) {
    handSelection.style.display = 'block';
    generateHandGrid();
  } else {
    handSelection.style.display = 'none';
  }
}

// Generate HTML for player's cards
function generateCardHTML(cards, revealCards, isPlayer = false) {
  let html = '';
  if (revealCards || isPlayer) {
    cards.forEach(card => {
      html += `<div class="card">${card.value}${card.suit}</div>`;
    });
  } else {
    cards.forEach(card => {
      html += `<div class="card back">#</div>`;
    });
  }
  return html;
}

// Handle Check move
function checkMove() {
  socket.emit('playerMove', { move: 'check' });
}

// Handle Trump move
function trumpMove() {
  socket.emit('playerMove', { move: 'trump' });
}

// Proceed to next round
function proceedNextRound() {
  socket.emit('proceedNextRound');
  // Disable the button after clicking
  const proceedButton = document.getElementById('proceedButton');
  proceedButton.disabled = true;
  proceedButton.classList.add('disabled');
}

// Generate hand selection grid
function generateHandGrid() {
  const handGrid = document.getElementById('handGrid');
  handGrid.innerHTML = '';

  const handRanks = gameState.handRanks;
  const currentHandIndex = gameState.currentHand ? handRanks.indexOf(gameState.currentHand) : -1;

  const handCategories = ['Singles', 'Doubles', 'Streets', 'Triples'];
  handCategories.forEach((category) => {
    const row = document.createElement('div');
    row.className = 'handRow';

    const rowTitle = document.createElement('div');
    rowTitle.className = 'rowTitle';
    rowTitle.innerText = category;
    row.appendChild(rowTitle);

    const handsInCategory = gameState.hands[category];
    handsInCategory.forEach((hand) => {
      const handButton = document.createElement('button');
      handButton.className = 'handButton';
      handButton.innerText = hand;

      const handIndex = handRanks.indexOf(hand);
      if (handIndex <= currentHandIndex) {
        handButton.disabled = true;
        handButton.classList.add('disabled');
      } else {
        handButton.addEventListener('click', () => {
          socket.emit('playerMove', { move: 'trump', selectedHand: hand });
        });
      }

      row.appendChild(handButton);
    });

    handGrid.appendChild(row);
  });
}

// Handle error messages from server
socket.on('errorMessage', (message) => {
  alert(message);
});

// Handle game over
socket.on('gameOver', (data) => {
  alert(`Game Over! Winner: ${data.winner}`);
  // Reset the game
  location.reload();
});
