import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useSound } from '../context/sound-context';
import { useLanguage } from '../context/language-context';
import { useTheme } from '../context/theme-context';
import { LanguageSwitcher } from '../components/ui/language-switcher';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { PhysicsRopeToggle } from '../components/ui/physics-rope-toggle';
import { Button } from '../components/ui/button';
import {
  Mic,
  FileText,
  FileUp,
  Video,
  Bot,
  Shield,
  ArrowRight,
  Cpu,
  CheckCircle,
  Database,
  Lock,
  Terminal,
  Play,
  RotateCcw,
  Download,
  Star,
  Menu,
  X,
} from 'lucide-react';
import { GithubIcon } from '../components/ui/github-icon';
import { ChromeIcon } from '../components/ui/chrome-icon';
import { NoiseTexture } from '../components/ui/noise-texture';
import { HeroLiveWorkspace } from '../components/landing/hero-live-workspace';
import { StickyStorySection } from '../components/landing/sticky-story-section';
import { BeforeAfterSlider } from '../components/ui/before-after-slider';
import { HorizontalCarousel } from '../components/ui/horizontal-carousel';
import { FeatureMap } from '../components/landing/feature-map';
import { CodeBlock } from '../components/ui/code-block';
import { LoopingTypewriter } from '../components/landing/looping-typewriter';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { SectionConstellation } from '../components/landing/section-constellation';
import { HeroCloudBackground } from '../components/landing/hero-cloud-background';
import { StarfieldBackground } from '../components/landing/starfield-background';
import { InteractiveFeatureDemo } from '../components/landing/interactive-feature-demo';
import { BrandCarouselBelts } from '../components/landing/brand-carousel-belts';
import { TiltCard } from '../components/ui/tilt-card';
import { useGitHubStars } from '../services/github/stars';
import mascotImg from '../assets/husky-mascot.png';
import logoImg from '../assets/official_huskynote.png';

const TYPEWRITER_PHRASES: Record<string, string[]> = {
  en: [
    'Transcribed offline.',
    'annotated on device.',
    'Organized into clear notes.',
    'Powered by your local AI.',
    'Private, offline, and secure.',
  ],
  zh: [
    '离线实时转写与智能总结。',
    '设备端自动捕获与步骤标注。',
    '系统化整理为持久笔记。',
    '由您的本地 AI 深度驱动。',
    '绝对私密、离线且安全。',
  ],
  ja: [
    'オフラインで書き起こし・要約。',
    '端末上で自動画面キャプチャ＆注釈。',
    '整理されたクリアなノートに集約。',
    'ローカル AI による高速推論。',
    '完全プライベート・オフライン・安全。',
  ],
  fr: [
    'Transcrit et résumé hors ligne.',
    'Capturé et annoté sur votre appareil.',
    'Organisé en notes limpides.',
    'Propulsé par votre IA locale.',
    'Privé, hors ligne et sécurisé.',
  ],
};

