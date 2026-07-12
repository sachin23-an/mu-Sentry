import React from 'react';

export const HelpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);


interface ExplanationToggleProps {
    isExplanationMode: boolean;
    setIsExplanationMode: (value: boolean) => void;
}

export const ExplanationToggle: React.FC<ExplanationToggleProps> = ({ isExplanationMode, setIsExplanationMode }) => {
    return (
        <button
            onClick={() => setIsExplanationMode(!isExplanationMode)}
            className={`fixed bottom-8 right-8 z-50 h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl border-2 ${
                isExplanationMode 
                ? 'bg-brand-green text-white border-brand-green scale-110' 
                : 'bg-white text-text-secondary border-border-cream hover:border-brand-green hover:text-brand-green'
            }`}
            aria-label="Toggle Explanation Mode"
        >
            <HelpIcon className="h-7 w-7" />
        </button>
    );
};


interface ExplanationOverlayProps {
  title: string;
  what: string;
  why: string;
  how: string;
  children?: React.ReactNode;
}

export const ExplanationOverlay: React.FC<ExplanationOverlayProps> = ({ title, what, why, how }) => {
  return (
    <div className="absolute inset-0 z-20 bg-white border-2 border-brand-green rounded-2xl p-8 flex flex-col justify-center animate-fade-in shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-green"></div>
      <h4 className="text-2xl font-serif font-bold text-brand-green mb-6 border-b border-border-cream pb-3">{title}</h4>
      <div className="space-y-6 text-base text-text-primary overflow-y-auto custom-scrollbar pr-4">
        <div className="leading-relaxed">
          <strong className="font-bold text-brand-green uppercase text-[11px] tracking-[0.2em] block mb-2">What</strong> 
          <div className="text-text-primary/90" dangerouslySetInnerHTML={{ __html: what }} />
        </div>
        <div className="leading-relaxed">
          <strong className="font-bold text-brand-green uppercase text-[11px] tracking-[0.2em] block mb-2">Why</strong> 
          <div className="text-text-primary/90" dangerouslySetInnerHTML={{ __html: why }} />
        </div>
        <div className="leading-relaxed">
          <strong className="font-bold text-brand-green uppercase text-[11px] tracking-[0.2em] block mb-2">How</strong> 
          <div className="text-text-primary/90" dangerouslySetInnerHTML={{ __html: how }} />
        </div>
      </div>
    </div>
  );
};

// Add fade-in animation to index.html or a global CSS file if one exists.
// For now, let's assume a simple style injection in the component file for simplicity, or rely on a CSS-in-JS solution if available.
const styles = `
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-in-out;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(74, 124, 68, 0.2);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 124, 68, 0.4);
}
`;

// A simple component to inject styles into the head
export const StyleInjector: React.FC = () => {
    React.useEffect(() => {
        const styleTag = document.createElement('style');
        styleTag.innerHTML = styles;
        document.head.appendChild(styleTag);
        return () => {
            document.head.removeChild(styleTag);
        };
    }, []);
    return null;
};
