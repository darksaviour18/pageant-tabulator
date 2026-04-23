import { forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const Input = forwardRef(function Input(
  {
    label,
    error,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const { isDark } = useTheme();

  const inputClasses = `
    w-full px-4 py-3 min-h-[48px] rounded-lg font-medium
    transition-all duration-150 ease-out
    bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]
    focus:outline-none focus:ring-2 focus:ring-[var(--color-cta)]/20 focus:border-[var(--color-cta)]
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20' : ''}
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    text-[var(--color-text-secondary)]
    ${error ? 'text-[var(--color-error)]' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    text-[var(--color-error)]
  `;

  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses}>{label}</label>}
      <input ref={ref} className={inputClasses} {...props} />
      {error && <span className={errorClasses}>{error}</span>}
    </div>
  );
});

const Select = forwardRef(function Select(
  {
    label,
    error,
    options = [],
    placeholder = 'Select an option',
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const { isDark } = useTheme();

  const selectClasses = `
    w-full px-4 py-3 min-h-[48px] rounded-lg font-medium appearance-none cursor-pointer
    transition-all duration-150 ease-out
    bg-[var(--color-bg-subtle)] bg-no-repeat border border-[var(--color-border)] text-[var(--color-text)]
    focus:outline-none focus:ring-2 focus:ring-[var(--color-cta)]/20 focus:border-[var(--color-cta)]
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20' : ''}
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    text-[var(--color-text-secondary)]
    ${error ? 'text-[var(--color-error)]' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    text-[var(--color-error)]
  `;

  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses}>{label}</label>}
      <select ref={ref} className={selectClasses} {...props}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className={errorClasses}>{error}</span>}
    </div>
  );
});

const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const { isDark } = useTheme();

  const textareaClasses = `
    w-full px-4 py-3 min-h-[48px] rounded-lg font-medium
    transition-all duration-150 ease-out
    resize-none
    bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]
    focus:outline-none focus:ring-2 focus:ring-[var(--color-cta)]/20 focus:border-[var(--color-cta)]
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20' : ''}
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    text-[var(--color-text-secondary)]
    ${error ? 'text-[var(--color-error)]' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    text-[var(--color-error)]
  `;

  return (
    <div className={containerClassName}>
      {label && <label className={labelClasses}>{label}</label>}
      <textarea ref={ref} className={textareaClasses} {...props} />
      {error && <span className={errorClasses}>{error}</span>}
    </div>
  );
});

export { Input, Select, Textarea };