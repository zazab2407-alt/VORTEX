/** Demo catalogue: 8 categories, 40 sportswear products, demo reviewers and coupons. */
const img = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

// Each ID verified live on unsplash.com (see client/src/data/images.ts for what every photo shows)
const POOLS = {
  men: ['photo-1517836357463-d25dfeac3438', 'photo-1599058917212-d750089bc07e', 'photo-1517838277536-f5f99be501cd', 'photo-1521804906057-1df8fdb718b7', 'photo-1788004001463-2576f91f511e', 'photo-1772450014551-3dae12d905ef'],
  women: ['photo-1434682881908-b43d0467b798', 'photo-1541534741688-6078c6bfb5c5', 'photo-1591258370814-01609b341790', 'photo-1574680096145-d05b474e2155', 'photo-1722925541142-5db2668ca492', 'photo-1761839258420-5c3e2f2e2a74'],
  gear: ['photo-1761946356399-8335dbdce394', 'photo-1758223520369-c6a215d6aedb', 'photo-1583454110551-21f2fa2afe61', 'photo-1782849206110-4a47f5acb1f0'],
};
const pick = (pool, start) => [0, 1, 2].map((o) => img(POOLS[pool][(start + o) % POOLS[pool].length]));

export const CATEGORIES = [
  { name: 'Tops', description: 'Performance tees, tanks and training tops.', image: img(POOLS.men[2], 800) },
  { name: 'Bottoms', description: 'Shorts, joggers and leggings built to move.', image: img(POOLS.women[2], 800) },
  { name: 'Hoodies & Jackets', description: 'Warm-ups, layers and weather protection.', image: img(POOLS.men[4], 800) },
  { name: 'Sports Bras', description: 'Support for every level of impact.', image: img(POOLS.women[0], 800) },
  { name: 'Accessories', description: 'Bags, bottles, caps and training gear.', image: img(POOLS.gear[0], 800) },
  { name: 'Swimwear', description: 'Chlorine-resistant training swimwear and swim accessories.', image: img(POOLS.women[4], 800) },
  { name: 'Running Essentials', description: 'Lightweight running tees, shorts and reflective gear.', image: img(POOLS.men[1], 800) },
  { name: 'Yoga & Studio', description: 'Flexible studio wear for yoga, Pilates and mobility work.', image: img(POOLS.women[1], 800) },
];

const C = {
  black: { name: 'Black', hex: '#0A0A0A' }, white: { name: 'White', hex: '#F5F5F5' }, orange: { name: 'Orange', hex: '#FF5A1F' },
  grey: { name: 'Grey', hex: '#6B7280' }, navy: { name: 'Navy', hex: '#1E293B' }, olive: { name: 'Olive', hex: '#4D5A3F' }, sand: { name: 'Sand', hex: '#D6C7A8' },
};
const MEN = ['S', 'M', 'L', 'XL', 'XXL'];
const WOMEN = ['XS', 'S', 'M', 'L', 'XL'];
const ONE = ['One Size'];

