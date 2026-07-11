import { type Page } from '@playwright/test';

import { presenterRouteCommandHistory } from './presenter-route-command-history';
import { presenterRouteInitialState } from './presenter-route-initial-state';
import { presenterRouteNavigation } from './presenter-route-navigation';
import { presenterRouteNotesResizer } from './presenter-route-notes-resizer';
import { presenterRouteNotesSync } from './presenter-route-notes-sync';
import { presenterRouteRemoteShortcuts } from './presenter-route-remote-shortcuts';
import { presenterRouteStartup } from './presenter-route-startup';
import { presenterRouteTimerCommands } from './presenter-route-timer-commands';

export async function runPresenterRouteJourney(page: Page, baseURL: string): Promise<void> {
  await presenterRouteStartup.open(page, baseURL);
  await presenterRouteInitialState.verify(page);
  await presenterRouteNotesResizer.verify(page);
  await presenterRouteTimerCommands.verify(page);
  await presenterRouteNotesSync.verify(page);
  await presenterRouteRemoteShortcuts.verify(page);
  await presenterRouteNavigation.verify(page);
  await presenterRouteCommandHistory.verify(page);
}
