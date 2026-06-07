import { DependencyList, useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      data: current.data,
      error: null,
      loading: true
    }));

    loader()
      .then((data) => {
        if (!cancelled) {
          setState({
            data,
            error: null,
            loading: false
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Erreur inconnue",
            loading: false
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [...dependencies, reloadKey]);

  return {
    ...state,
    reload: () => setReloadKey((value) => value + 1)
  };
}

