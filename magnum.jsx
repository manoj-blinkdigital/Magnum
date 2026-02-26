import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

const C = {
  bg: "#08080a", surface: "#121215", surfaceLight: "#1c1c20",
  gold: "#c9a84c", goldLight: "#e8d48b", goldDim: "#8a7233",
  cream: "#f5e6c8", white: "#fafafa", muted: "#555",
};

const FLAVORS = [
  { id: "dark", name: "Dark Chocolate", color: "#3b1f0b", hi: "#5c3822", rim: "#2a1508" },
  { id: "milk", name: "Milk Chocolate", color: "#6b3a2a", hi: "#8e5842", rim: "#4a2518" },
  { id: "ruby", name: "Ruby Chocolate", color: "#a83252", hi: "#cc4e6e", rim: "#7a2040" },
  { id: "white", name: "White Chocolate", color: "#f0e2c8", hi: "#fff8ee", rim: "#d8cbb0" },
];
const TOPPINGS = [
  { id: "nuts", name: "Crushed Nuts", color: "#c49a52", shape: "angular" },
  { id: "cookie", name: "Cookie Crumbs", color: "#5a3a1a", shape: "round" },
  { id: "coconut", name: "Coconut Flakes", color: "#f0e8d8", shape: "flake" },
  { id: "caramel", name: "Caramel Bits", color: "#d4952a", shape: "round" },
];
const SYRUPS = [
  { id: "caramel", name: "Caramel", color: "#c47a2a" },
  { id: "strawberry", name: "Strawberry", color: "#d94060" },
  { id: "darkchoc", name: "Dark Chocolate", color: "#2a1408" },
  { id: "salted", name: "Salted Caramel", color: "#b8863a" },
];

// ═══════════════════════════════════════════
//  DEEP HOUSE AUDIO ENGINE v2 — 122 BPM
// ═══════════════════════════════════════════
class AudioEngine {
  constructor() {
    this.started = false;
    this.bpm = 122;
    this.layers = {};
    this.loops = {};
    this.activeSteps = { kick: [], perc: [], melody: [], drop: [] };
    this._cbs = [];
    this._masterGain = null;
  }

