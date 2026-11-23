import { useEffect, useState } from 'react';
import { cartService } from '../services/shop';
import { setMoneyFormat } from '../utils/format';
import type { ShopConfig } from '../types';

/** Used only for the moment before the server answers (or if it cannot be reached). Matches the server's development defaults. */
export const DEFAULT_CONFIG: ShopConfig = {
  currency: 'USD', currencySymbol: '$', locale: 'en-US', storeName: 'VORTEX',
  shipping: { flatRate: 5, freeThreshold: 100 },
  contact: { formEnabled: false, email: null, phone: null, address: null },
  returns: { windowDays: null },
  promoCode: null,
};

let loaded: ShopConfig | null = null;
let cache: Promise<ShopConfig> | null = null;

function load() {
  cache ??= cartService.config()
    .then((c) => { loaded = { ...DEFAULT_CONFIG, ...c }; setMoneyFormat(loaded.currency, loaded.locale); return loaded; })
    .catch((e) => { cache = null; throw e; });
  return cache;
}

/** Store settings from the server plus whether they have actually arrived yet. */
export function useShopSettings() {
  const [state, setState] = useState({ config: loaded ?? DEFAULT_CONFIG, loaded: Boolean(loaded) });
  useEffect(() => {
    let live = true;
    load().then((config) => live && setState({ config, loaded: true })).catch(() => {});
    return () => { live = false; };
  }, []);
  return state;
}

/** Shipping rules, currency, contact details and return window come from the server; the defaults only cover the moment before they arrive. */
export const useShopConfig = () => useShopSettings().config;
