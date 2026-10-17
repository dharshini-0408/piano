import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  playNote,
  stopNote,
  stopAllNotes,
  setInstrument,
  setReverbAmount,
  INSTRUMENT_LIST,
} from "./synth";
import Visualizer from "./Visualizer";
import "./Piano.css";

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Maps a computer-keyboard key to a semitone offset from the current
// base octave's C. Modeled on the layout used by most DAW "musical typing"
// keyboards.
const KEY_TO_OFFSET = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7,
  y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16,
};

const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;
const MAX_RECORD_MS = 60000;

function midiForOffset(baseOctave, offset) {
  return 12 * (baseOctave + 1) + offset;
}

function buildKeys(baseOctave) {
  const keys = [];
  for (let o = baseOctave; o <= baseOctave + 1; o++) {
    for (let i = 0; i < 12; i++) {
      const midi = 12 * (o + 1) + i;
      keys.push({
        midi,
        name: NOTE_NAMES[i],
        octave: o,
        isBlack: NOTE_NAMES[i].includes("#"),
      });
    }
  }
  // Add the final top C to round out two full octaves visually.
  const topOctave = baseOctave + 2;
  keys.push({ midi: 12 * (topOctave + 1), name: "C", octave: topOctave, isBlack: false });
  return keys;
}

// Reverse lookup: midi offset -> computer key label, for the current base octave.
function buildLabelMap(baseOctave) {
  const map = {};
  Object.entries(KEY_TO_OFFSET).forEach(([key, offset]) => {
    map[midiForOffset(baseOctave, offset)] = key === ";" ? ";" : key.toUpperCase();
  });
  return map;
}

