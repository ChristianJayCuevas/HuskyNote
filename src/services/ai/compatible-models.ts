import type { OllamaModel } from '../../types';

export type ModelTier = 'minimum' | 'standard' | 'pro' | 'advanced';

export interface ModelTierInfo {
  tier: ModelTier;
  rank: number;
  label: string;
  badge: string;
  minRam: string;
  targetHardware: string;
  description: string;
}

export const MODEL_TIERS: Record<ModelTier, ModelTierInfo> = {
  minimum: {
    tier: 'minimum',
    rank: 1,
    label: 'Lightweight & Fast (1B – 2B)',
    badge: 'Fast & Battery Friendly',
    minRam: '4 GB RAM',
    targetHardware: 'Everyday laptops, older computers',
    description: 'Runs fast on any computer with low battery use. Great for quick notes, outlines, and meeting minutes.',
  },
  standard: {
    tier: 'standard',
    rank: 2,
    label: 'Balanced & Daily (3B – 4B)',
    badge: 'Best for Most People',
    minRam: '8 GB RAM',
    targetHardware: 'Modern laptops, MacBook Air, standard PCs',
    description: 'The best balance of speed and helpfulness. Great for reading documents, meeting action items, and answering questions.',
  },
  pro: {
    tier: 'pro',
    rank: 3,
    label: 'High Detail & Research (7B – 8B)',
    badge: 'In-Depth & Detailed',
    minRam: '16 GB RAM',
    targetHardware: 'Apple Silicon Macs, 16GB+ RAM PCs',
    description: 'Detailed answers for long meetings, complex documents, and thorough note summaries.',
  },
  advanced: {
    tier: 'advanced',
    rank: 4,
    label: 'Maximum Depth (14B)',
    badge: 'Maximum Detail',
    minRam: '24+ GB RAM',
    targetHardware: 'High-power computers, 24GB+ RAM',
    description: 'Best for very large document collections. Requires a powerful computer with plenty of memory.',
  },
};

export interface CompatibleModel {
  id: string; // primary Ollama pull tag
  aliases: string[]; // known alternative tags that resolve to this model
  name: string;
  provider: string;
  parameterSize: string;
  downloadSize: string;
  ramRequiredGb: number;
  tier: ModelTier;
  tierRank: number;
  speedRating: 'Fastest' | 'Very Fast' | 'Moderate' | 'Heavy';
  summary: string;
  recommendedFor: string;
  isAppDefault?: boolean;
}

/**
 * Curated catalog of models compatible with HuskyNote,
 * strictly ordered from Minimum Tier (1B) to Higher Tiers (14B).
 */
