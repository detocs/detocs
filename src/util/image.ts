export function pngDataUri(image: Buffer): string {
  return `data:image/png;base64,${image.toString('base64')}`;
}

export function dataFromUri(uri: string): string {
  return uri.replace(/data:image\/\w+;base64,/, '');
}
