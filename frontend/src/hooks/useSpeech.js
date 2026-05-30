import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

const API_BASE = '/api';

const PRIORITY_LANGS = ['en-US', 'de-DE', 'ar-SA', 'hi-IN'];
const BONUS_LANGS = ['ta-IN', 'te-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'or-IN'];

const SCRIPT_PATTERNS = [
  { regex: /[\u0900-\u097F]/, lang: 'hi-IN', script: 'Devanagari' },
  { regex: /[\u0B80-\u0BFF]/, lang: 'ta-IN', script: 'Tamil' },
  { regex: /[\u0C00-\u0C7F]/, lang: 'te-IN', script: 'Telugu' },
  { regex: /[\u0980-\u09FF]/, lang: 'bn-IN', script: 'Bengali' },
  { regex: /[\u0A80-\u0AFF]/, lang: 'gu-IN', script: 'Gujarati' },
  { regex: /[\u0C80-\u0CFF]/, lang: 'kn-IN', script: 'Kannada' },
  { regex: /[\u0D00-\u0D7F]/, lang: 'ml-IN', script: 'Malayalam' },
  { regex: /[\u0A00-\u0A7F]/, lang: 'pa-IN', script: 'Gurmukhi' },
  { regex: /[\u0B00-\u0B7F]/, lang: 'or-IN', script: 'Odia' },
  { regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/, lang: 'ar-SA', script: 'Arabic' },
];

const LATIN_RESULT = { lang: 'en-US', script: 'Latin', direction: 'ltr' };

const GERMAN_HINTS = /\b(und|ich|nicht|bitte|danke|für|mit|der|die|das|ein|eine|habe|haben|brauche|möchte|medizin|tabletten|bestellen|warenkorb|kasse|ja|nein)\b/i;
const ARABIC_LATIN_HINTS = /\b(salam|marhaba|shukran|yalla|tamam|aywa)\b/i;
const HINGLISH_HINTS = /\b(mujhe|chahiye|karo|dena|wala|haan|nahi|kitna|dawai|tablet|pehla|dusra|aur|bhi|hai|ke liye|manga|ruko|band)\b/i;
const ENGLISH_HINTS = /\b(the|and|please|need|add|medicine|medicines|cart|order|have|want|for|to|my)\b/i;

function normalizeLanguageTag(lang) {
  if (!lang) return '';
  const clean = String(lang).replace('_', '-');
  const [base, region] = clean.split('-');
  if (!base) return '';
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
}

function pickInitialLanguage() {
  if (typeof navigator === 'undefined') return PRIORITY_LANGS[0];
  const browserLangs = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ]
    .map(normalizeLanguageTag)
    .filter(Boolean);
  const supported = [...PRIORITY_LANGS, ...BONUS_LANGS];
  for (const browserLang of browserLangs) {
    const exact = supported.find(l => l.toLowerCase() === browserLang.toLowerCase());
    if (exact) return exact;
    const base = browserLang.split('-')[0];
    const byBase = supported.find(l => l.toLowerCase().startsWith(`${base}-`));
    if (byBase) return byBase;
  }
  return PRIORITY_LANGS[0];
}

function detectScript(text) {
  if (!text || text.length === 0) return LATIN_RESULT;
  const sample = text.length > 50 ? text.slice(0, 50) : text;
  for (let i = 0; i < SCRIPT_PATTERNS.length; i++) {
    if (SCRIPT_PATTERNS[i].regex.test(sample)) {
      const { lang, script } = SCRIPT_PATTERNS[i];
      return { lang, script, direction: script === 'Arabic' ? 'rtl' : 'ltr' };
    }
  }
  return LATIN_RESULT;
}

function detectLanguageFromText(text, fallbackLang) {
  const scriptDetection = detectScript(text);
  if (scriptDetection.script !== 'Latin') return scriptDetection;
  const sample = (text || '').trim();
  if (!sample) return { ...LATIN_RESULT, lang: fallbackLang || LATIN_RESULT.lang };
  if (GERMAN_HINTS.test(sample) || /[äöüß]/i.test(sample)) {
    return { lang: 'de-DE', script: 'Latin', direction: 'ltr' };
  }
  if (ARABIC_LATIN_HINTS.test(sample)) {
    return { lang: 'ar-SA', script: 'Latin', direction: 'rtl' };
  }
  if (HINGLISH_HINTS.test(sample)) {
    return { lang: 'hi-IN', script: 'Latin', direction: 'ltr' };
  }
  if (ENGLISH_HINTS.test(sample)) {
    return { lang: 'en-US', script: 'Latin', direction: 'ltr' };
  }
  return { lang: fallbackLang || LATIN_RESULT.lang, script: 'Latin', direction: 'ltr' };
}