export const COMPATIBLE_MODELS: CompatibleModel[] = [
  // --- TIER 1: MINIMUM / ULTRA-LIGHT (1B - 2B) ---
  {
    id: 'llama3.2:1b',
    aliases: ['llama3.2:1b', 'llama3.2:1b-instruct', 'llama3.2:1b-text'],
    name: 'Llama 3.2 (1B)',
    provider: 'Meta',
    parameterSize: '1.2B',
    downloadSize: '1.3 GB',
    ramRequiredGb: 4,
    tier: 'minimum',
    tierRank: 1,
    speedRating: 'Fastest',
    summary: 'Fast responses with almost no battery drain. Runs smoothly on any computer.',
    recommendedFor: 'Older computers, quick notes, saving battery',
  },
  {
    id: 'qwen2.5:1.5b',
    aliases: ['qwen2.5:1.5b', 'qwen2.5:1.5b-instruct'],
    name: 'Qwen 2.5 (1.5B)',
    provider: 'Alibaba',
    parameterSize: '1.5B',
    downloadSize: '1.0 GB',
    ramRequiredGb: 4,
    tier: 'minimum',
    tierRank: 1,
    speedRating: 'Fastest',
    summary: 'Fast and easy to use. Great for multiple languages and quick summaries.',
    recommendedFor: 'Everyday laptops, multiple languages, quick summaries',
  },
  {
    id: 'gemma2:2b',
    aliases: ['gemma2:2b', 'gemma2:2b-instruct'],
    name: 'Gemma 2 (2B)',
    provider: 'Google',
    parameterSize: '2.6B',
    downloadSize: '1.6 GB',
    ramRequiredGb: 4,
    tier: 'minimum',
    tierRank: 1,
    speedRating: 'Fastest',
    summary: 'Clean formatting and dependable notes, even on computers with less memory.',
    recommendedFor: 'Clear note outlines, meeting takeaways',
  },

  // --- TIER 2: BALANCED / STANDARD (3B - 4B) ---
  {
    id: 'llama3.2:3b',
    aliases: ['llama3.2:3b', 'llama3.2:latest', 'llama3.2'],
    name: 'Llama 3.2 (3B)',
    provider: 'Meta',
    parameterSize: '3.2B',
    downloadSize: '2.0 GB',
    ramRequiredGb: 8,
    tier: 'standard',
    tierRank: 2,
    speedRating: 'Very Fast',
    summary: 'Recommended. The perfect balance of clear writing, fast answers, and smooth performance.',
    recommendedFor: 'Most people, everyday notes, meeting transcripts, reading documents',
    isAppDefault: true,
  },
  {
    id: 'qwen2.5:3b',
    aliases: ['qwen2.5:3b', 'qwen2.5:3b-instruct'],
    name: 'Qwen 2.5 (3B)',
    provider: 'Alibaba',
    parameterSize: '3.1B',
    downloadSize: '2.0 GB',
    ramRequiredGb: 8,
    tier: 'standard',
    tierRank: 2,
    speedRating: 'Very Fast',
    summary: 'Great for organized checklists, clear tables, and concise meeting takeaways.',
    recommendedFor: 'Organized documents, tables, task checklists',
  },
  {
    id: 'phi3.5:3.8b',
    aliases: ['phi3.5:3.8b', 'phi3.5:latest', 'phi3.5'],
    name: 'Phi 3.5 (3.8B)',
    provider: 'Microsoft',
    parameterSize: '3.8B',
    downloadSize: '2.2 GB',
    ramRequiredGb: 8,
    tier: 'standard',
    tierRank: 2,
    speedRating: 'Very Fast',
    summary: 'Clear step-by-step thinking in a compact size. Great for guides and how-to manuals.',
    recommendedFor: 'Step-by-step guides, how-to manuals',
  },

  // --- TIER 3: HIGH PERFORMANCE / PRO (7B - 8B) ---
  {
    id: 'llama3.1:8b',
    aliases: ['llama3.1:8b', 'llama3.1:latest', 'llama3.1'],
    name: 'Llama 3.1 (8B)',
    provider: 'Meta',
    parameterSize: '8.0B',
    downloadSize: '4.7 GB',
    ramRequiredGb: 16,
    tier: 'pro',
    tierRank: 3,
    speedRating: 'Moderate',
    summary: 'Recommended for powerful computers. Thoroughly analyzes long meetings, large documents, and detailed notes.',
    recommendedFor: 'Apple Silicon Macs, 16GB+ RAM PCs, large document collections',
  },
  {
    id: 'qwen2.5:7b',
    aliases: ['qwen2.5:7b', 'qwen2.5:7b-instruct', 'qwen2.5-coder:7b'],
    name: 'Qwen 2.5 (7B)',
    provider: 'Alibaba',
    parameterSize: '7.6B',
    downloadSize: '4.5 GB',
    ramRequiredGb: 16,
    tier: 'pro',
    tierRank: 3,
    speedRating: 'Moderate',
    summary: 'Top performance across multiple languages and complex documents.',
    recommendedFor: 'Detailed documentation, large PDF files, multiple languages',
  },
  {
    id: 'mistral:7b',
    aliases: ['mistral:7b', 'mistral:latest', 'mistral'],
    name: 'Mistral (7B)',
    provider: 'Mistral AI',
    parameterSize: '7.2B',
    downloadSize: '4.1 GB',
    ramRequiredGb: 16,
    tier: 'pro',
    tierRank: 3,
    speedRating: 'Moderate',
    summary: 'Clean writing and reliable summaries for meetings and notes.',
    recommendedFor: 'Meeting summaries, polishing notes',
  },
  {
    id: 'gemma2:9b',
    aliases: ['gemma2:9b', 'gemma2:9b-instruct', 'gemma2:latest'],
    name: 'Gemma 2 (9B)',
    provider: 'Google',
    parameterSize: '9.2B',
    downloadSize: '5.5 GB',
    ramRequiredGb: 16,
    tier: 'pro',
    tierRank: 3,
    speedRating: 'Moderate',
    summary: 'High-accuracy answers and thorough document research.',
    recommendedFor: 'Research notes, high-accuracy answers',
  },

  // --- TIER 4: ADVANCED / POWER (14B) ---
  {
    id: 'qwen2.5:14b',
    aliases: ['qwen2.5:14b', 'qwen2.5:14b-instruct'],
    name: 'Qwen 2.5 (14B)',
    provider: 'Alibaba',
    parameterSize: '14.7B',
    downloadSize: '9.0 GB',
    ramRequiredGb: 24,
    tier: 'advanced',
    tierRank: 4,
    speedRating: 'Heavy',
    summary: 'Deepest analysis for very large libraries of files. Requires 24GB+ RAM.',
    recommendedFor: 'High-power workstations, 24GB+ RAM Apple Silicon, thorough research',
  },
];

/**
 * System hardware detection profile
 */
export interface SystemHardwareProfile {
  cpuCores: number;
  memoryEstimateGb: number;
  gpuRenderer: string;
  isAppleSilicon: boolean;
  recommendedTier: ModelTier;
  recommendedModelId: string;
  recommendationTitle: string;
  recommendationReason: string;
}

/**
 * Detect client system specifications and determine the optimal model recommendation
 */
