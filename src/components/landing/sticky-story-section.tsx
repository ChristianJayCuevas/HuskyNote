import React, { useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { useLanguage } from '../../context/language-context';

export const StickyStorySection: React.FC = () => {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);

  const stages = [
    {
      step: '01',
      title: t('landing.howItWorks.step1Title', 'Voice Recording'),
      desc: t('landing.howItWorks.step1Desc', 'Speech recorded locally via your browser. Spoken words appear in real time with clickable timestamps.'),
      content: (
        <div className="space-y-3 font-mono text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-850 pb-2">
            <span>Audio Recording</span>
            <span>00:14:32</span>
          </div>
          <p>00:02 speaker: Let us finalize the architecture for the local knowledge base.</p>
          <p>00:15 speaker: We agreed that IndexedDB will store all documents.</p>
          <p>00:28 speaker: Arron will complete the document parser by tomorrow.</p>
          <p>00:44 speaker: We should keep the local Ollama connection on port 11434.</p>
        </div>
      ),
    },
    {
      step: '02',
      title: t('landing.howItWorks.step2Title', 'Key Decisions & Highlights'),
      desc: t('landing.howItWorks.step2Desc', 'Meaningful statements, decisions, and action commitments are identified without transmitting data outside.'),
      content: (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-850 pb-2">
            <span>Extracted Points</span>
            <span className="text-slate-600 dark:text-zinc-400 font-mono text-xs">3 Items Identified</span>
          </div>
          <div className="p-2.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 text-slate-800 dark:text-zinc-200">
            <span className="text-xs text-slate-500 dark:text-zinc-400 block mb-1 font-semibold">Decision</span>
            "IndexedDB will store all documents locally without remote cloud dependencies."
          </div>
          <div className="p-2.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 text-slate-800 dark:text-zinc-200">
            <span className="text-xs text-slate-500 dark:text-zinc-400 block mb-1 font-semibold">Action Item</span>
            "Arron will complete the document parser by tomorrow."
          </div>
        </div>
      ),
    },
    {
      step: '03',
      title: t('landing.howItWorks.step3Title', 'Action Items'),
      desc: t('landing.howItWorks.step3Desc', 'Extracting task descriptions, assignees, and deadlines into an organized checklist.'),
      content: (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-850 pb-2">
            <span>Deliverables</span>
            <span>2 Items Assigned</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
            <CheckSquare className="w-4 h-4 text-slate-700 dark:text-zinc-300 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Implement universal document parser</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Assigned to: @Arron</div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
            <CheckSquare className="w-4 h-4 text-slate-700 dark:text-zinc-300 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Verify Ollama localhost connection</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Assigned to: @Engineering</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      step: '04',
      title: t('landing.howItWorks.step4Title', 'Clean Notes'),
      desc: t('landing.howItWorks.step4Desc', 'Conversation becomes clean, durable knowledge saved to your workspace.'),
      content: (
        <div className="space-y-3 font-sans text-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-850 pb-2">
            <span>Summary Note</span>
            <span className="text-slate-600 dark:text-zinc-400">Stored Privately</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Meeting Minutes: Local Knowledge Engine
          </h4>
          <p className="text-slate-700 dark:text-zinc-300 leading-relaxed text-xs">
            The team committed to client-side database persistence using IndexedDB and native Ollama
            processing. All actionable deliverables have been dispatched to your task index.
          </p>
          <div className="pt-2 flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
              #architecture
            </span>
            <span className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-850">
              #meeting
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="py-12 sm:py-24 border-t border-slate-200 dark:border-zinc-850 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Content */}
        <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
          <div className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>{t('landing.howItWorks.badge', 'How It Works')}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.08]">
            {t('landing.howItWorks.title', 'From conversation to organized notes.')}
          </h2>

          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-md">
            {t('landing.howItWorks.description', 'Most meeting conversations are forgotten once the call ends. HuskyNote preserves what was said, highlights key decisions, and turns them into lasting notes right on your computer.')}
          </p>

          {/* Interactive Step Selection Cards */}
          <div className="space-y-2.5 pt-2">
            {stages.map((st, idx) => {
              const isActive = activeStep === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                    isActive
                      ? 'bg-white dark:bg-zinc-900/90 border-slate-400 dark:border-white/40 text-slate-900 dark:text-white shadow-md'
                      : 'bg-slate-50/70 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-850 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-750 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-black'
                          : 'bg-slate-200 text-slate-700 dark:bg-zinc-900 dark:text-zinc-500'
                      }`}
                    >
                      {st.step}
                    </span>
                    <span className="text-xs font-medium tracking-tight">{st.title}</span>
                  </div>

                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Step Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-850/80 text-xs text-slate-500 dark:text-zinc-500 font-mono">
            <span>Step {activeStep + 1} of {stages.length}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : stages.length - 1))}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Previous step"
              >
                ← {t('landing.howItWorks.prev', 'Prev')}
              </button>
              <button
                onClick={() => setActiveStep((prev) => (prev < stages.length - 1 ? prev + 1 : 0))}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Next step"
              >
                {t('landing.howItWorks.next', 'Next')} →
              </button>
            </div>
          </div>
        </div>

        {/* Right Dynamic Interface with Sliding-In Card */}
        <div className="lg:col-span-7 overflow-hidden relative min-h-[400px]">
          <div
            key={activeStep}
            className="animate-slide-in-right rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3 mb-6">
              <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 tracking-wide font-mono">
                STAGE {stages[activeStep].step} • {stages[activeStep].title.toUpperCase()}
              </span>
              <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 px-2 py-0.5 rounded">
                {t('landing.howItWorks.preview', 'Preview')}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
              {stages[activeStep].desc}
            </p>

            <div className="p-3.5 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/50 min-h-[240px] flex flex-col justify-center">
              {stages[activeStep].content}
            </div>

            {/* Next stage callout button */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-zinc-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px]">
                Click step or Next to preview stage transformation
              </span>
              <button
                onClick={() => setActiveStep((prev) => (prev < stages.length - 1 ? prev + 1 : 0))}
                className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
              >
                <span>{activeStep < stages.length - 1 ? 'Next: ' + stages[activeStep + 1].title : t('landing.howItWorks.restart', 'Restart Flow (01)')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
