import crypto from 'crypto';

/**
 * Less-cryptic version of
 * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript/2117523#2117523
 */
export default function uuidv4(): string {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.randomFillSync(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}