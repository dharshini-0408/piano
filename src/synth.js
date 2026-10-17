// Web Audio API synth engine — multiple instrument tones, reverb send,
// and an analyser tap for the live visualizer. No external audio libs.

let audioCtx = null;
let masterGain = null;
let dryGain = null;
let wetGain = null;
let convolver = null;
let analyser = null;
const activeVoices = new Map(); // noteId -> voice

let currentInstrument = "grand";
let reverbAmount = 0.28;

function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;

    dryGain = audioCtx.createGain();
    wetGain = audioCtx.createGain();
    dryGain.gain.value = 1 - reverbAmount;
    wetGain.gain.value = reverbAmount;

    convolver = audioCtx.createConvolver();
    convolver.buffer = buildImpulseResponse(audioCtx, 2.4, 2.2);

    dryGain.connect(masterGain);
    convolver.connect(wetGain).connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Procedurally generate a plate-reverb-ish impulse response so no external
// audio file/asset is needed.
function buildImpulseResponse(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function getAnalyser() {
  getContext();
  return analyser;
}

export function setReverbAmount(amount) {
  reverbAmount = Math.min(1, Math.max(0, amount));
  if (dryGain && wetGain) {
    const now = getContext().currentTime;
    dryGain.gain.setTargetAtTime(1 - reverbAmount * 0.85, now, 0.05);
    wetGain.gain.setTargetAtTime(reverbAmount, now, 0.05);
  }
}

export function setInstrument(name) {
  currentInstrument = name;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Each instrument is a small recipe: a set of partials (oscillator type,
// frequency multiplier, relative gain) plus an amplitude envelope and a
// tone filter. This keeps every voice built from plain oscillators —
// no samples — while sounding meaningfully different per instrument.
const INSTRUMENTS = {
  grand: {
    label: "Great Hall Grand",
    partials: [
      { type: "triangle", mult: 1, gain: 1 },
      { type: "sine", mult: 2, gain: 0.09 },
      { type: "sine", mult: 1.5, gain: 0.05 },
      { type: "sine", mult: 3, gain: 0.03 },
    ],
    filterType: "lowpass",
    filterFreq: 5200,
    filterQ: 0.4,
    attack: 0.008,
    decayTo: 0.35,
    decayTime: 0.35,
    tailTo: 0.5,
    tailTime: 2.5,
    release: 0.35,
    sustains: false,
  },
  bright: {
    label: "Charms Class Bright",
    partials: [
      { type: "sawtooth", mult: 1, gain: 0.55 },
      { type: "triangle", mult: 1, gain: 0.5 },
      { type: "sine", mult: 2, gain: 0.12 },
      { type: "sine", mult: 4, gain: 0.05 },
    ],
    filterType: "lowpass",
    filterFreq: 7800,
    filterQ: 0.6,
    attack: 0.004,
    decayTo: 0.4,
    decayTime: 0.25,
    tailTo: 0.45,
    tailTime: 2.0,
    release: 0.28,
    sustains: false,
  },
  electric: {
    label: "Enchanted Keys",
    partials: [
      { type: "sine", mult: 1, gain: 1 },
      { type: "sine", mult: 2, gain: 0.35 },
      { type: "square", mult: 1, gain: 0.05 },
      { type: "sine", mult: 4.03, gain: 0.06 },
    ],
    filterType: "lowpass",
    filterFreq: 3400,
    filterQ: 1.4,
    attack: 0.003,
    decayTo: 0.5,
    decayTime: 0.45,
    tailTo: 0.3,
    tailTime: 2.8,
    release: 0.4,
    sustains: false,
  },
  organ: {
    label: "Chapel Organ",
    partials: [
      { type: "sine", mult: 1, gain: 0.6 },
      { type: "sine", mult: 2, gain: 0.35 },
      { type: "sine", mult: 3, gain: 0.2 },
      { type: "triangle", mult: 4, gain: 0.12 },
      { type: "sine", mult: 0.5, gain: 0.25 },
    ],
    filterType: "lowpass",
    filterFreq: 4200,
    filterQ: 0.2,
    attack: 0.02,
    decayTo: 0.95,
    decayTime: 0.08,
    tailTo: 0.95,
    tailTime: 0.1,
    release: 0.12,
    sustains: true,
  },
  synth: {
    label: "Spellcaster Lead",
    partials: [
      { type: "sawtooth", mult: 1, gain: 0.7 },
      { type: "sawtooth", mult: 1.005, gain: 0.6 },
      { type: "square", mult: 0.5, gain: 0.2 },
    ],
    filterType: "lowpass",
    filterFreq: 2600,
    filterQ: 4,
    attack: 0.015,
    decayTo: 0.8,
    decayTime: 0.15,
    tailTo: 0.7,
    tailTime: 1.2,
    release: 0.18,
    sustains: true,
  },
  bell: {
    label: "Room of Requirement",
    partials: [
      { type: "sine", mult: 1, gain: 1 },
      { type: "sine", mult: 3.01, gain: 0.4 },
      { type: "sine", mult: 4.2, gain: 0.25 },
      { type: "sine", mult: 6.8, gain: 0.15 },
    ],
    filterType: "lowpass",
    filterFreq: 9000,
    filterQ: 0.2,
    attack: 0.002,
    decayTo: 0.25,
    decayTime: 0.5,
    tailTo: 0.15,
    tailTime: 3.2,
    release: 0.6,
    sustains: false,
  },
};

export const INSTRUMENT_LIST = Object.entries(INSTRUMENTS).map(([id, v]) => ({
  id,
  label: v.label,
}));

export function playNote(noteId, midi, volume = 0.6) {
  const ctx = getContext();
  stopNote(noteId, true); // clear any lingering voice for this id first

  const preset = INSTRUMENTS[currentInstrument] || INSTRUMENTS.grand;
  const freq = midiToFreq(midi);
  const now = ctx.currentTime;

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0, now);

  const filter = ctx.createBiquadFilter();
  filter.type = preset.filterType;
  filter.frequency.value = preset.filterFreq;
  filter.Q.value = preset.filterQ;

  const oscillators = preset.partials.map((p) => {
    const osc = ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.value = freq * p.mult;
    const g = ctx.createGain();
    g.gain.value = p.gain;
    osc.connect(g).connect(filter);
    osc.start(now);
    return osc;
  });

  filter.connect(voiceGain);
  voiceGain.connect(dryGain);
  voiceGain.connect(convolver);

  const peak = volume;
  voiceGain.gain.linearRampToValueAtTime(peak, now + preset.attack);
  voiceGain.gain.exponentialRampToValueAtTime(
    Math.max(peak * preset.decayTo, 0.0001),
    now + preset.attack + preset.decayTime
  );
  if (!preset.sustains) {
    voiceGain.gain.exponentialRampToValueAtTime(
      Math.max(peak * preset.tailTo, 0.0001),
      now + preset.attack + preset.decayTime + preset.tailTime
    );
  }

  activeVoices.set(noteId, { oscillators, voiceGain, preset });
}

export function stopNote(noteId, immediate = false) {
  const voice = activeVoices.get(noteId);
  if (!voice) return;
  const ctx = getContext();
  const now = ctx.currentTime;

  if (immediate) {
    try {
      voice.oscillators.forEach((o) => o.stop(now));
    } catch (e) {
      // already stopped, ignore
    }
    activeVoices.delete(noteId);
    return;
  }

  const releaseTime = voice.preset.release;
  voice.voiceGain.gain.cancelScheduledValues(now);
  voice.voiceGain.gain.setValueAtTime(voice.voiceGain.gain.value, now);
  voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

  voice.oscillators.forEach((o) => o.stop(now + releaseTime + 0.05));
  activeVoices.delete(noteId);
}

export function stopAllNotes() {
  Array.from(activeVoices.keys()).forEach((id) => stopNote(id));
}
