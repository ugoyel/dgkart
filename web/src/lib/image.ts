/**
 * Shrinks a picked image in the browser before upload, so banners stay fast
 * on phones (and fit in demo mode's browser storage). GIFs are kept as they are.
 */
export async function prepareImage(file: File, maxSide = 1920, quality = 0.85): Promise<{ blob: Blob; name: string }> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Pick a JPG, PNG, WebP or GIF image');
  if (file.type === 'image/gif') {
    if (file.size > 5 * 1024 * 1024) throw new Error('GIFs must be under 5 MB');
    return { blob: file, name: file.name };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // PNGs keep transparency (cut-out product shots); photos become WebP.
  const type = file.type === 'image/png' ? 'image/png' : 'image/webp';
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), type, quality));
  const small = blob.size < file.size || scale < 1 ? blob : file;
  const ext = small.type === 'image/png' ? 'png' : small.type === 'image/webp' ? 'webp' : file.name.split('.').pop();
  return { blob: small, name: file.name.replace(/\.[^.]+$/, '') + '.' + ext };
}
