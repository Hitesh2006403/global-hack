import React, { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { PhoneCall, PhoneOff, Mic, Volume2, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export const AiVoiceCallModal = () => {
  const { activeVoiceCall, dismissVoiceCall, addToast } = useNotification();
  const [callState, setCallState] = useState('RINGING'); // RINGING -> CONNECTED -> ACCEPTED

  useEffect(() => {
    if (activeVoiceCall) {
      setCallState('RINGING');
    }
  }, [activeVoiceCall]);

  if (!activeVoiceCall) return null;

  const handleAnswer = () => {
    setCallState('CONNECTED');
  };

  const handleConfirmReservation = () => {
    setCallState('ACCEPTED');
    setTimeout(() => {
      dismissVoiceCall();
      addToast('AI Voice Dispatch: Recipient accepted surplus batch via telephone confirmation!', 'success');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-stone-950 text-white rounded-3xl p-6 shadow-2xl border border-rose-500/30 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between text-xs text-rose-400 font-semibold uppercase tracking-wider mb-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            AI Urgent Voice Dispatch
          </span>
          <span className="bg-rose-950/80 text-rose-300 border border-rose-800/60 px-2.5 py-0.5 rounded-full text-[11px]">
            High Urgency
          </span>
        </div>

        {/* Center Calling Avatar / Visualizer */}
        <div className="text-center py-4">
          <div className="relative inline-block mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
              callState === 'RINGING' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {callState === 'RINGING' ? (
                <PhoneCall className="w-9 h-9 animate-bounce text-rose-400" />
              ) : (
                <Volume2 className="w-9 h-9 text-emerald-400 animate-pulse" />
              )}
            </div>
          </div>

          <h4 className="text-xl font-bold text-slate-100">{activeVoiceCall.recipientName}</h4>
          <p className="text-xs text-slate-400 mt-1 font-mono">{activeVoiceCall.recipientPhone}</p>
          <div className="inline-block mt-2 bg-slate-800/80 px-3 py-1 rounded-full text-xs text-amber-300 border border-amber-500/20">
            {activeVoiceCall.foodName} • {activeVoiceCall.expiryLeft}
          </div>
        </div>

        {/* Simulated Live Audio Waveform & Speech Transcript */}
        <div className="mt-4 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Automated Synthesized Speech
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              {callState === 'RINGING' ? 'Dialing shelter coordinator...' : 'Live Connected Call'}
            </span>
          </div>

          {callState === 'RINGING' ? (
            <div className="py-3 text-center text-xs text-slate-400 italic">
              Calling recipient phone line... Voice synthesis ready.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
                "{activeVoiceCall.transcript}"
              </p>
              <div className="flex items-center justify-center gap-1 py-1">
                {[40, 70, 30, 90, 60, 20, 80, 45].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h * 0.25}px` }}
                    className="w-1 bg-amber-400/80 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center justify-center gap-4">
          {callState === 'RINGING' && (
            <>
              <button
                onClick={dismissVoiceCall}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4 text-slate-400" />
                Decline
              </button>
              <button
                onClick={handleAnswer}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                Connect AI Call
              </button>
            </>
          )}

          {callState === 'CONNECTED' && (
            <>
              <button
                onClick={dismissVoiceCall}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                End Call
              </button>
              <button
                onClick={handleConfirmReservation}
                className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-semibold shadow-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Voice Claim
              </button>
            </>
          )}

          {callState === 'ACCEPTED' && (
            <div className="w-full py-3 text-center text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Claim Confirmed via AI Voice Dispatch!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
