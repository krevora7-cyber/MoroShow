import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { AVATAR_OPTIONS } from '../types';
import { Lock, Delete, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export const PinModal: React.FC = () => {
  const { pendingProfile, isPinModalOpen, verifyPinAndSwitch, cancelPinEntry, pinError } = useProfile();
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setPinDigits([]);
  }, [isPinModalOpen]);

  // Handle number input
  const handleDigit = async (num: string) => {
    if (pinDigits.length >= 4 || isVerifying) return;
    const next = [...pinDigits, num];
    setPinDigits(next);

    if (next.length === 4) {
      setIsVerifying(true);
      const pin = next.join('');
      const res = await verifyPinAndSwitch(pin);
      setIsVerifying(false);
      if (!res.success) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPinDigits([]);
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setPinDigits(prev => prev.slice(0, -1));
  };

  // Listen to physical keyboard events
  useEffect(() => {
    if (!isPinModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        cancelPinEntry();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinModalOpen, pinDigits, isVerifying]);

  if (!isPinModalOpen || !pendingProfile) return null;

  const avatar = AVATAR_OPTIONS.find(a => a.id === pendingProfile.avatar) || AVATAR_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl relative ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        <button
          type="button"
          aria-label="Close PIN verification"
          onClick={cancelPinEntry}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with avatar */}
        <div className="text-center">
          <div
            className={`w-20 h-20 mx-auto rounded-2xl ${avatar.bgColor} flex items-center justify-center shadow-lg mb-3 relative`}
          >
            <span className="text-4xl"><img src={avatar.image} alt="" className="m-profile-image"/></span>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-neutral-950 border border-amber-500/50 text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">Profile Locked</h3>
          <p className="text-sm text-neutral-400 mt-0.5">
            Enter 4-digit PIN for <span className="text-white font-medium">{pendingProfile.name}</span>
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 my-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pinDigits.length;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-red-500 scale-125 shadow-md shadow-red-500/40'
                    : 'bg-neutral-800 border border-neutral-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error notification */}
        {pinError && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{pinError}</span>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 active:bg-neutral-600 text-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 active:bg-neutral-600 text-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            aria-label="Delete last digit"
            disabled={isVerifying || pinDigits.length === 0}
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex items-center justify-center disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Salted SHA-256 + Rate-Limit Protected
          </span>
          <button
            type="button"
            onClick={cancelPinEntry}
            className="text-neutral-400 hover:text-white hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
