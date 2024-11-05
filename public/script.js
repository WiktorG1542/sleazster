// script.js

let playerScore = 0;
let computerScore = 0;
let deck = createDeck();
let availableCards = new Set(deck.map(card => `${card.value}${card.suit}`));

document.getElementById('playRound').addEventListener('click', playRound);
document.getElementById('resetGame').addEventListener('click', resetGame);

// Initialize the grid and render all 52 cards
function initGrid() {
  const cardGrid = document.getElementById('cardGrid');
  cardGrid.innerHTML = ''; // Clear the grid if it already exists
  const suits = ['♠', '♣', '♦', '♥'];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];

  suits.forEach(suit => {
    values.forEach(value => {
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('card');
      cardDiv.id = `${value}${suit}`;
      cardDiv.innerText = `${value}${suit}`;
      cardGrid.appendChild(cardDiv);
    });
  });
}

// Reset and update the grid colors based on the deck status
function updateGrid(currentCards = []) {
  document.querySelectorAll('.card').forEach(card => {
    const cardId = card.id;
    if (!availableCards.has(cardId)) {
      card.classList.add('picked');
      card.classList.remove('current');
    } else {
      card.classList.remove('picked');
    }
    card.classList.remove('current');
  });

  // Highlight currently drawn cards
  currentCards.forEach(card => {
    const cardDiv = document.getElementById(`${card.value}${card.suit}`);
    if (cardDiv) {
      cardDiv.classList.add('current');
    }
  });
}

function createDeck() {
  const suits = ['♠', '♣', '♦', '♥'];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11-14 for J, Q, K, A
  let deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5); // Shuffle deck
}

function playRound() {
  if (deck.length === 0) {
    endGame();
    return;
  }

  const playerCard = deck.pop();
  const computerCard = deck.pop();
  availableCards.delete(`${playerCard.value}${playerCard.suit}`);
  availableCards.delete(`${computerCard.value}${computerCard.suit}`);

  updateGrid([playerCard, computerCard]);

  let roundResult = '';
  if (playerCard.value > computerCard.value) {
    playerScore++;
    roundResult = `You win this round! You drew ${playerCard.value}${playerCard.suit} and the computer drew ${computerCard.value}${computerCard.suit}.`;
  } else if (computerCard.value > playerCard.value) {
    computerScore++;
    roundResult = `Computer wins this round! You drew ${playerCard.value}${playerCard.suit} and the computer drew ${computerCard.value}${computerCard.suit}.`;
  } else {
    roundResult = `It's a tie! Both drew ${playerCard.value}${playerCard.suit}.`;
  }

  document.getElementById('status').innerText = roundResult;
  document.getElementById('playerScore').innerText = `Your Score: ${playerScore}`;
  document.getElementById('computerScore').innerText = `Computer Score: ${computerScore}`;

  if (deck.length === 0) {
    endGame();
  }
}

function endGame() {
  document.getElementById('playRound').style.display = 'none';
  document.getElementById('resetGame').style.display = 'inline';
  const finalMessage = playerScore > computerScore
    ? "Game Over! You win!"
    : playerScore < computerScore
      ? "Game Over! Computer wins!"
      : "Game Over! It's a tie!";
  document.getElementById('status').innerText = finalMessage;
}

function resetGame() {
  playerScore = 0;
  computerScore = 0;
  deck = createDeck();
  availableCards = new Set(deck.map(card => `${card.value}${card.suit}`));
  updateGrid(); // Reset the grid colors
  document.getElementById('playRound').style.display = 'inline';
  document.getElementById('resetGame').style.display = 'none';
  document.getElementById('status').innerText = "Click 'Play Round' to start the game";
  document.getElementById('playerScore').innerText = `Your Score: ${playerScore}`;
  document.getElementById('computerScore').innerText = `Computer Score: ${computerScore}`;
}

// Initialize the card grid on load
initGrid();
updateGrid();
