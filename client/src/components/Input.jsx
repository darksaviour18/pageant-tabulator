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
    w-full px-4 py-3 rounded-lg font-medium
    transition-all duration-150 ease-out
    ${isDark 
      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-pink-400 focus:ring-pink-400/20' 
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-500/20'
    }
    border 
    focus:outline-none focus:ring-2 
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error 
      ? isDark 
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
        : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : ''
    }
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    ${isDark ? 'text-zinc-300' : 'text-slate-700'}
    ${error ? 'text-red-500' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    ${isDark ? 'text-red-400' : 'text-red-600'}
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
    w-full px-4 py-3 rounded-lg font-medium appearance-none cursor-pointer
    transition-all duration-150 ease-out
    bg-no-repeat bg-right
    ${isDark 
      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-pink-400 focus:ring-pink-400/20' 
      : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-amber-500/20'
    }
    ${isDark ? '[background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2024%2024%27%20stroke%3D%27%23a1a1aa%27%3E%3Cpath%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%272%27%20d%3D%27M19%209l-7%207-7-7%27%2F%3E%3C%2Fsvg%3E")]' : '[background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2024%2024%27%20stroke%3D%27%2371717a%27%3E%3Cpath%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%272%27%20d%3D%27M19%209l-7%207-7-7%27%2F%3E%3C%2Fsvg%3E")]'}
    bg-[length:1.5rem] bg-[center_right_1rem]
    border 
    focus:outline-none focus:ring-2 
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error 
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
      : ''
    }
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    ${isDark ? 'text-zinc-300' : 'text-slate-700'}
    ${error ? 'text-red-500' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    ${isDark ? 'text-red-400' : 'text-red-600'}
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
    w-full px-4 py-3 rounded-lg font-medium
    transition-all duration-150 ease-out
    resize-none
    ${isDark 
      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-pink-400 focus:ring-pink-400/20' 
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-500/20'
    }
    border 
    focus:outline-none focus:ring-2 
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error 
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
      : ''
    }
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-1.5
    ${isDark ? 'text-zinc-300' : 'text-slate-700'}
    ${error ? 'text-red-500' : ''}
  `;

  const errorClasses = `
    block text-sm mt-1.5
    ${isDark ? 'text-red-400' : 'text-red-600'}
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