import { GraphQLClient } from 'graphql-request';
import range from 'lodash.range';

import { MAX_COMPLEXITY, RATE_LIMIT, MAX_PAGE_SIZE } from './constants';
import { PageInfo } from './queries';

export async function paginatedQuery<ResponseType, DataType>({
  client,
  query,
  params,
  extractor,
  defaultPageSize,
}: {
  client: GraphQLClient,
  query: string,
  params: Record<string, unknown>,
  extractor: (resp: ResponseType) => {
    nodes: DataType[],
    pageInfo: Pick<PageInfo, 'total'|'totalPages'>,
  },
  defaultPageSize?: number,
}): Promise<DataType[]> {
  // initial quey to get asdfasdfsddf
  const { data, extensions } = await client.rawRequest(
    query,
    Object.assign({}, params, {
      perPage: defaultPageSize ?? null,
      page: 1,
    }),
  );
  const pagedData = extractor(data as ResponseType);
  const defaultPerPage = pagedData.nodes.length;
  const total = pagedData.pageInfo.total;
  const defaultTotalPages = pagedData.pageInfo.totalPages;

  if (defaultTotalPages <= 1) {
    return pagedData.nodes;
  }

  const defaultComplexity = extensions.queryComplexity;
  const optimalPerPage = Math.min(
    MAX_PAGE_SIZE,
    Math.floor(MAX_COMPLEXITY / Math.ceil(defaultComplexity / defaultPerPage)),
  );
  const optimalTotalPages = Math.ceil(total / optimalPerPage);

  const remainingDefaultPages = defaultTotalPages - 1;
  const minTotalPages = Math.min(defaultTotalPages, optimalTotalPages + 1);
  if (minTotalPages > RATE_LIMIT) {
    throw new Error(
      `Number of pages required for query (${minTotalPages}) will exceed smash.gg's rate limit`);
  }

  async function queryPages(
    array: DataType[],
    startPage: number,
    endPage: number,
    perPage: number,
  ): Promise<DataType[]> {
    return Promise.all(range(startPage, endPage + 1)
      .map(page => client.request<ResponseType>(
        query,
        Object.assign({}, params, {
          perPage,
          page,
        }))))
      .then(responses => responses
        .map(resp => extractor(resp).nodes)
        .reduce((arr1, arr2) => {
          Array.prototype.push.apply(arr1, arr2);
          return arr1;
        }, array));
  }
  if (optimalTotalPages < remainingDefaultPages) {
    return queryPages([], 1, optimalTotalPages, optimalPerPage);
  } else {
    return queryPages(pagedData.nodes, 2, defaultTotalPages, defaultPerPage);
  }
}
