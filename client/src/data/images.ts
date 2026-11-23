// Demo photography, all served from Unsplash (free to use under the Unsplash License).
// Every ID below was confirmed live on unsplash.com on 2026-11-11, with the caption noted beside it,
// so each photo matches the section it is used in. Swap these for real product photos at delivery.
export const unsplash = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const POOLS = {
  men: [
    'photo-1517836357463-d25dfeac3438', // person about to lift the barbell
    'photo-1599058917212-d750089bc07e', // man exercising with battle ropes outdoors
    'photo-1517838277536-f5f99be501cd', // man holding black barbell
    'photo-1521804906057-1df8fdb718b7', // person lifting a heavy barbell from a rubber gym floor
    'photo-1788004001463-2576f91f511e', // person in a black tank top and cap lifting a dumbbell
    'photo-1772450014551-3dae12d905ef', // man performing a dumbbell squat in the gym
  ],
  women: [
    'photo-1434682881908-b43d0467b798', // woman in black sports bra working out at the gym
    'photo-1541534741688-6078c6bfb5c5', // woman doing weight lifting
    'photo-1591258370814-01609b341790', // woman in black tank top and black leggings on the floor
    'photo-1574680096145-d05b474e2155', // woman lifting barbell
    'photo-1722925541142-5db2668ca492', // a woman lifting a barbell in a gym
    'photo-1761839258420-5c3e2f2e2a74', // woman lifting weights in a gym
  ],
  gear: [
    'photo-1761946356399-8335dbdce394', // red sneakers and gym equipment on the floor
    'photo-1758223520369-c6a215d6aedb', // man in sleeveless shirt holding a water bottle
    'photo-1583454110551-21f2fa2afe61', // person in gray shirt holding a black dumbbell
    'photo-1782849206110-4a47f5acb1f0', // athletic woman walking in the gym with dumbbells
  ],
};

export const HERO_IMAGE = unsplash(POOLS.men[1], 2000); // battle ropes: movement, matches "Built to move"
export const MEN_BANNER = unsplash(POOLS.men[0], 1200);
export const WOMEN_BANNER = unsplash(POOLS.women[0], 1200);
export const PROMO_IMAGE = unsplash(POOLS.men[3], 1800);
export const GALLERY = [
  POOLS.men[4], POOLS.women[1], POOLS.men[5], POOLS.women[3], POOLS.gear[0], POOLS.women[5],
].map((id) => unsplash(id, 600));
