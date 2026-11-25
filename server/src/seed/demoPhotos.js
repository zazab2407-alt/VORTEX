// Which demo photo each product shows. Chosen by visual audit of the photo content, not the filename.
// Photos are in client/public/images/products/demo/photo-NN.webp (sources and licences: server/src/seed/demoImages.json).
//   photo-01..40  the original demo set, numbered by product position
//   photo-41..46  new permitted photos (male and female fitness models)
// Gender rule: men's products show male models or neutral equipment; women's products show female models or neutral
// equipment; unisex products show neutral or unisex imagery. Replace any photo from the admin product form.
export const PHOTO_BY_SLUG = {
  'apex-performance-tee': 'photo-42', // men: male model, gym floor
  'surge-training-shorts': 'photo-09', // men: male model
  'titan-compression-tank': 'photo-43', // men: male model, deadlift
  'momentum-tech-hoodie': 'photo-17', // men: male model
  'velocity-joggers': 'photo-39', // men: male model
  'stealth-windrunner-jacket': 'photo-41', // men: male model, push-ups
  'aura-seamless-sports-bra': 'photo-07', // women: female model
  'flux-high-waist-leggings': 'photo-01', // women: female model
  'pulse-cropped-hoodie': 'photo-14', // women: female model
  'nova-training-shorts': 'photo-02', // women: female model
  'elevate-longline-bra': 'photo-45', // women: female model
  'drift-oversized-tee': 'photo-15', // women: female model
  'core-duffel-bag': 'photo-34', // unisex: neutral
  'grip-training-gloves': 'photo-05', // unisex: neutral (hands)
  'vortex-pro-cap': 'photo-33', // unisex: neutral
  'hydra-shaker-bottle': 'photo-10', // unisex: neutral
  'tide-racerback-swimsuit': 'photo-28', // women: female model
  'current-swim-shorts': 'photo-19', // men: male model
  'riptide-training-swim-trunks': 'photo-20', // men: male model
  'pacific-swim-cap': 'photo-11', // unisex: neutral
  'lagoon-two-piece-set': 'photo-36', // women: female model
  'dryline-swim-towel': 'photo-12', // unisex: neutral
  'sprint-split-shorts': 'photo-24', // men: male model
  'stride-singlet': 'photo-16', // men: male model
  'aero-half-zip-pullover': 'photo-21', // men: neutral equipment
  'lumen-reflective-vest': 'photo-25', // unisex: neutral
  'trail-runner-belt': 'photo-04', // unisex: neutral
  'cadence-crop-tee': 'photo-37', // women: female model
  'pace-running-tights': 'photo-29', // women: female model
  'zephyr-running-jacket': 'photo-23', // women: female model
  'insight-running-socks-3-pack': 'photo-32', // unisex: neutral (feet)
  'lotus-wide-leg-pants': 'photo-31', // women: female model
  'serene-yoga-top': 'photo-46', // women: female model
  'balance-pilates-bodysuit': 'photo-44', // women: female model
  'flow-studio-jumpsuit': 'photo-35', // women: female model
  'grounding-yoga-mat': 'photo-03', // unisex: neutral
  'stretch-band-set': 'photo-08', // unisex: neutral
  'calm-oversized-crewneck': 'photo-30', // unisex: neutral
  'pose-lightweight-joggers': 'photo-18', // men: neutral equipment
  'ease-mobility-shorts': 'photo-13', // men: neutral equipment
};
export const demoPhotoPath = (photo) => `/images/products/demo/${photo}.webp`;
