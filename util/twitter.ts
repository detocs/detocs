import log4js from 'log4js';
const logger = log4js.getLogger('util/twitter');

import Twit, { Twitter } from 'twit';

import { User } from '../models/twitter';

import { sleep } from './async';
import { getOauth1 } from './oauth';

interface MediaStatusResponse {
  media_id_string: string;
  processing_info?: {
    state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
    check_after_secs: number;
    progress_percent: number;
    error?: {
      code: number;
      name: string;
      message: string;
    };
  };
}

export async function getUser(twit: Twit): Promise<User> {
  const { data } = await twit.get(
    'account/verify_credentials',
    { 
      'include_entities': false,
      'skip_status': true,
      'include_email': false,
    });
  const user = data as Twitter.User;
  return {
    id: user['id_str'],
    name: user['name'],
    handle: user['screen_name'],
    avatar: user['profile_image_url_https'],
  };
}

export async function tweet(
  twit: Twit,
  body: string,
  replyTo: string | null,
  mediaPath?: string,
): Promise<string> {
  const params: Twit.Params = {
    'status': body,
  };
  if (replyTo) {
    Object.assign(params, {
      'in_reply_to_status_id': replyTo,
      'auto_populate_reply_metadata': true,
    });
  }
  if (mediaPath) {
    Object.assign(params, {
      'media_ids': [await uploadMedia(twit, mediaPath)],
    });
  }
  const { data } = await twit.post('statuses/update', params);
  const status = data as Twitter.Status;
  logger.debug(`Tweet created with id ${status.id_str}`);
  return status.id_str;
}

export async function uploadImageData(twit: Twit, imgData: string): Promise<string> {
  const { data } = await twit.post(
    'media/upload',
    {
      'media_data': imgData,
    });
  const resp = data as Record<string, string>;
  const mediaId = resp['media_id_string'];
  logger.debug(`Media uploaded with id ${mediaId}`);
  return mediaId;
}

export async function uploadMedia(twit: Twit, mediaPath: string): Promise<string> {
  logger.debug(`Uploading ${mediaPath}`);
  const upload = new Promise((resolve, reject) => {
    twit.postMediaChunked({ 'file_path': mediaPath }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
  let resp = (await upload) as MediaStatusResponse;
  logger.debug(resp);
  const mediaId = resp.media_id_string;

  // https://github.com/ttezel/twit/issues/517
  await pollMediaStatus(twit, resp);

  logger.debug(`Media uploaded with id ${mediaId}`);
  return mediaId;
}

async function pollMediaStatus(twit: Twit, resp: MediaStatusResponse): Promise<void> {
  const mediaId = resp.media_id_string;

  while (resp.processing_info &&
    resp.processing_info.state !== 'succeeded' &&
    resp.processing_info.state !== 'failed'
  ) {
    logger.debug(`Media processing, waiting ${resp.processing_info.check_after_secs} seconds`);
    await sleep(1000 * resp.processing_info.check_after_secs);

    const res = await twit.get(
      'media/upload',
      {
        'command': 'STATUS',
        'media_id': mediaId
      } as Twit.Params);
    resp = res.data as MediaStatusResponse;
    logger.debug(resp);
  }
  
  if (resp.processing_info?.state === 'failed') {
    throw new Error(resp.processing_info?.error?.message);
  }
}
