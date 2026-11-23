import { useShopConfig } from '../hooks/useShopConfig';
import { freeShippingLabel } from '../utils/storeText';

export default function AnnouncementBar() {
  const c = useShopConfig();
  return (
    <div className="bg-brand px-4 py-2 text-center font-display text-sm font-bold uppercase tracking-widest text-white sm:text-base">
      <span className="sm:hidden">{freeShippingLabel(c)}{c.promoCode && <> &nbsp;|&nbsp; Code <span className="underline">{c.promoCode}</span></>}</span>
      <span className="hidden sm:inline">{freeShippingLabel(c)}{c.promoCode && <> &nbsp;|&nbsp; Use code <span className="underline">{c.promoCode}</span> at checkout</>}</span>
    </div>
  );
}
