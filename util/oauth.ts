import crypto from 'crypto';
import OAuth from 'oauth-1.0a';

export function getOauth1(apiKey: string, apiKeySecret: string): OAuth {
  return new OAuth({
    consumer: {
      key: apiKey,
      secret: apiKeySecret,
    },
    'signature_method': 'HMAC-SHA1',
    'hash_function'(baseString, key) {
      return crypto
        .createHmac('sha1', key)
        .update(baseString)
        .digest('base64');
    },
  });
}
