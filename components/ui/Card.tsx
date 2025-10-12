import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  gradient = false,
  hover = false,
  onClick 
}) => {
  const baseStyles = "rounded-xl border transition-all duration-300";
  const gradientStyles = gradient 
    ? "bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm" 
    : "bg-slate-800/50 border-slate-700";
  const hoverStyles = hover 
    ? "hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1 hover:border-cyan-500/50 cursor-pointer" 
    : "";

  return (
    <div 
      className={`${baseStyles} ${gradientStyles} ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;

