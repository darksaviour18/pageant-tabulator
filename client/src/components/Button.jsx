import { forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const variants = {
  primary: {
    light: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700',
    dark: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600',
  },
  secondary: {
    light: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200',
    dark: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700',
  },
  outline: {
    light: 'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    dark: 'bg-transparent text-zinc-300 border border-zinc-600 hover:bg-zinc-800 hover:border-zinc-500',
  },
  ghost: {
    light: 'bg-transparent text-slate-600 hover:bg-slate-100',
    dark: 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
  },
  danger: {
    light: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700',
    dark: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800',
  },
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
  const { isDark } = useTheme();

  const variantClasses = variants[variant]?.[isDark ? 'dark' : 'light'] || variants.primary[isDark ? 'dark' : 'light'];
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
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
        ${variantClasses}
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