const p = (o) => o;
export const PRODUCTS = [
  p({ name: 'Apex Performance Tee', category: 'Tops', gender: 'men', price: 34, sizes: MEN, colors: [C.black, C.white, C.orange], pool: 'men', start: 0, sold: 940, featured: true, daysAgo: 120,
    description: 'Ultra-light moisture-wicking tee with an athletic cut and flatlock seams to prevent chafing. Built for heavy sessions and long runs alike.' }),
  p({ name: 'Surge Training Shorts', category: 'Bottoms', gender: 'men', price: 42, salePrice: 34, sizes: MEN, colors: [C.black, C.navy, C.grey], pool: 'men', start: 2, sold: 610, daysAgo: 90,
    description: 'Quick-dry 7-inch training shorts with a zip pocket and a liner-free design. Four-way stretch for squats, sprints and everything between.' }),
  p({ name: 'Titan Compression Tank', category: 'Tops', gender: 'men', price: 30, sizes: MEN, colors: [C.black, C.olive], pool: 'men', start: 3, sold: 280, daysAgo: 6,
    description: 'Second-skin compression tank that supports muscles and keeps you cool. Reflective VORTEX mark for low-light visibility.' }),
  p({ name: 'Momentum Tech Hoodie', category: 'Hoodies & Jackets', gender: 'men', price: 79, sizes: MEN, colors: [C.black, C.grey, C.orange], pool: 'men', start: 1, sold: 1210, featured: true, daysAgo: 150,
    description: 'Heavyweight brushed-fleece hoodie with a structured hood and kangaroo pocket. Warm-up essential and post-gym favourite.' }),
  p({ name: 'Velocity Joggers', category: 'Bottoms', gender: 'men', price: 64, salePrice: 49, sizes: MEN, colors: [C.black, C.navy, C.sand], pool: 'men', start: 4, sold: 450, daysAgo: 75,
    description: 'Tapered training joggers with zip ankles and secure side pockets. Lightweight stretch fabric that moves with you.' }),
  p({ name: 'Stealth Windrunner Jacket', category: 'Hoodies & Jackets', gender: 'men', price: 119, sizes: MEN, colors: [C.black, C.orange], pool: 'men', start: 5, sold: 190, daysAgo: 4,
    description: 'Packable water-resistant windbreaker with reflective detailing and a ventilated back panel. Made for early-morning runs.' }),
  p({ name: 'Aura Seamless Sports Bra', category: 'Sports Bras', gender: 'women', price: 38, sizes: WOMEN, colors: [C.black, C.sand, C.orange], pool: 'women', start: 0, sold: 1500, featured: true, daysAgo: 140,
    description: 'Medium-support seamless bra with a soft, sculpting knit and removable pads. Zero distractions, all-day comfort.' }),
  p({ name: 'Flux High-Waist Leggings', category: 'Bottoms', gender: 'women', price: 68, sizes: WOMEN, colors: [C.black, C.navy, C.olive, C.grey], pool: 'women', start: 1, sold: 1820, featured: true, daysAgo: 160,
    description: 'Sculpting high-waist leggings in squat-proof, buttery-soft fabric. Hidden waistband pocket and flatlock seams.' }),
  p({ name: 'Pulse Cropped Hoodie', category: 'Hoodies & Jackets', gender: 'women', price: 72, sizes: WOMEN, colors: [C.grey, C.sand, C.black], pool: 'women', start: 2, sold: 160, daysAgo: 8,
    description: 'Relaxed cropped hoodie in soft-touch fleece with a dropped shoulder. Layers over any training set.' }),
  p({ name: 'Nova Training Shorts', category: 'Bottoms', gender: 'women', price: 36, salePrice: 29, sizes: WOMEN, colors: [C.black, C.orange, C.navy], pool: 'women', start: 3, sold: 520, daysAgo: 100,
    description: 'Lightweight 5-inch shorts with a bonded waistband and no-ride-up hem. Built for speed and flexibility.' }),
  p({ name: 'Elevate Longline Bra', category: 'Sports Bras', gender: 'women', price: 44, sizes: WOMEN, colors: [C.black, C.white, C.olive], pool: 'women', start: 4, sold: 140, daysAgo: 3,
    description: 'Longline high-support bra with a criss-cross back and moisture-wicking lining. Perfect for HIIT and studio sessions.' }),
  p({ name: 'Drift Oversized Tee', category: 'Tops', gender: 'women', price: 32, sizes: WOMEN, colors: [C.white, C.black, C.sand], pool: 'women', start: 5, sold: 330, daysAgo: 60,
    description: 'Drop-shoulder oversized tee in heavyweight cotton blend. Gym-to-street comfort with a clean, premium finish.' }),
  p({ name: 'Core Duffel Bag', category: 'Accessories', gender: 'unisex', price: 59, sizes: ONE, colors: [C.black, C.navy], pool: 'gear', start: 0, sold: 260, daysAgo: 110,
    description: '40L water-resistant duffel with a ventilated shoe compartment and padded shoulder strap. Your gym day, organised.' }),
  p({ name: 'Grip Training Gloves', category: 'Accessories', gender: 'unisex', price: 24, sizes: ['S', 'M', 'L'], colors: [C.black, C.grey], pool: 'gear', start: 2, sold: 200, daysAgo: 130,
    description: 'Padded palm gloves with breathable mesh back and wrist support. Protect your hands without losing feel.' }),
  p({ name: 'Vortex Pro Cap', category: 'Accessories', gender: 'unisex', price: 26, salePrice: 20, sizes: ONE, colors: [C.black, C.white, C.orange], pool: 'gear', start: 3, sold: 380, daysAgo: 95,
    description: 'Lightweight performance cap with a moisture-wicking sweatband and adjustable strap. Embroidered VORTEX logo.' }),
  p({ name: 'Hydra Shaker Bottle', category: 'Accessories', gender: 'unisex', price: 18, sizes: ONE, colors: [C.black, C.orange, C.white], pool: 'gear', start: 1, sold: 700, daysAgo: 12,
    description: 'Leak-proof 700ml shaker with a steel mixing ball and carry loop. BPA-free and dishwasher safe.' }),

  // ---- Swimwear (6) ----
  p({ name: 'Tide Racerback Swimsuit', category: 'Swimwear', gender: 'women', price: 52, sizes: WOMEN, colors: [C.black, C.navy], pool: 'women', start: 0, sold: 180, featured: true, daysAgo: 2,
    description: 'Chlorine-resistant racerback swimsuit with a full lining and a secure, low-cut back. Built for lap sessions and open water.' }),
  p({ name: 'Current Swim Shorts', category: 'Swimwear', gender: 'men', price: 44, sizes: MEN, colors: [C.navy, C.black], pool: 'men', start: 0, sold: 150, daysAgo: 60,
    description: 'Quick-dry 16-inch swim shorts with a mesh liner and a drawcord waist. Chlorine-resistant fabric that keeps its shape.' }),
  p({ name: 'Riptide Training Swim Trunks', category: 'Swimwear', gender: 'men', price: 48, sizes: MEN, colors: [C.black, C.orange, C.grey], pool: 'men', start: 1, sold: 210, daysAgo: 45,
    description: 'Fitted training trunks with a zip pocket and a stretch waistband. Designed for pool sessions and quick changes.' }),
  p({ name: 'Pacific Swim Cap', category: 'Swimwear', gender: 'unisex', price: 14, sizes: ONE, colors: [C.black, C.white], pool: 'gear', start: 2, sold: 300, daysAgo: 80,
    description: 'Silicone swim cap with a snug, comfortable fit that protects hair from chlorine. Lightweight and easy to pull on.' }),
  p({ name: 'Lagoon Two-Piece Set', category: 'Swimwear', gender: 'women', price: 62, salePrice: 49, sizes: WOMEN, colors: [C.navy, C.sand], pool: 'women', start: 3, sold: 240, daysAgo: 35,
    description: 'Two-piece training set with a supportive crop top and high-rise bottoms. Soft-touch fabric that dries quickly after a swim.' }),
  p({ name: 'Dryline Swim Towel', category: 'Swimwear', gender: 'unisex', price: 28, sizes: ONE, colors: [C.orange, C.navy], pool: 'gear', start: 0, sold: 130, daysAgo: 70,
    description: 'Quick-dry microfibre towel that folds into a compact pouch. Absorbent, light and ideal for the pool bag.' }),

  // ---- Running Essentials (9) ----
  p({ name: 'Sprint Split Shorts', category: 'Running Essentials', gender: 'men', price: 46, sizes: MEN, colors: [C.black, C.navy], pool: 'men', start: 4, sold: 390, daysAgo: 85,
    description: 'Lightweight 5-inch split shorts with an inner brief and a zip-free pocket. Built for tempo runs and race day.' }),
  p({ name: 'Stride Singlet', category: 'Running Essentials', gender: 'men', price: 32, sizes: MEN, colors: [C.white, C.orange, C.black], pool: 'men', start: 5, sold: 520, featured: true, daysAgo: 10,
    description: 'Breathable racing singlet with mesh side panels and a reflective logo. Light enough to forget you are wearing it.' }),
  p({ name: 'Aero Half-Zip Pullover', category: 'Running Essentials', gender: 'men', price: 58, sizes: MEN, colors: [C.grey, C.navy], pool: 'men', start: 0, sold: 260, daysAgo: 95,
    description: 'Thermal half-zip pullover with thumb loops and a stand collar. Keeps you warm at the start line and dries fast.' }),
  p({ name: 'Lumen Reflective Vest', category: 'Running Essentials', gender: 'unisex', price: 36, sizes: ['S', 'M', 'L'], colors: [C.orange, C.black], pool: 'gear', start: 1, sold: 170, daysAgo: 55,
    description: 'Lightweight high-visibility running vest with reflective strips and a zip pocket. Made for early and late runs.' }),
  p({ name: 'Trail Runner Belt', category: 'Running Essentials', gender: 'unisex', price: 22, sizes: ONE, colors: [C.black, C.orange], pool: 'gear', start: 3, sold: 230, daysAgo: 65,
    description: 'Slim hydration-free belt with two elasticated pockets for gels and keys. Stays flat against the body on long trail runs.' }),
  p({ name: 'Cadence Crop Tee', category: 'Running Essentials', gender: 'women', price: 34, sizes: WOMEN, colors: [C.white, C.olive], pool: 'women', start: 2, sold: 310, daysAgo: 75,
    description: 'Cropped running tee with flatlock seams and a breathable knit. Fitted through the waist and light on hot days.' }),
  p({ name: 'Pace Running Tights', category: 'Running Essentials', gender: 'women', price: 58, salePrice: 46, sizes: WOMEN, colors: [C.black, C.navy], pool: 'women', start: 4, sold: 280, daysAgo: 50,
    description: 'Compression running tights with a high waist, a back pocket and reflective details. Supports muscles on long miles.' }),
  p({ name: 'Zephyr Running Jacket', category: 'Running Essentials', gender: 'women', price: 112, sizes: WOMEN, colors: [C.black, C.orange], pool: 'women', start: 5, sold: 90, daysAgo: 7,
    description: 'Packable water-resistant running jacket with a ventilated back and a hood that stows in the collar. Made for changing weather.' }),
  p({ name: 'Insight Running Socks (3-Pack)', category: 'Running Essentials', gender: 'unisex', price: 20, sizes: ['S', 'M', 'L'], colors: [C.black, C.white, C.grey], pool: 'gear', start: 2, sold: 410, daysAgo: 40,
    description: 'Cushioned crew running socks with arch support and a breathable mesh top. Sold as a three-pair pack.' }),

  // ---- Yoga & Studio (9) ----
  p({ name: 'Lotus Wide-Leg Pants', category: 'Yoga & Studio', gender: 'women', price: 64, sizes: WOMEN, colors: [C.black, C.olive, C.sand], pool: 'women', start: 1, sold: 480, featured: true, daysAgo: 90,
    description: 'Wide-leg studio pants in a soft, stretchy blend with a wide elastic waistband. Free movement for flows and stretches.' }),
  p({ name: 'Serene Yoga Top', category: 'Yoga & Studio', gender: 'women', price: 36, sizes: WOMEN, colors: [C.sand, C.olive, C.white], pool: 'women', start: 3, sold: 290, daysAgo: 66,
    description: 'Relaxed-fit yoga top with a scooped neck and a soft, breathable knit. Layers easily under a cardigan after class.' }),
  p({ name: 'Balance Pilates Bodysuit', category: 'Yoga & Studio', gender: 'women', price: 54, sizes: WOMEN, colors: [C.black, C.navy], pool: 'women', start: 5, sold: 175, daysAgo: 58,
    description: 'Fitted pilates bodysuit with a snap gusset and a smooth, supportive fit. Stays put through inversions and rolls.' }),
  p({ name: 'Flow Studio Jumpsuit', category: 'Yoga & Studio', gender: 'women', price: 78, salePrice: 62, sizes: WOMEN, colors: [C.olive, C.black], pool: 'women', start: 2, sold: 150, daysAgo: 33,
    description: 'One-piece studio jumpsuit with a racerback and a relaxed leg. Easy to wear from yoga class to coffee.' }),
  p({ name: 'Grounding Yoga Mat', category: 'Yoga & Studio', gender: 'unisex', price: 68, sizes: ONE, colors: [C.olive, C.sand, C.black], pool: 'gear', start: 3, sold: 120, daysAgo: 110,
    description: '5mm non-slip yoga mat with a natural rubber base and a cushioned surface. Includes a carry strap.' }),
  p({ name: 'Stretch Band Set', category: 'Yoga & Studio', gender: 'unisex', price: 19, sizes: ONE, colors: [C.orange, C.grey, C.black], pool: 'gear', start: 1, sold: 360, daysAgo: 42,
    description: 'Set of three resistance bands in light, medium and heavy strength. Use for mobility, pilates and warm-ups.' }),
  p({ name: 'Calm Oversized Crewneck', category: 'Yoga & Studio', gender: 'unisex', price: 66, sizes: ['S', 'M', 'L', 'XL'], colors: [C.sand, C.grey, C.white], pool: 'men', start: 2, sold: 200, daysAgo: 18,
    description: 'Heavyweight oversized crewneck in a brushed cotton blend. Soft enough for stretching and comfortable between sessions.' }),
  p({ name: 'Pose Lightweight Joggers', category: 'Yoga & Studio', gender: 'men', price: 60, sizes: MEN, colors: [C.black, C.olive], pool: 'men', start: 3, sold: 140, daysAgo: 88,
    description: 'Tapered lightweight joggers with a drawcord waist and side pockets. Made for studio sessions and easy recovery days.' }),
  p({ name: 'Ease Mobility Shorts', category: 'Yoga & Studio', gender: 'men', price: 40, salePrice: 32, sizes: MEN, colors: [C.sand, C.navy, C.black], pool: 'men', start: 1, sold: 220, daysAgo: 48,
    description: 'Soft stretch shorts with a flat waistband and an unrestricted leg. Built for mobility work and warm-ups.' }),
];

