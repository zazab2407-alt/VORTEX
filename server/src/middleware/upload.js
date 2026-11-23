import multer from 'multer';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Memory storage: nothing touches disk until the image has been decoded and re-encoded (see imageService). */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
}).single('image');
