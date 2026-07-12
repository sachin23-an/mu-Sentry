import React from 'react';

interface MuLogoProps {
  className?: string;
  size?: number;
  variant?: 'green' | 'white' | 'outline';
}

const MuLogo: React.FC<MuLogoProps> = ({ className = '', size = 24, variant = 'white' }) => {
  const baseClasses = "flex items-center justify-center font-sans font-bold italic select-none";
  
  const variants = {
    white: "bg-white text-brand-green border border-border-cream shadow-sm",
    green: "bg-brand-green text-white shadow-lg shadow-brand-green/20",
    outline: "bg-transparent text-brand-green border border-brand-green/30"
  };

  return (
    <div 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      style={{ 
        width: size, 
        height: size, 
        fontSize: size * 0.7,
        borderRadius: size * 0.3
      }}
    >
      μ
    </div>
  );
};

export default MuLogo;
