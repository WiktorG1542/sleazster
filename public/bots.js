
// For all these bots, we assume the following helpers are available globally:
// 1) isHandPossible(handName, cards) -> returns true if 'handName' can be formed with 'cards'
// 2) handRanks (Array of strings ordered from weakest to strongest)
// 3) A full deck concept or at least knowledge of which cards have been 'played' (for hardBot).

/**
 * Returns an array of all hands from 'handRanks' that are possible with the given cards.
 */
function getAllPossibleHands(cards, handRanks) {
  let possible = [];
  for (let hr of handRanks) {
    if (isHandPossible(hr, cards)) {
      possible.push(hr);
    }
  }
  return possible;
}

/**
 * EASY BOT:
 * 1. Identify which moves (hands) are possible from the bot's hand.
 * 2. Randomly pick one of the possible moves.
 * 3. If no moves are possible, it returns 'check'.
 */
function easyBot(botCards, handRanks) {
  const possibleHands = getAllPossibleHands(botCards, handRanks);
  
  // If nothing is possible, the bot checks.
  if (possibleHands.length === 0) {
    return 'check';
  }
  
  // Pick a random possible hand.
  const randomIndex = Math.floor(Math.random() * possibleHands.length);
  return possibleHands[randomIndex];
}

/**
 * MID BOT:
 * 1. Identify which hands are possible.
 * 2. From all possible hands, pick the "best" one – here we'll define "best"
 *    as the highest-ranked hand in the 'handRanks' array.
 * 3. If no moves are possible, it returns 'check'.
 */
function midBot(botCards, handRanks) {
  const possibleHands = getAllPossibleHands(botCards, handRanks);
  
  // If nothing is possible, the bot checks.
  if (possibleHands.length === 0) {
    return 'check';
  }

  // Choose the hand with the highest index in handRanks (strongest).
  let bestHand = possibleHands[0];
  for (let i = 1; i < possibleHands.length; i++) {
    if (handRanks.indexOf(possibleHands[i]) > handRanks.indexOf(bestHand)) {
      bestHand = possibleHands[i];
    }
  }
  
  return bestHand;
}

/**
 * HARD BOT (More advanced approach example):
 * 
 * 1. Build a representation of all possible cards in the deck (all suits, all values).
 * 2. Remove 'playedCards' + the bot's own cards from this "remaining deck." This simulates
 *    what might still be in other players' hands.
 * 3. Get all possible hands the bot can form. For each hand:
 *    - Estimate how likely it is that another player can form a stronger trump
 *      using the "remaining deck."
 *    - That likelihood can be approximated by counting how many stronger hands
 *      are possible given the remaining deck (this is a rough measure).
 * 4. Pick the bot's hand with the smallest probability of being out-trumped
 *    (or equivalently the largest probability of success).
 * 5. If no moves are possible, return 'check'.
 */

