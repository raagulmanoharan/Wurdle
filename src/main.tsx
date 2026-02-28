import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {createSpeechlySpeechRecognition} from '@speechly/speech-recognition-polyfill';
import App from './App.tsx';
import './index.css';

// Apply Speechly polyfill when native Speech Recognition is unavailable (e.g. iOS Safari, Firefox).
// Enables voice input on mobile without requiring Chrome/Edge.
const appId = import.meta.env.VITE_SPEECHLY_APP_ID;
if (!window.SpeechRecognition && !(window as any).webkitSpeechRecognition && appId) {
  const SpeechlyRecognition = createSpeechlySpeechRecognition(appId);
  if (SpeechlyRecognition.hasBrowserSupport) {
    (window as any).SpeechRecognition = SpeechlyRecognition;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
