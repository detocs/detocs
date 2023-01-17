export function decodeBase64(imageData: string): Buffer {
  return Buffer.from(imageData.substring(22), 'base64');
}

export function parseHeight(data: Buffer): number {
  return data.readUInt32BE(20);
}

export function parseWidth(data: Buffer): number {
  return data.readUInt32BE(16);
}
