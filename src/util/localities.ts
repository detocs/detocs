import countries from 'i18n-iso-countries/index';
import countriesEn from 'i18n-iso-countries/langs/en.json';
import { iso31662 } from 'iso-3166';

countries.registerLocale(countriesEn);

// This will need to be redone to support i18n
const countryNames: { code: string; name: string }[] = Object.entries(
  countries.getNames('en', { select: 'alias' })
).map(([code, name]) => ({ code, name, }));

export function getCountries(): { code: string; name: string }[] {
  return countryNames;
}

export function getStates(countryCode: string): { code: string; name: string }[] {
  return iso31662.filter(e => e.parent === countryCode);
}

// TODO: Congo is an alias for both CG and CD
const nameToCountryCode = new Map(Object.entries(
  countries.getNames('en', { select: 'all' })
).flatMap(([code, names]) => names.map(name => [name.toLowerCase(), code])));

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
