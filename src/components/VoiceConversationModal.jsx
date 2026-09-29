import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, X, PhoneOff, AlertCircle, Radio } from 'lucide-react';
import { floatTo16BitPCM, arrayBufferToBase64, base64ToFloat32Array } from '../utils/audioLive.js';

export const VoiceConversationModal = ({
  isOpen,
  onClose,
}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [transcriptNotice, setTranscriptNotice] = useState(
    'Speak clearly into your microphone to consult the academic voice mentor.'
  );

  const wsRef = useRef(null);
  const inputAudioCtxRef = useRef(null);
  const outputAudioCtxRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const isMutedRef = useRef(false);

  isMutedRef.current = isMuted;

  const startSession = async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      // 1. Microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Audio contexts
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const inputCtx = new AudioContextClass({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;

      const outputCtx = new AudioContextClass({
        sampleRate: 24000,
      });
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      // 3. Connect WebSocket to /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setTranscriptNotice('Connected to gemini-3.8-live. Start speaking your question.');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            setConnectionStatus('connected');
          } else if (data.type === 'audio' && data.audio) {
            setIsModelSpeaking(true);
            playAudioChunk(data.audio);
          } else if (data.type === 'interrupted') {
            stopAllPlayback();
            setIsModelSpeaking(false);
          } else if (data.type === 'error') {
            setErrorMessage(data.error);
            setConnectionStatus('error');
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setErrorMessage('Failed to connect to the Live API WebSocket service.');
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        if (connectionStatus !== 'error') {
          setConnectionStatus('disconnected');
        }
      };

      // 4. Capture microphone and send to WebSocket
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcmBuffer);

        wsRef.current.send(JSON.stringify({ audio: base64Audio }));
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (err) {
      console.error('Microphone or connection initialization error:', err);
      setErrorMessage(
        err?.message || 'Microphone access denied or audio initialization failed.'
      );
      setConnectionStatus('error');
    }
  };

  const playAudioChunk = (base64Audio) => {
    const outputCtx = outputAudioCtxRef.current;
    if (!outputCtx) return;

    try {
      const float32Samples = base64ToFloat32Array(base64Audio);
      const buffer = outputCtx.createBuffer(1, float32Samples.length, 24000);
      buffer.copyToChannel(float32Samples, 0);

      const sourceNode = outputCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.connect(outputCtx.destination);

      const currentTime = outputCtx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      sourceNode.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;

      activeSourcesRef.current.push(sourceNode);

      sourceNode.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
        if (activeSourcesRef.current.length === 0) {
          setIsModelSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  };

  const stopAllPlayback = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const stopSession = () => {
    stopAllPlayback();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    setIsModelSpeaking(false);
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      stopSession();
    }
    return () => {
      stopSession();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-700 animate-pulse shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              Live Voice Academic Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            title="Close voice session"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine and Protocol Badge */}
        <div className="flex flex-wrap items-center justify-between text-xs p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Model:</span>
            <span className="font-mono font-bold text-blue-900">gemini-3.8-live</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Audio:</span>
            <span className="font-mono text-slate-700">16kHz / 24kHz</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Status:</span>
            <span
              className={`font-semibold capitalize ${
                connectionStatus === 'connected'
                  ? 'text-emerald-700'
                  : connectionStatus === 'connecting'
                  ? 'text-amber-700'
                  : connectionStatus === 'error'
                  ? 'text-red-700'
                  : 'text-slate-500'
              }`}
            >
              {connectionStatus}
            </span>
          </div>
        </div>

        {/* Visual Audio Activity Box */}
        <div className="p-8 bg-slate-900 rounded-lg text-white flex flex-col items-center justify-center space-y-4 text-center">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isModelSpeaking
                  ? 'bg-blue-600 ring-4 ring-blue-400/50'
                  : connectionStatus === 'connected'
                  ? 'bg-slate-800 ring-2 ring-emerald-500'
                  : 'bg-slate-800'
              }`}
            >
              {isModelSpeaking ? (
                <Volume2 className="w-8 h-8 text-white animate-bounce" />
              ) : isMuted ? (
                <MicOff className="w-8 h-8 text-slate-400" />
              ) : (
                <Mic className="w-8 h-8 text-emerald-400" />
              )}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-slate-100">
              {isModelSpeaking
                ? 'Voice Mentor Speaking...'
                : connectionStatus === 'connected'
                ? isMuted
                  ? 'Microphone Muted'
                  : 'Listening to your question...'
                : connectionStatus === 'connecting'
                ? 'Establishing live audio socket...'
                : 'Session Idle'}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">{transcriptNotice}</p>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              disabled={connectionStatus !== 'connected'}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors flex items-center gap-1.5 ${
                isMuted
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            {connectionStatus === 'error' && (
              <button
                onClick={startSession}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded flex items-center gap-1.5 transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
