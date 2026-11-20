// backend/analisis.js
// Lógica pura (sin MQTT ni MongoDB): validar un mensaje y analizarlo con los detectores.
// Está separada del servidor para poder probarla sola y explicarla fácil.
import { readFileSync } from 'node:fs';
import { crearDetectores } from './detectores/index.js';
import { UNIDADES } from './senales.js';

// Parámetros de los detectores (los genera scripts/evaluar.js).
export const PARAMS = JSON.parse(readFileSync(new URL('./params.json', import.meta.url), 'utf8'));

// VALIDACIÓN BÁSICA: ¿el mensaje es JSON y trae lo mínimo?
// Devuelve { ok:true, msg } o { ok:false, error } (los inválidos se descartan, el sistema no se cae).
export function validar(texto) {
  let msg;
  try { msg = JSON.parse(texto); } catch { return { ok: false, error: 'JSON inválido' }; }
  if (typeof msg.deviceId !== 'string' || !msg.deviceId) return { ok: false, error: 'falta deviceId' };
  if (typeof msg.runId !== 'string' || !msg.runId) return { ok: false, error: 'falta runId' };
  if (Number.isNaN(Date.parse(msg.ts))) return { ok: false, error: 'ts inválido' };
  if (typeof msg.lecturas !== 'object' || msg.lecturas === null) return { ok: false, error: 'faltan lecturas' };
  for (const v of Object.keys(UNIDADES)) {
    if (typeof msg.lecturas[v] !== 'number' || !Number.isFinite(msg.lecturas[v])) return { ok: false, error: `lectura inválida: ${v}` };
  }
  return { ok: true, msg };
}

// El analizador guarda un juego de detectores por dispositivo.
// Si cambia el runId (nueva corrida) se reinician, para que una corrida no contamine a la siguiente.
export class Analizador {
  constructor() { this.estados = new Map(); }

  procesar(msg) {
    let e = this.estados.get(msg.deviceId);
    if (!e || e.runId !== msg.runId) {
      e = { runId: msg.runId, detectores: crearDetectores(PARAMS), previo: {} };
      this.estados.set(msg.deviceId, e);
    }
    const lectura = Object.fromEntries(Object.keys(UNIDADES).map((v) => [v, msg.lecturas[v]]));
    const resultados = {};
    const nuevas = []; // anomalías NUEVAS (la alerta pasó de apagada a encendida)
    for (const [nombre, d] of Object.entries(e.detectores)) {
      const r = d.paso(lectura);
      resultados[nombre] = r;
      if (r.alerta && !e.previo[nombre]) nuevas.push({ algoritmo: nombre, variables: r.vars });
      e.previo[nombre] = r.alerta;
    }
    return { resultados, nuevas };
  }
}
