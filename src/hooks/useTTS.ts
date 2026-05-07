import { useCallback, useRef, useState, useEffect } from "react";
import type { Gender } from "@/contexts/AuthContext";

/**
 * Browser-native Text-to-Speech hook.
 * Picks a voice based on user gender (male/female).
 */
export function useTTS(gender: Gender | null) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Pick an appropriate voice
  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Try Arabic voices first
    const arVoices = voices.filter((v) => v.lang.startsWith("ar"));
    
    // Filter by gender heuristic (voice name keywords)
    const maleKeywords = ["male", "man", "david", "daniel", "james", "google uk english male", "majed"];
    const femaleKeywords = ["female", "woman", "zira", "samantha", "google uk english female", "maryam"];
    
    const keywords = gender === "female" ? femaleKeywords : maleKeywords;
    const antiKeywords = gender === "female" ? maleKeywords : femaleKeywords;
    
    // Try Arabic + gender match
    const arGender = arVoices.find((v) =>
      keywords.some((k) => v.name.toLowerCase().includes(k))
    );
    if (arGender) return arGender;

    // Try any Arabic voice that doesn't match opposite gender
    const arOk = arVoices.find((v) =>
      !antiKeywords.some((k) => v.name.toLowerCase().includes(k))
    );
    if (arOk) return arOk;
    if (arVoices.length) return arVoices[0];

    // Fallback: any voice matching gender
    const genderVoice = voices.find((v) =>
      keywords.some((k) => v.name.toLowerCase().includes(k))
    );
    if (genderVoice) return genderVoice;

    return voices[0];
  }, [gender]);

  // Ensure voices loaded
  useEffect(() => {
    speechSynthesis.getVoices(); // trigger loading
    const h = () => {};
    speechSynthesis.addEventListener?.("voiceschanged", h);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", h);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !text) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = "ar-SA";
      }
      u.rate = 1;
      u.pitch = gender === "female" ? 1.1 : 0.9;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utteranceRef.current = u;
      speechSynthesis.speak(u);
    },
    [voiceEnabled, pickVoice, gender]
  );

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      if (v) speechSynthesis.cancel();
      return !v;
    });
  }, []);

  return { voiceEnabled, toggleVoice, speaking, speak, stop };
}
