import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useGpaEngine(semesterId = 'current', enabled = true) {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const refreshScenarios = useCallback(async () => {
    if (!enabled) return;
    setScenarios(await api.getGpaScenarios(data?.semester?.id));
  }, [data?.semester?.id, enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all([
      api.getGpaEngine(semesterId),
      api.getGpaInsights(semesterId),
      api.getGpaScenarios(),
    ])
      .then(([engine, insightResult, savedScenarios]) => {
        if (!active) return;
        setData(engine);
        setInsights(insightResult.items || []);
        setScenarios(savedScenarios || []);
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
  }, [attempt, enabled, semesterId]);

  return {
    data,
    insights,
    scenarios,
    setScenarios,
    isLoading,
    error,
    retry,
    refreshScenarios,
  };
}
