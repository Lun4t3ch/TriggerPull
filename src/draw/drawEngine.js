// Source-agnostic draw logic. Knows nothing about SSI or PractiScore — it only
// deals with entrants of the shape { id, name }.

// Cryptographically-seeded random index when available, Math.random otherwise.
function randomIndex(n) {
  if (n <= 0) return -1;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Rejection sampling to avoid modulo bias.
    const max = Math.floor(0xffffffff / n) * n;
    const buf = new Uint32Array(1);
    let x;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= max);
    return x % n;
  }
  return Math.floor(Math.random() * n);
}

// Pick one winner from the active entrants. Returns the entrant or null.
export function pickWinner(activeEntrants) {
  const i = randomIndex(activeEntrants.length);
  return i < 0 ? null : activeEntrants[i];
}

// Build the scrolling reel of names for the drum animation. The sequence is
// randomised for visual effect and *ends* on the predetermined winner so the
// landing matches the result. Returns an array of display strings.
export function reelSequence(entrants, winner, length = 40) {
  const pool = entrants.length ? entrants : [winner];
  const names = [];
  for (let i = 0; i < length - 1; i++) {
    const pick = pool[randomIndex(pool.length)] || winner;
    names.push(pick.name);
  }
  names.push(winner.name); // final, resting cell = the actual winner
  return names;
}

// Convenience: the entrants still eligible to be drawn.
export function activePool(entrants) {
  return entrants.filter((e) => e.state === 'ACTIVE');
}
