const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "assets", "sounds");
fs.mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;

function writeWav(fileName, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(value * 32767, 44 + index * 2);
  });

  fs.writeFileSync(path.join(outDir, fileName), buffer);
}

// Tono sinusoidal puro con envelope suave (attack/release lineal)
function tone(freq, duration, volume = 0.25, attack = 0.02, release = 0.05) {
  const total = Math.floor(sampleRate * duration);
  const samples = [];
  const attackSamples = Math.floor(sampleRate * attack);
  const releaseSamples = Math.floor(sampleRate * release);

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attackSamples) env = i / attackSamples;
    else if (i > total - releaseSamples)
      env = Math.max(0, (total - i) / releaseSamples);
    samples.push(Math.sin(2 * Math.PI * freq * t) * volume * env);
  }
  return samples;
}

// Suma de dos tonos (acordes simples para sonido "limpio")
function chord(freqs, duration, volume = 0.22) {
  const total = Math.floor(sampleRate * duration);
  const samples = new Array(total).fill(0);
  const releaseSamples = Math.floor(sampleRate * 0.08);
  const attackSamples = Math.floor(sampleRate * 0.015);

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attackSamples) env = i / attackSamples;
    else if (i > total - releaseSamples)
      env = Math.max(0, (total - i) / releaseSamples);

    let sum = 0;
    freqs.forEach((f) => {
      sum += Math.sin(2 * Math.PI * f * t);
    });
    samples[i] = (sum / freqs.length) * volume * env;
  }
  return samples;
}

function silence(duration) {
  return Array(Math.floor(sampleRate * duration)).fill(0);
}

function concat(...parts) {
  return parts.flat();
}

/* =============== SONIDOS MINIMALISTAS =================
   Caracter: suaves, breves, baja saturación.
   ===================================================== */

// Respuesta correcta: dos notas ascendentes suaves (mi → sol)
writeWav(
  "correct.wav",
  concat(
    tone(659.25, 0.09, 0.35, 0.005, 0.04),
    tone(880.0, 0.14, 0.35, 0.005, 0.08)
  )
);

// Respuesta incorrecta: tono grave breve, sin agresividad
writeWav(
  "wrong.wav",
  tone(196.0, 0.22, 0.4, 0.01, 0.1)
);

// Sin respuesta / timeout: dos tonos descendentes muy suaves
writeWav(
  "timeout.wav",
  concat(
    tone(392.0, 0.14, 0.32, 0.01, 0.05),
    silence(0.03),
    tone(261.63, 0.22, 0.32, 0.01, 0.1)
  )
);

// Tick (últimos segundos): click muy corto y discreto
writeWav(
  "tick.wav",
  tone(1200, 0.025, 0.28, 0.001, 0.015)
);

// Final de partida: acorde tranquilo de Do mayor (Do-Mi-Sol) sostenido
writeWav(
  "finish.wav",
  concat(
    chord([523.25, 659.25, 783.99], 0.7, 0.28),
    silence(0.05)
  )
);

// Música de fondo: secuencia ambiental lenta en Do mayor (loop)
// Tonos largos, baja amplitud, sin percusión.
const bgVol = 0.14;
writeWav(
  "background.wav",
  concat(
    chord([261.63, 329.63], 0.9, bgVol),   // Do + Mi
    chord([293.66, 369.99], 0.9, bgVol),   // Re + Fa#
    chord([329.63, 392.0], 0.9, bgVol),    // Mi + Sol
    chord([261.63, 349.23], 0.9, bgVol),   // Do + Fa
    chord([293.66, 392.0], 0.9, bgVol),    // Re + Sol
    chord([329.63, 440.0], 0.9, bgVol),    // Mi + La
    chord([293.66, 369.99], 0.9, bgVol),   // Re + Fa#
    chord([261.63, 329.63], 1.2, bgVol)    // Do + Mi (resolución)
  )
);

console.log("Sonidos minimalistas generados en assets/sounds");
