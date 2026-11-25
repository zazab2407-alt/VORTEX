import multer from 'multer';
import ApiError from '../utils/ApiError.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Memory storage: nothing touches disk until the image has been decoded and re-encoded (see imageService). */
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
}).single('image');

/**
 * Same middleware as before, with one addition: a request the multipart parser cannot read (truncated body, malformed part
 * header, missing boundary...) is the client's mistake, so it becomes a 400 instead of an unexplained 500. MulterError
 * (size and count limits) and errors that already carry a status are passed through unchanged; parser internals are never echoed.
 */
export const uploadImage = (req, res, next) => parser(req, res, (err) => {
  if (!err) return next();
  if (err instanceof multer.MulterError || err.status || err.statusCode) return next(err);
  return next(ApiError.badRequest('The upload could not be read. Send one image as multipart form data (field "image").'));
});
