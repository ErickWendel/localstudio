import { presenterRouteRuntime } from './presenter-route-runtime';

export const presenterRouteHarness = {
  install: (page: Parameters<typeof presenterRouteRuntime.install>[0]) =>
    presenterRouteRuntime.install(page),
};
