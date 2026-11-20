// simulador/simulador.js
// Hace el papel del microcontrolador: publica telemetría por MQTT.
//   Datos nuevos:        npm run simular -- --falla fuga --run demo-1
//   Reproducir un CSV:   npm run simular -- --csv datos/prueba/fuga-221.csv   (plan B: se marca como REPRODUCCIÓN)
// Opciones: --falla (sobrecalentamiento|fuga|obstruccion) --inicio 90 --n 240 --hz 1 --seed 7 --run ID --device bomba-01
import { readFileSync } from 'node:fs';
import mqtt from 'mqtt';
import { generarCorrida, UNIDADES } from '../backend/senales.js';

const arg = (nombre, defecto) => { const i = process.argv.indexOf('--' + nombre); return i > 0 ? process.argv[i + 1] : defecto; };
const device = arg('device', 'bomba-01');
const runId = arg('run', 'run-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
const hz = Number(arg('hz', 1));
const csv = arg('csv', null);
const VARS = Object.keys(UNIDADES);

// Filas a publicar: de un CSV grabado o generadas con semilla.
let filas;
if (csv) {
  const [, ...lineas] = readFileSync(csv, 'utf8').trim().split('\n');
  filas = lineas.map((l) => { const c = l.split(','); return Object.fromEntries(VARS.map((v, i) => [v, Number(c[i + 1])])); });
} else {
  filas = generarCorrida({ seed: Number(arg('seed', 7)), n: Number(arg('n', 240)), falla: arg('falla', null), inicio: Number(arg('inicio', 90)) });
}

const temaEstado = `motor/${device}/estado`;
const cliente = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
  username: process.env.MQTT_USER_DISP,
  password: process.env.MQTT_PASS_DISP,
  // Last Will: si el simulador se cae sin despedirse, el broker avisa que quedó "offline".
  will: { topic: temaEstado, payload: JSON.stringify({ estado: 'offline' }), qos: 1, retain: true },
});

cliente.on('error', (e) => console.error('MQTT error:', e.message));
cliente.on('connect', async () => {
  cliente.publish(temaEstado, JSON.stringify({ estado: 'online' }), { qos: 1, retain: true });
  console.log(`Publicando ${filas.length} lecturas a ${hz} Hz | dispositivo=${device} corrida=${runId}${csv ? ' | REPRODUCCIÓN de ' + csv : ''}`);
  for (const f of filas) {
    const msg = {
      deviceId: device, runId, ts: new Date().toISOString(),
      lecturas: Object.fromEntries(VARS.map((v) => [v, f[v]])), unidades: UNIDADES,
      ...(csv ? { reproduccion: true } : {}), // identifica los datos grabados como reproducción
    };
    cliente.publish(`motor/${device}/telemetria`, JSON.stringify(msg), { qos: 1 });
    await new Promise((r) => setTimeout(r, 1000 / hz));
  }
  cliente.publish(temaEstado, JSON.stringify({ estado: 'offline' }), { qos: 1, retain: true }, () => cliente.end());
});
