export default function Card({ 
  children, 
  className = '', 
  hover = true,
  padding = true,
  glass = false,
}) {
  const baseClasses = 'rounded-xl border transition-all duration-200';
  
  const glassClasses = glass 
    ? 'bg-[var(--glass-bg)] backdrop-blur-sm border-[var(--glass-border)] shadow-lg'
    : 'bg-[var(--bg-primary)] border-[var(--border-color)] shadow-sm';

  const hoverClasses = hover
    ? 'hover:border-[var(--border-hover)] hover:shadow-xl hover:-translate-y-0.5'
    : '';

  const paddingClasses = padding ? 'p-6' : '';

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
  return (
    <h3 className={`text-lg font-semibold text-[var(--text-primary)] ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`text-sm mt-1 text-[var(--text-secondary)] ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`mt-4 pt-4 border-t border-[var(--border-color)] ${className}`}>
      {children}
    </div>
  );
}