import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {createSpeechlySpeechRecognition} from '@speechly/speech-recognition-polyfill';
import App from './App.tsx';
import RevealSoundTest from './RevealSoundTest.tsx';
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

const isSoundTest = window.location.pathname === '/reveal-sound-test';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSoundTest ? <RevealSoundTest /> : <App />}
  </StrictMode>,
);
