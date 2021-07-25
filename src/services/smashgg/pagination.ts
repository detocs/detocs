import { GraphQLClient } from 'graphql-request';
import range from 'lodash.range';

import { getLogger } from '@util/logger';

import { MAX_COMPLEXITY, RATE_LIMIT, MAX_PAGE_SIZE } from './constants';
import { PageInfo } from './queries';

const logger = getLogger('services/smashgg/pagination');
const COMPLEXITY_SAFETY = 0.95;

export async function paginatedQuery<ResponseType, DataType>({
  client,
  query,
  params,
  extractor,
  defaultPageSize,
  complexityAdjuster,
}: {
  client: GraphQLClient,
  query: string,
  params: Record<string, unknown>,
  extractor: (resp: ResponseType) => ({
    nodes: DataType[] | null,
    pageInfo: Pick<PageInfo, 'total'|'totalPages'>,
  } | undefined),
  defaultPageSize?: number,
  complexityAdjuster?: (nodes: DataType[]) => number,
}): Promise<DataType[]> {
  // Initial query to get query complexity
  const rawResponse = await client.rawRequest(
    query,
    Object.assign({}, params, {
      perPage: defaultPageSize ?? null,
      page: 1,
    }),
  );
  logger.debug('Initial paginated response:', JSON.stringify(rawResponse, null, 2));
  const { data, extensions } = rawResponse;
  const pagedData = extractor(data as ResponseType);
  if (!pagedData) {
    logger.warn(`Unable to extract paged data from ${data}`);
    return []; // TODO: Return error?
  }
  if (pagedData.nodes == null) {
    logger.warn(`Paged data has no nodes ${data}`);
    return [];
  }

  const defaultPerPage = pagedData.nodes.length;
  const total = pagedData.pageInfo.total;
  const defaultTotalPages = pagedData.pageInfo.totalPages;
  if (defaultTotalPages <= 1) {
    return pagedData.nodes;
  }

  const unadjustedComplexity = extensions.queryComplexity;
  const complexityAdjustment = complexityAdjuster ? complexityAdjuster(pagedData.nodes) : 0;
  const defaultComplexity = unadjustedComplexity + complexityAdjustment;
  const optimalPerPage = Math.min(
    MAX_PAGE_SIZE,
    Math.floor(MAX_COMPLEXITY * COMPLEXITY_SAFETY / Math.ceil(defaultComplexity / defaultPerPage)),
  );
  const optimalTotalPages = Math.ceil(total / optimalPerPage);

  const remainingDefaultPages = defaultTotalPages - 1;
  const minTotalPages = Math.min(defaultTotalPages, optimalTotalPages + 1);
  logger.debug(`Paginated query, ${total} total items
Default: ${defaultTotalPages} @ ${defaultPerPage}/page, complexity: ${
  unadjustedComplexity
} + ${complexityAdjustment}
Optimized: ${optimalTotalPages} @ ${optimalPerPage}/page, predicted complexity: ${
  Math.ceil(defaultComplexity / defaultPerPage) * optimalPerPage
}`);
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
      .map(page => client.rawRequest<ResponseType>(
        query,
        Object.assign({}, params, {
          perPage,
          page,
        }))))
      .then(responses => responses
        .map(resp => {
          logger.debug(`Actual complexity: ${resp.extensions.queryComplexity}`);
          return resp;
        })
        .map(resp => extractor(resp.data as ResponseType)?.nodes ?? [])
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
