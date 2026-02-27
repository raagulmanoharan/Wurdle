/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ArrowRight, X, Volume2, Share, RotateCcw, Key, Loader2, Sparkles } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { generateDaVinciSketch, generateConceptWord } from './services/geminiService';

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
  "A pair of noise-canceling headphones that doesn't block sound, but instead replaces all background noise with a live, slightly out-of-tune mariachi band that dynamically reacts to your current stress levels.",
  "A smart refrigerator that passively-aggressively locks its doors and suggests you drink room-temperature water when you reach for a midnight snack, citing your recent search history and lack of cardio.",
  "An umbrella that actively seeks out rain clouds and alters local weather patterns to ensure you get wet, claiming it builds character, resilience, and a deeper, more meaningful appreciation for dry towels.",
  "A coffee mug that analyzes your micro-expressions and sleep patterns, automatically decaffeinating your brew if it thinks you're too jittery, replacing it with a lukewarm, vaguely sad chamomile tea.",
  "A mechanical pencil that corrects your spelling mistakes by physically wrestling your hand until you write the right letter, leaving you utterly exhausted but grammatically flawless.",
  "A pair of socks that constantly shift their internal temperature using quantum entanglement to ensure one foot is always slightly too warm and the other is uncomfortably, distractingly cold.",
  "A GPS navigation system that actively refuses to give you the fastest route, insisting instead on the most 'scenic and emotionally fulfilling' journey through obscure, mildly dangerous back alleys."
];

