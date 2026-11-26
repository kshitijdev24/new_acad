import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useAdminDashboard(enabled = true, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    api.getAdminDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, refreshKey, retryCount]);

  return { data, isLoading, error, retry };
}