export function useSpeech() {
  const initialLanguage = useMemo(() => pickInitialLanguage(), []);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [detectedLanguage, setDetectedLanguage] = useState(initialLanguage);
  const [scriptInfo, setScriptInfo] = useState({ ...LATIN_RESULT, lang: initialLanguage });
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [manualLanguage, setManualLanguage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const sileroVADRef = useRef(null);

  const audioPlayerRef = useRef(null);
  const audioOnEndRef = useRef(null);

  const langRef = useRef({ detected: detectedLanguage, manual: null, initial: initialLanguage });
  const lastDetectionRef = useRef({ ...LATIN_RESULT, lang: initialLanguage });

  const autoStopVADRef = useRef(false);

  useEffect(() => {
    langRef.current = { detected: detectedLanguage, manual: manualLanguage, initial: initialLanguage };
  }, [detectedLanguage, manualLanguage, initialLanguage]);

  useEffect(() => {
    fetch(`${API_BASE}/voice/voices`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.voices) {
          setVoices(data.voices);
          setSelectedVoice(data.voices[0] || null);
        }
      })
      .catch(() => {});
  }, []);

  const destroySileroVAD = useCallback(() => {
    if (sileroVADRef.current) {
      sileroVADRef.current.destroy().catch(() => {});
      sileroVADRef.current = null;
    }
    setAudioLevel(0);
    setUserSpeaking(false);
  }, []);

  const startSileroVAD = useCallback((stream) => {
    if (!stream) return;
    const opts = {
      getStream: async () => stream,
      redemptionMs: 900,
      preSpeechPadMs: 200,
      minSpeechMs: 400,
      positiveSpeechThreshold: 0.7,
      negativeSpeechThreshold: 0.3,
      processorType: 'AudioWorklet',
      startOnLoad: true,
      onSpeechStart: () => {
        setUserSpeaking(true);
      },
      onSpeechEnd: () => {
        setUserSpeaking(false);
        if (autoStopVADRef.current && mediaRecorderRef.current?.state === 'recording') {
          try { mediaRecorderRef.current.stop(); } catch (_) {}
        }
      },
      onFrameProcessed: (probs) => {
        setAudioLevel(Math.min(1, probs.isSpeech * 2.5));
      },
      onVADMisfire: () => {},
    };
    MicVAD.new(opts)
      .then(vad => { sileroVADRef.current = vad; })
      .catch(err => console.error('Silero VAD init error:', err));
  }, []);

  const setPreferredLanguage = useCallback((langCode) => {
    const normalized = normalizeLanguageTag(langCode) || null;
    const langToUse = normalized || initialLanguage;
    const direction = (langToUse || '').toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
    setManualLanguage(normalized);
    setDetectedLanguage(langToUse);
    const info = { lang: langToUse, script: 'Latin', direction };
    setScriptInfo(info);
    lastDetectionRef.current = info;
  }, [initialLanguage]);

  const setVoice = useCallback((voice) => {
    setSelectedVoice(voice);
  }, []);

  const sendAudioForTranscription = useCallback(async (blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      const lang = langRef.current.manual || langRef.current.detected;
      if (lang) formData.append('language', lang.split('-')[0]);

      const res = await fetch(`${API_BASE}/voice/transcribe`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      const text = (data.text || '').trim();
      setTranscript(text);

      if (text && data.language && !langRef.current.manual) {
        const langMap = { en: 'en-US', de: 'de-DE', ar: 'ar-SA', hi: 'hi-IN' };
        const backendLang = langMap[data.language] || (data.language ? `${data.language}-${data.language.toUpperCase()}` : null);
        if (backendLang) {
          const detected = detectLanguageFromText(text, backendLang);
          lastDetectionRef.current = detected;
          setScriptInfo(detected);
          setDetectedLanguage(detected.lang);
        }
      }
    } catch (err) {
      console.error('[STT] transcription error:', err);
      setError(err.message || 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') return;
    setTranscript('');
    setError(null);
    audioChunksRef.current = [];
    const langToUse = langRef.current.manual || langRef.current.detected || langRef.current.initial;
    setScriptInfo(prev => ({
      ...prev,
      lang: langToUse,
      direction: langToUse.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr',
    }));

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        startSileroVAD(stream);

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          setIsListening(false);
          destroySileroVAD();
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          audioChunksRef.current = [];
          if (blob.size > 0) sendAudioForTranscription(blob);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
        };
        recorder.onerror = () => {
          setIsListening(false);
          setError('Recording error occurred');
        };
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsListening(true);
      })
      .catch(() => {
        setError('Microphone access denied');
        setIsSupported(false);
        destroySileroVAD();
      });
  }, [startSileroVAD, sendAudioForTranscription]);

  const stopListening = useCallback(() => {
    autoStopVADRef.current = false;
    destroySileroVAD();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setIsListening(false);
    }
  }, [destroySileroVAD]);

  const toggleListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const speak = useCallback((text, options = {}) => {
    if (!text) {
      if (options.onEnd) setTimeout(() => options.onEnd(), 50);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsSpeaking(true);

    const lang = options.lang || langRef.current.detected || langRef.current.initial;
    audioOnEndRef.current = options.onEnd || null;

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('language', lang);
    if (options.rate && options.rate !== 1.0) {
      const diff = Math.round((options.rate - 1) * 100);
      params.set('rate', `${diff >= 0 ? '+' : ''}${diff}%`);
    }

    const url = `${API_BASE}/voice/tts?${params.toString()}`;

    const handleEnd = () => {
      setIsSpeaking(false);
      audioPlayerRef.current = null;
      if (audioOnEndRef.current) {
        const cb = audioOnEndRef.current;
        audioOnEndRef.current = null;
        cb();
      }
    };

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('TTS request failed');
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audioPlayerRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          handleEnd();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          handleEnd();
        };
        return audio.play();
      })
      .catch(() => {
        handleEnd();
      });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsSpeaking(false);
    audioOnEndRef.current = null;
  }, []);

  const enableVAD = useCallback(() => {
    autoStopVADRef.current = true;
  }, []);

  const disableVAD = useCallback(() => {
    autoStopVADRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      destroySileroVAD();
    };
  }, [destroySileroVAD]);

  return {
    isListening,
    isSpeaking,
    isTranscribing,
    userSpeaking,
    transcript,
    error,
    isSupported,
    audioLevel,
    detectedLanguage,
    scriptInfo,
    manualLanguage,
    voices,
    selectedVoice,
    setVoice,
    setPreferredLanguage,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    setTranscript,
    enableVAD,
    disableVAD,
  };
}
