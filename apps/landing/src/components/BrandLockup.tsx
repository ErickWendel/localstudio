import { localStudioLogoMark } from '@localstudio/brand/logo';

export function BrandLockup() {
  return (
    <>
      <svg
        aria-hidden="true"
        className="ls-logo-mark brand-mark-logo"
        focusable="false"
        viewBox={localStudioLogoMark.viewBox}
      >
        <path
          className="ls-logo-mark__layer ls-logo-mark__layer-back"
          d={localStudioLogoMark.backLayerPath}
        />
        <path
          className="ls-logo-mark__layer ls-logo-mark__layer-middle"
          d={localStudioLogoMark.middleLayerPath}
        />
        <path
          className="ls-logo-mark__layer ls-logo-mark__layer-front"
          d={localStudioLogoMark.frontLayerPath}
        />
        <circle className="ls-logo-mark__dot" cx="31" cy="26" r="1.5" />
        <circle className="ls-logo-mark__dot" cx="36" cy="26" r="1.5" />
        <circle className="ls-logo-mark__dot" cx="41" cy="26" r="1.5" />
        <path className="ls-logo-mark__bar" d={localStudioLogoMark.browserBarPath} />
      </svg>
      <span className="ls-logo-word">LocalStudio</span>
      <span className="beta-flag">Beta</span>
    </>
  );
}
