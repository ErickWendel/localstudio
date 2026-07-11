interface DesignColorFieldProps {
  ariaLabel: string;
  className?: string | undefined;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

export function DesignColorField({
  ariaLabel,
  className = 'design-control ew-field-scope',
  label,
  onChange,
  value,
}: DesignColorFieldProps) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        type="color"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}
