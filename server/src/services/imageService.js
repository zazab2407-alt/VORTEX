import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_INPUT_PIXELS = 40_000_000; // refuses decompression bombs
const DIR = path.join(config.uploadsDir, 'products');
const URL_RE = /^\/uploads\/products\/[a-f0-9]{32}\.webp$/;

/**
 * The file's real content decides, never its name or declared type: it must decode as JPEG, PNG or WebP. It is then
 * re-encoded to a resized WebP, which strips metadata (e.g. GPS) and any payload hidden in the original bytes.
 * The stored name is random, so user input never reaches the filesystem path.
 */
export async function saveProductImage(buffer) {
  const open = () => sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
  let meta;
  try { meta = await open().metadata(); } catch { throw ApiError.badRequest('That file is not a valid image'); }
  if (!ALLOWED_FORMATS.has(meta.format)) throw ApiError.badRequest('Only JPEG, PNG and WebP images are allowed');
  if ((meta.pages ?? 1) > 1) throw ApiError.badRequest('Animated images are not allowed');

  let out;
  try {
    out = await open().rotate().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch { throw ApiError.badRequest('That image could not be processed'); }

  await fs.mkdir(DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.webp`;
  await fs.writeFile(path.join(DIR, name), out.data, { flag: 'wx' });
  return { url: `/uploads/products/${name}`, width: out.info.width, height: out.info.height, size: out.info.size };
}

/** Deletes an uploaded file once no product or category uses it any more. Anything that is not one of our files is ignored. */
export async function deleteUploadIfUnused(url) {
  if (!URL_RE.test(url ?? '')) return;
  const { Product, Category } = await import('../models/index.js');
  if (await Product.exists({ images: url }) || await Category.exists({ image: url })) return;
  await fs.unlink(path.join(DIR, path.basename(url))).catch((e) => { if (e.code !== 'ENOENT') throw e; });
}
