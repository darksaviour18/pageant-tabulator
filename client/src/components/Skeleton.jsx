import { useTheme } from '../context/ThemeContext';

export function Skeleton({ className = '', variant = 'text', width, height }) {
  const { isDark } = useTheme();
  
  const baseClasses = 'animate-pulse rounded';
  
  const variantClasses = {
    text: isDark ? 'bg-zinc-700' : 'bg-slate-200',
    circular: isDark ? 'bg-zinc-700' : 'bg-slate-200',
    rectangular: isDark ? 'bg-zinc-700' : 'bg-slate-200',
  };
  
  const style = {
    width: width || (variant === 'circular' ? 'h-10 w-10' : 'w-full'),
    height: height || (variant === 'text' ? 'h-4' : variant === 'circular' ? 'w-10' : 'h-full'),
  };
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  const { isDark } = useTheme();
  
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          width={i === lines - 1 ? '75%' : '100%'}
          height="h-4"
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  const { isDark } = useTheme();
  
  return (
    <div className={`rounded-xl border p-5 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width="w-10" height="h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height="h-4" />
          <Skeleton width="40%" height="h-3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  const { isDark } = useTheme();
  
  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}>
      <div className={`grid gap-4 p-4 ${isDark ? 'bg-zinc-700/50 border-b border-zinc-700' : 'bg-slate-50 border-b border-slate-200'}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-4" width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className={`grid gap-4 p-4 border-t ${isDark ? 'border-zinc-700' : 'border-slate-200'}`}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} height="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonButton({ className = '' }) {
  const { isDark } = useTheme();
  
  return (
    <div className={`w-24 h-10 rounded-lg ${isDark ? 'bg-zinc-700' : 'bg-slate-200'} ${className}`} />
  );
}

export default Skeleton;