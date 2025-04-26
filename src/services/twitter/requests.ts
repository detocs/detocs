import { promises as fs } from 'fs';
import { extname } from 'path';

import { Error as ChainableError } from 'chainable-error';
import { err, ok, okAsync, Result, ResultAsync } from 'neverthrow';
import { EUploadMimeType, SendTweetV2Params, TweetV2, TwitterApiReadWrite } from 'twitter-api-v2';
import { MediaV2MediaCategory } from 'twitter-api-v2/dist/esm/types/v2/media.v2.types';
import { DataV2 } from 'twitter-api-v2/dist/esm/types/v2/shared.v2.types';

import { User } from '@services/twitter/types';
import { getLogger } from '@util/logger';
import { combineAsync } from '@util/results';

const logger = getLogger('services/twitter');

export function getUser(client: TwitterApiReadWrite): ResultAsync<User, Error> {
  return ResultAsync.fromPromise(
    client.currentUserV2(),
    e => e as Error,
  )
    .map(res => ({
      id: res.data.id,
      name: res.data.name,
      handle: res.data.username,
      url: `https://twitter.com/${res.data.username}`,
      avatar: res.data.profile_image_url ?? null,
    }));
}

export function tweet(
  client: TwitterApiReadWrite,
  body: string,
  replyTo: string | null,
  mediaPath?: string,
): ResultAsync<string, Error> {
  const replyParams: ResultAsync<SendTweetV2Params, Error> = !replyTo ? okAsync({}) :
    okAsync({
      reply: {
        in_reply_to_tweet_id: replyTo,
      },
    });
  const mediaParams: ResultAsync<SendTweetV2Params, Error> = !mediaPath ? okAsync({}) :
    uploadMedia(client, mediaPath)
      .map<SendTweetV2Params>(
      mediaIds => ({
        media: {
          media_ids: [mediaIds],
        },
      }))
      .mapErr(err => new ChainableError(`Unable to upload media ${mediaPath}`, err));
  return combineAsync([replyParams, mediaParams])
    .map<SendTweetV2Params>(paramsList => Object.assign({} as SendTweetV2Params, ...paramsList))
    .andThen(params => ResultAsync.fromPromise(
      client.v2.tweet(body, params),
      e => e as Error,
    ))
    .andThen(parseData)
    .map(({id}) => {
      logger.debug(`Tweet created with id ${id}`);
      return id;
    });
}

function parseData<D>(resp: DataV2<D>): Result<D, Error> {
  if (resp.errors?.length) {
    return err(new Error(JSON.stringify(resp.errors, null, 2)));
  } else {
    return ok(resp.data);
  }
}

export function getTweet(client: TwitterApiReadWrite, id: string): ResultAsync<TweetV2, Error> {
  return ResultAsync.fromPromise(
    client.v2.singleTweet(id, { expansions: 'entities.mentions.username' }),
    e => e as Error,
  )
    .andThen(parseData);
}

export function uploadMedia(
  client: TwitterApiReadWrite,
  mediaPath: string,
): ResultAsync<string, Error> {
  const media_type = extentionToMimeType(extname(mediaPath));
  const media_category = mediaTypeToCategory(media_type);
  logger.debug(`Uploading ${mediaPath} with type ${media_type} and category ${media_category}`);

  // TODO: Get progress updates?
  return ResultAsync.fromPromise(
    fs.readFile(mediaPath),
    e => e as Error,
  )
    .andThen(buffer => ResultAsync.fromPromise(
      client.v2.uploadMedia(buffer, {media_type, media_category}),
      e => e as Error,
    ))
    .map(mediaId => {
      logger.debug(`Upload of ${mediaPath} complete with ID ${mediaId}`);
      return mediaId;
    });
}

function extentionToMimeType(ext: string): EUploadMimeType {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return EUploadMimeType.Jpeg;
    case '.png':
      return EUploadMimeType.Png;
    case '.webp':
      return EUploadMimeType.Webp;
    case '.gif':
      return EUploadMimeType.Gif;
    case '.mp4':
      return EUploadMimeType.Mp4;
    case '.mov':
      return EUploadMimeType.Mov;
    default:
      return "application/octet-stream" as EUploadMimeType;
  }
}
function mediaTypeToCategory(media_type: string): MediaV2MediaCategory|undefined {
  switch (media_type) {
    case EUploadMimeType.Jpeg:
    case EUploadMimeType.Png:
    case EUploadMimeType.Webp:
      return 'tweet_image';
    case EUploadMimeType.Gif:
      return 'tweet_gif';
    case EUploadMimeType.Mp4:
    case EUploadMimeType.Mov:
      return 'tweet_video';
    default:
      return undefined;
  }
}

