export function toDeck(deck) {
  return deck === 'B' ? 'B' : 'A';
}

export function getOtherDeck(deck) {
  return toDeck(deck) === 'B' ? 'A' : 'B';
}
