import { parseTournamentSlug } from '@services/smashgg/smashgg';

describe(parseTournamentSlug, () => {
  it('can load plain URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBeUndefined();
  });

  it('can load smash.gg URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.smash.gg/tournament/evo-2022');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBeUndefined();
  });

  it('can load /details URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022/details');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBeUndefined();
  });

  it('can load event URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022/event/skullgirls-2nd-encore-1');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBeUndefined();
  });

  it('can load pools URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022/event/skullgirls-2nd-encore-1/brackets?filter={"phaseId":1086096,"perPage":16}');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBe('1086096');
  });

  it('can load URL-encoded pools URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022/event/skullgirls-2nd-encore-1/brackets?filter=%7B%22phaseId%22%3A1086096%2C%22perPage%22%3A16%7D');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBe('1086096');
  });

  it('can load pool URLs', () => {
    const parsedIds = parseTournamentSlug('https://www.start.gg/tournament/evo-2022/event/skullgirls-2nd-encore-1/brackets/1086096/1815188');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('evo-2022');
    expect(parsedIds?.phaseId).toBe('1086096');
  });
});
