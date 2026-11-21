import { useEffect, useRef } from 'react';
import { AD_CLIENT, loadAdScript, requestAd } from '@/lib/ads';

export function SideAd({ slot }: { slot: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    loadAdScript();
    if (ref.current) requestAd(ref.current);
  }, []);
  return (
    <aside
      aria-label="광고"
      className="sticky top-[calc(var(--header-h,56px)+24px)] mt-6 w-[160px] shrink-0 self-start bg-app lg:mt-8"
    >
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', width: 160 }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
