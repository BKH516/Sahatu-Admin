import React, { useMemo } from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '' 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200";
  
  const variants = useMemo(() => ({
    default: "bg-slate-600/20 text-slate-300 border border-slate-600/50",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/50",
    danger: "bg-red-500/20 text-red-400 border border-red-500/50",
    info: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50",
  }), []);

  const sizes = useMemo(() => ({
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }), []);

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(Badge);

