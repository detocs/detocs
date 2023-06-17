import { parseEntrantName, parseTournamentId } from '@services/challonge/challonge';

describe(parseEntrantName, () => {
  it('leaves regular names alone', () => {
    expect(parseEntrantName('asdf')).toEqual({
      prefix: null,
      handle: 'asdf',
    });
  });

  it('parses single prefixes', () => {
    expect(parseEntrantName('qw | asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('parses multiple prefixes', () => {
    expect(parseEntrantName('zx | qw | asdf')).toEqual({
      prefix: 'zx | qw',
      handle: 'asdf',
    });
  });

  it('handles multiple pipes', () => {
    expect(parseEntrantName('qw || asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
    expect(parseEntrantName('qw ||| asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('handles varying whitespace around pipe', () => {
    expect(parseEntrantName('qw|asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
    expect(parseEntrantName('qw  |  asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('handles empty string', () => {
    expect(parseEntrantName('')).toEqual({
      prefix: null,
      handle: '',
    });
  });
});

describe(parseTournamentId, () => {
  it('can load plain URLs', () => {
    const parsedIds = parseTournamentId('https://challonge.com/Eurofight83');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('Eurofight83');
    expect(parsedIds?.phaseId).toBe('Eurofight83');
  });

  it('can load subdomain URLs', () => {
    const parsedIds = parseTournamentId('https://quarterlyrapport.challonge.com/quar4llb');
    expect(parsedIds).not.toBeNull();
    expect(parsedIds?.tournamentId).toBe('quarterlyrapport-quar4llb');
    expect(parsedIds?.phaseId).toBe('quarterlyrapport-quar4llb');
  });

  it('ignores non-tournament URLs', () => {
    expect(parseTournamentId('https://challonge.com/search/tournaments')).toBeNull();
    expect(parseTournamentId('https://challonge.com/events/quarantined4')).toBeNull();
  });
});
