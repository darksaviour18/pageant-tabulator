export function Skeleton({ className = '', variant = 'text', width, height }) {
  const baseClasses = 'animate-pulse rounded';
  
  const variantClasses = 'bg-[var(--skeleton-color)]';
  
  const style = {
    width: width || (variant === 'circular' ? 'h-10 w-10' : 'w-full'),
    height: height || (variant === 'text' ? 'h-4' : variant === 'circular' ? 'w-10' : 'h-full'),
  };
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
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
  return (
    <div className="rounded-xl border p-5 bg-[var(--bg-primary)] border-[var(--border-color)]">
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
  return (
    <div className="rounded-xl border overflow-hidden bg-[var(--bg-primary)] border-[var(--border-color)]">
      <div className={`grid gap-4 p-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]`}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-4" width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className={`grid gap-4 p-4 border-t border-[var(--border-color)]`}
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
  return (
    <div className={`w-24 h-10 rounded-lg bg-[var(--skeleton-color)] ${className}`} />
  );
}

export default Skeleton;