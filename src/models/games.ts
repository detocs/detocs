import Game from './game';

// TODO: Use separate IDs for separate releases?
const games: Game[] = [
  {
    id: 'uni',
    name: 'Under Night In-Birth Exe:Late[cl-r]',
    shortNames: [
      'Under Night In-Birth',
      'Under Night',
      'UNIclr',
    ],
    hashtags: [
      'UNIclr',
      'inbirth',
    ],
    additionalTags: ['Under Night In-Birth', 'Under Night'],
    serviceInfo: {
      twitch: { id: 'Under Night In-Birth Exe:Late[cl-r]' },
      smashgg: { id: '33870' },
      challonge: { id: '186168' },
    },
  },
  {
    id: 'melty',
    name: 'Melty Blood Actress Again Current Code',
    shortNames: [
      'Melty Blood',
      'Melty',
    ],
    hashtags: [
      'MBAACC',
      'メルブラ',
    ],
    additionalTags: ['Melty Blood', 'Melty'],
    serviceInfo: {
      twitch: { id: 'Melty Blood: Actress Again: Current Code' },
      smashgg: { id: '22407' },
      challonge: { id: '306' },
    },
  },
  {
    id: 'bbcf',
    name: 'Blazblue Central Fiction',
    shortNames: [
      'Blazblue',
      'BBCF',
    ],
    hashtags: [
      'BBCF',
    ],
    serviceInfo: {
      twitch: { id: 'BlazBlue: Central Fiction' },
      smashgg: { id: '37' },
    },
  },
  {
    id: 'ss7',
    name: 'Samurai Shodown',
    shortNames: [
      'SamSho 7',
      'SS7',
    ],
    hashtags: [
      'SamSho',
      'EmbraceDeath',
    ],
    serviceInfo: {
      twitch: { id: 'Samurai Shodown' },
      smashgg: { id: '3568' },
    },
  },
  {
    id: 'ssv',
    name: 'Samurai Shodown V Special',
    shortNames: [
      'Samurai Shodown V',
      'SamSho 5',
      'SSVSP',
    ],
    hashtags: [
      'SSVSP',
      'SamSho',
    ],
    serviceInfo: {
      twitch: { id: 'Samurai Shodown V Special' },
      smashgg: { id: '16391' },
    },
  },
  {
    id: 'kofxiii',
    name: 'The King of Fighters XIII',
    shortNames: [
      'King of Fighters XIII',
      'KOF XIII',
    ],
    hashtags: [
      'KOFXIII',
      'KOF',
    ],
    serviceInfo: {
      twitch: { id: 'The King of Fighters XIII' },
      smashgg: { id: '9690' },
    },
  },
  {
    id: 'dfc',
    name: 'Dengeki Bunko Fighting Climax: Ignition',
    shortNames: [
      'Dengeki Bunko Fighting Climax',
      'Dengeki Bunko',
      'DFCI',
    ],
    hashtags: [
      'DFCI',
    ],
    serviceInfo: {
      twitch: { id: 'Dengeki Bunko: Fighting Climax Ignition' },
      smashgg: { id: '4267' },
    },
  },
  {
    id: 'kof98',
    name: 'The King of Fighters \'98',
    shortNames: [
      'King of Fighters 98',
      'KOF 98',
    ],
    hashtags: [
      'KOF98',
      'KOF',
    ],
    additionalTags: ['KOF98'],
    serviceInfo: {
      twitch: { id: 'The King of Fighters \'98: The Slugfest' },
      smashgg: { id: '2804' },
    },
  },
  {
    id: 'kof98um',
    name: 'The King of Fighters \'98: UMFE',
    shortNames: [
      'King of Fighters 98 UMFE',
      'KOF 98 UMFE',
    ],
    hashtags: [
      'KOF98',
      'KOF',
    ],
    additionalTags: ['KOF98', 'KOF98UM'],
    serviceInfo: {
      twitch: { id: 'The King of Fighters \'98 Ultimate Match' },
      smashgg: { id: '17413' },
    },
  },
  {
    id: 'sg',
    name: 'Skullgirls 2nd Encore',
    shortNames: [
      'Skullgirls',
      'SG2E',
    ],
    hashtags: [
      'Skullgirls',
    ],
    serviceInfo: {
      twitch: { id: 'Skullgirls' },
      smashgg: { id: '32' },
      challonge: { id: '367' },
    },
  },
  {
    id: 'sc6',
    name: 'SOULCALIBUR VI',
    shortNames: [
      'SC6',
    ],
    hashtags: [
      'SOULCALIBURVI',
      'SC6',
      'ソウルキャリバー',
    ],
    serviceInfo: {
      twitch: { id: 'Soulcalibur VI' },
      smashgg: { id: '904' },
    },
  },
  {
    id: 't7',
    name: 'Tekken 7',
    shortNames: [
      'T7',
    ],
    hashtags: [
      'TEKKEN7',
    ],
    serviceInfo: {
      twitch: { id: 'Tekken 7' },
      smashgg: { id: '17' },
    },
  },
  {
    id: 'kofxiv',
    name: 'The King of Fighters XIV',
    shortNames: [
      'King of Fighters XIV',
      'KOF XIV',
    ],
    hashtags: [
      'KOFXIV',
      'KOF',
    ],
    additionalTags: ['King of Fighters XIV', 'King of Fighters 14', 'King of Fighters', 'KOF14'],
    serviceInfo: {
      twitch: { id: 'The King of Fighters XIV' },
      smashgg: { id: '38' },
    },
  },
  {
    id: 'garou',
    name: 'Garou: Mark of the Wolves',
    shortNames: [
      'Garou',
    ],
    hashtags: [
      'GarouMOTW',
      'MOTW',
      'Garou',
    ],
    serviceInfo: {
      twitch: { id: 'Garou: Mark of the Wolves' },
      smashgg: { id: '10838' },
    },
  },
  {
    id: 'kof02',
    name: 'The King of Fighters 2002: UM',
    shortNames: [
      'King of Fighters 2002 UM',
      'KOF 2002 UM',
    ],
    hashtags: [
      'KOF2K2UM',
      'KOF2002',
      'KOF',
    ],
    serviceInfo: {
      twitch: { id: 'The King of Fighters 2002 Unlimited Match' },
      smashgg: { id: '33632' },
    },
  },
  {
    id: 'ffs',
    name: 'Fatal Fury Special',
    shortNames: [
      'Fatal Fury SP',
    ],
    hashtags: [
      'FatalFurySpecial',
      'FatalFury',
    ],
    serviceInfo: {
      twitch: { id: 'Fatal Fury Special' },
      smashgg: { id: '8093' },
    },
  },
  {
    id: 'gbvs',
    name: 'Granblue Fantasy: Versus',
    shortNames: [
      'Granblue Versus',
      'Granblue',
    ],
    hashtags: [
      'GBVS',
    ],
    additionalTags: ['Granblue Fantasy', 'Granblue', 'GBFV'],
    serviceInfo: {
      twitch: { id: 'Granblue Fantasy: Versus' },
      smashgg: { id: '22107' },
    },
  },
];
export default games;

export function getGameById(id: string): Game | null {
  return games.find(g => g.id === id) || null;
}

export function getGameByServiceId(
  serviceName: string,
  id: string,
): Game | null {
  return games.find(g => g.serviceInfo[serviceName]?.id === id) || null;
}

export function getGameBySmashggId(id: string): Game | null {
  return getGameByServiceId('smashgg', id);
}

export function getGameByChallongeId(id: string): Game | null {
  return getGameByServiceId('challonge', id);
}
