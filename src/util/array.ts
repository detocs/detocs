import countBy from 'lodash.countby';
import { sortNumbersDescending } from './sort';

export function mode(arr: string[]): string | null {
  const counts = countBy(arr);
  const sortedByCount = Object.keys(counts)
    .sort((a, b) => sortNumbersDescending(counts[a], counts[b]));
  return sortedByCount[0] ?? null;
}
