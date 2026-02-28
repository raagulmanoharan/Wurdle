/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ArrowRight, X, Volume2, VolumeX, Share2, RotateCcw, Key, Loader2, Sparkles } from 'lucide-react';
import { generateDaVinciSketch, generateConceptWord } from './services/geminiService';
import { shareImage } from './shareUtils';
import { playTypingSound, playRevealSound, playSparkleSound, startScrambleSound } from './audioUtils';
import { vibrateHapticTyping, vibrateHapticReveal } from './hapticUtils';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type ScreenState = 'splash' | 'input' | 'result' | 'upgrade';
type ConceptData = { word: string; pronunciation: string; definition: string; discovery: string; image: string; };

const ABSURD_EXAMPLES = [
  "A self-aware toaster that philosophizes about the fleeting nature of warmth while intentionally burning your sourdough to teach you a profound lesson about the inevitability of loss and attachment.",
  "A pair of noise-canceling headphones that replaces all background noise with a live, slightly out-of-tune mariachi band that dynamically reacts to your current stress levels.",
  "A smart refrigerator that passively-aggressively locks its doors and suggests room-temperature water when you reach for a midnight snack, citing your search history and lack of cardio.",
  "An umbrella that actively seeks out rain clouds and alters local weather patterns to ensure you get wet, claiming it builds character and a deeper appreciation for dry towels.",
  "A coffee mug that analyzes your micro-expressions and sleep patterns, automatically decaffeinating your brew if it thinks you're too jittery, replacing it with lukewarm chamomile tea.",
  "A mechanical pencil that corrects your spelling by physically wrestling your hand until you write the right letter, leaving you exhausted but grammatically flawless.",
  "A pair of socks that use quantum entanglement to ensure one foot is always slightly too warm and the other uncomfortably cold.",
  "A GPS that refuses the fastest route, insisting on the most 'scenic and emotionally fulfilling' journey through obscure back alleys.",
  "A toothbrush that hums motivational speeches about dental hygiene while judging your brushing technique in real time.",
  "A doormat that greets visitors with passive-aggressive compliments based on how long they've been standing there.",
  "A lamp that dims itself when it detects you're reading something it disapproves of.",
  "A yoga mat that sighs audibly when you skip your morning stretch and holds a grudge all day.",
  "A bookshelf that rearranges itself at night to hide the books you said you'd read but never did.",
  "A plant that thrives on passive aggression and wilts dramatically when you forget to water it.",
  "A mirror that offers unsolicited fashion advice and occasionally gasps at your outfit choices.",
  "A showerhead that plays dramatic orchestral music during your most mundane showers.",
  "A stapler that refuses to staple more than three pages at once, citing 'structural integrity concerns.'",
  "A clock that runs slightly fast on weekdays and slightly slow on weekends to mess with your sense of time."
];

const RANDOM_CONCEPTS = [
  "A toaster that screams when your bread is perfectly browned",
  "An umbrella that rains on you to keep you cool in the summer",
  "A coffee mug that judges your life choices based on your caffeine intake",
  "A pair of glasses that translates dog barks into sarcastic comments",
  "A pillow that absorbs your nightmares and turns them into a soft hum",
  "A refrigerator that locks itself when it senses you're bored, not hungry",
  "A pen that corrects your grammar but insults you while doing it",
  "A hat that projects your current mood as a weather hologram above your head",
  "A doorbell that only rings when it thinks the visitor is worth your time",
  "A soap dispenser that dispenses compliments instead of soap when you're having a bad day",
  "A calendar that crosses out days it considers 'unproductive' without your permission",
  "A keychain that plays dramatic music when you're searching for your keys",
  "A salt shaker that judges how much salt you're putting on your food",
  "A lint roller that hums show tunes while you clean your clothes",
  "A rubber duck that offers therapy sessions during your bath",
  "A bookmark that gets offended when you dog-ear pages instead of using it",
  "A tape dispenser that makes a disappointed sigh when you use too much tape",
  "A paperweight that believes it has a more important job than it actually does",
  "A desk organizer that rearranges your pens by color when you're not looking",
  "A coaster that slides away from your drink when it thinks you've had enough caffeine"
];

const screenVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '100%' : '-100%',
    opacity: 1
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '-100%' : '100%',
    opacity: 1
  })
};

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<ScreenState>('splash');
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [concept, setConcept] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<ConceptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [inputScrolledFromTop, setInputScrolledFromTop] = useState(false);
  const [isOnInputSlide, setIsOnInputSlide] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [cardScrolledFromTop, setCardScrolledFromTop] = useState(false);
  const cardScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [displayConcept, setDisplayConcept] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const [wordHistory, setWordHistory] = useState<ConceptData[]>([]);
  const inputCardsScrollRef = useRef<HTMLDivElement>(null);
  const inputSlideScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const baseConceptRef = useRef("");
  const typingAudioCtxRef = useRef<AudioContext | null>(null);
  const scrambleSoundRef = useRef<{ stop: () => void } | null>(null);
  const lastTypingSoundRef = useRef(0);
  const cancelledRef = useRef(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);
  const dot3Ref = useRef<HTMLDivElement>(null);
  const shareDataRef = useRef<{ file: File; text: string; dataUrl?: string; hostedUrl?: string } | null>(null);
  const [shareReady, setShareReady] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAddToHomeDrawer, setShowAddToHomeDrawer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const color = isDesktop ? '#ffffff' : screen === 'splash' ? '#FF3B44' : screen === 'input' ? '#F6C927' : '#000000';
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    if (screen === 'splash') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [screen, isDesktop]);

  useEffect(() => {
    const stored = localStorage.getItem('generationCount');
    const date = localStorage.getItem('generationDate');
    const today = new Date().toDateString();
    
    if (date === today) {
      setGenerationCount(Number(stored) || 0);
    } else {
      localStorage.setItem('generationDate', today);
      localStorage.setItem('generationCount', '0');
      setGenerationCount(0);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex(prev => {
        const others = ABSURD_EXAMPLES.map((_, i) => i).filter(i => i !== prev);
        return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : 0;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (screen === 'result' && resultRef.current) {
      resultRef.current.scrollTop = 0;
      const el = resultRef.current;
      const handleScroll = () => {
        setIsScrolled(el.scrollTop > 10);
        setIsScrolledToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 50);
      };
      el.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => el.removeEventListener('scroll', handleScroll);
    }
    window.scrollTo(0, 0);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      const isBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
      setIsScrolledToBottom(isBottom);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [screen, currentResult]);

  useEffect(() => {
    if (screen !== 'input') {
      setInputScrolledFromTop(false);
      setCardScrolledFromTop(false);
      setIsInputFocused(false);
      return;
    }
    const el = inputSlideScrollRef.current;
    if (!el) return;
    const handleInputScroll = () => {
      setInputScrolledFromTop(el.scrollTop > 10);
    };
    el.addEventListener('scroll', handleInputScroll);
    handleInputScroll();
    return () => el.removeEventListener('scroll', handleInputScroll);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'input') return;
    const el = inputCardsScrollRef.current;
    if (!el) return;
    const checkSlide = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const isAtInput = scrollWidth - clientWidth <= 0 || scrollLeft >= scrollWidth - clientWidth - 10;
      setIsOnInputSlide(isAtInput);
      if (!isAtInput && wordHistory.length > 0) {
        const cardIndex = Math.round(scrollLeft / clientWidth);
        const cardEl = cardScrollRefs.current[cardIndex];
        setCardScrolledFromTop(cardEl ? cardEl.scrollTop > 10 : false);
      } else {
        setCardScrolledFromTop(false);
      }
    };
    el.addEventListener('scroll', checkSlide, { passive: true });
    checkSlide();
    return () => el.removeEventListener('scroll', checkSlide);
  }, [screen, wordHistory.length]);

  useEffect(() => {
    if (screen !== 'input') return;
    const el = inputCardsScrollRef.current;
    if (!el) return;
    const scrollToInput = () => {
      el.scrollLeft = el.scrollWidth;
    };
    requestAnimationFrame(() => setTimeout(scrollToInput, 50));
  }, [screen, wordHistory.length]);

  useEffect(() => {
    if (screen === 'result') {
      window.scrollTo(0, 0);
    }
  }, [screen, currentResult]);

  const APP_URL = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const SHARE_TEXT = "Just forged this absurd word — you gotta try this weird little app that invents scientific terms for ridiculous ideas 😂";
  const SHARE_MESSAGE = APP_URL ? `${SHARE_TEXT} ${APP_URL}` : SHARE_TEXT;

  useEffect(() => {
    if (!currentResult) {
      shareDataRef.current = null;
      setShareReady(false);
      return;
    }
    let cancelled = false;
    const prepare = async () => {
      try {
        const pixelRatio = 2;
        const width = 400 * pixelRatio;
        const padding = 32 * pixelRatio;
        const bottomPadding = 48 * pixelRatio;

        const imgEl = new Image();
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = reject;
          imgEl.src = currentResult!.image;
        });
        if (cancelled) return;

        const imgAspect = imgEl.naturalHeight / imgEl.naturalWidth;
        const imgW = width - padding * 2;
        const imgH = imgW * imgAspect;

        const wordFontSize = 48 * pixelRatio;
        const wordLineHeight = 1;
        const wordMb = 16 * pixelRatio;
        const defFontSize = 20 * pixelRatio;
        const defLineHeight = 1.625;
        const defLinePx = defFontSize * defLineHeight;
        const defMb = 24 * pixelRatio;
        const footerFontSize = 12 * pixelRatio;
        const footerHeight = 24 * pixelRatio;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        const maxTextWidth = width - padding * 2;
        ctx.font = `${defFontSize}px "Didact Gothic", sans-serif`;
        const words = currentResult.definition.split(/\s+/);
        const defLinesArr: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (ctx.measureText(test).width <= maxTextWidth) {
            line = test;
          } else {
            if (line) defLinesArr.push(line);
            line = ctx.measureText(w).width <= maxTextWidth ? w : w.slice(0, 25) + '…';
          }
        }
        if (line) defLinesArr.push(line);

        await document.fonts.load('16px "DM Serif Text"');
        if (cancelled) return;

        ctx.font = `${wordFontSize}px "DM Serif Text", serif`;
        const wordLower = currentResult.word.toLowerCase();
        const wordLines: string[] = [];
        if (ctx.measureText(wordLower).width <= maxTextWidth) {
          wordLines.push(wordLower);
        } else {
          let breakAt = 0;
          for (let i = 1; i <= wordLower.length; i++) {
            if (ctx.measureText(wordLower.slice(0, i)).width > maxTextWidth) {
              breakAt = i - 1;
              break;
            }
            breakAt = i;
          }
          wordLines.push(wordLower.slice(0, breakAt));
          if (breakAt < wordLower.length) {
            wordLines.push(wordLower.slice(breakAt));
          }
        }

        const wordBlockHeight = wordLines.length * wordFontSize * wordLineHeight;
        const defBlockHeight = defLinesArr.length * defLinePx;
        const height = padding + imgH + padding + wordBlockHeight + wordMb + defBlockHeight + defMb + footerHeight + bottomPadding;
        canvas.height = height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(imgEl, padding, padding, imgW, imgH);
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'top';

        ctx.font = `${wordFontSize}px "DM Serif Text", serif`;
        wordLines.forEach((ln, i) => {
          ctx.fillText(ln, padding, padding + imgH + padding + i * wordFontSize * wordLineHeight);
        });
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `${defFontSize}px "Didact Gothic", sans-serif`;
        defLinesArr.forEach((ln, i) => {
          ctx.fillText(ln, padding, padding + imgH + padding + wordBlockHeight + wordMb + i * defLinePx);
        });
        const footerY = height - bottomPadding - footerHeight;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${footerFontSize}px "Didact Gothic", sans-serif`;
        ctx.fillText('generated with ', padding, footerY);
        const genW = ctx.measureText('generated with ').width;
        ctx.font = `${footerFontSize}px "DM Serif Text", serif`;
        ctx.fillText('Wurdle', padding + genW, footerY);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png', 1);
        });
        if (!blob || cancelled) return;

        const file = new File([blob], `${currentResult.word}.png`, { type: 'image/png' });
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        let hostedUrl: string | undefined;
        const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY;
        if (imgbbKey && !cancelled) {
          try {
            const base64 = dataUrl.split(',')[1];
            const form = new FormData();
            form.append('image', base64);
            const uploadUrl = import.meta.env.DEV
              ? `/api/imgbb/1/upload?key=${imgbbKey}`
              : `https://api.imgbb.com/1/upload?key=${imgbbKey}`;
            const res = await fetch(uploadUrl, {
              method: 'POST',
              body: form,
            });
            const json = await res.json();
            if (json.data?.url) hostedUrl = json.data.url;
            else if (json.error) console.warn('ImgBB upload failed:', json.error.message);
          } catch (e) {
            console.warn('ImgBB upload error:', e);
          }
        }
        if (cancelled) return;
        shareDataRef.current = { file, text: SHARE_MESSAGE, dataUrl, hostedUrl };
        setShareReady(true);
      } catch (e) {
        console.error("Share prep failed", e);
        shareDataRef.current = null;
        setShareReady(false);
      }
    };
    setShareReady(false);
    prepare();
    return () => { cancelled = true; };
  }, [currentResult]);

  useEffect(() => {
    if (isLoading) {
      setIsInputFocused(false);
    }
  }, [isLoading]);

  const scrambleFrameRef = useRef(0);
  const scramblePhraseIndexRef = useRef(0);
  const scrambleConceptRef = useRef(concept);

  useEffect(() => {
    scrambleConceptRef.current = concept;
  }, [concept]);

  useEffect(() => {
    if (!isLoading) {
      setDisplayConcept(concept);
      if (scrambleSoundRef.current) {
        scrambleSoundRef.current.stop();
        scrambleSoundRef.current = null;
      }
      return;
    }

    scrambleFrameRef.current = 0;
    scramblePhraseIndexRef.current = 0;

    const phrases = ["SEARCHING...", "DISCOVERING...", "ANALYZING...", "SYNTHESIZING..."];
    const chars = "!<>-_\\/[]{}—=+*^?#________";

    const onTick = () => {
      scrambleFrameRef.current++;
      if (scrambleFrameRef.current % 60 === 0) {
        scramblePhraseIndexRef.current = (scramblePhraseIndexRef.current + 1) % phrases.length;
      }
      const phrase = phrases[scramblePhraseIndexRef.current];
      const baseText = scrambleConceptRef.current || "PROCESSING";
      let result = "";
      for (let i = 0; i < baseText.length; i++) {
        const rand = Math.random();
        if (rand < 0.05) {
          result += chars[Math.floor(Math.random() * chars.length)];
        } else if (rand < 0.08) {
          result += phrase[Math.floor(Math.random() * phrase.length)];
        } else {
          result += baseText[i];
        }
      }
      setDisplayConcept(result);
    };

    scrambleSoundRef.current = startScrambleSound(typingAudioCtxRef, onTick, soundEnabled);

    return () => {
      if (scrambleSoundRef.current) {
        scrambleSoundRef.current.stop();
        scrambleSoundRef.current = null;
      }
    };
  }, [isLoading, concept, soundEnabled]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasKey(hasSelected);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const startAudioAnalysis = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      const updateDots = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        const dots = [dot1Ref.current, dot2Ref.current, dot3Ref.current];
        
        dots.forEach((dot, index) => {
          if (dot) {
            const freqIndex = index * 4 + 2; 
            const value = dataArrayRef.current[freqIndex] || 0;
            const translateY = -(value / 255) * 8; 
            dot.style.transform = `translateY(${translateY}px)`;
          }
        });
        
        animationFrameRef.current = requestAnimationFrame(updateDots);
      };
      updateDots();
    } catch (err) {
      console.error("Error analyzing audio:", err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const handleSpeak = () => {
    if (!currentResult) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentResult.word);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleShare = () => {
    if (!currentResult) return;
    const data = shareDataRef.current;
    if (!data) return;

    shareImage(data.file, {
      title: currentResult.word,
      text: data.text,
      filename: `${currentResult.word}.png`,
      hostedUrl: data.hostedUrl,
      dataUrl: data.dataUrl,
      onLinkCopied: () => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      },
    });
  };

  const handleConceptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (next.length > concept.length) {
      const now = Date.now();
      if (now - lastTypingSoundRef.current > 50) {
        lastTypingSoundRef.current = now;
        playTypingSound(typingAudioCtxRef, soundEnabled);
        vibrateHapticTyping();
      }
    }
    setConcept(next);
  };

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopAudioAnalysis();
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioAnalysis(stream);
    } catch (e) {
      console.error("Microphone access denied", e);
      return;
    }

    baseConceptRef.current = concept;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      const base = baseConceptRef.current;
      setConcept(base ? `${base} ${fullTranscript}`.trim() : fullTranscript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      stopAudioAnalysis();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAudioAnalysis();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };

    recognition.onstart = () => setIsListening(true);

    try {
      await recognition.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
      setIsListening(false);
      stopAudioAnalysis();
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsLoading(false);
  };

  const conceptWordCount = concept.trim().split(/\s+/).filter(Boolean).length;
  const canGenerate = conceptWordCount >= 3 && !isLoading;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (generationCount >= 5) {
      setSlideDirection('forward');
      setScreen('upgrade');
      return;
    }

    setSlideDirection('forward');
    setIsLoading(true);
    setError(null);
    cancelledRef.current = false;
    
    try {
      const [wordData, image] = await Promise.all([
        generateConceptWord(concept),
        generateDaVinciSketch(concept)
      ]);
      
      if (cancelledRef.current) return;
      
      window.scrollTo(0, 0);
      setCurrentResult({
        word: wordData.word,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        discovery: wordData.discovery,
        image
      });
      
      const newCount = generationCount + 1;
      setGenerationCount(newCount);
      localStorage.setItem('generationCount', newCount.toString());
      
      playRevealSound(typingAudioCtxRef, soundEnabled);
      vibrateHapticReveal();
      setScreen('result');
    } catch (err: any) {
      if (cancelledRef.current) return;
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      } else {
        setError("An error occurred while generating.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (hasKey === null) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-black" size={48} /></div>;
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center bg-white text-black font-sans">
        <div className="max-w-md text-center space-y-6 p-8 border border-gray-200 rounded-3xl shadow-sm">
          <Key size={48} className="mx-auto text-gray-400" />
          <h1 className="text-3xl font-serif font-bold">API Key Required</h1>
          <p className="text-gray-500">
            To use the high-quality Da Vinci sketchbook model, you must select a paid Google Cloud API key.
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-black">Learn more about billing</a>
          </p>
          <button
            onClick={handleSelectKey}
            className="min-h-[48px] px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium w-full touch-manipulation"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-hidden ${screen === 'splash' ? 'overflow-y-hidden' : ''} relative w-full min-h-screen ${isDesktop ? 'bg-white' : screen === 'splash' ? 'bg-[#FF3B44]' : screen === 'result' ? 'bg-black' : screen === 'input' ? 'bg-[var(--color-brand-yellow)]' : 'bg-[var(--color-brand-yellow)]'} ${screen === 'splash' || (screen === 'input' && !isDesktop) ? 'h-screen' : ''}`}>
      <div className={isDesktop ? 'flex flex-col min-h-screen' : ''}>
      {isDesktop && (
        <header className="flex-shrink-0 p-8">
          <h1 className="text-2xl font-serif font-normal text-black">Wurdle</h1>
        </header>
      )}
      <div className={isDesktop ? 'flex-1 flex items-center justify-center px-8 py-8 min-h-0 overflow-hidden' : 'absolute inset-0'}>
      <AnimatePresence mode="sync" custom={slideDirection} initial={false}>
        {screen === 'splash' && (
          <motion.div 
            key="splash"
            custom={slideDirection}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`${isDesktop ? 'w-full max-w-[400px]' : 'absolute inset-0 min-h-screen w-full'} overflow-hidden ${isDesktop ? '' : 'bg-[#FF3B44]'}`}
          >
            {isDesktop ? (
              <div className="w-full max-w-[400px] min-h-[680px] bg-[#FF3B44] rounded-3xl p-8 flex flex-col shadow-lg">
                    <h1 className="text-4xl font-serif font-normal leading-none mb-8 tracking-tight text-[var(--color-brand-yellow)]">
                      Wurdle
                    </h1>
                    <p className="font-sans text-lg leading-[1.4] font-normal text-black mb-4">
                      Not everything needs to be useful.
                    </p>
                    <p className="font-sans text-lg leading-[1.4] font-normal text-black mb-4">
                      This app exists to name weird ideas and draw pretend science about them.
                    </p>
                    <p className="font-sans text-lg leading-[1.4] font-normal text-black mb-8">
                      That&apos;s it. That&apos;s the feature.
                    </p>
                    <div className="mt-auto flex flex-col gap-8">
                      <button 
                        onClick={() => { setSlideDirection('forward'); setScreen('input'); }}
                        className="min-h-[48px] px-8 py-3 rounded-[32px] border-2 border-black text-black text-xl font-sans hover:bg-black/5 transition-colors touch-manipulation w-fit"
                      >
                        Let&apos;s go!
                      </button>
                      <p className="font-sans text-sm text-black/80">
                        In a world obsessed with utility, this is a small rebellion.
                      </p>
                    </div>
                  </div>
            ) : (
              <>
                <div className="flex flex-col max-w-md mx-auto px-8 safe-area-pt-24 safe-area-pb-8 h-screen">
                  <div className="flex-1 flex flex-col">
                    <h1 className="text-7xl font-serif font-normal leading-none mb-8 tracking-tight text-[var(--color-brand-yellow)]">
                      Wurdle
                    </h1>
                    <p className="font-sans text-[22px] md:text-[26px] leading-[1.4] font-normal text-black">
                      Not everything needs to be useful.
                    </p>
                    <p className="font-sans text-[22px] md:text-[26px] leading-[1.4] font-normal text-black">
                      This app exists to name weird ideas and draw pretend science about them.
                    </p>
                    <p className="font-sans text-[22px] md:text-[26px] leading-[1.4] font-normal text-black">
                      That&apos;s it. That&apos;s the feature.
                    </p>
                  </div>
                  <div className="mt-auto pt-7 flex flex-col gap-12">
                    <button 
                      onClick={() => { setSlideDirection('forward'); setScreen('input'); }}
                      className="min-h-[48px] px-8 py-3 rounded-[32px] border-2 border-black text-2xl font-sans hover:bg-black/5 transition-colors touch-manipulation w-fit"
                    >
                      Let&apos;s go!
                    </button>
                    <div>
                      <p className="font-sans text-sm text-black/90">
                        In a world obsessed with utility, this is a small rebellion.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {screen === 'input' && (
          <motion.div 
            key="input"
            custom={slideDirection}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`${isDesktop ? 'w-full max-w-[400px]' : 'absolute inset-0 min-h-screen w-full'} text-black overflow-hidden ${isDesktop ? '' : 'bg-[var(--color-brand-yellow)] max-w-md mx-auto'}`}
          >
            {/* Desktop layout */}
            {isDesktop && (
                  <div className="w-full max-w-[400px] min-h-[680px] bg-[var(--color-brand-yellow)] rounded-3xl p-8 shadow-lg">
                    <div className="relative min-h-[280px]">
                      {!concept && !isLoading && !isInputFocused && (
                        <div className="absolute inset-0 text-[40px] md:text-[48px] font-serif leading-[1.1] text-black/40 pointer-events-none" style={{ hyphens: 'auto', WebkitHyphens: 'auto' }}>
                          Describe an idea…<br />but make it weird
                        </div>
                      )}
                      <textarea
                        ref={textareaRef}
                        value={isLoading ? displayConcept : concept}
                        onChange={handleConceptChange}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canGenerate) { e.preventDefault(); handleGenerate(); } }}
                        lang="en"
                        placeholder=""
                        className={`w-full bg-transparent text-[40px] md:text-[48px] font-serif leading-[1.1] focus:outline-none resize-none min-h-[180px] ${isLoading ? 'opacity-50' : ''}`}
                        style={{ hyphens: 'auto', WebkitHyphens: 'auto' } as React.CSSProperties}
                        disabled={isLoading}
                      />
                    </div>
                    {concept && !isLoading && conceptWordCount < 3 && (
                      <p className="mt-4 font-sans text-black/50 text-base">Type at least 3 words to continue</p>
                    )}
                    {!concept && !isLoading && !isInputFocused && (
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={exampleIndex}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.4 }}
                          onClick={() => setConcept(ABSURD_EXAMPLES[exampleIndex])}
                          className="mt-6 font-serif text-black/50 italic text-lg leading-snug cursor-pointer hover:text-black/70 transition-colors"
                        >
                          eg. {ABSURD_EXAMPLES[exampleIndex]}
                        </motion.p>
                      </AnimatePresence>
                    )}
                    <div className="mt-10 flex justify-center gap-4">
                      {concept ? (
                        <>
                          <button
                            onClick={() => (isLoading ? handleCancel() : setConcept(''))}
                            className="w-14 h-14 rounded-full border-2 border-black flex items-center justify-center hover:bg-black/5 transition-colors touch-manipulation"
                          >
                            <X size={24} strokeWidth={1} />
                          </button>
                          <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="w-14 h-14 rounded-full border-2 border-black flex items-center justify-center hover:bg-black/5 disabled:opacity-50 transition-colors touch-manipulation bg-black text-[var(--color-brand-yellow)] disabled:bg-transparent disabled:text-black"
                          >
                            {isLoading ? <Loader2 className="animate-spin" size={24} strokeWidth={1} /> : <ArrowRight size={24} strokeWidth={1} />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              playSparkleSound(typingAudioCtxRef, soundEnabled);
                              setConcept(RANDOM_CONCEPTS[Math.floor(Math.random() * RANDOM_CONCEPTS.length)]);
                            }}
                            className="w-14 h-14 rounded-full border-2 border-black flex items-center justify-center hover:bg-black/5 transition-colors touch-manipulation"
                          >
                            <Sparkles size={24} strokeWidth={1} />
                          </button>
                          <button
                            onClick={toggleListening}
                            disabled={!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)}
                            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors touch-manipulation disabled:opacity-50 ${isListening ? 'border-black bg-black text-[var(--color-brand-yellow)]' : 'border-black/30 hover:bg-black/5'}`}
                            title="Dictate with microphone"
                          >
                            {isListening ? (
                              <div className="flex gap-1 items-center">
                                <div ref={dot1Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full" />
                                <div ref={dot2Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full" />
                                <div ref={dot3Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full" />
                              </div>
                            ) : (
                              <Mic size={24} strokeWidth={1} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
            )}
            {/* Mobile layout */}
            {!isDesktop && (
            <>
            <div
              ref={inputCardsScrollRef}
              className="flex h-screen w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            >
              {/* Generated cards first (swipe right from input to see them) */}
              {wordHistory.map((card, i) => (
                <div
                  key={`${card.word}-${i}`}
                  ref={el => { cardScrollRefs.current[i] = el; }}
                  onScroll={(e) => {
                    if (!isOnInputSlide) {
                      setCardScrolledFromTop(e.currentTarget.scrollTop > 10);
                    }
                  }}
                  className="flex-shrink-0 w-full min-h-screen flex flex-col bg-black text-white snap-center overflow-auto"
                >
                  <div className="flex-1 flex flex-col px-6 pt-12 pb-24">
                    <div className="w-full mb-6 flex justify-center overflow-hidden rounded-lg">
                      <img src={card.image} alt="" className="w-full h-auto object-contain mix-blend-screen" />
                    </div>
                    <h1 className="text-4xl font-serif leading-none mb-3 capitalize" style={{ wordBreak: 'break-word' }}>
                      {card.word.toLowerCase()}
                    </h1>
                    <p className="font-sans text-lg leading-relaxed text-white/90">{card.definition}</p>
                  </div>
                </div>
              ))}
              {/* Input slide last */}
              <div 
                ref={inputSlideScrollRef}
                className="input-slide-scroll flex-shrink-0 w-full h-screen flex flex-col snap-center overflow-y-auto overflow-x-hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex-1 flex flex-col min-h-0 px-8 safe-area-pt-8 pt-8 pb-6">
                  <div className="flex-1 flex flex-col min-h-0 relative">
                    {!concept && !isLoading && !isInputFocused && (
                      <div className="w-full text-[60px] font-serif leading-[0.8] text-black/40 pointer-events-none absolute top-0 left-0" style={{ hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 6 4' }}>
                        <span className="placeholder-cursor inline-block w-[3px] mr-1 bg-black/50" style={{ height: '0.75em', verticalAlign: 'baseline' }} />
                        Describe an idea… but make it weird
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={isLoading ? displayConcept : concept}
                      onChange={handleConceptChange}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      lang="en"
                      inputMode="text"
                      enterKeyHint="done"
                      autoComplete="off"
                      placeholder=""
                      style={{ hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 6 4' } as React.CSSProperties}
                      className={`w-full bg-transparent text-[60px] font-serif leading-[0.8] focus:outline-none resize-none overflow-y-auto flex-1 min-h-[120px] ${isLoading ? 'opacity-50' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {concept && !isLoading && conceptWordCount < 3 && (
                    <p className="flex-shrink-0 mt-4 font-sans text-black/50 text-lg">
                      Type at least 3 words to continue
                    </p>
                  )}
                  {!concept && !isLoading && !isInputFocused && (
                    <div className="flex-shrink-0 mt-4 min-h-[80px]">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={exampleIndex}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.5 }}
                          onClick={() => setConcept(ABSURD_EXAMPLES[exampleIndex])}
                          className="font-serif text-black/40 italic text-xl md:text-2xl leading-snug cursor-pointer hover:text-black/60 transition-colors py-3 pr-4 touch-manipulation"
                        >
                          eg. {ABSURD_EXAMPLES[exampleIndex]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 h-[100px]" />
              </div>
            </div>
          
          <div className={`fixed top-0 left-0 right-0 h-40 pointer-events-none z-10 transition-opacity duration-200 ${isOnInputSlide ? (inputScrolledFromTop ? 'opacity-100' : 'opacity-0') : (cardScrolledFromTop ? 'opacity-100' : 'opacity-0')} ${isOnInputSlide ? 'bg-gradient-to-b from-[var(--color-brand-yellow)] via-[var(--color-brand-yellow)] to-transparent' : 'bg-gradient-to-b from-black via-black to-transparent'}`}></div>
          <div className={`fixed bottom-0 left-0 right-0 h-40 pointer-events-none z-10 bg-gradient-to-t from-black via-black to-transparent transition-opacity duration-200 ${!isOnInputSlide && cardScrolledFromTop ? 'opacity-100' : 'opacity-0'}`}></div>
          
          {isOnInputSlide && (
          <AnimatePresence>
            {!isInputFocused && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-8 safe-area-bottom flex justify-between items-end pointer-events-none z-20"
            >
              {concept ? (
                <>
                  <button 
                    onClick={() => (isLoading ? handleCancel() : setConcept(''))} 
                    className="min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border border-black flex items-center justify-center hover:bg-black/5 disabled:opacity-50 transition-colors bg-[var(--color-brand-yellow)] pointer-events-auto touch-manipulation"
                  >
                    <X size={28} strokeWidth={1} />
                  </button>
                  <button 
                    onClick={handleGenerate} 
                    disabled={!canGenerate} 
                    className="min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border border-black flex items-center justify-center hover:bg-black/5 disabled:opacity-50 transition-colors bg-[var(--color-brand-yellow)] pointer-events-auto touch-manipulation"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={28} strokeWidth={1} /> : <ArrowRight size={28} strokeWidth={1} />}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      playSparkleSound(typingAudioCtxRef, soundEnabled);
                      const randomConcept = RANDOM_CONCEPTS[Math.floor(Math.random() * RANDOM_CONCEPTS.length)];
                      setConcept(randomConcept);
                    }} 
                    className="min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border border-black flex items-center justify-center transition-colors hover:bg-black/5 bg-[var(--color-brand-yellow)] pointer-events-auto touch-manipulation"
                  >
                    <Sparkles size={28} strokeWidth={1} />
                  </button>
                  <button 
                    onClick={toggleListening}
                    disabled={!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)}
                    className={`min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border flex items-center justify-center transition-colors pointer-events-auto disabled:opacity-50 touch-manipulation ${isListening ? 'border-black bg-black text-[var(--color-brand-yellow)]' : 'border-black/30 bg-black/5 text-black/40 hover:bg-black/10'}`}
                    title={window.SpeechRecognition || (window as any).webkitSpeechRecognition ? "Dictate with microphone" : "Voice input requires Chrome/Edge or Speechly (see .env.example)"}
                  >
                    {isListening ? (
                      <div className="flex space-x-1.5 items-center justify-center h-full">
                        <div ref={dot1Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full origin-center transition-transform duration-75" />
                        <div ref={dot2Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full origin-center transition-transform duration-75" />
                        <div ref={dot3Ref} className="w-1.5 h-1.5 bg-[var(--color-brand-yellow)] rounded-full origin-center transition-transform duration-75" />
                      </div>
                    ) : (
                      <Mic size={28} strokeWidth={1} />
                    )}
                  </button>
                </>
              )}
            </motion.div>
            )}
          </AnimatePresence>
          )}
            </>
            )}
        </motion.div>
      )}

      {screen === 'result' && currentResult && (
        <motion.div 
          key="result"
          ref={resultRef}
          custom={slideDirection}
          variants={screenVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`${isDesktop ? 'w-full max-w-[400px] max-h-[70vh]' : 'absolute inset-0 min-h-screen w-full'} text-white flex flex-col ${isDesktop ? 'bg-black rounded-3xl shadow-lg overflow-y-auto' : 'overflow-auto bg-black max-w-md mx-auto'}`}
        >
          {!isDesktop && (
          <div className="sticky top-0 z-20 safe-area-pt-8 px-8 pb-4 bg-black">
            <div className="w-full h-[1px] bg-transparent"></div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 translate-y-full bg-gradient-to-b from-black to-transparent pointer-events-none transition-opacity duration-300 ${isScrolled ? 'opacity-100' : 'opacity-0'}`}></div>
          </div>
          )}
          
          <div className="flex-1 flex flex-col">
          <div className={`w-full mb-8 flex items-center justify-center ${isDesktop ? 'px-8' : 'px-8'}`}>
            <img 
              key={currentResult.word}
              src={currentResult.image} 
              alt="Scientific diagram" 
              className="w-full h-auto object-contain mix-blend-screen"
              loading="eager"
            />
          </div>
          
          <div className="flex-1 flex flex-col px-8 pb-44">
            <h1 
              className="text-[60px] font-serif leading-[0.8] mb-4 capitalize" 
              lang="en"
              style={{ wordBreak: 'break-word', hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 6 4' } as React.CSSProperties}
            >
              {currentResult.word.toLowerCase().split('').map((char, i) => (
                <React.Fragment key={i}>
                  {i > 0 && i % 6 === 0 ? '\u00AD' : ''}{char}
                </React.Fragment>
              ))}
            </h1>
            
            <button 
              onClick={handleSpeak}
              className="min-h-[44px] flex items-center gap-2 text-white/60 mb-8 font-sans hover:text-white transition-colors w-fit py-2 pr-2 touch-manipulation"
            >
              <Volume2 size={20} strokeWidth={1.5} />
              <span className="text-lg">{currentResult.pronunciation}</span>
            </button>
            
            <div className="space-y-6">
              <p className="font-sans text-xl leading-relaxed text-white/90">
                {currentResult.definition}
              </p>
              
              <div className="border-t border-white/20 pt-6">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-sans">DISCOVERY</p>
                <p className="font-sans text-lg leading-relaxed text-white/70 italic">
                  {currentResult.discovery}
                </p>
              </div>
            </div>
          </div>
          </div>

          <div className={`fixed bottom-0 h-40 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10 ${isDesktop ? 'left-1/2 -translate-x-1/2 w-full max-w-[400px]' : 'left-0 right-0'}`}></div>

          <AnimatePresence>
            {isScrolledToBottom && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={`share-buttons-container fixed bottom-0 px-8 safe-area-bottom flex justify-between items-end pointer-events-none z-20 ${isDesktop ? 'left-1/2 -translate-x-1/2 w-full max-w-[400px]' : 'left-0 right-0 mx-auto max-w-md'}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <button 
                    onClick={handleShare}
                    disabled={!shareReady}
                    className="min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border border-white/50 flex items-center justify-center bg-black hover:bg-white/10 transition-colors pointer-events-auto touch-manipulation disabled:opacity-50 disabled:hover:bg-black"
                    title="Share image"
                  >
                    {shareReady ? <Share2 size={28} strokeWidth={1} /> : <Loader2 className="animate-spin" size={28} strokeWidth={1} />}
                  </button>
                  {shareCopied && (
                    <span className="text-xs text-white/80">Link copied!</span>
                  )}
                </div>
                <button 
                  onClick={() => {
                    if (currentResult) setWordHistory(prev => [currentResult, ...prev]);
                    setSlideDirection('backward');
                    setConcept('');
                    setScreen(generationCount >= 5 ? 'upgrade' : 'input');
                    const standalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
                    const mobileSafari = /iP(hone|ad|od)/.test(navigator.userAgent);
                    if (generationCount >= 1 && generationCount < 5 && !standalone && mobileSafari && !localStorage.getItem('addToHomeDrawerShown')) {
                      setShowAddToHomeDrawer(true);
                    }
                  }} 
                  className="min-w-[48px] min-h-[48px] w-16 h-16 rounded-full border border-white/50 flex items-center justify-center bg-black hover:bg-white/10 transition-colors pointer-events-auto touch-manipulation"
                >
                  <RotateCcw size={28} strokeWidth={1} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {screen === 'upgrade' && (
        <motion.div 
          key="upgrade"
          custom={slideDirection}
          variants={screenVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 min-h-screen w-full text-black flex flex-col max-w-md mx-auto px-8 pt-12 safe-area-pb-8 ${isDesktop ? 'bg-white' : 'bg-[#FF3B44]'}`}
        >
          <div className="w-full h-[1px] bg-transparent mb-8"></div>
          
          <div className="flex-1 flex flex-col">
            <h1 className="text-[60px] font-serif font-normal leading-[0.8] mb-8 tracking-tight">
              That's 5 free<br/>Wurdles!
            </h1>
            
            <p className="font-sans text-[28px] leading-[1.15] font-normal">
              I'd love to keep going, but<br/>each one costs real AI<br/>tokens. Come back<br/>tomorrow, or upgrade if<br/>you want infinite made-<br/>up words.
            </p>
          </div>
          
          <div className="mt-auto pt-12 flex justify-start">
            <button 
              onClick={() => { setSlideDirection('backward'); setScreen('input'); }}
              className="min-h-[48px] px-8 py-3 rounded-[32px] border-2 border-black text-2xl font-sans hover:bg-black/5 transition-colors touch-manipulation"
            >
              Upgrade
            </button>
          </div>
        </motion.div>
      )}

      </AnimatePresence>
      </div>
      {isDesktop && (
        <footer className="flex-shrink-0 p-8 flex justify-between items-end">
          <p className="text-sm font-sans text-black/70 max-w-md leading-relaxed">
            Not everything needs to be useful.<br />
            This app exists to name weird ideas and draw pretend science about them.<br />
            That&apos;s it. That&apos;s the feature.
          </p>
          <button
            onClick={() => setSoundEnabled(s => !s)}
            className="p-2 text-black/40 hover:text-black/70 transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? <Volume2 size={20} strokeWidth={1.5} /> : <VolumeX size={20} strokeWidth={1.5} />}
          </button>
        </footer>
      )}
      </div>

      <AnimatePresence>
        {showAddToHomeDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => {
                setShowAddToHomeDrawer(false);
                localStorage.setItem('addToHomeDrawerShown', '1');
              }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 h-[60%] max-h-[500px] bg-white rounded-t-[24px] z-50 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex-shrink-0 flex justify-end p-4">
                <button
                  onClick={() => {
                    setShowAddToHomeDrawer(false);
                    localStorage.setItem('addToHomeDrawerShown', '1');
                  }}
                  className="p-2 -m-2 text-black/50 hover:text-black transition-colors touch-manipulation"
                  aria-label="Close"
                >
                  <X size={24} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 flex flex-col px-8 pb-8 safe-area-pb-8 overflow-y-auto">
                <h2 className="text-2xl font-serif font-normal text-black mb-3">
                  Like Wurdle?
                </h2>
                <p className="font-sans text-lg text-black/80 leading-relaxed mb-6">
                  Pin it to your home screen for quick access — no browser bar, just the app.
                </p>
                {typeof navigator.share === 'function' ? (
                  <button
                    onClick={() => {
                      const url = window.location.origin + window.location.pathname;
                      navigator.share({ url, title: 'Wurdle', text: 'Forge nonsense words for absurd ideas' }).catch(() => {});
                      setShowAddToHomeDrawer(false);
                      localStorage.setItem('addToHomeDrawerShown', '1');
                    }}
                    className="min-h-[48px] px-8 py-3 rounded-[32px] bg-black text-white text-lg font-sans hover:bg-black/90 transition-colors touch-manipulation w-full flex items-center justify-center gap-2 mb-4"
                  >
                    <Share2 size={20} strokeWidth={1.5} />
                    Open Share Menu
                  </button>
                ) : null}
                <div className="bg-black/5 rounded-2xl p-5 font-sans text-base text-black/90 leading-relaxed">
                  <p className="font-medium text-black mb-2">How to add:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Tap the <strong>3 dots menu</strong> (⋯) in the browser</li>
                    <li>Tap <strong>Share</strong></li>
                    <li>Tap <strong>View more</strong></li>
                    <li>Tap <strong>Add to Home Screen</strong></li>
                  </ol>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