const RANDOM_CONCEPTS = [
  "A toaster that screams when your bread is perfectly browned",
  "An umbrella that rains on you to keep you cool in the summer",
  "A coffee mug that judges your life choices based on your caffeine intake",
  "A pair of glasses that translates dog barks into sarcastic comments",
  "A pillow that absorbs your nightmares and turns them into a soft hum",
  "A refrigerator that locks itself when it senses you're bored, not hungry",
  "A pen that automatically corrects your grammar but insults you while doing it",
  "A hat that projects your current mood as a weather hologram above your head"
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [displayConcept, setDisplayConcept] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const baseConceptRef = useRef("");
  const typingAudioCtxRef = useRef<AudioContext | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);
  const dot3Ref = useRef<HTMLDivElement>(null);

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
      setExampleIndex(prev => (prev + 1) % ABSURD_EXAMPLES.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      const isBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
      setIsScrolledToBottom(isBottom);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initially
    return () => window.removeEventListener('scroll', handleScroll);
  }, [screen, currentResult]);

  useEffect(() => {
    if (!isLoading) {
      setDisplayConcept(concept);
      return;
    }
    
    const phrases = ["SEARCHING...", "DISCOVERING...", "ANALYZING...", "SYNTHESIZING..."];
    const chars = "!<>-_\\\\/[]{}—=+*^?#________";
    let frame = 0;
    let phraseIndex = 0;
    
    const interval = setInterval(() => {
      frame++;
      if (frame % 60 === 0) {
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
      
      const phrase = phrases[phraseIndex];
      const baseText = concept || "PROCESSING";
      
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
      playHudSound();
    }, 100);
    
    return () => clearInterval(interval);
  }, [isLoading, concept]);

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

  useEffect(() => {
    if (textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
          
          const rect = textareaRef.current.getBoundingClientRect();
          if (rect.bottom > window.innerHeight - 120) {
            window.scrollBy({ top: rect.bottom - (window.innerHeight - 120), behavior: 'smooth' });
          }
        }
      }, 50);
    }
  }, [concept, screen]);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const playHudSound = () => {
    try {
      if (!typingAudioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        typingAudioCtxRef.current = new AudioContextClass();
      }
      
      const ctx = typingAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'square';
      const freq = 800 + Math.random() * 400;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.03);
      
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    } catch (e) {}
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

  const handleShare = async () => {
    if (!shareCardRef.current || !currentResult) return;
    try {
      const dataUrl = await htmlToImage.toPng(shareCardRef.current, {
        backgroundColor: '#000000',
        pixelRatio: 2,
      });
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      if (!blob) return;
      const file = new File([blob], `${currentResult.word}.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentResult.word}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Share failed", e);
    }
  };

  const handleConceptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConcept(e.target.value);
  };

  const toggleListening = async () => {
    if (isListening) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    let mediaStream: MediaStream | null = null;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioAnalysis(mediaStream);
    } catch (e) {
      console.error("Microphone access denied", e);
      setError("Microphone access was denied. Please allow microphone permissions.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    baseConceptRef.current = concept;

    recognition.onstart = () => setIsListening(true);
    
    let silenceTimeout: NodeJS.Timeout;
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join('');
      
      const newConcept = baseConceptRef.current ? `${baseConceptRef.current} ${transcript}` : transcript;
      setConcept(newConcept);
      
      clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        recognition.stop();
      }, 2000);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setError("Microphone access was denied. Please allow microphone permissions.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
      stopAudioAnalysis();
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    };
    
    recognition.onend = () => {
      setIsListening(false);
      stopAudioAnalysis();
      clearTimeout(silenceTimeout);
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    };
    
    recognition.start();
  };

  const handleGenerate = async () => {
    if (!concept.trim() || isLoading) return;

    if (generationCount >= 5) {
      setSlideDirection('forward');
      setScreen('upgrade');
      return;
    }

    setSlideDirection('forward');
    setIsLoading(true);
    setError(null);
    
    try {
      const [wordData, image] = await Promise.all([
        generateConceptWord(concept),
        generateDaVinciSketch(concept)
      ]);
      
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
      
      setScreen('result');
    } catch (err: any) {
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
            className="px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium w-full"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden relative w-full min-h-screen bg-[var(--color-brand-yellow)]">
      <AnimatePresence mode="popLayout" custom={slideDirection} initial={false}>
        {screen === 'splash' && (
          <motion.div 
            key="splash"
            custom={slideDirection}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-screen w-full bg-[#FF3B44] text-black flex flex-col max-w-md mx-auto relative px-8 pt-24 pb-12"
          >
            <div className="flex-1 flex flex-col">
              <h1 className="text-7xl font-serif font-normal leading-none mb-6 tracking-tight text-[var(--color-brand-yellow)]">
                Wurdle
              </h1>
              
              <p className="font-sans text-[28px] leading-[1.15] font-normal">
                Forge nonsense words<br/>for absurd ideas.
              </p>
            </div>
            
            <div className="mt-auto pt-12 flex justify-start">
              <button 
                onClick={() => {
                  setSlideDirection('forward');
                  setScreen('input');
                }}
                className="px-8 py-3 rounded-[32px] border-2 border-black text-2xl font-sans hover:bg-black/5 transition-colors"
              >
                Let's go!
              </button>
            </div>
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
            className="min-h-screen w-full bg-[var(--color-brand-yellow)] flex flex-col max-w-md mx-auto relative text-black"
          >
            <div className="sticky top-0 z-20 bg-[var(--color-brand-yellow)] pt-8 px-8 pb-4">
            <div className="w-full h-[1px] bg-transparent"></div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 translate-y-full bg-gradient-to-b from-[var(--color-brand-yellow)] to-transparent pointer-events-none transition-opacity duration-300 ${isScrolled ? 'opacity-100' : 'opacity-0'}`}></div>
          </div>
          
          <div className="flex-1 flex flex-col relative px-8 pt-4 pb-40">
            <div className="relative w-full">
              {!concept && !isLoading && (
                <div className="w-full text-[66px] font-serif leading-[0.76] text-black/40 pointer-events-none" style={{ hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 3' }}>
                  Describe an idea… but make it weird
                </div>
              )}
              <textarea 
                ref={textareaRef}
                value={isLoading ? displayConcept : concept} 
                onChange={handleConceptChange}
                lang="en"
                style={{ hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 3' } as React.CSSProperties}
                className={`w-full bg-transparent text-[66px] font-serif leading-[0.76] focus:outline-none resize-none ${(!concept && !isLoading) ? 'absolute top-0 left-0 h-full' : ''} ${isLoading ? 'opacity-50' : ''}`}
                rows={1}
                disabled={isLoading}
              />
            </div>
            
            {!concept && !isLoading && (
              <div className="relative h-32 mt-6">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={exampleIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.5 }}
                    onClick={() => setConcept(ABSURD_EXAMPLES[exampleIndex])}
                    className="font-serif text-black/40 italic text-xl md:text-2xl leading-snug absolute top-0 left-0 cursor-pointer hover:text-black/60 transition-colors"
                  >
                    eg. {ABSURD_EXAMPLES[exampleIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
            {error && <p className="text-red-800 font-sans mt-4">{error}</p>}
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--color-brand-yellow)] via-[var(--color-brand-yellow)] to-transparent pointer-events-none z-10"></div>
          
          <div className="fixed bottom-8 left-0 right-0 max-w-md mx-auto px-8 flex justify-between items-end pointer-events-none z-20">
              {concept ? (
                <>
                  <button 
                    onClick={() => setConcept('')} 
                    disabled={isLoading}
                    className="w-16 h-16 rounded-full border border-black flex items-center justify-center hover:bg-black/5 disabled:opacity-50 transition-colors bg-[var(--color-brand-yellow)] pointer-events-auto"
                  >
                    <X size={28} strokeWidth={1} />
                  </button>
                  <button 
                    onClick={handleGenerate} 
                    disabled={isLoading} 
                    className="w-16 h-16 rounded-full border border-black flex items-center justify-center hover:bg-black/5 disabled:opacity-50 transition-colors bg-[var(--color-brand-yellow)] pointer-events-auto"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={28} strokeWidth={1} /> : <ArrowRight size={28} strokeWidth={1} />}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      const randomConcept = RANDOM_CONCEPTS[Math.floor(Math.random() * RANDOM_CONCEPTS.length)];
                      setConcept(randomConcept);
                    }} 
                    className="w-16 h-16 rounded-full border border-black flex items-center justify-center transition-colors hover:bg-black/5 bg-[var(--color-brand-yellow)] pointer-events-auto"
                  >
                    <Sparkles size={28} strokeWidth={1} />
                  </button>
                  <button 
                    onClick={toggleListening} 
                    className={`w-16 h-16 rounded-full border border-black flex items-center justify-center transition-colors pointer-events-auto ${isListening ? 'bg-black text-[var(--color-brand-yellow)]' : 'hover:bg-black/5 bg-[var(--color-brand-yellow)]'}`}
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
          </div>
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
          className="min-h-screen w-full bg-black text-white flex flex-col max-w-md mx-auto relative"
        >
          <div className="sticky top-0 z-20 bg-black pt-8 px-8 pb-4">
            <div className="w-full h-[1px] bg-transparent"></div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 translate-y-full bg-gradient-to-b from-black to-transparent pointer-events-none transition-opacity duration-300 ${isScrolled ? 'opacity-100' : 'opacity-0'}`}></div>
          </div>
          
          <div className="w-full px-8 mb-8 flex items-center justify-center overflow-hidden">
            <img 
              src={currentResult.image} 
              alt="Scientific diagram" 
              className="w-full h-auto object-cover mix-blend-screen"
            />
          </div>
          
          <div className="flex-1 flex flex-col px-8 pb-32">
            <h1 
              className="text-5xl md:text-6xl font-serif leading-none mb-4 capitalize" 
              lang="en"
              style={{ wordBreak: 'break-word', hyphens: 'auto', WebkitHyphens: 'auto', hyphenateLimitChars: 'auto 3' } as React.CSSProperties}
            >
              {currentResult.word.toLowerCase().split('').map((char, i) => (
                <React.Fragment key={i}>
                  {i > 0 && i % 3 === 0 ? '\u00AD' : ''}{char}
                </React.Fragment>
              ))}
            </h1>
            
            <button 
              onClick={handleSpeak}
              className="flex items-center gap-2 text-white/60 mb-8 font-sans hover:text-white transition-colors w-fit"
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

          <div className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10"></div>

          <AnimatePresence>
            {isScrolledToBottom && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="share-buttons-container fixed bottom-8 left-0 right-0 max-w-md mx-auto px-8 flex justify-between items-end pointer-events-none z-20"
              >
                <button 
                  onClick={handleShare}
                  className="w-16 h-16 rounded-full border border-white/50 flex items-center justify-center bg-black hover:bg-white/10 transition-colors pointer-events-auto"
                >
                  <Share size={28} strokeWidth={1} />
                </button>
                <button 
                  onClick={() => { setSlideDirection('backward'); setConcept(''); setScreen('input'); }} 
                  className="w-16 h-16 rounded-full border border-white/50 flex items-center justify-center bg-black hover:bg-white/10 transition-colors pointer-events-auto"
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
          className="min-h-screen w-full bg-[#FF3B44] text-black flex flex-col max-w-md mx-auto relative px-8 pt-12 pb-12"
        >
          <div className="w-full h-[1px] bg-transparent mb-8"></div>
          
          <div className="flex-1 flex flex-col">
            <h1 className="text-[66px] font-serif font-normal leading-[0.76] mb-8 tracking-tight">
              That's 5 free<br/>Wurdles!
            </h1>
            
            <p className="font-sans text-[28px] leading-[1.15] font-normal">
              I'd love to keep going, but<br/>each one costs real AI<br/>tokens. Come back<br/>tomorrow, or upgrade if<br/>you want infinite made-<br/>up words.
            </p>
          </div>
          
          <div className="mt-auto pt-12 flex justify-start">
            <button 
              onClick={() => { setSlideDirection('backward'); setScreen('input'); }}
              className="px-8 py-3 rounded-[32px] border-2 border-black text-2xl font-sans hover:bg-black/5 transition-colors"
            >
              Upgrade
            </button>
          </div>
        </motion.div>
      )}

      {/* Hidden share card */}
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={shareCardRef} className="w-[400px] bg-black text-white px-8 pt-8 pb-12 flex flex-col relative">
          {currentResult && (
            <>
              <img 
                src={currentResult.image} 
                alt="Scientific diagram" 
                className="w-full h-auto object-cover mb-12"
              />
              
              <h1 
                className="text-7xl font-serif leading-none mb-6 capitalize" 
                style={{ wordBreak: 'break-word', hyphens: 'auto' }}
              >
                {currentResult.word.toLowerCase()}
              </h1>
              
              <div className="flex items-center gap-2 text-white/60 mb-8 font-sans w-fit">
                <Volume2 size={20} strokeWidth={1.5} />
                <span className="text-lg">{currentResult.pronunciation}</span>
              </div>
              
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
            </>
          )}
        </div>
      </div>
      </AnimatePresence>
    </div>
  );
}
