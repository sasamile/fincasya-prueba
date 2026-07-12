'use client';

import { useEffect, useRef } from 'react';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { sileo } from 'sileo';
import { convex } from '@/lib/convex-client';
import {
  getContractSettingsSnapshot,
  isValidRemoteSnapshot,
  useContractSettingsStore,
} from '../../store/contract-settings.store';

const SAVE_DEBOUNCE_MS = 900;

async function putSnapshot(body: ReturnType<typeof getContractSettingsSnapshot>) {
  await convex.mutation(api.adminContractSettings.replaceForAdmin, {
    payload: body,
  });
}

export function ContractSettingsRemoteSync() {
  const remoteDoc = useConvexQuery(api.adminContractSettings.getGlobalPayload, {});
  const remoteReadyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentJsonRef = useRef<string | null>(null);
  const bootstrapDoneRef = useRef(false);

  useEffect(() => {
    if (remoteDoc === undefined || bootstrapDoneRef.current) return;

    const runBootstrap = async () => {
      if (!useContractSettingsStore.persist.hasHydrated()) return;
      bootstrapDoneRef.current = true;

      try {
        if (remoteDoc != null && isValidRemoteSnapshot(remoteDoc)) {
          applyingRemoteRef.current = true;
          useContractSettingsStore.getState().hydrateFromRemote(remoteDoc);
          queueMicrotask(() => {
            applyingRemoteRef.current = false;
          });
          lastSentJsonRef.current = JSON.stringify(
            getContractSettingsSnapshot(useContractSettingsStore.getState()),
          );
        } else {
          const snap = getContractSettingsSnapshot(
            useContractSettingsStore.getState(),
          );
          await putSnapshot(snap);
          lastSentJsonRef.current = JSON.stringify(snap);
        }
      } catch (e) {
        console.error('[contract-settings] bootstrap', e);
      } finally {
        remoteReadyRef.current = true;
      }
    };

    const unsubHydration = useContractSettingsStore.persist.onFinishHydration(
      () => void runBootstrap(),
    );

    if (useContractSettingsStore.persist.hasHydrated()) {
      void runBootstrap();
    }

    return unsubHydration;
  }, [remoteDoc]);

  useEffect(() => {
    const unsub = useContractSettingsStore.subscribe((state) => {
      if (!remoteReadyRef.current || applyingRemoteRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const snap = getContractSettingsSnapshot(state);
        const json = JSON.stringify(snap);
        if (json === lastSentJsonRef.current) return;
        void putSnapshot(snap)
          .then(() => {
            lastSentJsonRef.current = json;
          })
          .catch((e) => {
            console.error('[contract-settings] save', e);
            sileo.error({
              title: 'No se guardaron los ajustes en la nube',
              fill: '#fee2e2',
            });
          });
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return null;
}