  async init() {
    if (this.started) return;
    await Tone.start();
    Tone.getTransport().bpm.value = this.bpm;
    Tone.getTransport().swing = 0.08;
    Tone.getTransport().swingSubdivision = "16n";

    this._masterGain = new Tone.Gain(1).toDestination();

    // Kick: Deep & punchy with ghost note
    this.layers.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 5.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.45, sustain: 0.0, release: 0.7 },
    }).connect(this._masterGain);
    this.layers.kick.volume.value = -5;

    // Closed hat
    this.layers.hihatClosed = new Tone.MetalSynth({
      frequency: 340, envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1, modulationIndex: 34, resonance: 4200, octaves: 1.0,
    }).connect(this._masterGain);
    this.layers.hihatClosed.volume.value = -23;

    // Open hat
    this.layers.hihatOpen = new Tone.MetalSynth({
      frequency: 300, envelope: { attack: 0.001, decay: 0.18, release: 0.12 },
      harmonicity: 5.1, modulationIndex: 28, resonance: 3800, octaves: 1.3,
    }).connect(this._masterGain);
    this.layers.hihatOpen.volume.value = -24;

    // Clap with reverb tail
    const clapReverb = new Tone.Reverb({ decay: 0.6, wet: 0.25 }).connect(this._masterGain);
    this.layers.clap = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0.0, release: 0.06 },
    }).connect(clapReverb);
    this.layers.clap.volume.value = -15;

    // Chords: Warm stabs with chorus
    const chordFilter = new Tone.Filter({ frequency: 2400, type: "lowpass", rolloff: -12, Q: 0.8 }).connect(this._masterGain);
    const chordChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.2 }).connect(chordFilter);
    this.layers.chords = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5, modulationIndex: 1.0,
      oscillator: { type: "sine" },
      envelope: { attack: 0.008, decay: 0.3, sustain: 0.25, release: 0.7 },
      modulation: { type: "triangle" },
      modulationEnvelope: { attack: 0.08, decay: 0.2, sustain: 0.3, release: 0.5 },
    }).connect(chordChorus);
    this.layers.chords.volume.value = -15;

    // Bass: Groovy sub with filter sweep
    const bassFilter = new Tone.Filter({ frequency: 550, type: "lowpass", rolloff: -24, Q: 2.5 }).connect(this._masterGain);
    this.layers.bassLFO = new Tone.LFO({ frequency: "1n", min: 280, max: 750 }).connect(bassFilter.frequency).start();
    this.layers.bass = new Tone.MonoSynth({
      oscillator: { type: "triangle8" },
      filter: { Q: 1.5, type: "lowpass", rolloff: -12 },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0.45, release: 0.25 },
      filterEnvelope: { attack: 0.004, decay: 0.15, sustain: 0.35, release: 0.3, baseFrequency: 90, octaves: 2.8 },
    }).connect(bassFilter);
    this.layers.bass.volume.value = -9;

    // Impact sub boom for the drop
    this.layers.impact = new Tone.MembraneSynth({
      pitchDecay: 0.12, octaves: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0.0, release: 1.2 },
    }).connect(this._masterGain);
    this.layers.impact.volume.value = -2;

    // White noise riser
    this.layers.riser = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.35, decay: 0.01, sustain: 1, release: 0.05 },
    }).connect(this._masterGain);
    this.layers.riser.volume.value = -18;

    this.started = true;
  }

  // Layer 1: Kick — four-on-floor + ghost on 16
  startKick() {
    if (this.loops.kick) return;
    const pat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2];
    this.activeSteps.kick = pat.map(v => v ? 1 : 0);
    let step = 0;
    this.loops.kick = new Tone.Loop((time) => {
      const s = step % 16;
      if (pat[s] === 1) this.layers.kick.triggerAttackRelease("C1", "8n", time);
      else if (pat[s] === 2) this.layers.kick.triggerAttackRelease("C1", "16n", time, 0.4);
      this._fire("kick", s);
      step++;
    }, "16n").start(0);
    if (Tone.getTransport().state !== "started") Tone.getTransport().start();
  }

  // Layer 2: Open/closed hats + clap
  startPerc() {
    if (this.loops.perc) return;
    const closedH = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    const openH =   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const clapP =   [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    this.activeSteps.perc = closedH.map((h, i) => (h || openH[i] || clapP[i]) ? 1 : 0);
    let step = 0;
    this.loops.perc = new Tone.Loop((time) => {
      const s = step % 16;
      if (closedH[s]) this.layers.hihatClosed.triggerAttackRelease("32n", time, 0.22);
      if (openH[s]) this.layers.hihatOpen.triggerAttackRelease("8n", time, 0.18);
      if (clapP[s]) this.layers.clap.triggerAttackRelease("16n", time);
      this._fire("perc", s);
      step++;
    }, "16n").start(0);
  }

  // Layer 3: Chord stabs — Dm9, Am7, Gm9, C7
  startMelody() {
    if (this.loops.melody) return;
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    this.activeSteps.melody = pat;
    const chords = {
      0: ["D3","F3","A3","C4","E4"],
      3: ["D3","F3","A3","C4"],
      6: ["A2","C3","E3","G3"],
      10: ["G2","Bb2","D3","F3","A3"],
      14: ["C3","E3","G3","Bb3"],
    };
    let step = 0;
    this.loops.melody = new Tone.Loop((time) => {
      const s = step % 16;
      if (pat[s] && chords[s]) this.layers.chords.triggerAttackRelease(chords[s], "8n", time, 0.3);
      this._fire("melody", s);
      step++;
    }, "16n").start(0);
  }

  // Layer 4: Walking bassline
  startDrop() {
    if (this.loops.drop) return;
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
    this.activeSteps.drop = pat;
    const notes = { 0:"D2", 3:"E2", 6:"A1", 8:"G1", 12:"Bb1", 14:"C2" };
    let step = 0;
    this.loops.drop = new Tone.Loop((time) => {
      const s = step % 16;
      if (pat[s] && notes[s]) this.layers.bass.triggerAttackRelease(notes[s], "16n", time);
      this._fire("drop", s);
      step++;
    }, "16n").start(0);
  }

  // THE BREAK: silence → riser → slam back in with bass + impact
  async triggerBreakDrop() {
    if (this._masterGain) this._masterGain.gain.rampTo(0, 0.05);
    setTimeout(() => {
      this.layers.riser.triggerAttackRelease("0.4");
    }, 80);
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this._masterGain) this._masterGain.gain.rampTo(1, 0.02);
        this.layers.impact.triggerAttackRelease("C1", "2n");
        this.startDrop();
        resolve();
      }, 520);
    });
  }

  _fire(layer, step) { this._cbs.forEach((cb) => cb(layer, step)); }
  onStep(cb) { this._cbs.push(cb); }
  dispose() {
    try {
      Tone.getTransport().stop();
      Object.values(this.loops).forEach((l) => l?.dispose());
      Object.values(this.layers).forEach((l) => l?.dispose());
    } catch (e) {}
  }
}

