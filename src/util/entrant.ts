import merge from 'lodash.merge';

import PersonDatabase from '@models/people';
import Person, { getPrefixedName, nullPerson } from '@models/person';
import TournamentSet, { TournamentParticipant, TournamentEntrant } from '@models/tournament-set';

export function entrantToPerson(
  personDatabase: PersonDatabase,
  entrant: TournamentEntrant,
): Partial<Person> {
  if (entrant.name === '' && entrant.participants.length == 0) {
    return nullPerson;
  }
  const soloParticipant = entrant.participants.length == 1;
  if (soloParticipant) {
    return getOrCreatePlayer(personDatabase, entrant);
  }
  else {
    return getOrCreateTeam(personDatabase, entrant);
  }
}

function getOrCreatePlayer(
  personDatabase: PersonDatabase,
  entrant: TournamentSet['entrants'][0],
): Partial<Person> {
  const participant = entrant.participants[0];

  const foundById = personDatabase.getByServiceId(participant.serviceName, participant.serviceId);
  if (foundById) {
    return mergeSetParticipant(foundById, participant);
  }

  const foundPeople = personDatabase.findByFullName(getPrefixedName(participant));
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
  const incomingPerson: Partial<Person> = incoming;
  if (incomingPerson.handle !== orig.handle) {
    extra.alias = incomingPerson.handle;
  }
  delete incomingPerson.handle;
  const merged = merge({}, orig, incomingPerson, extra);
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

function getOrCreateTeam(
  personDatabase: PersonDatabase,
  entrant: TournamentSet['entrants'][0],
): Partial<Person> {
  const foundPeople = personDatabase.findByFullName(entrant.name);
  if (foundPeople.length == 1) {
    return foundPeople[0];
  }

  return { handle: entrant.name };
}
