import React, { useState } from 'react';
import {
  Cloud,
  Layers,
  ShieldCheck,
  FolderSearch,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: <Cloud className="w-12 h-12 text-blue-600 dark:text-blue-400" />,
      badge: 'Stage 1 of 4',
      title: 'Welcome to Multi-Cloud Manager',
      subtitle: 'A single unified workspace for all your cloud storage accounts.',
      description:
        'Access and manage multiple cloud storage accounts side by side without switching apps or logging in and out.',
      highlights: [
        'Mobile-first responsive interface for Android & Web',
        'Strict per-account isolation with composite file keys',
        'Instant account switching and unified navigation',
      ],
    },
    {
      icon: <Layers className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />,
      badge: 'Stage 2 of 4',
      title: 'Connect your cloud storage providers',
      subtitle: 'Support for Google Drive, Microsoft OneDrive, Dropbox & Box.',
      description:
        'Authorize your personal, work, or enterprise cloud accounts with OAuth 2.0 PKCE and monitor per-account connection health and storage usage.',
      highlights: [
        'Google Drive, Microsoft OneDrive, Dropbox, and Box',
        'Independent per-provider quota meters and status badges',
        'One-click account reconnection and token revocation',
      ],
    },
    {
      icon: <FolderSearch className="w-12 h-12 text-sky-600 dark:text-sky-400" />,
      badge: 'Stage 3 of 4',
      title: 'Unified file management and organization',
      subtitle: 'Browse, search, upload, download, and organize seamlessly.',
      description:
        'Search across every connected provider at once, preview media in the chronological gallery, and perform uploads, downloads, renames, moves, and folder creation.',
      highlights: [
        'Cross-account search with provider attribution badges',
        'Upload files, create folders, rename, move, and trash',
        'Offline file pinning and pending operation reconciliation',
      ],
    },
    {
      icon: <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />,
      badge: 'Stage 4 of 4',
      title: 'Privacy, security, and permissions',
      subtitle: 'Zero-storage architecture with transparent quota boundaries.',
      description:
        'Your files and quotas remain owned, metered, and enforced directly by each cloud provider. Diagnostic logs are automatically scrubbed of tokens and PII.',
      highlights: [
        'PBKDF2-SHA256 credential hashing & 24h session tokens',
        'Automatic PII and bearer token redaction in audit logs',
        'Granular cookie and local cache consent controls',
      ],
    },
  ];

  const currentSlide = slides[step];
  const isLastStep = step === slides.length - 1;

  const completeOnboarding = () => {
    try {
      localStorage.setItem('ucfm_onboarding_completed', 'true');
    } catch (e) {
      console.warn('Unable to persist onboarding state:', e);
    }
    onClose();
  };

  const handleNext = () => {
    if (!isLastStep) {
      setStep((prev) => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      onClick={completeOnboarding}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100 transition-colors relative"
      >
        {/* Top bar: Stage badge, Step dots & Close button */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
            {currentSlide.badge}
          </span>

          <div className="flex items-center justify-center gap-1.5" aria-label="Onboarding progress">
            {slides.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to stage ${i + 1}: ${s.title}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === step
                    ? 'w-6 bg-blue-600'
                    : i < step
                    ? 'w-2 bg-blue-400 dark:bg-blue-700'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={completeOnboarding}
            aria-label="Close onboarding tour"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Graphic */}
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto shadow-inner">
          {currentSlide.icon}
        </div>

        {/* Text */}
        <div className="space-y-2 text-center">
          <h3
            id="onboarding-modal-title"
            className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight"
          >
            {currentSlide.title}
          </h3>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {currentSlide.subtitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            {currentSlide.description}
          </p>
        </div>

        {/* Key Highlights */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-left">
          {currentSlide.highlights.map((item) => (
            <div key={item} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons: Skip Tour, Back, Next / Finish */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={completeOnboarding}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <span>{isLastStep ? 'Finish & Continue' : 'Next'}</span>
              {isLastStep ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
