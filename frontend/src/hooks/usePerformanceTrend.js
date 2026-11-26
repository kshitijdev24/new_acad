import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function usePerformanceTrend({
  fromSemester,
  toSemester,
  courseId,
  includeCohort = true,
} = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    api.getPerformanceTrend({ fromSemester, toSemester, courseId, includeCohort })
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
  }, [attempt, fromSemester, toSemester, courseId, includeCohort]);

  return { data, isLoading, error, retry };
}