// ═══════════════════════════════════════
//  POLISHED 3D ICE CREAM BAR
// ═══════════════════════════════════════
function IceCreamBar({ coating, topping, syrup, bitten, floating = true }) {
  const f = FLAVORS.find((fl) => fl.id === coating);
  const hasCoating = !!f;
  const syrupColor = SYRUPS.find((s) => s.id === syrup)?.color;
  const td = TOPPINGS.find((t) => t.id === topping);
  const isWhite = coating === "white";

  const sprinkles = useRef(
    Array.from({ length: 22 }, () => ({
      x: 6 + Math.random() * 72, y: 8 + Math.random() * 175,
      w: 2.5 + Math.random() * 3, rot: Math.random() * 360,
    }))
  ).current;

  const dripData = useRef(
    [0,1,2,3,4].map(() => ({
      x: 6 + Math.random() * 72, w: 4 + Math.random() * 6,
      h: 35 + Math.random() * 90, blobR: 3 + Math.random() * 4,
    }))
  ).current;

  return (
    <div style={{
      position: "relative", width: 130, height: 300, margin: "0 auto",
      animation: floating ? "barFloat 3s ease-in-out infinite" : "none",
    }}>
      {/* Ground shadow */}
      <div style={{
        position: "absolute", bottom: -55, left: "50%", transform: "translateX(-50%)",
        width: 70, height: 14, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.35), transparent 70%)",
        filter: "blur(4px)",
      }} />

      {/* Stick */}
      <div style={{
        position: "absolute", bottom: -35, left: "50%", transform: "translateX(-50%)",
        width: 14, height: 85,
        background: "linear-gradient(90deg, #c4a466 0%, #d4b876 25%, #e8d8a8 50%, #d4b876 75%, #b89850 100%)",
        borderRadius: "2px 2px 5px 5px",
        boxShadow: "2px 3px 10px rgba(0,0,0,0.35), inset -1px 0 2px rgba(0,0,0,0.1)",
        zIndex: 2,
      }}>
        {[20, 40, 55].map((y) => (
          <div key={y} style={{
            position: "absolute", top: y, left: 2, right: 2, height: 0.5,
            background: "rgba(0,0,0,0.06)", borderRadius: 1,
          }} />
        ))}
      </div>

      {/* Bar body */}
      <div style={{
        position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
        width: 94, height: 205, borderRadius: "22px 22px 26px 26px",
        background: hasCoating
          ? `linear-gradient(145deg, ${f.hi} 0%, ${f.color} 35%, ${f.color} 60%, ${f.rim} 100%)`
          : "linear-gradient(145deg, #fffefa 0%, #f8f2e8 30%, #ede4d4 60%, #ddd2c0 100%)",
        boxShadow: hasCoating
          ? `0 10px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset -5px -5px 15px rgba(0,0,0,0.3), inset 3px 3px 10px rgba(255,255,255,${isWhite ? "0.5" : "0.08"})`
          : `0 10px 40px rgba(0,0,0,0.3), inset -4px -4px 12px rgba(0,0,0,0.08), inset 4px 4px 12px rgba(255,255,255,0.9)`,
        transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)", zIndex: 5, overflow: "hidden",
      }}>
        {/* Top cap highlight */}
        <div style={{
          position: "absolute", top: 0, left: 8, right: 8, height: 28,
          borderRadius: "18px 18px 50% 50%",
          background: `linear-gradient(180deg, rgba(255,255,255,${hasCoating ? (isWhite ? "0.5" : "0.18") : "0.7"}) 0%, transparent 100%)`,
        }} />

        {/* Left edge shine */}
        <div style={{
          position: "absolute", top: 12, left: 5, width: 10, height: "65%",
          background: `linear-gradient(180deg, rgba(255,255,255,${isWhite ? "0.4" : "0.15"}) 0%, transparent 80%)`,
          borderRadius: 6, filter: "blur(4px)",
        }} />

        {/* Right shadow */}
        <div style={{
          position: "absolute", top: 12, right: 0, width: 15, height: "80%",
          background: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.15))",
          borderRadius: "0 18px 20px 0", filter: "blur(2px)",
        }} />

        {/* Center specular */}
        <div style={{
          position: "absolute", top: 30, left: "30%", width: 6, height: 50,
          background: `rgba(255,255,255,${hasCoating ? (isWhite ? "0.25" : "0.06") : "0.3"})`,
          borderRadius: 4, filter: "blur(5px)", transform: "rotate(-5deg)",
        }} />

        {/* Sprinkle particles */}
        {td && sprinkles.map((sp, i) => (
          <div key={i} style={{
            position: "absolute", left: sp.x, top: sp.y,
            width: sp.w, height: td.shape === "flake" ? sp.w * 0.35 : sp.w,
            borderRadius: td.shape === "round" ? "50%" : td.shape === "flake" ? "1px" : "2px",
            background: td.color, opacity: 0.85,
            transform: `rotate(${sp.rot}deg)`,
            animation: `popIn 0.35s ease ${0.6 + i * 0.04}s both`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }} />
        ))}

        {/* Syrup drips */}
        {syrupColor && dripData.map((d, i) => (
          <div key={i} style={{ position: "absolute", left: d.x, top: 0 }}>
            <div style={{
              width: d.w, height: d.h,
              background: `linear-gradient(to bottom, ${syrupColor}ee, ${syrupColor}aa)`,
              borderRadius: `0 0 ${d.w / 2}px ${d.w / 2}px`,
              animation: `dripDown 0.7s ease ${i * 0.15}s both`,
              boxShadow: `inset -1px 0 2px rgba(255,255,255,0.15)`,
            }} />
            <div style={{
              width: d.blobR * 2, height: d.blobR * 2.2,
              borderRadius: "45% 45% 50% 50%",
              background: `radial-gradient(ellipse at 30% 30%, ${syrupColor}dd, ${syrupColor})`,
              marginLeft: (d.w - d.blobR * 2) / 2,
              animation: `dripDown 0.7s ease ${i * 0.15 + 0.3}s both`,
              boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
            }} />
          </div>
        ))}

        {/* Bite: background cutout */}
        {bitten && (
          <>
            <div style={{
              position: "absolute", top: -8, right: -8, width: 55, height: 52,
              borderRadius: "0 0 0 55%", background: C.bg,
              animation: "biteIn 0.25s cubic-bezier(0.2,0,0,1) forwards", zIndex: 20,
            }} />
            {/* Cream cross-section */}
            <div style={{
              position: "absolute", top: -2, right: -2, width: 48, height: 45,
              borderRadius: "0 0 0 55%",
              background: "linear-gradient(135deg, #fff8ee, #f0e6d2)",
              animation: "biteIn 0.25s cubic-bezier(0.2,0,0,1) 0.05s forwards",
              opacity: 0, zIndex: 19,
            }} />
            {/* Crack lines */}
            {[
              { x: 46, y: 38, w: 18, r: 25 },
              { x: 60, y: 20, w: 14, r: -40 },
              { x: 38, y: 48, w: 12, r: 60 },
            ].map((cr, i) => (
              <div key={i} style={{
                position: "absolute", left: cr.x, top: cr.y,
                width: cr.w, height: 1.5,
                background: hasCoating ? f.rim : "rgba(0,0,0,0.1)",
                transform: `rotate(${cr.r}deg)`,
                animation: `crackIn 0.15s ease ${0.1 + i * 0.05}s both`, zIndex: 21,
              }} />
            ))}
          </>
        )}
      </div>

      <style>{`
        @keyframes barFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes popIn { from{opacity:0;transform:scale(0)} to{opacity:0.85;transform:scale(1) rotate(45deg)} }
        @keyframes dripDown { from{opacity:0;transform:scaleY(0);transform-origin:top} to{opacity:1;transform:scaleY(1);transform-origin:top} }
        @keyframes biteIn { from{opacity:0;transform:scale(0.3);transform-origin:top right} to{opacity:1;transform:scale(1);transform-origin:top right} }
        @keyframes crackIn { from{opacity:0;transform:scaleX(0)} to{opacity:0.7;transform:scaleX(1)} }
      `}</style>
    </div>
  );
}

