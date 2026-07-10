export function AiToolsHelpTip({ id, text }: { id: string; text: string }) {
  return (
    <span className="translation-target-help">
      <span aria-describedby={id} className="material-symbols-outlined" tabIndex={0}>
        info
      </span>
      <span id={id} className="translation-target-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}
