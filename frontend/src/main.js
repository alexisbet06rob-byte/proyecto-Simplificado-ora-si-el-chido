// frontend/src/main.js
// Pinta en tiempo real lo que el backend manda por SSE: variables, detectores, alertas y estado.
import './style.css';
import './historial.js';

const VARS = { temperatura_C: ['Temperatura', '°C'], humedad_pct: ['Humedad', '%HR'], caudal_Lmin: ['Caudal', 'L/min'] };
const DETECTORES = { umbral: 'Umbrales fijos (referencia)', mad: 'MAD en ventana', ewma: 'EWMA' };
const $ = (id) => document.getElementById(id);
const serie = Object.fromEntries(Object.keys(VARS).map((v) => [v, []])); // últimos valores para la mini gráfica
let ultimoDato = 0;

// Tarjetas de variables y de detectores (se crean una vez).
$('variables').innerHTML = Object.entries(VARS).map(([v, [nombre, u]]) => `
  <div class="rounded-lg bg-slate-800 p-3">
    <div class="text-slate-400 text-sm">${nombre}</div>
    <div class="text-3xl font-bold"><span id="val-${v}">–</span> <span class="text-base text-slate-400">${u}</span></div>
    <svg viewBox="0 0 200 40" class="w-full h-10"><polyline id="spark-${v}" fill="none" stroke="#38bdf8" stroke-width="2" points=""/></svg>
  </div>`).join('');
$('detectores').innerHTML = Object.entries(DETECTORES).map(([d, nombre]) => `
  <div id="det-${d}" class="rounded-lg bg-slate-800 p-3">
    <div class="text-slate-400 text-sm">${nombre}</div>
    <div id="det-${d}-txt" class="text-lg font-bold">–</div>
  </div>`).join('');

// Mini gráfica: convierte los últimos valores en puntos de una línea.
function puntos(vals) {
  if (vals.length < 2) return '';
  const min = Math.min(...vals), rango = Math.max(...vals) - min || 1;
  return vals.map((y, i) => `${(i / (vals.length - 1)) * 200},${38 - ((y - min) / rango) * 36}`).join(' ');
}

// Cada medición nueva actualiza toda la pantalla.
function pintar(m) {
  ultimoDato = Date.now();
  $('modo').textContent = m.reproduccion ? 'REPRODUCCIÓN · datos grabados' : 'EN VIVO';
  $('modo').className = 'px-2 py-1 rounded font-bold ' + (m.reproduccion ? 'bg-amber-500 text-black' : 'bg-green-600');
  for (const v of Object.keys(VARS)) {
    $('val-' + v).textContent = m.lecturas[v].toFixed(1);
    serie[v].push(m.lecturas[v]);
    if (serie[v].length > 60) serie[v].shift();
    $('spark-' + v).setAttribute('points', puntos(serie[v]));
  }
  let hayAlerta = false;
  for (const d of Object.keys(DETECTORES)) {
    const r = m.resultados[d];
    hayAlerta ||= r.alerta;
    $('det-' + d + '-txt').textContent = r.alerta ? 'ALERTA: ' + r.vars.join(', ') : 'normal';
    $('det-' + d).className = 'rounded-lg p-3 ' + (r.alerta ? 'bg-red-700' : 'bg-slate-800');
  }
  $('estado').textContent = hayAlerta ? 'ALERTA · corrida ' + m.runId : 'NORMAL · corrida ' + m.runId;
  $('estado').className = 'rounded-lg p-4 text-center text-2xl font-bold ' + (hayAlerta ? 'bg-red-600' : 'bg-green-700');
}

// Alerta nueva: se agrega al principio de la lista (textContent evita inyectar HTML).
function agregarAlerta(a) {
  const ul = $('alertas');
  if (ul.children.length === 1 && ul.firstChild.classList.contains('text-slate-400')) ul.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'rounded bg-red-900/60 px-2 py-1';
  li.textContent = `${new Date(a.ts).toLocaleTimeString()} · ${a.algoritmo} · ${a.variables.join(', ')}${a.reproduccion ? ' (reproducción)' : ''}`;
  ul.prepend(li);
  while (ul.children.length > 8) ul.lastChild.remove();
}

// Conexión SSE: si se corta, el navegador reconecta solo.
const fuente = new EventSource('/api/stream');
fuente.onopen = () => { $('conexion').textContent = 'servidor conectado'; $('conexion').className = 'px-2 py-1 rounded bg-green-600'; };
fuente.onerror = () => { $('conexion').textContent = 'reconectando…'; $('conexion').className = 'px-2 py-1 rounded bg-red-600'; };
fuente.addEventListener('medicion', (e) => pintar(JSON.parse(e.data)));
fuente.addEventListener('anomalia', (e) => agregarAlerta(JSON.parse(e.data)));
fuente.addEventListener('estado', (e) => { const d = JSON.parse(e.data); $('conexion').textContent = `${d.deviceId}: ${d.estado}`; });

// Si dejan de llegar datos (sensor o broker caído), se avisa en pantalla.
setInterval(() => {
  if (ultimoDato && Date.now() - ultimoDato > 5000) {
    $('estado').textContent = 'SIN DATOS RECIENTES';
    $('estado').className = 'rounded-lg p-4 text-center text-2xl font-bold bg-amber-600 text-black';
  }
}, 1000);
