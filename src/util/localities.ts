import countries from 'i18n-iso-countries/index';
import countriesEn from 'i18n-iso-countries/langs/en.json';
import { iso31662 } from 'iso-3166';
import groupBy from 'lodash.groupby';

interface RegionData {
  code: string;
  name: string;
}

countries.registerLocale(countriesEn);

// This will need to be redone to support i18n
const codeToAlias = countries.getNames('en', { select: 'alias' });
codeToAlias['GB'] = 'United Kingdom';
codeToAlias['CG'] = 'Congo Republic';
codeToAlias['CD'] = 'DR Congo';
const countryNames: RegionData[] = Object.entries(codeToAlias)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => ({ code, name }));

export function getCountries(): { code: string; name: string }[] {
  return countryNames;
}

const statesByCountry = Object.fromEntries(
  Object.entries(groupBy(iso31662, s => s.parent))
    .map(([countryCode, states]) => {
      return [countryCode, states.sort((a, b) => a.name.localeCompare(b.name))];
    })
);
export function getStates(countryCode: string): RegionData[] {
  return statesByCountry[countryCode] || [];
}

const allNames = countries.getNames('en', { select: 'all' });
allNames['CG'].push('Congo Republic');
allNames['CD'].push('DR Congo');
const nameToCountryCode = new Map(
  Object.entries(allNames)
    .flatMap(([code, names]) => names.map(name => [name.toLowerCase(), code]))
);

export function getCountryCodeFromName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  const code = nameToCountryCode.get(name.toLowerCase());
  return code || null;
}

export function getStateCodeFromName(
  countryCode: string | null | undefined,
  name: string | null | undefined,
): string | null {
  if (!countryCode || !name) {
    return null;
  }
  const state = iso31662.find(
    s => s.parent === countryCode &&
    (s.name.toLowerCase() === name.toLowerCase() ||
      s.code === `${countryCode}-${name.toUpperCase()}`)
  );
  return state ? state.code : null;
}
