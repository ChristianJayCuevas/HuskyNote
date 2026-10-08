import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/theme-context';
import { LanguageProvider } from './context/language-context';
import { WorkspaceProvider } from './context/workspace-context';
import { AIProviderContext } from './context/ai-context';
import { migrateLegacyData } from './services/legacy-migration';
import { setPreferredTranscriptionEngine } from './services/audio/transcription-engines';
import { db } from './db';
import './brand/fonts';
import './index.css';

async function loadTranscriptionPreference(): Promise<void> {
  try {
    const settings = await db.settings.get('current');
    if (settings?.transcriptionEngine) setPreferredTranscriptionEngine(settings.transcriptionEngine);
  } catch {
    // keep the default engine
  }
}

// Carry over data saved by pre-rebrand DomoNote builds before anything reads storage
migrateLegacyData().then(loadTranscriptionPreference).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <LanguageProvider>
          <AIProviderContext>
            <WorkspaceProvider>
              <App />
            </WorkspaceProvider>
          </AIProviderContext>
        </LanguageProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
});
