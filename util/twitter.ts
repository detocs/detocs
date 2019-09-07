import Twit, { Twitter } from 'twit';

import { User } from '../models/twitter';

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

export async function tweet(twit: Twit, body: string, img?: string): Promise<string> {
  const mediaIds: string[] = [];
  if (img) {
    mediaIds.push(await uploadImage(twit, img));
  }
  const { data } = await twit.post(
    'statuses/update',
    { 
      'status': body,
      'media_ids': mediaIds,
    });
  const status = data as Twitter.Status;
  return status.id_str;
}

export async function uploadImage(twit: Twit, img: string): Promise<string> {
  const { data } = await twit.post(
    'media/upload',
    {
      'media_data': img,
    });
  const resp = data as Record<string, string>;
  return resp['media_id_string'];
}
