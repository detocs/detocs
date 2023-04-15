// TODO: Remove once neverthrow is upgraded
import { err, ok, Result, ResultAsync } from 'neverthrow';

const appendValueToEndOfList = <T>(value: T) => (list: T[]): T[] => [...list, value];

export const combineResultList = <T, E>(
  resultList: readonly Result<T, E>[],
): Result<readonly T[], E> =>
  resultList.reduce(
    (acc, result) =>
      acc.isOk()
        ? result.isErr()
          ? err(result.error)
          : acc.map(appendValueToEndOfList(result.value))
        : acc,
    ok([]) as Result<T[], E>,
  );

export const combineAsync = <T, E>(
  asyncResultList: readonly ResultAsync<T, E>[],
): ResultAsync<readonly T[], E> =>
  ResultAsync.fromSafePromise(Promise.all(asyncResultList)).andThen(
    combineResultList,
  ) as ResultAsync<T[], E>;
