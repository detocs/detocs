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

export async function tweet(twit: Twit, body: string): Promise<string> {
  const { data } = await twit.post(
    'statuses/update',
    { 
      'status': body,
    });
  const status = data as Twitter.Status;
  return status.id_str;
}