// ═══════════════════
//  PARTICLE EFFECTS
// ═══════════════════
function SprinkleParticles({ topping, active }) {
  const [particles] = useState(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id: i, x: 28 + Math.random() * 44, y: -8 - Math.random() * 35,
      delay: Math.random() * 0.9, size: 2 + Math.random() * 4.5, rot: Math.random() * 360,
    }))
  );
  if (!active || !topping) return null;
  const t = TOPPINGS.find((tp) => tp.id === topping);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: t?.shape === "flake" ? p.size * 0.35 : p.size,
          borderRadius: t?.shape === "round" ? "50%" : t?.shape === "flake" ? "1px" : "2px",
          background: t?.color, transform: `rotate(${p.rot}deg)`,
          animation: `sprinkleFall 1s ease-in ${p.delay}s forwards`, opacity: 0,
        }} />
      ))}
      <style>{`@keyframes sprinkleFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0.85;transform:translateY(290px) rotate(800deg)}}`}</style>
    </div>
  );
}

function DrizzleAnimation({ syrup, active }) {
  if (!active || !syrup) return null;
  const s = SYRUPS.find((sp) => sp.id === syrup);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
      {[33, 42, 50, 58, 67, 45, 55].map((x, i) => (
        <div key={i} style={{
          position: "absolute", left: `${x}%`, top: "8%",
          width: 2.5 + Math.random() * 2, height: 0,
          background: `linear-gradient(to bottom, transparent, ${s?.color}ee)`,
          borderRadius: "0 0 3px 3px",
          animation: `drizzlePour 1s ease-in ${i * 0.12}s forwards`, opacity: 0.9,
        }} />
      ))}
      <style>{`@keyframes drizzlePour{0%{height:0;opacity:0}15%{opacity:0.9}100%{height:210px;opacity:0.75}}`}</style>
    </div>
  );
}

