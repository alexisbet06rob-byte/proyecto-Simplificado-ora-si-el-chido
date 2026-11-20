// backend/modelos.js
// Qué se guarda en MongoDB. Dos colecciones: mediciones y anomalías.
import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const Libre = Schema.Types.Mixed; // objeto con forma libre (lecturas, resultados, parámetros)

// Una medición por mensaje MQTT: fecha y hora, dispositivo, corrida, variables,
// configuración usada (parámetros de los detectores) y resultado de cada algoritmo.
const Medicion = model('Medicion', new Schema({
  ts: { type: Date, index: true },
  deviceId: String,
  runId: String,
  lecturas: Libre,
  unidades: Libre,
  reproduccion: { type: Boolean, default: false }, // true = dato grabado, NO en vivo
  config: Libre,
  resultados: Libre,
}).index({ runId: 1, ts: 1 }));

// Un evento anómalo cada vez que un algoritmo pasa de "normal" a "alerta".
const Anomalia = model('Anomalia', new Schema({
  ts: { type: Date, index: true },
  deviceId: String,
  runId: String,
  algoritmo: String,   // umbral | mad | ewma
  variables: [String], // qué variables dispararon la alerta
  lecturas: Libre,
  parametros: Libre,   // configuración con la que se detectó
  reproduccion: { type: Boolean, default: false },
}));

export { Medicion, Anomalia };
