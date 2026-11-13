// Pure Web Audio API ringtone, ringback, and mobile vibration controller for WhatApp calls.

type ActiveAudioMode = 'incoming' | 'outgoing' | null;

let sharedAudioCtx: AudioContext | null = null;
let ringTimer: number | null = null;
let vibrateTimer: number | null = null;
let currentMode: ActiveAudioMode = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function unlockCallAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playToneBurst(
  freqs: number[],
  startOffsetSec: number,
  durationSec: number,
  volume: number
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime + startOffsetSec;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(volume, now + 0.025);
  master.gain.setValueAtTime(volume, Math.max(now + 0.03, now + durationSec - 0.04));
  master.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
  master.connect(ctx.destination);

  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(master);
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }
}

function playIncomingCycle(): void {
  // Pleasant smartphone-style harmonic chime ring (two quick phrases per ring cycle)
  playToneBurst([523.25, 659.25], 0, 0.28, 0.16);
  playToneBurst([659.25, 783.99], 0.3, 0.34, 0.16);
  playToneBurst([523.25, 659.25], 0.85, 0.28, 0.16);
  playToneBurst([659.25, 783.99], 1.15, 0.36, 0.16);
}

function playOutgoingCycle(): void {
  // Classic subtle dual-tone ringback pulse (440 Hz + 480 Hz)
  playToneBurst([440, 480], 0, 0.85, 0.06);
}

function triggerVibrationPattern(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([700, 350, 700, 1200]);
    } catch {
      // Ignore browser vibration restrictions
    }
  }
}

export function startIncomingRingtone(): void {
  if (currentMode === 'incoming') return;
  stopCallAudioAndVibration();
  currentMode = 'incoming';

  playIncomingCycle();
  ringTimer = window.setInterval(() => {
    if (currentMode === 'incoming') {
      playIncomingCycle();
    }
  }, 2400);

  triggerVibrationPattern();
  vibrateTimer = window.setInterval(() => {
    if (currentMode === 'incoming') {
      triggerVibrationPattern();
    }
  }, 3100);
}

export function startOutgoingRingback(): void {
  if (currentMode === 'outgoing') return;
  stopCallAudioAndVibration();
  currentMode = 'outgoing';

  playOutgoingCycle();
  ringTimer = window.setInterval(() => {
    if (currentMode === 'outgoing') {
      playOutgoingCycle();
    }
  }, 3000);
}

export function stopCallAudioAndVibration(): void {
  currentMode = null;
  if (ringTimer !== null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
  if (vibrateTimer !== null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore
    }
  }
}