export const productImages = (prod) => pick(prod.pool, prod.start);

/** Deterministic demo stock: mostly healthy, with a few low-stock and sold-out variants to exercise the UI. */
export function demoVariants(slugLike, sizes, colors) {
  let h = 0;
  for (const ch of slugLike) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return sizes.flatMap((size, i) => colors.map((c, j) => {
    const v = (h + i * 7 + j * 13) % 14;
    return { size, color: c.name, stock: v < 2 ? 0 : v < 4 ? v : v + 2 };
  }));
}

export const REVIEWERS = ['Omar K.', 'Nour H.', 'Youssef A.', 'Mariam S.', 'Karim F.'];
export const REVIEW_POOL = [
  { rating: 5, title: 'Exactly what I wanted', comment: 'Great fit, great fabric. Washed it many times and it still looks brand new.' },
  { rating: 4, title: 'Very comfortable', comment: 'Comfortable and breathable. I would size up if you prefer a looser fit.' },
  { rating: 5, title: 'Worth every penny', comment: 'Quality feels far above the price. Already ordered a second one.' },
  { rating: 4, title: 'Solid gym staple', comment: 'Stays in place during workouts and dries quickly. Colour is true to the photos.' },
  { rating: 5, title: 'Top quality', comment: 'Stitching and finish are excellent. Feels like a proper international brand.' },
  { rating: 4, title: 'Great for running', comment: 'Light and breathable on long runs. Took a day to arrive, packaging was neat.' },
  { rating: 5, title: 'Love the fit', comment: 'True to size and flattering. Moves with me through every set.' },
  { rating: 3, title: 'Good, not perfect', comment: 'Nice material but the sizing runs slightly small for me. Support was helpful.' },
];

export const COUPONS = [
  { code: 'VORTEX10', type: 'percentage', value: 10 },
  { code: 'WELCOME15', type: 'percentage', value: 15, minSubtotal: 50 },
];
