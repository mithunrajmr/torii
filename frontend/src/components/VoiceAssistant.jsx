// frontend/src/components/VoiceAssistant.jsx
// Speaks a single text message using the Web Speech API (SpeechSynthesis).
// Renders nothing — purely a side-effect component.
//
// Props:
//   text   {string}   — The message to speak aloud.
//   onEnd  {function} — Called when speech finishes (or if TTS is unavailable).

import { useEffect } from 'react';

export default function VoiceAssistant({ text, onEnd }) {
  useEffect(() => {
    if (!text) {
      onEnd?.();
      return;
    }

    // Graceful degradation — if browser doesn't support TTS, call onEnd immediately
    if (!window.speechSynthesis) {
      console.info('[VoiceAssistant] speechSynthesis not supported in this browser');
      onEnd?.();
      return;
    }

    // Cancel any in-progress speech before starting (handles hot-reloads / re-mounts)
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';   // Indian English accent where available
    utterance.rate = 0.92;       // Slightly slower for clarity in noisy kiosk environment
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => {
      console.warn('[VoiceAssistant] Speech error:', e.error);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);

    // Cleanup: cancel speech if the component unmounts before it finishes
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text]); // Re-speak only if text changes

  return null; // This component has no visible output
}
