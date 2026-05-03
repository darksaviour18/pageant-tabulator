import { forwardRef } from 'react';

const variants = {
  primary: 'bg-[var(--color-cta)] hover:opacity-90 text-white',
  secondary: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
  outline: 'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-cta)]',
  ghost: 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

const sizes = {
  sm: 'px-3 py-2 min-h-[40px] text-sm',
  md: 'px-4 py-2.5 min-h-[48px] text-sm',
  lg: 'px-6 py-3 min-h-[56px] text-base',
};

const Button = forwardRef(function Button(
  { 
    children, 
    variant = 'primary', 
    size = 'md', 
    className = '', 
    disabled = false,
    loading = false,
    icon: Icon,
    ...props 
  },
  ref
) {
  const variantClass = variants[variant] || variants.primary;
  const sizeClasses = sizes[size];

  const disabledClasses = disabled || loading
    ? 'opacity-50 cursor-not-allowed transform-none'
    : 'active:scale-[0.98] hover:scale-[1.02]';

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-150 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-cta)]
        ${variantClass}
        ${sizeClasses}
        ${disabledClasses}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;