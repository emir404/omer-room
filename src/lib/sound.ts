/**
 * Tiny Web Audio engine. Off by default; nothing is created until the visitor turns sound on.
 * Phase 1 synthesizes every effect (no files to download). Phase 3 adds CC0 ambience
 * (day birds / night crickets) through the same API.
 */
export type Sfx = "hover" | "open" | "close" | "bounce" | "rim" | "swish";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;

const STORAGE_KEY = "omer-room:sound";

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function readStoredSound(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // ignore blocked storage
  }
  if (on) void audio()?.resume();
}

function tone(type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0) {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, gain: number, fromHz: number, toHz: number) {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(fromHz, t0);
  filter.frequency.exponentialRampToValueAtTime(toHz, t0 + duration);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(env).connect(master);
  src.start(t0);
}

export function playSfx(name: Sfx) {
  if (!enabled) return;
  switch (name) {
    case "hover":
      tone("sine", 1320, 1180, 0.05, 0.05);
      break;
    case "open":
      tone("square", 520, 520, 0.06, 0.04);
      tone("square", 780, 780, 0.08, 0.04, 0.06);
      break;
    case "close":
      tone("square", 780, 780, 0.06, 0.04);
      tone("square", 520, 520, 0.08, 0.04, 0.06);
      break;
    case "bounce":
      tone("sine", 150, 55, 0.18, 0.5);
      noise(0.05, 0.08, 400, 200);
      break;
    case "rim":
      tone("triangle", 1250, 1150, 0.35, 0.12);
      tone("triangle", 1870, 1800, 0.25, 0.06);
      break;
    case "swish":
      noise(0.35, 0.18, 900, 4200);
      break;
  }
}
