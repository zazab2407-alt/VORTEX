/** Money is stored as plain numbers rounded to 2 decimals. */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