function hardBot(botCards, handRanks, playedCards) {
  // Helper: Create a full deck of 24 cards (6 values x 4 suits).
  function createFullDeck() {
    const suits = ['♠', '♣', '♦', '♥'];
    const values = ['9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (let v of values) {
      for (let s of suits) {
        deck.push({ value: v, suit: s });
      }
    }
    return deck;
  }

  // Helper: Get all possible hands from 'handRanks' that are formable with 'cards'.
  function getAllPossibleHands(cards, handRanks) {
    const possible = [];
    for (let hr of handRanks) {
      if (isHandPossible(hr, cards)) {
        possible.push(hr);
      }
    }
    return possible;
  }

  // Helper: Return numeric rank (index in handRanks).
  function getHandStrength(handName, handRanks) {
    return handRanks.indexOf(handName);
  }

  // Helper: Get all stronger hands than 'baseHand' from the full set of 'handRanks'.
  function getStrongerHands(baseHand, handRanks) {
    const baseStrength = getHandStrength(baseHand, handRanks);
    return handRanks.filter(hr => getHandStrength(hr, handRanks) > baseStrength);
  }

  // 1) Build the full deck.
  const fullDeck = createFullDeck();

  // 2) Remove playedCards + botCards from the fullDeck => remainingDeck
  const remainingDeck = [...fullDeck];

  // A small helper to compare card objects by value & suit
  function sameCard(c1, c2) {
    return c1.value === c2.value && c1.suit === c2.suit;
  }

  // Remove playedCards from remainingDeck
  for (let played of playedCards) {
    const idx = remainingDeck.findIndex(card => sameCard(card, played));
    if (idx !== -1) {
      remainingDeck.splice(idx, 1);
    }
  }
  // Remove botCards from remainingDeck
  for (let botCard of botCards) {
    const idx = remainingDeck.findIndex(card => sameCard(card, botCard));
    if (idx !== -1) {
      remainingDeck.splice(idx, 1);
    }
  }

  // 3) Get all possible hands the bot can form.
  const possibleHands = getAllPossibleHands(botCards, handRanks);

  // If none are possible, we check.
  if (possibleHands.length === 0) {
    return 'check';
  }

function canFormHandRough(handName, candidateCards) {
  // Determine the exact number of cards needed for each hand type
  // so we can optimize and only generate subsets of the exact required size.
  const handSize = getHandSize(handName);

  // If the candidateCards don't have at least `handSize` cards, it can't form the hand.
  if (candidateCards.length < handSize) {
    return false;
  }

  // Generate all subsets of 'candidateCards' of size `handSize`.
  const subsets = generateSubsets(candidateCards, handSize);

  // Check each subset with isHandPossible. If any subset is valid, return true.
  for (let subset of subsets) {
    if (isHandPossible(handName, subset)) {
      return true;
    }
  }
  return false;
}

/**
 * Return how many cards are required by a given handName.
 * For example:
 *   "Single 9" -> 1
 *   "Double 10" -> 2
 *   "Triple K" -> 3
 *   "Quadruple A" -> 4
 *   "2 Pairs 9-10" -> 4
 *   "Full House Q" -> 5
 *   "Small Street" or "Big Street" -> 5
 */
function getHandSize(handName) {
  if (handName.startsWith('Single')) return 1;
  if (handName.startsWith('Double')) return 2;
  if (handName.startsWith('Triple')) return 3;
  if (handName.startsWith('Quadruple')) return 4;
  if (handName.startsWith('2 Pairs')) return 4;
  if (handName.startsWith('Full House')) return 5;
  if (handName === 'Small Street' || handName === 'Big Street') return 5;
  // Default fallback (should not happen if all hand types are covered)
  return 5;
}

/**
 * Generate all subsets of the given 'cards' array of size 'targetSize'.
 * We only need subsets up to size 5 for this game, which is manageable.
 */
function generateSubsets(cards, targetSize) {
  const results = [];
  const subset = [];

  function backtrack(start) {
    // If we've picked enough cards, record the subset
    if (subset.length === targetSize) {
      results.push([...subset]);
      return;
    }
    // If we don't have enough remaining cards to reach targetSize, prune
    const remainingNeeded = targetSize - subset.length;
    if ((cards.length - start) < remainingNeeded) {
      return;
    }

    // Try each possibility
    for (let i = start; i < cards.length; i++) {
      subset.push(cards[i]);
      backtrack(i + 1);
      subset.pop();
    }
  }

  backtrack(0);
  return results;
}


  // Build a result structure: { hand: <handName>, risk: <number> }
  const handEvaluations = possibleHands.map(botHand => {
    // Gather all hands that are strictly stronger than 'botHand'
    const strongerHands = getStrongerHands(botHand, handRanks);

    // Count how many strongerHands can be formed from 'remainingDeck'
    let countPossibleStronger = 0;
    for (let sh of strongerHands) {
      if (canFormHandRough(sh, remainingDeck)) {
        countPossibleStronger++;
      }
    }

    return {
      hand: botHand,
      risk: countPossibleStronger
    };
  });

  // 4) Choose the hand with the minimum risk (fewest ways it might be beaten).
  // If there's a tie, pick the strongest among them or just pick the first.
  let bestEvaluation = handEvaluations[0];
  for (let i = 1; i < handEvaluations.length; i++) {
    const eval_i = handEvaluations[i];

    // If we found a lower risk, pick it
    if (eval_i.risk < bestEvaluation.risk) {
      bestEvaluation = eval_i;
    }
    // If risk is the same, pick whichever has a higher hand strength
    else if (eval_i.risk === bestEvaluation.risk) {
      const currentStrength = getHandStrength(eval_i.hand, handRanks);
      const bestStrength = getHandStrength(bestEvaluation.hand, handRanks);
      if (currentStrength > bestStrength) {
        bestEvaluation = eval_i;
      }
    }
  }

  // Return the chosen move (hand).
  return bestEvaluation.hand;
}