// ═══════════════
//  DAW TIMELINE
// ═══════════════
function DAWTimeline({ activeLayers, currentSteps, stepPatterns, dropping }) {
  const layers = [
    { id: "kick", label: "KICK", color: C.gold },
    { id: "perc", label: "PERC", color: "#e87040" },
    { id: "melody", label: "CHRD", color: "#6a8fd8" },
    { id: "drop", label: "BASS", color: "#d94060" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "linear-gradient(to top, #060608fa, #060608dd)",
      backdropFilter: "blur(24px)", borderTop: `1px solid ${C.goldDim}1a`,
      padding: "8px 16px 12px", zIndex: 100,
    }}>
      <div style={{
        textAlign: "center", fontSize: 8, fontFamily: "'SF Mono','Fira Code',monospace",
        color: C.goldDim, letterSpacing: "0.25em", marginBottom: 5, opacity: 0.7,
      }}>
        DEEP HOUSE — 122 BPM
      </div>
      <div style={{ maxWidth: 650, margin: "0 auto" }}>
        {layers.map((layer) => {
          const isActive = activeLayers.includes(layer.id);
          const pat = stepPatterns[layer.id] || [];
          const cur = currentSteps[layer.id] ?? -1;
          return (
            <div key={layer.id} style={{
              display: "flex", alignItems: "center", marginBottom: 2,
              opacity: dropping ? 0.15 : isActive ? 1 : 0.1,
              transition: "opacity 0.3s ease",
            }}>
              <div style={{
                width: 36, fontSize: 7, fontFamily: "'SF Mono','Fira Code',monospace",
                color: isActive ? layer.color : C.muted,
                letterSpacing: "0.08em", fontWeight: 700, textAlign: "right", paddingRight: 6,
              }}>
                {layer.label}
              </div>
              <div style={{ display: "flex", gap: 1.5, flex: 1 }}>
                {Array.from({ length: 16 }).map((_, i) => {
                  const has = pat[i];
                  const isCur = cur === i && isActive;
                  return (
                    <div key={i} style={{
                      flex: 1, height: 9, borderRadius: 1.5,
                      background: isCur && has ? layer.color
                        : isCur ? `${layer.color}15`
                        : has ? `${layer.color}35`
                        : `${C.surfaceLight}55`,
                      boxShadow: isCur && has ? `0 0 8px ${layer.color}77` : "none",
                      transition: "background 0.03s, box-shadow 0.03s",
                      borderLeft: i % 4 === 0 ? `1px solid ${C.muted}1a` : "none",
                    }} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════
//  BUTTONS
// ═══════════════
function OptionButton({ label, color, selected, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "10px 18px", borderRadius: 28,
        border: selected ? `2px solid ${C.gold}` : `1px solid ${hov ? C.gold + "66" : C.muted + "33"}`,
        background: selected ? `linear-gradient(135deg, ${color}cc, ${color}88)` : `${C.surface}dd`,
        color: selected ? C.white : C.cream,
        fontSize: 12.5, fontFamily: "'Cormorant Garamond',Georgia,serif",
        fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer",
        transition: "all 0.25s ease", backdropFilter: "blur(10px)",
        boxShadow: selected ? `0 4px 20px ${color}44` : hov ? `0 2px 12px rgba(0,0,0,0.3)` : "0 2px 8px rgba(0,0,0,0.2)",
        textTransform: "uppercase", transform: hov && !selected ? "translateY(-1px)" : "none",
      }}>
      <span style={{
        display: "inline-block", width: 9, height: 9, borderRadius: "50%",
        background: color, marginRight: 7, verticalAlign: "middle",
        boxShadow: `0 0 6px ${color}55`,
      }} />
      {label}
    </button>
  );
}

function CTAButton({ label, onClick, disabled, pulse }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "13px 44px", borderRadius: 36,
      border: `1px solid ${disabled ? C.muted + "33" : C.gold}`,
      background: disabled ? `${C.surface}88` : `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
      color: disabled ? C.muted : C.bg,
      fontSize: 13, fontFamily: "'Cormorant Garamond',Georgia,serif",
      fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
      cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s ease",
      opacity: disabled ? 0.35 : 1,
      boxShadow: disabled ? "none" : `0 4px 24px ${C.gold}44`,
      animation: pulse ? "ctaPulse 2s ease infinite" : "none",
    }}>
      {label}
      {pulse && <style>{`@keyframes ctaPulse{0%,100%{box-shadow:0 4px 24px ${C.gold}44}50%{box-shadow:0 4px 36px ${C.gold}88}}`}</style>}
    </button>
  );
}

// ═══════════════
//  MAIN APP
// ═══════════════
export default function MagnumBeatBuilder() {
  const [slide, setSlide] = useState(0);
  const [coating, setCoating] = useState(null);
  const [topping, setTopping] = useState(null);
  const [syrup, setSyrup] = useState(null);
  const [bitten, setBitten] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showSprinkles, setShowSprinkles] = useState(false);
  const [showDrizzle, setShowDrizzle] = useState(false);
  const [activeLayers, setActiveLayers] = useState([]);
  const [currentSteps, setCurrentSteps] = useState({});
  const [stepPatterns, setStepPatterns] = useState({});
  const [transitioning, setTransitioning] = useState(false);
  const [dropping, setDropping] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new AudioEngine();
    audioRef.current.onStep((layer, step) => {
      setCurrentSteps((prev) => ({ ...prev, [layer]: step }));
    });
    return () => audioRef.current?.dispose();
  }, []);

  const goToSlide = useCallback((next) => {
    setTransitioning(true);
    setTimeout(() => { setSlide(next); setTransitioning(false); }, 450);
  }, []);

  const handleDip = async (flavor) => {
    if (animating) return;
    setCoating(flavor.id); setAnimating(true);
    await audioRef.current.init();
    audioRef.current.startKick();
    setActiveLayers((p) => [...new Set([...p, "kick"])]);
    setStepPatterns((p) => ({ ...p, kick: audioRef.current.activeSteps.kick }));
    setTimeout(() => setAnimating(false), 900);
  };

  const handleSprinkle = (t) => {
    if (animating) return;
    setTopping(t.id); setShowSprinkles(true); setAnimating(true);
    audioRef.current.startPerc();
    setActiveLayers((p) => [...new Set([...p, "perc"])]);
    setStepPatterns((p) => ({ ...p, perc: audioRef.current.activeSteps.perc }));
    setTimeout(() => setAnimating(false), 1100);
  };

  const handleDrizzle = (s) => {
    if (animating) return;
    setSyrup(s.id); setShowDrizzle(true); setAnimating(true);
    audioRef.current.startMelody();
    setActiveLayers((p) => [...new Set([...p, "melody"])]);
    setStepPatterns((p) => ({ ...p, melody: audioRef.current.activeSteps.melody }));
    setTimeout(() => setAnimating(false), 1200);
  };

  const handleBite = async () => {
    if (animating) return;
    setAnimating(true);
    setDropping(true);
    await audioRef.current.triggerBreakDrop();
    setBitten(true);
    setDropping(false);
    setActiveLayers((p) => [...new Set([...p, "drop"])]);
    setStepPatterns((p) => ({ ...p, drop: audioRef.current.activeSteps.drop }));
    setTimeout(() => setAnimating(false), 600);
  };

  const titleStyle = {
    fontFamily: "'Playfair Display','Cormorant Garamond',Georgia,serif",
    fontSize: "clamp(22px,3.5vw,36px)", fontWeight: 300,
    color: C.cream, letterSpacing: "0.1em", marginBottom: 4,
  };
  const stepLbl = {
    fontSize: 10, letterSpacing: "0.35em", color: C.goldDim,
    marginBottom: 6, fontFamily: "'Cormorant Garamond',Georgia,serif",
    textTransform: "uppercase",
  };
  const subText = {
    fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 13,
    color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 28,
  };
  const optRow = { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 36, padding: "0 12px" };

  const slides = [
    // Intro
    <div key="intro" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.5em", color: C.goldDim, textTransform: "uppercase", marginBottom: 18, fontFamily: "'Cormorant Garamond',Georgia,serif", opacity: 0.8 }}>Experience</div>
      <h1 style={{
        fontFamily: "'Playfair Display','Cormorant Garamond',Georgia,serif",
        fontSize: "clamp(34px,7vw,64px)", fontWeight: 300, color: C.cream,
        letterSpacing: "0.14em", marginBottom: 10,
        textShadow: `0 0 80px ${C.gold}15`,
      }}>MAGNUM</h1>
      <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}88, transparent)`, margin: "0 auto 18px" }} />
      <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(12px,1.8vw,16px)", color: C.goldDim, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 44, opacity: 0.8 }}>
        Build Your Bar &middot; Build Your Beat
      </p>
      <IceCreamBar coating={null} topping={null} syrup={null} bitten={false} />
      <div style={{ marginTop: 44 }}><CTAButton label="Begin" onClick={() => goToSlide(1)} pulse /></div>
    </div>,

    // Slide 1
    <div key="dip" style={{ textAlign: "center" }}>
      <div style={stepLbl}>Step 01</div>
      <h2 style={titleStyle}>The Dip</h2>
      <p style={subText}>Choose your chocolate coating</p>
      <div style={{ position: "relative" }}>
        <div style={{ transform: animating && coating ? "translateY(25px)" : "translateY(0)", transition: "transform 0.5s ease" }}>
          <IceCreamBar coating={coating} topping={null} syrup={null} bitten={false} />
        </div>
      </div>
      <div style={optRow}>{FLAVORS.map((f) => <OptionButton key={f.id} label={f.name} color={f.color} selected={coating === f.id} onClick={() => handleDip(f)} />)}</div>
      <div style={{ marginTop: 28 }}><CTAButton label="Next →" onClick={() => goToSlide(2)} disabled={!coating} /></div>
    </div>,

    // Slide 2
    <div key="crunch" style={{ textAlign: "center" }}>
      <div style={stepLbl}>Step 02</div>
      <h2 style={titleStyle}>The Crunch</h2>
      <p style={subText}>Add your toppings</p>
      <div style={{ position: "relative" }}>
        <SprinkleParticles topping={topping} active={showSprinkles} />
        <IceCreamBar coating={coating} topping={topping} syrup={null} bitten={false} />
      </div>
      <div style={optRow}>{TOPPINGS.map((t) => <OptionButton key={t.id} label={t.name} color={t.color} selected={topping === t.id} onClick={() => handleSprinkle(t)} />)}</div>
      <div style={{ marginTop: 28 }}><CTAButton label="Next →" onClick={() => goToSlide(3)} disabled={!topping} /></div>
    </div>,

    // Slide 3
    <div key="drizzle" style={{ textAlign: "center" }}>
      <div style={stepLbl}>Step 03</div>
      <h2 style={titleStyle}>The Drizzle</h2>
      <p style={subText}>Select your syrup</p>
      <div style={{ position: "relative" }}>
        <DrizzleAnimation syrup={syrup} active={showDrizzle} />
        <IceCreamBar coating={coating} topping={topping} syrup={syrup} bitten={false} />
      </div>
      <div style={optRow}>{SYRUPS.map((s) => <OptionButton key={s.id} label={s.name} color={s.color} selected={syrup === s.id} onClick={() => handleDrizzle(s)} />)}</div>
      <div style={{ marginTop: 28 }}><CTAButton label="Next →" onClick={() => goToSlide(4)} disabled={!syrup} /></div>
    </div>,

    // Slide 4: The Bite
    <div key="bite" style={{ textAlign: "center" }}>
      <div style={stepLbl}>Step 04</div>
      <h2 style={titleStyle}>The Bite</h2>
      <p style={subText}>{bitten ? "Your Magnum is complete" : dropping ? "\u00A0" : "Take a bite to drop the beat"}</p>
      <div style={{
        position: "relative",
        animation: bitten ? "screenShake 0.35s cubic-bezier(0.2,0,0,1)" : "none",
      }}>
        <IceCreamBar coating={coating} topping={topping} syrup={syrup} bitten={bitten} floating={!dropping && !bitten} />
        {bitten && (
          <div style={{
            position: "absolute", inset: -40,
            background: `radial-gradient(circle, ${C.gold}22, transparent 70%)`,
            animation: "flashIn 0.6s ease forwards", pointerEvents: "none",
          }} />
        )}
      </div>
      {!bitten && !dropping ? (
        <div style={{ marginTop: 44 }}><CTAButton label="Take a Bite" onClick={handleBite} pulse /></div>
      ) : dropping ? (
        <div style={{ marginTop: 44 }}>
          <div style={{ width: 30, height: 2, background: C.gold, margin: "0 auto", borderRadius: 1, animation: "riserBar 0.5s ease forwards" }} />
        </div>
      ) : (
        <div style={{ marginTop: 36 }}>
          <div style={{
            display: "inline-block", padding: "10px 26px", borderRadius: 28,
            border: `1px solid ${C.gold}33`, background: `${C.surface}dd`,
            backdropFilter: "blur(10px)", animation: "fadeUp 0.7s ease 0.3s both",
          }}>
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: C.gold, fontFamily: "'Cormorant Garamond',Georgia,serif", textTransform: "uppercase" }}>
              Now Playing — Your Magnum Beat
            </span>
          </div>
          <p style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 11,
            color: C.muted, letterSpacing: "0.18em", textTransform: "uppercase",
            marginTop: 12, animation: "fadeUp 0.7s ease 0.6s both",
          }}>Made with Magnum</p>
        </div>
      )}
      <style>{`
        @keyframes screenShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px) rotate(-0.7deg)}30%{transform:translateX(8px) rotate(0.7deg)}50%{transform:translateX(-5px)}70%{transform:translateX(5px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes flashIn{0%{opacity:1}100%{opacity:0}}
        @keyframes riserBar{0%{width:30px;opacity:0.5}100%{width:120px;opacity:0}}
      `}</style>
    </div>,
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 15%, #14110e 0%, ${C.bg} 65%)`,
      color: C.white, fontFamily: "'Cormorant Garamond',Georgia,serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "50px 20px 120px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${C.gold}05 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* Progress */}
      <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 7, zIndex: 50 }}>
        {[0,1,2,3,4].map((i) => (
          <div key={i} style={{
            width: slide === i ? 26 : 5, height: 5, borderRadius: 3,
            background: slide >= i ? `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` : `${C.muted}28`,
            transition: "all 0.5s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: slide === i ? `0 0 10px ${C.gold}44` : "none",
          }} />
        ))}
      </div>

      <div style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? "translateY(20px) scale(0.97)" : "translateY(0) scale(1)",
        transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 10, width: "100%", maxWidth: 580,
      }}>
        {slides[slide]}
      </div>

      <DAWTimeline activeLayers={activeLayers} currentSteps={currentSteps} stepPatterns={stepPatterns} dropping={dropping} />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500&family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
