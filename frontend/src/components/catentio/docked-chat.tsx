'use client';

import { useCallback, useMemo, useState } from 'react';
import { LogoGlyph } from '@/components/brand/logo';
import { DockedChat, createBffChatAdapters, type ChatAction } from '@forjio/agent-ui';
import { catentioHttp } from '@/lib/catentio-http';
import { applyChatAction } from '@/components/catentio/chat-actions';
import { useCatentioStatus, ASSISTANT_ACTIVITY_EVENT } from '@/hooks/use-catentio';
import { ApiError } from '@/lib/api';

/**
 * The docked product chat — fulkruma's mount of the embedded agent
 * layer (linksnap's docked-chat.tsx is the reference). Renders nothing
 * unless the catentio pilot flag is on for this account (the backend
 * re-checks on every call regardless).
 */
export function CatentioDockedChat() {
  const { enabled } = useCatentioStatus();
  const [open, setOpen] = useState(false);
  // ONE adapter set per mount — an inline object per render would
  // restart the package's poll/save machinery.
  const adapters = useMemo(
    () => createBffChatAdapters(catentioHttp, { activityEventName: ASSISTANT_ACTIVITY_EVENT }),
    [],
  );

  const onApplyAction = useCallback(
    async (action: ChatAction, earlier: { action: ChatAction; result?: unknown }[]) => {
      try {
        return await applyChatAction(action, earlier);
      } catch (err) {
        // Surface what the SERVER said — a bare "Request failed" hides
        // the exact rejection the user needs to see on the card.
        throw new Error(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'That change could not be applied',
        );
      }
    },
    [],
  );

  if (!enabled) return null;

  // Insets mirror <main>'s padding so the dock lines up with the page
  // content (linksnap's layout decision, 2026-08-05). fulkruma's shell
  // pads `p-4 md:p-6`, so the step is at `md:` here — copying linksnap's
  // `sm:` verbatim left the dock 8px inside the content between 640 and
  // 767px. Expanded: full SCREEN below md (fixed inset-0 over
  // everything), full column height above it at the same content width.
  return (
    <div
      className={
        open
          ? 'fixed inset-0 z-50 flex flex-col md:absolute md:inset-x-6 md:bottom-6 md:top-6 md:z-40 md:mx-auto md:max-w-4xl'
          : 'absolute inset-x-4 bottom-4 z-40 mx-auto flex max-w-4xl flex-col md:inset-x-6 md:bottom-6'
      }
    >
      <DockedChat
        adapters={adapters}
        product="fulkruma"
        open={open}
        onOpenChange={setOpen}
        title="Fulkruma Assistant"
        // The assistant's bubble avatar. Served from public/ — until
        // 2026-08-19 this pointed at a file fulkruma never shipped, and
        // every reply carried the browser's broken-image glyph.
        avatarUrl="/apple-touch-icon.png"
        // The detached circle left of the resting dock, on the
        // product's primary fill (bang, 2026-08-06). The bare crates
        // glyph, not the tile: the slot supplies the red and expects
        // a lucide-weight icon in the contrast colour. The tile's own
        // #F22F46 rect and the circle's `--primary` are the same red to
        // within two points, so the tile simply disappeared into it.
        brandIcon={<LogoGlyph />}
        // Starter prompts on a new session (bang, 2026-08-08). Phrased as
        // the merchant talking, not as menu items, and drawn from what the
        // LIVE agent prompt says it can finish: the SETUP layer, meaning
        // `warehouses` (name/address/city/postal/phone) and `products`
        // (name/sku/type + the shipping box in GRAMS and CM). Stock,
        // shipments, deliveries, licenses, shipping credits, buyer
        // addresses, variants and prices are refused at the auth layer, so
        // no chip names one — a chip that opens on a refusal is worse than
        // no chip. Two writes and one read. Clicking SENDS.
        suggestions={[
          'Add our Jakarta warehouse with its address and phone',
          'Add a new product with its shipping weight and box size',
          'Show me my warehouses and products',
        ]}
        onApplyAction={onApplyAction}
      />
    </div>
  );
}
