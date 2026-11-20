// backend/server.js
// El "cerebro": recibe MQTT -> valida -> detecta -> guarda en MongoDB -> avisa al navegador (SSE).
// También ofrece una API REST para consultar el historial.
import express from 'express';
import mqtt from 'mqtt';
import mongoose from 'mongoose';
import { validar, Analizador, PARAMS } from './analisis.js';
import { Medicion, Anomalia } from './modelos.js';

// Configuración desde variables de entorno (archivo .env, que NO se sube a Git).
const { PORT = 3000, MQTT_URL = 'mqtt://localhost:1883', MQTT_USER_BACKEND, MQTT_PASS_BACKEND,
  MONGO_URL = 'mongodb://localhost:27017/bomba' } = process.env;

const analizador = new Analizador();
const estado = { mqtt: false, invalidos: 0, dispositivos: {}, ultimo: null };

// ---------- SSE: el navegador abre una conexión y el servidor le "empuja" eventos ----------
const clientes = new Set();
function difundir(evento, datos) {
  const texto = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of clientes) res.write(texto);
}

// ---------- MQTT: suscripción, validación y manejo de desconexiones ----------
const broker = mqtt.connect(MQTT_URL, {
  username: MQTT_USER_BACKEND,
  password: MQTT_PASS_BACKEND,
  reconnectPeriod: 2000, // si se cae el broker, reintenta cada 2 s
});
broker.on('connect', () => { // se ejecuta también después de cada reconexión
  estado.mqtt = true;
  console.log('MQTT conectado');
  broker.subscribe(['motor/+/telemetria', 'motor/+/estado'], { qos: 1 });
  difundir('broker', { conectado: true });
});
broker.on('close', () => { estado.mqtt = false; difundir('broker', { conectado: false }); console.warn('MQTT desconectado, reintentando...'); });
broker.on('error', (e) => console.error('MQTT error:', e.message));

broker.on('message', async (topic, payload) => {
  const [, id, tipo] = topic.split('/'); // motor/{id}/{tipo}
  if (tipo === 'estado') { // online/offline del dispositivo (incluye el Last Will)
    let e = 'desconocido';
    try { e = JSON.parse(payload.toString()).estado; } catch { /* se queda desconocido */ }
    estado.dispositivos[id] = e;
    difundir('estado', { deviceId: id, estado: e });
    return;
  }
  const v = validar(payload.toString());
  if (!v.ok || v.msg.deviceId !== id) { // dato inválido: se descarta y se cuenta
    estado.invalidos++;
    console.warn('Mensaje descartado:', v.ok ? 'deviceId distinto al del tema' : v.error);
    return;
  }
  const msg = v.msg;
  const { resultados, nuevas } = analizador.procesar(msg);
  const doc = {
    ts: new Date(msg.ts), deviceId: msg.deviceId, runId: msg.runId, lecturas: msg.lecturas,
    unidades: msg.unidades, reproduccion: msg.reproduccion === true, config: PARAMS, resultados,
  };
  estado.ultimo = doc;
  difundir('medicion', doc); // tiempo real
  try { // persistencia
    await Medicion.create(doc);
    for (const n of nuevas) {
      const a = { ts: doc.ts, deviceId: doc.deviceId, runId: doc.runId, lecturas: doc.lecturas, parametros: PARAMS, reproduccion: doc.reproduccion, ...n };
      await Anomalia.create(a);
      difundir('anomalia', a);
    }
  } catch (e) { console.error('No se pudo guardar en MongoDB:', e.message); }
});

// ---------- API REST ----------
const app = express();
const filtro = (req) => (req.query.runId ? { runId: String(req.query.runId) } : {});
const limite = (req) => Math.min(Number(req.query.limite) || 100, 1000);

app.get('/api/salud', (req, res) => res.json({ ok: true, mqtt: estado.mqtt, mongo: mongoose.connection.readyState === 1 }));
app.get('/api/estado', (req, res) => res.json({ ...estado, params: PARAMS }));
app.get('/api/mediciones', async (req, res) => res.json(await Medicion.find(filtro(req)).sort({ ts: -1 }).limit(limite(req)).lean()));
app.get('/api/anomalias', async (req, res) => res.json(await Anomalia.find(filtro(req)).sort({ ts: -1 }).limit(limite(req)).lean()));
app.get('/api/corridas', async (req, res) => res.json(await Medicion.aggregate([
  { $group: { _id: '$runId', n: { $sum: 1 }, inicio: { $min: '$ts' }, fin: { $max: '$ts' }, reproduccion: { $max: '$reproduccion' } } },
  { $sort: { inicio: -1 } }, { $limit: 50 },
])));
app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 2000\n\n'); // el navegador reconecta solo
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
});

await mongoose.connect(MONGO_URL);
console.log('MongoDB conectado');
app.listen(PORT, () => console.log(`API en http://localhost:${PORT}`));
