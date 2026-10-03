import React, { useState } from 'react';
import {
  Cloud,
  Layers,
  ShieldCheck,
  Search,
  ArrowRight,
  Check,
  X,
  Smartphone,
} from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: <Cloud className="w-12 h-12 text-blue-600" />,
      title: 'Welcome to Multi-Cloud Manager',
      subtitle: 'A single unified interface for all your cloud storage accounts.',
      description:
        'Connect multiple Google Drive, Microsoft OneDrive, Dropbox, and Box accounts and manage them seamlessly without logging in and out.',
    },
    {
      icon: <Layers className="w-12 h-12 text-indigo-600" />,
      title: 'Cross-Cloud Search & Gallery',
      subtitle: 'Instant recall across all connected providers.',
      description:
        'Unified chronological gallery for all your photos and videos, and lightning-fast search with provider attribution badges on every file.',
    },
    {
      icon: <ShieldCheck className="w-12 h-12 text-emerald-600" />,
      title: 'Zero-Storage Privacy Architecture',
      subtitle: 'Storage remains owned and metered by each provider.',
      description:
        'We never pool or bypass storage limits. Your files stay encrypted and stored strictly inside their authentic cloud services.',
    },
    {
      icon: <Smartphone className="w-12 h-12 text-blue-600" />,
      title: 'Mobile-First & Offline Ready',
      subtitle: 'Designed for smartphone and web ergonomics.',
      description:
        'Install on your home screen as a PWA or run as an APK with offline access, background queueing, and real device downloads.',
    },
  ];

  const currentSlide = slides[step];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('ucfm_onboarding_completed', 'true');
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100 transition-colors"
      >
        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Slide Graphic */}
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto shadow-inner">
          {currentSlide.icon}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {currentSlide.title}
          </h3>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {currentSlide.subtitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            {currentSlide.description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              localStorage.setItem('ucfm_onboarding_completed', 'true');
              onClose();
            }}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2 py-1"
          >
            Skip Tour
          </button>

          <button
            onClick={handleNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
          >
            <span>{step === slides.length - 1 ? 'Get Started' : 'Next'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
