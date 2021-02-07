import merge from 'lodash.merge';

import * as People from '@models/people';
import Person, { getPrefixedName } from '@models/person';
import TournamentSet, { TournamentParticipant, TournamentEntrant } from '@models/tournament-set';

export function entrantToPerson(entrant: TournamentEntrant): Partial<Person> {
  const soloParticipant = entrant.participants.length == 1;
  if (soloParticipant) {
    return getOrCreatePlayer(entrant);
  }
  else {
    return getOrCreateTeam(entrant);
  }
}

function getOrCreatePlayer(entrant: TournamentSet['entrants'][0]): Partial<Person> {
  const participant = entrant.participants[0];

  const foundById = People.getByServiceId(participant.serviceName, participant.serviceId);
  if (foundById) {
    return mergeSetParticipant(foundById, participant);
  }

  const foundPeople = People.findByFullName(getPrefixedName(participant));
  if (foundPeople.length == 1) {
    return mergeSetParticipant(foundPeople[0], participant);
  }

  return newPersonFromParticipant(participant);
}

function mergeSetParticipant(orig: Person, {
  serviceName,
  serviceId,
  ...incoming
}: TournamentParticipant): Person {
  const extra: Partial<Person> = {
    serviceIds: {
      [serviceName]: serviceId,
    },
  };
  if (incoming.handle !== orig.handle) {
    extra.alias = incoming.handle;
  }
  delete incoming.handle;
  const merged = merge({}, orig, incoming, extra);
  return merged;
}

function newPersonFromParticipant({
  serviceName,
  serviceId,
  ...person
}: TournamentParticipant): Partial<Person> {
  const withServiceId = merge({}, person, {
    serviceIds: {
      [serviceName]: serviceId,
    },
  });
  return withServiceId;
}

function getOrCreateTeam(entrant: TournamentSet['entrants'][0]): Partial<Person> {
  const foundPeople = People.findByFullName(entrant.name);
  if (foundPeople.length == 1) {
    return foundPeople[0];
  }

  return { handle: entrant.name };
}
