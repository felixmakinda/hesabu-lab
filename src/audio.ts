// All sounds are synthesised with Web Audio: no files to download or license.

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers only allow sound after a user gesture; call this from one. */
export const unlockAudio = () => void audio();

// Major scale, so filling the tube climbs up a tune: marble 10 lands on the octave.
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const c = audio();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, filterFreq: number, gain: number, sweepTo?: number) {
  const c = audio();
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, start);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(start);
}

/** Glassy "tink" whose pitch climbs with how full the ones tube is (1–10). */
export function tink(count: number) {
  const c = audio();
  const step = SCALE[Math.min(Math.max(count, 1), 10) - 1];
  const f = 523.25 * Math.pow(2, step / 12);
  tone(f, c.currentTime, 0.35, "sine", 0.25);
  tone(f * 2, c.currentTime, 0.15, "triangle", 0.06);
}

/** Heavy lid slam when ten marbles seal into a crate. */
export function clunk() {
  const c = audio();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.3);
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.45);
  noise(t, 0.12, 900, 0.5);
}

/** Air whoosh as the crate flies to the tens shelf. */
export function whoosh() {
  noise(audio().currentTime, 0.5, 400, 0.25, 2500);
}

/** Crate landing thud on the shelf. */
export function thud() {
  const t = audio().currentTime;
  tone(90, t, 0.18, "sine", 0.4);
  noise(t, 0.06, 600, 0.2);
}

/** Victory arpeggio. */
export function fanfare() {
  const t = audio().currentTime;
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
    tone(392 * Math.pow(2, s / 12), t + i * 0.08, 0.5, "triangle", 0.18),
  );
}

/** Soft "try again" bloop. Never harsh. */
export function bloop() {
  const t = audio().currentTime;
  tone(330, t, 0.2, "sine", 0.2);
  tone(262, t + 0.12, 0.3, "sine", 0.2);
}

/** Falling "tink" when a marble is taken away. */
export function untink(remaining: number) {
  const c = audio();
  const t = c.currentTime;
  const step = SCALE[Math.min(Math.max(remaining, 1), 10) - 1];
  const f = 523.25 * Math.pow(2, step / 12);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f * 1.5, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.75, t + 0.25);
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.35);
}

/** Crate bursting open into ten marbles. */
export function pop() {
  const t = audio().currentTime;
  noise(t, 0.25, 1800, 0.45, 300);
  tone(220, t, 0.25, "square", 0.08);
  tone(660, t + 0.05, 0.3, "triangle", 0.12);
}

/** Little engine for trucks driving in. */
export function vroom() {
  const c = audio();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.linearRampToValueAtTime(110, t + 0.5);
  osc.frequency.linearRampToValueAtTime(70, t + 0.8);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  osc.connect(filter).connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.95);
}
