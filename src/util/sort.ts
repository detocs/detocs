export type ComparisonFunction<T> = (a: T, b: T) => number;

export const sortNumbersAscending: ComparisonFunction<number> = (a, b) => a - b;

export const sortNumbersDescending: ComparisonFunction<number> = (a, b) => b - a;
