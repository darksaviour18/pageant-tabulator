import { useTheme } from '../context/ThemeContext';

export default function Card({ 
  children, 
  className = '', 
  hover = true,
  padding = true,
  glass = false,
}) {
  const { isDark } = useTheme();

  const baseClasses = 'rounded-xl border transition-all duration-200';
  
  const glassClasses = glass 
    ? isDark
      ? 'bg-zinc-900/60 backdrop-blur-sm border-zinc-700/50 shadow-lg shadow-black/20'
      : 'bg-white/70 backdrop-blur-sm border-white/50 shadow-lg shadow-black/5'
    : isDark
    ? 'bg-zinc-900 border-zinc-800'
    : 'bg-white border-slate-200 shadow-sm';

  const hoverClasses = hover
    ? isDark
      ? 'hover:border-zinc-600 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5'
      : 'hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5'
    : '';

  const paddingClasses = padding ? (isDark ? 'p-6' : 'p-6') : '';

  return (
    <div className={`${baseClasses} ${glassClasses} ${hoverClasses} ${paddingClasses} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  const { isDark } = useTheme();
  return (
    <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-900'} ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  const { isDark } = useTheme();
  return (
    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'} ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  const { isDark } = useTheme();
  return (
    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-slate-200'} ${className}`}>
      {children}
    </div>
  );
}