import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  LockKeyhole,
  Mail,
  Mic2,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { useEffect } from 'react';
import { Reveal } from '../components/Reveal';

declare global {
  interface Window {
    MauticDomain?: string;
    MauticLang?: {
      submittingMessage: string;
    };
    MauticSDK?: {
      onLoad: () => void;
    };
    MauticSDKLoaded?: boolean;
  }
}

const mauticWaitlistConfig = {
  action: 'https://mautic.erickwendel.com.br/form/submit?formId=6',
  domain: 'https://mautic.erickwendel.com.br',
  formId: '6',
  formName: 'localstudiowaitlist',
  scriptId: 'mautic-form-sdk',
  scriptSrc: 'https://mautic.erickwendel.com.br/media/js/mautic-form.js?ve96f9e9b',
} as const;

const speakerFeatures = [
  'Full editor with LocalStack or your own S3-compatible setup',
  'Projects, assets, browser AI models, and exports stay on infrastructure you control',
  'Presenter mode, public share payloads, imports, exports, and WebMCP from the open product',
  'Free forever for builders, speakers, educators, and self-hosted teams',
];

const keynoteFeatures = [
  'Premium models for sharper image generation, slide drafting, and transcription',
  'Managed private cloud for backups, history, assets, public links, and transcripts',
  'Better results when local browser models are too small, slow, or inaccurate',
  'Private-by-default workspaces with recovery when a machine changes',
  'Early access to hosted conveniences as the cloud plan launches',
];

export function PricingSection() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.MauticDomain = mauticWaitlistConfig.domain;
    window.MauticLang = {
      submittingMessage: 'Please wait...',
    };

    if (window.MauticSDKLoaded) {
      window.MauticSDK?.onLoad();
      return;
    }

    window.MauticSDKLoaded = true;

    const script = document.createElement('script');
    script.id = mauticWaitlistConfig.scriptId;
    script.src = mauticWaitlistConfig.scriptSrc;
    script.type = 'text/javascript';
    script.onload = () => {
      window.MauticSDK?.onLoad();
    };
    document.head.appendChild(script);
  }, []);

  return (
    <section id="pricing" className="pricing-section" aria-labelledby="pricing-title">
      <div className="section-heading pricing-heading">
        <p className="eyebrow">Pricing</p>
        <h2 id="pricing-title">Free forever locally. Cheap when convenience matters.</h2>
        <p>
          LocalStudio stays open and self-hostable. The paid plan is for speakers who want the practical parts handled:
          private cloud backups, project history, hosted assets, share links, and transcriptions without running the
          storage stack themselves.
        </p>
      </div>

      <div className="pricing-grid" aria-label="LocalStudio plans">
        <Reveal as="article" className="pricing-card pricing-card--speaker" reveal="pricing-speaker">
          <div className="pricing-card-header">
            <span className="pricing-badge">Free forever</span>
            <Mic2 size={34} aria-hidden="true" />
          </div>
          <h3>Speaker</h3>
          <p className="pricing-price">
            $0
            <span>/forever</span>
          </p>
          <p className="pricing-card-copy">
            Everything you need to build, import, present, export, and share from your own browser and local stack.
          </p>
          <ul className="pricing-feature-list">
            {speakerFeatures.map((feature) => (
              <li key={feature}>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <a className="secondary-action pricing-card-action" href="/editor/">
            Start free
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </Reveal>

        <Reveal as="article" className="pricing-card pricing-card--keynote" delay={80} reveal="pricing-keynote">
          <div className="pricing-card-header">
            <span className="pricing-badge pricing-badge--highlight">Waitlist</span>
            <Cloud size={34} aria-hidden="true" />
          </div>
          <h3>Keynote Speaker</h3>
          <p className="pricing-price">
            Cheap
            <span>/managed cloud</span>
          </p>
          <p className="pricing-card-copy">
            For people who want LocalStudio to feel portable and more capable: private backups, premium models, history,
            assets, transcriptions, and recovery handled by our cloud.
          </p>
          <ul className="pricing-feature-list">
            {keynoteFeatures.map((feature) => (
              <li key={feature}>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div id="mauticform_wrapper_localstudiowaitlist" className="mauticform_wrapper">
            <form
              action={mauticWaitlistConfig.action}
              autoComplete="off"
              className="pricing-waitlist-form"
              data-mautic-form={mauticWaitlistConfig.formName}
              encType="multipart/form-data"
              id="mauticform_localstudiowaitlist"
              method="post"
              role="form"
            >
              <div className="mauticform-error" id="mauticform_localstudiowaitlist_error" />
              <div className="mauticform-message" id="mauticform_localstudiowaitlist_message" />
              <label htmlFor="mauticform_input_localstudiowaitlist_email">Email</label>
              <div className="pricing-waitlist-row">
                <input
                  autoComplete="email"
                  className="mauticform-input"
                  id="mauticform_input_localstudiowaitlist_email"
                  name="mauticform[email]"
                  placeholder="you@company.com"
                  required
                  type="email"
                />
                <button
                  className="mauticform-button"
                  id="mauticform_input_localstudiowaitlist_submit"
                  name="mauticform[submit]"
                  type="submit"
                  value="1"
                >
                  <Mail size={17} aria-hidden="true" />
                  Join waitlist
                </button>
              </div>
              <p>Join the list with your email.</p>
              <input
                id="mauticform_localstudiowaitlist_id"
                type="hidden"
                name="mauticform[formId]"
                value={mauticWaitlistConfig.formId}
              />
              <input
                id="mauticform_localstudiowaitlist_return"
                type="hidden"
                name="mauticform[return]"
                value=""
              />
              <input
                id="mauticform_localstudiowaitlist_name"
                type="hidden"
                name="mauticform[formName]"
                value={mauticWaitlistConfig.formName}
              />
            </form>
          </div>
        </Reveal>
      </div>

      <Reveal as="div" className="pricing-trust-row" delay={120} reveal="pricing-trust">
        <span>
          <Server size={18} aria-hidden="true" />
          Self-hostable core
        </span>
        <span>
          <Database size={18} aria-hidden="true" />
          Managed storage option
        </span>
        <span>
          <LockKeyhole size={18} aria-hidden="true" />
          Private assets
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          Controlled by design
        </span>
      </Reveal>
    </section>
  );
}
