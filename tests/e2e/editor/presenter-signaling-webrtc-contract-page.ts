import { type Page } from '@playwright/test';

import { evaluatePresenterSignalingWebRtcAnswerContract } from './presenter-signaling-webrtc-answer-contract-browser';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { evaluatePresenterSignalingWebRtcIceContract } from './presenter-signaling-webrtc-ice-contract-browser';
import { evaluatePresenterSignalingWebRtcOfferContract } from './presenter-signaling-webrtc-offer-contract-browser';

type PresenterSignalingWebRtcContractResult = {
  answer: string | null;
  answerPublished: boolean;
  controllerCandidates: Array<{ candidate: string }>;
  controllerIcePublished: boolean;
  drainedCandidates: Array<{ candidate: string }>;
  missingAnswerPublished: boolean;
  missingIce: boolean;
  missingOffer: { status: string };
  pendingOffers: Array<{ controllerId: string; offerSdp: string }>;
  presenterCandidates: Array<{ candidate: string }>;
  presenterIcePublished: boolean;
  trustedOffer: { status: string };
  untrustedOffer: { status: string };
};

export const presenterSignalingWebRtcContractPage = {
  async runAnswer(
    page: Page,
    options: { baseURL: string; presenterRemoteSourceRoot: string },
  ) {
    await presenterSignalingContractPage.gotoReady(page, options.baseURL);
    return page.evaluate(evaluatePresenterSignalingWebRtcAnswerContract, {
      presenterRemoteSourceRoot: options.presenterRemoteSourceRoot,
    });
  },
  async runIce(
    page: Page,
    options: { baseURL: string; presenterRemoteSourceRoot: string },
  ) {
    await presenterSignalingContractPage.gotoReady(page, options.baseURL);
    return page.evaluate(evaluatePresenterSignalingWebRtcIceContract, {
      presenterRemoteSourceRoot: options.presenterRemoteSourceRoot,
    });
  },
  async runOffer(
    page: Page,
    options: { baseURL: string; presenterRemoteSourceRoot: string },
  ) {
    await presenterSignalingContractPage.gotoReady(page, options.baseURL);
    return page.evaluate(evaluatePresenterSignalingWebRtcOfferContract, {
      presenterRemoteSourceRoot: options.presenterRemoteSourceRoot,
    });
  },
  async run(
    page: Page,
    options: { baseURL: string; presenterRemoteSourceRoot: string },
  ): Promise<PresenterSignalingWebRtcContractResult> {
    const offer = await this.runOffer(page, options);
    const answer = await this.runAnswer(page, options);
    const ice = await this.runIce(page, options);

    return {
      ...offer,
      ...answer,
      ...ice,
    };
  },
};
