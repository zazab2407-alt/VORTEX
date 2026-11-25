// One place that decides where the locally hosted catalogue photos live. Used by the seed catalogue, the download script
// (scripts/fetch-images.mjs), the database updater (applyImages.js) and the tests, so they can never disagree.
// Files live in client/public/images/ and are served by the storefront itself at /images/...
export const PROFILES = {
  product: { w: 1000, h: 1250, smW: 500, smH: 625 },   // 4:5 portrait, the shape of every product card
  category: { w: 1200, h: 900, smW: 600, smH: 450 },   // 4:3
};
export const productImagePath = (slug, n) => `/images/products/${slug}/${n}.webp`;
export const categoryImagePath = (slug) => `/images/categories/${slug}.webp`;
export const siteImagePath = (key) => `/images/site/${key}.webp`;
/** Small variant of a local image: /images/x/1.webp -> /images/x/1-sm.webp (used for srcSet). */
export const smallVariant = (p) => p.replace(/\.webp$/, '-sm.webp');
/** Demo product photos: one per product, named after the product slug. Replace them from the admin product form. */
export const demoProductImagePath = (slug) => `/images/products/demo/${slug}.webp`;
/** Clean generated placeholder shown when a product or category has no photo. Never a stock photo. */
export const PLACEHOLDER_IMAGE = '/images/products/placeholder.webp';
export const LOCAL_IMAGE = /^\/images\/(products\/demo\/[a-z0-9-]+|products\/placeholder|categories\/[a-z0-9-]+|site\/[a-z0-9-]+)\.webp$/;
