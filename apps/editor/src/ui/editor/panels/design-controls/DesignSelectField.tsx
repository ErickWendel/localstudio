interface DesignSelectOption {
  label: string;
  value: string;
}

interface DesignSelectFieldProps {
  ariaLabel: string;
  className?: string | undefined;
  defaultValue?: string | undefined;
  disabled?: boolean | undefined;
  label: string;
  onChange?: ((value: string) => void) | undefined;
  options: readonly DesignSelectOption[];
  value?: string | undefined;
}

export function DesignSelectField({
  ariaLabel,
  className = 'design-control ew-field-scope',
  defaultValue,
  disabled,
  label,
  onChange,
  options,
  value,
}: DesignSelectFieldProps) {
  return (
    <label className={className}>
      <span>{label}</span>
      <select
        aria-label={ariaLabel}
        defaultValue={defaultValue}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          onChange?.(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
