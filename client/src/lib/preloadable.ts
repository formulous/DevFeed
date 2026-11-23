import { lazy, type ComponentType } from 'react';

type AnyComponent = ComponentType<Record<string, never>>;

type Loaded<T> = { default: T };

export function preloadable<T extends AnyComponent>(load: () => Promise<T>) {
  let loaded: T | null = null;
  const preload = () =>
    load().then((c) => {
      loaded = c;
      return c;
    });
  const Component = lazy<T>(() => {
    if (loaded) {
      const mod: Loaded<T> = { default: loaded };
      return { then: (resolve: (m: Loaded<T>) => void) => resolve(mod) } as unknown as Promise<Loaded<T>>;
    }
    return preload().then((c) => ({ default: c }));
  });
  return { Component, preload };
}
