import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  CheckCircle2,
  BookOpen,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

export const HelpSupportView: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [message, setMessage] = useState('');

  const faqs = [
    {
      q: 'How does Multi-Cloud Unified Management work?',
      a: 'The application acts as a client-side unified controller. When you connect your Google Drive, OneDrive, Dropbox, or Box accounts, you can browse, upload, download, and search across all of them from a single dashboard without switching apps or logging in and out.',
    },
    {
      q: 'Does this app provide or bypass cloud storage limits?',
      a: 'No. Storage remains strictly owned, metered, and enforced by each respective cloud provider. You use your existing storage quotas provided by Google One, Microsoft 365, Dropbox, or Box.',
    },
    {
      q: 'How do I install this app as a native mobile app (PWA or APK)?',
      a: 'On Android Chrome: tap the browser menu (⋮) and select "Install app" or "Add to Home screen". On iOS Safari: tap the Share button and select "Add to Home Screen". You can also package this codebase with Bubblewrap into an Android APK for Google Play Store.',
    },
    {
      q: 'What happens when I disconnect a cloud account?',
      a: 'In accordance with our strict multi-account isolation rules (ST-4), disconnecting an account permanently purges all cached authentication tokens, index metadata, and thumbnail references from local browser storage.',
    },
    {
      q: 'Are my OAuth tokens sent to any external server?',
      a: 'No. All authentication code exchanges and API requests occur directly between your device and the respective cloud provider endpoints (e.g. googleapis.com, graph.microsoft.com).',
    },
  ];

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setFeedbackSent(true);
    setMessage('');
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-blue-600" />
          <span>Help Center & Knowledgebase</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Frequently asked questions, mobile installation guides, and support
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* FAQs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Frequently Asked Questions</span>
          </h3>

          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden text-xs"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-semibold text-slate-800 transition"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="p-3.5 bg-white text-slate-600 text-xs leading-relaxed border-t border-slate-100">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support & Feedback Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>Support & Feature Feedback</span>
          </h3>
          <p className="text-xs text-slate-500">
            Have a question or want to request a new cloud provider? Send a message directly to the engineering team.
          </p>

          <form onSubmit={handleSendFeedback} className="space-y-3">
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or suggest a feature..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white text-slate-800 transition"
            />

            <div className="flex items-center justify-between">
              {feedbackSent ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Thank you! Your feedback has been received.</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Response within 24 hours
                </span>
              )}

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>Submit</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
