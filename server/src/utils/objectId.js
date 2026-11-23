export const OBJECT_ID = /^[a-f0-9]{24}$/i;
export const isObjectId = (v) => typeof v === 'string' && OBJECT_ID.test(v);
