import { parseTournamentId } from '@services/battlefy/battlefy';

describe(parseTournamentId, () => {
  it('can load info page URLs', () => {
    const parsedIds = parseTournamentId('https://battlefy.com/excelsior-gaming/battle-of-the-kings/5fa20aa59c1a774697ac1ec8/info?infoTab=details');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('5fa20aa59c1a774697ac1ec8');
    expect(parsedIds?.phaseId).toBeUndefined();
  });

  it('can load bracket URLs', () => {
    const parsedIds = parseTournamentId('https://battlefy.com/excelsior-gaming/battle-of-the-kings/5fa20aa59c1a774697ac1ec8/stage/5feb93620beb6e3294e04810/bracket/');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('5fa20aa59c1a774697ac1ec8');
    expect(parsedIds?.phaseId).toBe('5feb93620beb6e3294e04810');
  });
});
