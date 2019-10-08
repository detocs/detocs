import Match from './match';

const matches: Match[] = [
  {
    id: 'tf',
    name: 'True Finals',
    smashggId: 'Grand Final Reset',
  },
  {
    id: 'gf',
    name: 'Grand Finals',
    smashggId: 'Grand Final',
  },
  {
    id: 'wf',
    name: 'Winners Finals',
    smashggId: 'Winners Final',
  },
  {
    id: 'ws',
    name: 'Winners Semis',
    smashggId: 'Winners Semi-Final',
  },
  {
    id: 'wq',
    name: 'Winners Quarters',
    smashggId: 'Winners Quarter-Final',
  },
  {
    id: 'lf',
    name: 'Losers Finals',
    smashggId: 'Losers Final',
  },
  {
    id: 'ls',
    name: 'Losers Semis',
    smashggId: 'Losers Semi-Final',
  },
  {
    id: 'lq',
    name: 'Losers Quarters',
    smashggId: 'Losers Quarter-Final',
  },
  {
    id: 'ex',
    name: 'Exhibition',
    smashggId: null,
  },
  {
    id: 'rr',
    name: 'Round Robin',
    smashggId: null,
  },
  {
    id: 'cas',
    name: 'Casuals',
    smashggId: null,
  },
];

for(let i = 1; i < 10; i++) {
  matches.push({
    id: `w${i}`,
    name: `Winners Round ${i}`,
    smashggId: `Winners Round ${i}`,
  });
  matches.push({
    id: `l${i}`,
    name: `Losers Round ${i}`,
    smashggId: `Losers Round ${i}`,
  });
}

for(const i of [3, 5, 7, 10, 15, 20]) {
  matches.push({
    id: `ft${i}`,
    name: `First to ${i}`,
    smashggId: null,
  });
}

export default matches;

export function getMatchById(id: string): Match | null {
  return matches.find(m => m.smashggId === id) || null;
}

export function getMatchBySmashggId(id: string): Match | null {
  return matches.find(m => m.smashggId === id) || null;
}

export function isGrandFinals(match: Match | null | undefined): boolean {
  if (match == null) {
    return false;
  }
  return match.id === 'gf';
}

export function isTrueFinals(match: Match | null | undefined): boolean {
  if (match == null) {
    return false;
  }
  return match.id === 'tf';
}