export default function Piano() {
  const [baseOctave, setBaseOctave] = useState(3);
  const [volume, setVolume] = useState(0.6);
  const [sustain, setSustain] = useState(false);
  const [activeNotes, setActiveNotes] = useState(() => new Set());
  const [instrument, setInstrumentState] = useState("grand");
  const [reverb, setReverb] = useState(0.28);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const sustainRef = useRef(sustain);
  const sustainedNotesRef = useRef(new Set());
  const heldKeysRef = useRef(new Set());
  const volumeRef = useRef(volume);
  const baseOctaveRef = useRef(baseOctave);

  const recordingRef = useRef([]); // {midi, type: 'on'|'off', t}
  const recordStartRef = useRef(0);
  const playbackTimeoutsRef = useRef([]);

  useEffect(() => {
    sustainRef.current = sustain;
    if (!sustain) {
      sustainedNotesRef.current.forEach((midi) => {
        if (!heldKeysRef.current.has(midi)) {
          stopNote(midi);
          setActiveNotes((prev) => {
            const next = new Set(prev);
            next.delete(midi);
            return next;
          });
        }
      });
      sustainedNotesRef.current.clear();
    }
  }, [sustain]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    baseOctaveRef.current = baseOctave;
  }, [baseOctave]);

  useEffect(() => {
    setInstrument(instrument);
  }, [instrument]);

  useEffect(() => {
    setReverbAmount(reverb);
  }, [reverb]);

  const keys = useMemo(() => buildKeys(baseOctave), [baseOctave]);
  const labelMap = useMemo(() => buildLabelMap(baseOctave), [baseOctave]);

  const recordEvent = useCallback((midi, type) => {
    if (!isRecording) return;
    const t = performance.now() - recordStartRef.current;
    if (t > MAX_RECORD_MS) return;
    recordingRef.current.push({ midi, type, t });
  }, [isRecording]);

  const noteOn = useCallback((midi, fromPlayback = false) => {
    playNote(midi, midi, volumeRef.current);
    setActiveNotes((prev) => new Set(prev).add(midi));
    if (!fromPlayback) recordEvent(midi, "on");
  }, [recordEvent]);

  const noteOff = useCallback((midi, fromPlayback = false) => {
    if (sustainRef.current && !fromPlayback) {
      sustainedNotesRef.current.add(midi);
      return;
    }
    stopNote(midi);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    if (!fromPlayback) recordEvent(midi, "off");
  }, [recordEvent]);

  // Computer keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const active = document.activeElement;
      // Only ignore key presses while the user is actually typing into a
      // text field. Range sliders and the (auto-blurred) tone select must
      // never swallow keyboard note input.
      if (active && active.tagName === "INPUT" && active.type === "text") return;
      if (e.code === "Space") {
        e.preventDefault();
        setSustain(true);
        return;
      }
      if (e.key.toLowerCase() === "z") {
        setBaseOctave((o) => Math.max(MIN_OCTAVE, o - 1));
        return;
      }
      if (e.key.toLowerCase() === "x") {
        setBaseOctave((o) => Math.min(MAX_OCTAVE, o + 1));
        return;
      }
      const key = e.key.toLowerCase();
      if (key in KEY_TO_OFFSET) {
        // Safety net: if a button/select still has focus (e.g. right after
        // a click), release it so it can never intercept subsequent keys.
        if (active && active !== document.body && active.blur) active.blur();
        const midi = midiForOffset(baseOctaveRef.current, KEY_TO_OFFSET[key]);
        if (heldKeysRef.current.has(midi)) return;
        heldKeysRef.current.add(midi);
        noteOn(midi);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setSustain(false);
        return;
      }
      const key = e.key.toLowerCase();
      if (key in KEY_TO_OFFSET) {
        const midi = midiForOffset(baseOctaveRef.current, KEY_TO_OFFSET[key]);
        heldKeysRef.current.delete(midi);
        sustainedNotesRef.current.delete(midi);
        noteOff(midi);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [noteOn, noteOff]);

  useEffect(() => stopAllNotes, []);

  const clearPlaybackTimeouts = () => {
    playbackTimeoutsRef.current.forEach((id) => clearTimeout(id));
    playbackTimeoutsRef.current = [];
  };

  const toggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasRecording(recordingRef.current.length > 0);
    } else {
      clearPlaybackTimeouts();
      setIsPlaying(false);
      recordingRef.current = [];
      recordStartRef.current = performance.now();
      setHasRecording(false);
      setIsRecording(true);
    }
  };

  const playRecording = () => {
    if (!recordingRef.current.length || isRecording) return;
    clearPlaybackTimeouts();
    setIsPlaying(true);
    recordingRef.current.forEach((ev) => {
      const id = setTimeout(() => {
        if (ev.type === "on") noteOn(ev.midi, true);
        else noteOff(ev.midi, true);
      }, ev.t);
      playbackTimeoutsRef.current.push(id);
    });
    const lastT = recordingRef.current[recordingRef.current.length - 1].t + 400;
    const endId = setTimeout(() => setIsPlaying(false), lastT);
    playbackTimeoutsRef.current.push(endId);
  };

  const stopPlayback = () => {
    clearPlaybackTimeouts();
    setIsPlaying(false);
    stopAllNotes();
    setActiveNotes(new Set());
  };

  const clearRecording = () => {
    stopPlayback();
    recordingRef.current = [];
    setHasRecording(false);
  };

  const whiteKeys = keys.filter((k) => !k.isBlack);
  const whiteKeyWidth = 100 / whiteKeys.length;

  // Position each black key relative to the white key it sits between.
  let whiteCounter = -1;
  const keysWithWhiteIndex = keys.map((k) => {
    if (!k.isBlack) whiteCounter += 1;
    return { ...k, whiteIndex: whiteCounter };
  });

  const handlePress = (midi) => (e) => {
    e.preventDefault();
    noteOn(midi);
  };
  const handleRelease = (midi) => (e) => {
    e.preventDefault();
    noteOff(midi);
  };

  const anySoundActive = activeNotes.size > 0;

  return (
    <div className="piano-wrap">
      <header className="piano-header">
        <div className="piano-brand">
          <span className="piano-brand-dot" />
          <h1 className="piano-title">Enchanted Piano</h1>
        </div>
        <p className="piano-subtitle">
          Cast your melody &middot; play the keys or your own keyboard, A&ndash;; &middot; Z / X to change octave &middot; hold Space to sustain
        </p>
      </header>

      <Visualizer active={anySoundActive} />

      <section className="panel">
        <div className="panel-row">
          <div className="field">
            <label className="field-label">Tone</label>
            <select
              className="select"
              value={instrument}
              onChange={(e) => {
                setInstrumentState(e.target.value);
                e.target.blur();
              }}
            >
              {INSTRUMENT_LIST.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Octave</label>
            <div className="stepper">
              <button
                className="stepper-btn"
                onClick={() => setBaseOctave((o) => Math.max(MIN_OCTAVE, o - 1))}
                aria-label="Shift octave down"
              >
                &minus;
              </button>
              <span className="stepper-value">{baseOctave}</span>
              <button
                className="stepper-btn"
                onClick={() => setBaseOctave((o) => Math.min(MAX_OCTAVE, o + 1))}
                aria-label="Shift octave up"
              >
                +
              </button>
            </div>
          </div>

          <div className="field field-slider">
            <label className="field-label">Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>

          <div className="field field-slider">
            <label className="field-label">Reverb</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={reverb}
              onChange={(e) => setReverb(parseFloat(e.target.value))}
            />
          </div>

          <div className="field field-toggles">
            <button
              className={`toggle-pill${sustain ? " toggle-on" : ""}`}
              onMouseDown={() => setSustain(true)}
              onMouseUp={() => setSustain(false)}
              onMouseLeave={() => sustain && setSustain(false)}
            >
              Sustain
            </button>
            <button
              className={`toggle-pill${showLabels ? " toggle-on" : ""}`}
              onClick={() => setShowLabels((v) => !v)}
            >
              Labels
            </button>
          </div>
        </div>

        <div className="panel-divider" />

        <div className="panel-row panel-row-recorder">
          <button
            className={`rec-btn rec-btn-primary${isRecording ? " is-recording" : ""}`}
            onClick={toggleRecord}
          >
            <span className="rec-icon" />
            {isRecording ? "Stop recording" : "Record"}
          </button>
          <button
            className="rec-btn"
            onClick={isPlaying ? stopPlayback : playRecording}
            disabled={!hasRecording && !isPlaying}
          >
            {isPlaying ? "◼ Stop" : "▶ Play back"}
          </button>
          <button className="rec-btn rec-btn-ghost" onClick={clearRecording} disabled={!hasRecording}>
            Clear
          </button>
          {isRecording && <span className="rec-status">Recording&hellip;</span>}
        </div>
      </section>

      <div className="piano-stage">
        <div className="piano" onContextMenu={(e) => e.preventDefault()}>
          <div className="white-keys">
            {whiteKeys.map((k) => (
              <div
                key={k.midi}
                className={`white-key${activeNotes.has(k.midi) ? " pressed" : ""}`}
                style={{ width: `${whiteKeyWidth}%` }}
                onMouseDown={handlePress(k.midi)}
                onMouseUp={handleRelease(k.midi)}
                onMouseLeave={() => activeNotes.has(k.midi) && noteOff(k.midi)}
                onTouchStart={handlePress(k.midi)}
                onTouchEnd={handleRelease(k.midi)}
              >
                <span className="key-face" />
                {showLabels && labelMap[k.midi] && (
                  <span className="key-label">{labelMap[k.midi]}</span>
                )}
                {k.name === "C" && <span className="note-name">C{k.octave}</span>}
              </div>
            ))}
          </div>
          <div className="black-keys">
            {keysWithWhiteIndex
              .filter((k) => k.isBlack)
              .map((k) => {
                const leftPercent =
                  (k.whiteIndex + 1) * whiteKeyWidth - (whiteKeyWidth * 0.58) / 2;
                return (
                  <div
                    key={k.midi}
                    className={`black-key${activeNotes.has(k.midi) ? " pressed" : ""}`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${whiteKeyWidth * 0.58}%`,
                    }}
                    onMouseDown={handlePress(k.midi)}
                    onMouseUp={handleRelease(k.midi)}
                    onMouseLeave={() => activeNotes.has(k.midi) && noteOff(k.midi)}
                    onTouchStart={handlePress(k.midi)}
                    onTouchEnd={handleRelease(k.midi)}
                  >
                    <span className="key-face" />
                    {showLabels && labelMap[k.midi] && (
                      <span className="key-label black-label">{labelMap[k.midi]}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
        <div className="piano-riser" aria-hidden="true" />
        <div className="piano-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