export const LandingPage: React.FC = () => {
  const { setActiveView, isCloudHost, setIsCloudModalOpen, setIsExtensionModalOpen } = useWorkspace();
  const { playPop, playThock } = useSound();
  const { t, language } = useLanguage();
  const { theme } = useTheme();

  const mascotRef = React.useRef<HTMLDivElement>(null);
  const [demoMode, setDemoMode] = useState<'interactive' | 'video'>('interactive');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { starCount, refreshStars } = useGitHubStars();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenWorkspace = () => {
    setIsMobileMenuOpen(false);
    if (isCloudHost) {
      setIsCloudModalOpen(true);
    } else {
      setActiveView('dashboard');
    }
  };

  const activeTypewriterList = TYPEWRITER_PHRASES[language] || TYPEWRITER_PHRASES.en;

  const carouselPanels = useMemo(
    () => [
      {
        id: 'meetings',
        tag: 'MEETINGS',
        title: t('landing.features.panelMeetingsTitle', 'Voice Recording & Instant Notes'),
        description: t(
          'landing.features.panelMeetingsDesc',
          'Record meetings directly in your browser. Get clear transcripts, highlighted decisions, and structured action items automatically.'
        ),
        meta: 'Audio Recording',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
              <span>Weekly Team Sync</span>
              <span className="text-slate-800 dark:text-zinc-300 font-medium">Transcribing</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-zinc-400 font-mono">03:12 speaker: "All documents will be stored locally on device."</div>
            <div className="p-2.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200">
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 block uppercase font-semibold">Key Decision</span>
              Local-first architecture chosen with zero cloud dependencies.
            </div>
          </div>
        ),
      },
      {
        id: 'documents',
        tag: 'DOCUMENTS',
        title: t('landing.features.panelDocumentsTitle', 'Document Reader & Analysis'),
        description: t(
          'landing.features.panelDocumentsDesc',
          'Upload PDFs, Word docs, presentations, and text files. Ask questions across your documents, highlight passages, and extract summaries.'
        ),
        meta: 'Universal Files',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
              <span>Architecture Spec • Page 4</span>
              <span>Stored Locally</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shrink-0">
                01
              </span>
              <span className="text-xs text-slate-800 dark:text-zinc-200">Run database migrations before starting the application</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-500">Summary note saved directly to your workspace</div>
          </div>
        ),
      },
      {
        id: 'operations',
        tag: 'GUIDES',
        title: t('landing.features.panelOperationsTitle', 'Screen Recording & Step Manuals'),
        description: t(
          'landing.features.panelOperationsDesc',
          'Record your screen during complex workflows. HuskyNote extracts screenshots, captures steps, and builds a standard operating manual.'
        ),
        meta: 'Step Manuals',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-850 pb-1.5">
              <span>Standard Operating Procedure</span>
              <span>Export: PDF & Markdown</span>
            </div>
            <div className="text-xs text-slate-800 dark:text-zinc-300 font-medium">Step 1: Check server health and memory</div>
            <div className="text-xs text-slate-800 dark:text-zinc-300 font-medium">Step 2: Deploy update with 10% canary traffic</div>
            <div className="text-xs text-slate-500 dark:text-zinc-500">3 screenshots captured • 2 action steps</div>
          </div>
        ),
      },
      {
        id: 'ai',
        tag: 'LOCAL AI',
        title: t('landing.features.panelAiTitle', 'Private AI Assistant'),
        description: t(
          'landing.features.panelAiDesc',
          'Run AI models completely on your computer with Ollama. Ask questions across your notes, meetings, and documents without sending data to third parties.'
        ),
        meta: '100% Offline',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-850 pb-1.5">
              <span>Local Assistant</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">Attached: [SprintPlan.pdf] [TeamSync]</div>
            <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
              "Based on your sprint plan and meeting notes, the project release is scheduled for Friday at 18:00 UTC."
            </p>
          </div>
        ),
      },
      {
        id: 'annotation',
        tag: 'AUTO-ANNOTATE',
        title: t('landing.features.panelAnnotationTitle', 'Dynamic Step-by-Step Auto-Annotation'),
        description: t(
          'landing.features.panelAnnotationDesc',
          'Detects UI elements, sentences, and workflows in real time. Automatically outlines actionable coordinates, captures screenshots, and drafts illustrated guides.'
        ),
        meta: 'Vision Framing',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
              <span>Coordinate Detection</span>
              <span className="text-slate-800 dark:text-zinc-300 font-mono text-[11px]">Exact Box: [x:142, y:388]</span>
            </div>
            <div className="p-2.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 text-xs text-slate-800 dark:text-zinc-200">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block uppercase font-semibold">Step 01 • Target Framed</span>
              Exact boundary calculated with border line only and zero inner obscuration.
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Auto-compiled into illustrated step manual</div>
          </div>
        ),
      },
      {
        id: 'vault',
        tag: 'STORAGE',
        title: t('landing.features.panelVaultTitle', 'Private On-Device Storage'),
        description: t(
          'landing.features.panelVaultDesc',
          'All your notes, audio transcripts, and documents stay strictly inside your browser. Fast, offline, and completely private.'
        ),
        meta: 'Zero Cloud',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
              <span>Client Database Status</span>
              <span className="text-slate-800 dark:text-zinc-300 font-mono text-[11px]">Encrypted IndexedDB</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-950 p-2.5 rounded border border-slate-200 dark:border-zinc-800">
              <span>Local Documents & Audio Recordings</span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">100% On-Device</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Zero trackers • Zero cookies • Stays on your machine</div>
          </div>
        ),
      },
      {
        id: 'zen',
        tag: 'WRITING',
        title: t('landing.features.panelZenTitle', 'Distraction-Free Husky Notes'),
        description: t(
          'landing.features.panelZenDesc',
          'A calm, distraction-free space for focused writing with full markdown support, version history, and soothing sounds.'
        ),
        meta: 'Husky Notes',
        previewContent: (
          <div className="space-y-2 text-slate-700 dark:text-zinc-300">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-850 pb-1.5">
              <span>Architecture Notes.md</span>
              <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px]">1,420 words • Auto-saved</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-zinc-200 font-sans italic">
              "The best notes are the ones written without interruption, stored where you own them forever."
            </p>
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 selection:text-slate-900 dark:selection:text-white relative overflow-x-clip transition-colors duration-500">
      {/* Subtle Noise Texture Overlay */}
      <NoiseTexture opacity={0.035} />

      {/* Global Starfield Cosmic Background for Dark Mode */}
      <StarfieldBackground isDark={theme === 'dark'} className="fixed inset-0 pointer-events-none z-0" />

      {/* Top Navigation - Sticky Appbar */}
      <header className="sticky top-0 z-50 relative bg-white/90 dark:bg-black/85 backdrop-blur-md border-b border-slate-200 dark:border-zinc-850/80 px-4 sm:px-6 h-14 flex items-center transition-all shadow-sm dark:shadow-lg">
        <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between relative">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img src={logoImg} alt="HuskyNote" className="w-7 h-7 rounded-lg object-contain shadow-xs" />
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">HuskyNote</span>
          </div>

          {/* Desktop Navigation Items (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2.5 h-full">
            {/* 1-Click Chrome Extension Button */}
            <button
              onClick={() => setIsExtensionModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors group"
              title="HuskyNote Chrome Extension (1-Click Automated Setup)"
            >
              <ChromeIcon className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" />
              <span className="font-medium">Chrome Extension</span>
            </button>

            <button
              onClick={() => setActiveView('download')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('common.download', 'Download')}</span>
            </button>

            {/* GitHub Star Count Button */}
            <a
              href="https://github.com/ChristianJayCuevas/HuskyNote"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setTimeout(refreshStars, 3000);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900/90 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-850 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm group"
              title="Star HuskyNote on GitHub"
            >
              <GithubIcon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              <span className="font-medium">{t('landing.hero.star', 'Star')}</span>
              <span className="h-3 w-[1px] bg-slate-200 dark:bg-zinc-800" />
              <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-zinc-400 group-hover:text-amber-500 transition-colors">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{starCount !== null ? starCount.toLocaleString() : 'Star'}</span>
              </span>
            </a>

            {/* Language Switcher Dropdown */}
            <LanguageSwitcher />

            <Button variant="primary" size="sm" onClick={handleOpenWorkspace}>
              <span>{isCloudHost ? t('landing.hero.downloadApp', 'Download App') : t('landing.hero.openWorkspace', 'Open Workspace')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>

            {/* Subtle Divider */}
            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

            {/* Physics Lampcord Toggle Hanging Seamlessly Under Action Bar */}
            <div className="relative flex items-center justify-center w-8 h-full self-stretch">
              <div className="absolute top-full -mt-[2px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                <PhysicsRopeToggle />
              </div>
            </div>
          </div>

          {/* Mobile Right Bar: Theme Toggle + Hamburger Button */}
          <div className="flex md:hidden items-center gap-1.5">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden sticky top-14 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-2xl border-b border-slate-200 dark:border-zinc-850 shadow-2xl px-5 py-4 space-y-3.5 animate-fade-in transition-all">
          <Button
            variant="primary"
            size="md"
            className="w-full justify-center shadow-md py-2.5 text-xs font-bold"
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleOpenWorkspace();
            }}
          >
            <span>{isCloudHost ? t('landing.hero.downloadApp', 'Download Desktop App') : t('landing.hero.openWorkspace', 'Open Workspace')}</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsExtensionModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:border-slate-400 dark:hover:border-zinc-700 transition-colors"
            >
              <ChromeIcon className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Extension</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setActiveView('download');
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:border-slate-400 dark:hover:border-zinc-700 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-zinc-300 shrink-0" />
              <span>{t('common.download', 'Download')}</span>
            </button>
          </div>

          <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-zinc-900 text-xs">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setActiveView('studio');
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <Video className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <span>Screen Recorder Studio</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">HD</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                const el = document.getElementById('demo-video-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2.5 font-medium"
            >
              <Play className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <span>{t('landing.demo.watchDemo', 'Watch Demo')}</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                const el = document.getElementById('setup-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2.5 font-medium"
            >
              <Terminal className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <span>{t('landing.setup.badge', 'Quick Setup Guide')}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-900 flex items-center justify-between gap-3">
            <a
              href="https://github.com/ChristianJayCuevas/HuskyNote"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setTimeout(refreshStars, 3000);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-500">
                <Star className="w-3 h-3 fill-amber-500" />
                <span>{starCount !== null ? starCount.toLocaleString() : 'Star'}</span>
              </span>
            </a>

            <LanguageSwitcher />
          </div>
        </div>
      )}

      {/* Main Hero Body */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20 sm:pb-24 relative z-10 w-full overflow-hidden sm:overflow-visible">
        {/* 2-Column Hero Section with Interactive Background */}
        <div
          className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl transition-colors duration-500 border border-slate-200/60 dark:border-zinc-800"
          style={{
            background: theme === 'light'
              ? 'linear-gradient(160deg, #d4dce8 0%, #dce4ef 30%, #e5eaf5 65%, #edf1f8 100%)'
              : '#000000',
          }}
        >
          {/* Animated Cloud Sky in Light Mode (continuous right-to-left loop with smooth fadein/fadeout) */}
          <HeroCloudBackground isLight={theme === 'light'} />

          {/* Neural Clusters Constellation Background in Dark Mode */}
          <SectionConstellation variant="neural-clusters" mascotExclusionRef={mascotRef} opacity={theme === 'dark' ? 0.7 : 0} className="z-0" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center pt-6 sm:pt-8 pb-12 sm:pb-20 border-b border-slate-200/50 dark:border-zinc-850/60 mb-12 sm:mb-20 relative z-10 px-4 sm:px-10 lg:px-12">
            {/* Left Column: Text Content & Actions */}
            <div className="lg:col-span-6 flex flex-col items-start text-left space-y-5 sm:space-y-6 w-full">
              {/* Top Benefit Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-200 select-none shadow-sm backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <span className="font-semibold text-slate-900 dark:text-white">Personal AI Secretary</span>
              </div>

              {/* Hero Headline with Looping Typewriter */}
              <div className="space-y-2 sm:space-y-3 w-full">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08] sm:leading-[1.05]">
                  {t('landing.hero.headlinePrefix', 'Notes, meetings, and documents.')}
                </h1>
                <div className="text-lg sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-slate-600 dark:text-zinc-400 tracking-tight h-[2.25rem] sm:h-[3rem] flex items-center overflow-hidden">
                  <LoopingTypewriter
                    key={language}
                    phrases={activeTypewriterList}
                    className="text-slate-800 dark:text-zinc-300 sm:whitespace-nowrap"
                  />
                </div>
              </div>

              {/* Benefit-Focused Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-zinc-400 max-w-xl leading-relaxed font-normal">
                {t('landing.hero.subheadline', 'Record meeting voice notes, search documents, create illustrated how-to guides, and take notes without cloud servers. Everything stays 100% private on your own computer.')}
              </p>

              {/* Primary Hero Actions */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 pt-2 w-full">
                <Button variant="primary" size="md" onClick={handleOpenWorkspace} className="w-full sm:w-auto justify-center">
                  <span>{isCloudHost ? t('landing.hero.downloadApp', 'Download Desktop App') : t('landing.hero.openWorkspace', 'Open Workspace')}</span>
                  {isCloudHost ? <Download className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-white/40 text-slate-800 dark:text-white bg-white dark:bg-transparent"
                  onClick={() => setIsExtensionModalOpen(true)}
                  title="1-Click Chrome Extension Setup"
                >
                  <ChromeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Chrome Extension</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800">
                    1-Click
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-white/40 text-slate-800 dark:text-white bg-white dark:bg-transparent"
                  onClick={() => setActiveView('download')}
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-300" />
                  <span>{t('landing.hero.downloadAll', 'Download (Mac / Win / Linux)')}</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-white bg-white dark:bg-transparent"
                  onClick={() => setActiveView('studio')}
                >
                  <Video className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-300" />
                  <span>{t('landing.hero.screenStudio', 'Screen Recorder')}</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-white bg-white dark:bg-transparent"
                  onClick={() => {
                    const el = document.getElementById('demo-video-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Play className="w-3.5 h-3.5 fill-current text-slate-700 dark:text-zinc-300" />
                  <span>{t('landing.demo.watchDemo', 'Watch Demo')}</span>
                </Button>
              </div>

              {/* Spec / Security Credentials Strip */}
              <div className="pt-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-6 text-xs text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-850/80 w-full">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>{t('landing.hero.clientDb', '100% Private on Your Device')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>{t('landing.hero.autoAnnotation', 'Automatic Step-by-Step Guides')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>{t('landing.hero.zeroCloudLatency', 'Works Completely Offline')}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Mascot — frameless dark / black-framed light */}
            <div className="lg:col-span-6 flex items-center justify-center relative select-none w-full py-4 sm:py-0">

              {/* Ambient glow — adapts per theme */}
              <div
                className="absolute w-[240px] h-[240px] sm:w-[420px] sm:h-[420px] lg:w-[680px] lg:h-[680px] rounded-full pointer-events-none blur-3xl transition-opacity duration-500"
                style={{
                  opacity: 1,
                  background: theme === 'light'
                    ? 'radial-gradient(circle at center, rgba(15,23,42,0.15) 0%, rgba(30,41,59,0.08) 50%, transparent 75%)'
                    : 'radial-gradient(circle at center, rgba(39,39,42,0.6) 0%, rgba(24,24,27,0.3) 50%, transparent 75%)',
                }}
              />

              {/*
                FRAME WRAPPER:
                - Dark mode  → transparent, no frame — image only
                - Light mode → BLACK frame with dark inner fill
              */}
              <div
                ref={mascotRef}
                className="relative z-10 cursor-pointer group flex items-center justify-center w-[240px] h-[240px] sm:w-[380px] sm:h-[380px] lg:w-[560px] lg:h-[560px] max-w-full rounded-full transition-all duration-500 hover:scale-105 outline-none"
                style={{
                  border: theme === 'light' ? '3px solid rgba(9,9,11,0.88)' : '2px solid transparent',
                  background: theme === 'light'
                    ? 'linear-gradient(to bottom, rgba(9,9,11,0.95), rgba(15,23,42,0.92), rgba(24,24,27,0.90))'
                    : 'transparent',
                  boxShadow: theme === 'light'
                    ? '0 0 0 1px rgba(255,255,255,0.08) inset, 0 25px 60px -10px rgba(0,0,0,0.5), 0 0 40px 10px rgba(0,0,0,0.25)'
                    : 'none',
                  backdropFilter: theme === 'light' ? 'blur(2px)' : 'none',
                  padding: theme === 'light' ? '12px' : '0',
                }}
                tabIndex={0}
                onClick={() => {
                  playPop();
                }}
                onMouseEnter={() => {
                  playThock(1.2);
                }}
                title="HuskyNote Mascot"
              >
                {/* Inner bezel — always dark */}
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center relative"
                  style={{
                    background: theme === 'light'
                      ? 'radial-gradient(circle at 50% 40%, rgba(24,24,27,0.8) 0%, rgba(9,9,11,0.95) 65%, rgba(0,0,0,1) 100%)'
                      : 'transparent',
                    border: theme === 'light' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  {/* Mascot GIF — always shows fully */}
                  <img
                    src="/mascot-reading.gif"
                    alt="HuskyNote Mascot Reading"
                    className="max-w-none h-auto object-contain relative z-10 drop-shadow-[0_12px_32px_rgba(0,0,0,0.8)] animate-float transition-all duration-500"
                    style={{
                      width: theme === 'light' ? '125%' : '112%',
                      maskImage: theme === 'light'
                        ? 'radial-gradient(circle at 50% 52%, black 48%, rgba(0,0,0,0.6) 62%, transparent 76%)'
                        : 'none',
                      WebkitMaskImage: theme === 'light'
                        ? 'radial-gradient(circle at 50% 52%, black 48%, rgba(0,0,0,0.6) 62%, transparent 76%)'
                        : 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Continuous Looping Brand Belts: Video Platforms & Supported File Formats */}
        <BrandCarouselBelts />

        {/* Product Demo Video Showcase with Quantum Lattice Constellation */}
        <ScrollReveal direction="up" delayMs={50}>
          <div id="demo-video-section" className="w-full py-8 sm:py-10 text-left mb-16 sm:mb-28 scroll-mt-20 relative overflow-hidden rounded-3xl px-4 sm:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="quantum-lattice" opacity={theme === 'dark' ? 0.55 : 0} />
            <div className="relative z-10">
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    {t('landing.demo.badge', 'Interactive Live Demo')}
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                    {t('landing.demo.title', 'See HuskyNote in action')}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                    {t('landing.demo.description', 'Try HuskyNote right now: see how it listens to your voice, gives you instant easy summaries, and draws bright red boxes on your papers so you can find answers fast.')}
                  </p>
                </div>

                {/* View Switcher: Interactive Studio vs Full Walkthrough */}
                <div className="grid grid-cols-2 sm:flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-full sm:w-auto">
                  <button
                    onClick={() => setDemoMode('interactive')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                      demoMode === 'interactive'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('landing.demo.interactiveStudio', 'Interactive Studio')}
                  </button>
                  <button
                    onClick={() => setDemoMode('video')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                      demoMode === 'video'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('landing.demo.walkthroughVideo', 'Walkthrough Video')}
                  </button>
                </div>
              </div>

              {/* Interactive Demo Studio or Video Frame */}
              {demoMode === 'interactive' ? (
                <InteractiveFeatureDemo onOpenWorkspace={handleOpenWorkspace} />
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xl dark:shadow-2xl animate-fade-in">
                  <div className="p-3.5 border-b border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                      <span className="ml-2 font-medium text-slate-800 dark:text-zinc-300">HuskyNote Product Walkthrough</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          const img = document.getElementById('demo-video-img') as HTMLImageElement;
                          if (img) img.src = `/huskynote-demo.webp?t=${Date.now()}`;
                        }}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        <span>{t('landing.demo.replay', 'Replay')}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="relative bg-slate-950 flex items-center justify-center p-2 min-h-[400px]">
                    <img
                      id="demo-video-img"
                      src="/huskynote-demo.webp"
                      alt="HuskyNote Product Walkthrough"
                      className="w-full max-h-[640px] object-contain rounded-lg shadow-inner"
                    />
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600 dark:text-zinc-400 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span>Recorded on desktop running local WebAudio, PDF reader, and Ollama.</span>
                    </div>
                    <Button variant="primary" size="sm" onClick={handleOpenWorkspace}>
                      <span>{t('landing.hero.openWorkspace', 'Open Workspace')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>

        {/* Live Interactive Workspace Preview with Synaptic Flow Constellation */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full mb-16 sm:mb-28 relative overflow-hidden rounded-3xl px-4 sm:px-8 lg:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="synaptic-flow" opacity={theme === 'dark' ? 0.5 : 0} />
            <div className="relative z-10">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 mb-2 px-1">
                <span className="font-semibold text-slate-800 dark:text-zinc-300">Document Reader & AI Assistant</span>
                <span className="text-slate-500 dark:text-zinc-500">Interactive Preview</span>
              </div>
              <HeroLiveWorkspace />
            </div>
          </div>
        </ScrollReveal>

        {/* Storytelling Section with Harmonic Wave Constellation */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full mb-16 sm:mb-28 relative overflow-hidden rounded-3xl px-4 sm:px-8 lg:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="harmonic-wave" opacity={theme === 'dark' ? 0.55 : 0} />
            <div className="relative z-10">
              <StickyStorySection />
            </div>
          </div>
        </ScrollReveal>

        {/* Before / After Comparison with Audio Nodes Constellation */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full py-10 sm:py-16 border-t border-slate-200 dark:border-zinc-850 text-left mb-16 sm:mb-28 relative overflow-hidden rounded-3xl px-4 sm:px-8 lg:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="audio-nodes" opacity={theme === 'dark' ? 0.6 : 0} />
            <div className="relative z-10">
              <div className="mb-8">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  {t('landing.summaries.badge', 'Automatic Summaries')}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  {t('landing.summaries.title', 'From messy conversation to clear action items.')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-xl leading-relaxed">
                  {t('landing.summaries.description', 'Drag the slider to see how raw speech transcripts become structured executive decisions and deliverables.')}
                </p>
              </div>
              <BeforeAfterSlider />
            </div>
          </div>
        </ScrollReveal>

        {/* Horizontal Feature Carousel with Stellar Vortex Constellation */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full py-10 sm:py-16 border-t border-slate-200 dark:border-zinc-850 text-left mb-16 sm:mb-28 relative overflow-hidden rounded-3xl px-4 sm:px-8 lg:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="stellar-vortex" opacity={theme === 'dark' ? 0.65 : 0} />
            <div className="relative z-10">
              <div className="mb-8">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  {t('landing.features.badge', 'Features')}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  {t('landing.features.title', 'Built for real everyday work.')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-xl leading-relaxed">
                  {t('landing.features.description', 'Everything runs right on your computer. Private, fast, and works without an internet connection.')}
                </p>
              </div>
              <HorizontalCarousel panels={carouselPanels} />
            </div>
          </div>
        </ScrollReveal>

        {/* Unified Feature Explorer Map */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full mb-16 sm:mb-28">
            <FeatureMap />
          </div>
        </ScrollReveal>

        {/* Local Setup Section with Crystalline Polyhedra Constellation */}
        <ScrollReveal direction="up" delayMs={60}>
          <div id="setup-section" className="w-full py-10 sm:py-16 border-t border-slate-200 dark:border-zinc-850 text-left mb-16 sm:mb-28 scroll-mt-20 relative overflow-hidden rounded-3xl px-4 sm:px-8 lg:px-10">
            <HeroCloudBackground isLight={theme === 'light'} />
            <SectionConstellation variant="crystalline-polyhedra" opacity={theme === 'dark' ? 0.55 : 0} />
            <div className="relative z-10">
              <div className="mb-8">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  {t('landing.setup.badge', 'Quick Setup')}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  {t('landing.setup.title', 'One command to initialize everything.')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                  {t('landing.setup.description', 'HuskyNote includes an automated launcher that checks your local Ollama setup, enables browser permissions, pulls recommended models, and opens your workspace.')}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <CodeBlock
                    title={t('landing.setup.oneClickInit', 'ONE-CLICK INITIALIZATION')}
                    code={`# Clone the repository
git clone https://github.com/ChristianJayCuevas/HuskyNote.git
cd HuskyNote

# Run automated launcher
./start.sh`}
                  />

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-xs text-slate-600 dark:text-zinc-400 space-y-2.5 shadow-sm">
                    <div className="text-slate-900 dark:text-zinc-200 font-semibold mb-1">
                      {t('landing.setup.whatLauncherAutomates', 'What the launcher automates:')}
                    </div>
                    <div className="flex items-start sm:items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span>{t('landing.setup.checkOllama', 'Checks if Ollama is installed (prompts installation if missing)')}</span>
                    </div>
                    <div className="flex items-start sm:items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span>{t('landing.setup.configCors', 'Configures cross-origin settings for local browser communication')}</span>
                    </div>
                    <div className="flex items-start sm:items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span>{t('landing.setup.pullModels', 'Pulls lightweight models automatically if none exist')}</span>
                    </div>
                    <div className="flex items-start sm:items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span>{t('landing.setup.startServer', 'Starts the development server and launches your workspace in browser')}</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm mb-2">
                        <Cpu className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                        <span>{t('landing.setup.supportedModels', 'Supported Local Models')}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                        {t('landing.setup.supportedModelsDesc', 'Compatible with any model running on Ollama, including llama3.2, gemma, mistral, qwen2.5, phi3, and llava.')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                        llama3.2
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                        gemma
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                        qwen2.5
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                        mistral
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm mb-2">
                        <Shield className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                        <span>{t('landing.setup.privacyBoundaries', 'Privacy Boundaries')}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        {t('landing.setup.privacyBoundariesDesc', 'Your notes and recordings never leave your device. AI requests travel exclusively between your web browser and http://localhost:11434.')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Why HuskyNote / Foundations */}
        <ScrollReveal direction="up" delayMs={60}>
          <div className="w-full py-10 sm:py-16 border-t border-slate-200 dark:border-zinc-850 text-left mb-16 sm:mb-20 px-2 sm:px-0">
            <div className="mb-10 text-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                {t('landing.why.badge', 'Why HuskyNote')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                {t('landing.why.title', 'Built for privacy, speed, and ownership')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <TiltCard className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 flex flex-col justify-start space-y-2.5 shadow-sm h-full w-full">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  {t('landing.why.card1Tag', 'Private by Default')}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('landing.why.card1Title', 'Your Data Stays With You')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {t('landing.why.card1Desc', 'Everything is stored directly in your browser using IndexedDB. No remote servers ever read or store your content.')}
                </p>
              </TiltCard>

              <TiltCard className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 flex flex-col justify-start space-y-2.5 shadow-sm h-full w-full">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  {t('landing.why.card2Tag', 'Zero Tracking')}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('landing.why.card2Title', 'No Ads or Tracking')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {t('landing.why.card2Desc', 'No tracking scripts, cookies, or analytics. Your notes, meetings, and thoughts remain completely confidential.')}
                </p>
              </TiltCard>

              <TiltCard className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 flex flex-col justify-start space-y-2.5 shadow-sm h-full w-full">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  {t('landing.why.card3Tag', 'Universal Formats')}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('landing.why.card3Title', 'Export Anytime')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {t('landing.why.card3Desc', 'Export your notes, meeting minutes, and manuals to clean Markdown and PDF files with one click.')}
                </p>
              </TiltCard>

              <TiltCard className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 flex flex-col justify-start space-y-2.5 shadow-sm h-full w-full">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">
                  {t('landing.why.card4Tag', 'Open Source')}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('landing.why.card4Title', 'Free and Auditable')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {t('landing.why.card4Desc', 'Free to use under the MIT license. You can inspect the source code, run it anywhere, or contribute improvements.')}
                </p>
              </TiltCard>
            </div>
          </div>
        </ScrollReveal>

        {/* Final Launch Callout Card */}
        <ScrollReveal direction="up" delayMs={60}>
          <TiltCard maxTilt={3} scale={1.01} className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-12 text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8 shadow-xl dark:shadow-2xl">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {t('landing.cta.title', 'Start taking notes with private local AI.')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t('landing.cta.description', 'No account creation required. No credit card. Your workspace lives entirely inside your browser and local storage.')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
              <Button variant="primary" size="lg" className="w-full sm:w-auto justify-center" onClick={handleOpenWorkspace}>
                <span>{isCloudHost ? t('landing.hero.downloadApp', 'Download Desktop App') : t('landing.cta.openApp', 'Open HuskyNote')}</span>
                {isCloudHost ? <Download className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto justify-center border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-slate-400 dark:hover:border-white/40 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-transparent"
                onClick={() => setActiveView('download')}
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-zinc-300" />
                <span>{t('landing.cta.downloadApp', 'Download App')}</span>
              </Button>
            </div>
          </TiltCard>
        </ScrollReveal>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-zinc-850 py-12 px-6 bg-slate-100 dark:bg-black text-slate-500 dark:text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="HuskyNote" className="w-6 h-6 rounded-md object-contain shadow-xs" />
              <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">HuskyNote</span>
              <span className="text-xs text-slate-500 dark:text-zinc-500">• {t('app.tagline', 'Your Personal AI Secretary')}</span>
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs max-w-sm">
              {t('landing.footer.description', 'Your personal AI secretary for notes, meetings, and documents. Everything stays strictly on your computer — no accounts, no tracking, and no cloud needed.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-zinc-400">
            <button
              onClick={() => setActiveView('download')}
              className="text-slate-900 dark:text-white font-semibold hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            >
              {t('common.download', 'Download')}
            </button>
            <button
              onClick={handleOpenWorkspace}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t('nav.localWorkspace', 'Workspace')}
            </button>
            <button
              onClick={() => setActiveView('privacy')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t('nav.privacy', 'Privacy')}
            </button>
            <button
              onClick={() => setActiveView('about')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t('nav.about', 'About')}
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t('nav.settings', 'Settings')}
            </button>
            <a
              href="https://github.com/ChristianJayCuevas/HuskyNote"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
              {starCount !== null && (
                <span className="flex items-center gap-0.5 text-[11px] font-mono text-amber-500">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <span>{starCount.toLocaleString()}</span>
                </span>
              )}
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-200 dark:border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-zinc-600">
          <span>{t('landing.footer.licenseNotice', 'MIT License • Open Source • Runs on Your Device')}</span>
          <span className="mt-2 sm:mt-0">{t('landing.footer.privateByDefault', 'Private by Default')}</span>
        </div>
      </footer>
    </div>
  );
};