export function detectSystemHardware(): SystemHardwareProfile {
  const cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const rawMemory = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 8 : 8;

  let gpuRenderer = '';
  let isAppleSilicon = false;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }
    } catch {
      // ignore
    }
  }

  const lowerGpu = gpuRenderer.toLowerCase();
  if (
    lowerGpu.includes('apple') ||
    lowerGpu.includes('m1') ||
    lowerGpu.includes('m2') ||
    lowerGpu.includes('m3') ||
    lowerGpu.includes('m4') ||
    (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) && cpuCores >= 8)
  ) {
    isAppleSilicon = true;
  }

  // Friendly GPU name display
  let cleanGpu = 'Standard Graphics Engine';
  if (isAppleSilicon) {
    const mMatch = gpuRenderer.match(/Apple M\d(\s*(Pro|Max|Ultra))?/i);
    cleanGpu = mMatch ? mMatch[0] : 'Apple Silicon GPU';
  } else if (gpuRenderer) {
    cleanGpu = gpuRenderer.split(',')[0].replace(/^ANGLE\s*\(/i, '').replace(/\)$/, '').trim();
  }

  let recommendedTier: ModelTier = 'standard';
  let recommendedModelId = 'llama3.2:3b';
  let recommendationTitle = 'Llama 3.2 (3B) — Recommended for Your Computer';
  let recommendationReason = 'Great balance of fast speed and clear, helpful notes for your computer.';

  if (isAppleSilicon) {
    if (cpuCores >= 10 || rawMemory >= 16) {
      recommendedTier = 'pro';
      recommendedModelId = 'llama3.1:8b';
      recommendationTitle = 'Llama 3.1 (8B) — Recommended for Your Mac';
      recommendationReason =
        'Your Mac has plenty of power. Runs fast and handles long notes and detailed summaries smoothly.';
    } else {
      recommendedTier = 'standard';
      recommendedModelId = 'llama3.2:3b';
      recommendationTitle = 'Llama 3.2 (3B) — Recommended for Your Mac';
      recommendationReason =
        'Fast performance with great battery life. Perfect for everyday notes and meeting summaries.';
    }
  } else if (rawMemory >= 16 || cpuCores >= 12) {
    recommendedTier = 'pro';
    recommendedModelId = 'llama3.1:8b';
    recommendationTitle = 'Llama 3.1 (8B) — Recommended for Your PC';
    recommendationReason =
      'Great computer performance detected. Handles larger models and deep document searches easily.';
  } else if (rawMemory <= 4 || cpuCores <= 4) {
    recommendedTier = 'minimum';
    recommendedModelId = 'llama3.2:1b';
    recommendationTitle = 'Llama 3.2 (1B) — Lightweight & Fast';
    recommendationReason =
      'Lightweight setup detected. This model runs quickly and smoothly without slowing down your computer.';
  } else {
    recommendedTier = 'standard';
    recommendedModelId = 'llama3.2:3b';
    recommendationTitle = 'Llama 3.2 (3B) — Recommended for Your Computer';
    recommendationReason =
      'Recommended for your computer. Great balance of fast speed and clear, helpful notes.';
  }

  return {
    cpuCores,
    memoryEstimateGb: rawMemory,
    gpuRenderer: cleanGpu,
    isAppleSilicon,
    recommendedTier,
    recommendedModelId,
    recommendationTitle,
    recommendationReason,
  };
}


/**
 * Check if an installed Ollama model matches any compatible model in our catalog
 */
export function findMatchingCompatibleModel(
  installedName: string
): CompatibleModel | undefined {
  const norm = installedName.trim().toLowerCase();
  // Strip ':latest' if present for base comparison
  const baseName = norm.replace(/:latest$/, '');

  return COMPATIBLE_MODELS.find((m) => {
    if (m.id.toLowerCase() === norm) return true;
    if (m.id.toLowerCase().replace(/:latest$/, '') === baseName) return true;
    return m.aliases.some((alias) => {
      const aliasNorm = alias.toLowerCase();
      return norm === aliasNorm || baseName === aliasNorm.replace(/:latest$/, '');
    });
  });
}

/**
 * Check if a specific compatible model is installed in the local Ollama instance
 */
export function isModelInstalled(
  model: CompatibleModel,
  installedModels: OllamaModel[]
): boolean {
  return getInstalledOllamaModel(model, installedModels) !== undefined;
}

/**
 * Retrieve the matching installed OllamaModel record if available
 */
export function getInstalledOllamaModel(
  model: CompatibleModel,
  installedModels: OllamaModel[]
): OllamaModel | undefined {
  const targetId = model.id.toLowerCase();
  const baseTarget = targetId.replace(/:latest$/, '');

  return installedModels.find((m) => {
    const installedNorm = (m.name || m.model || '').toLowerCase();
    const installedBase = installedNorm.replace(/:latest$/, '');

    if (installedNorm === targetId || installedBase === baseTarget) return true;
    return model.aliases.some((alias) => {
      const aliasNorm = alias.toLowerCase();
      return installedNorm === aliasNorm || installedBase === aliasNorm.replace(/:latest$/, '');
    });
  });
}
