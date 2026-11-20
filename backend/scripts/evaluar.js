// backend/scripts/evaluar.js
// Experimento completo en un solo script: ajustar con unos datos y evaluar con OTROS.
//   1) ENTRENAMIENTO: corridas normales -> aprende qué es "normal" (baseline) para EWMA.
//   2) VALIDACIÓN: elige los parámetros de MAD y EWMA (y por tanto el límite de alerta).
//   3) PRUEBA: datos nunca vistos -> métricas finales. Aquí NO se ajusta nada.
// Uso: npm run evaluar     (escribe backend/params.json, docs/resultados/ y datos/prueba/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { generarCorrida, FALLAS, UNIDADES } from '../senales.js';
import { crearDetectores } from '../detectores/index.js';
import { LIMITES } from '../detectores/umbral.js';

const RAIZ = new URL('../../', import.meta.url).pathname;
const N = 300, INICIO = 150, K = 3; // 300 s por corrida; la falla empieza en el s 150; K lecturas seguidas
const VARS = Object.keys(UNIDADES);

// ---------- 1. Conjuntos de datos (semillas distintas = datos distintos) ----------
const normal = (seeds) => seeds.map((seed) => ({ seed, falla: null, filas: generarCorrida({ seed, n: N }) }));
const conFalla = (seeds, por) => Object.keys(FALLAS).flatMap((falla) =>
  Array.from({ length: por }, (_, i) => { const seed = seeds + Object.keys(FALLAS).indexOf(falla) * 20 + i;
    return { seed, falla, filas: generarCorrida({ seed, n: N, falla, inicio: INICIO }) }; }));
const entrenamiento = normal([1, 2, 3, 4, 5]);
const validacion = [...normal(Array.from({ length: 20 }, (_, i) => 11 + i)), ...conFalla(51, 3)]; // 20 normales: pocas corridas normales dan una mala estimación de falsas alarmas
const prueba = [...normal([101, 102, 103, 104, 105]), ...conFalla(201, 5)];

// ---------- 2. Baseline de operación normal (media y desviación por variable) ----------
const baseline = {};
for (const v of VARS) {
  const x = entrenamiento.flatMap((r) => r.filas.map((f) => f[v]));
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  baseline[v] = { mu, sigma: Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / (x.length - 1)) };
}
// ---------- 3. Evaluar un método sobre un conjunto de corridas ----------
// Regla por corrida (a = segundo de la primera alerta):
//   normal  + alerta           -> falsa alarma (FP)     normal  sin alerta -> TN
//   con falla, alerta antes    -> falsa alarma (FP)     con falla, sin alerta -> FN
//   con falla, alerta despues  -> acierto (TP), latencia = a - INICIO
function evaluar(nombre, params, corridas) {
  const m = { TP: 0, FP: 0, FN: 0, TN: 0, latencias: [], porFalla: {} };
  for (const c of corridas) {
    const det = crearDetectores(params)[nombre];
    let a = null;
    for (const f of c.filas) {
      if (det.paso(Object.fromEntries(VARS.map((v) => [v, f[v]]))).alerta) { a = f.t; break; }
    }
    if (!c.falla) { a === null ? m.TN++ : m.FP++; continue; }
    const pf = (m.porFalla[c.falla] ??= { total: 0, detectadas: 0, latencias: [] });
    pf.total++;
    if (a === null) m.FN++;
    else if (a < INICIO) m.FP++;
    else { m.TP++; m.latencias.push(a - INICIO); pf.detectadas++; pf.latencias.push(a - INICIO); }
  }
  const prom = (x) => (x.length ? x.reduce((s, y) => s + y, 0) / x.length : null);
  m.precision = m.TP + m.FP ? m.TP / (m.TP + m.FP) : 0;
  m.recall = m.TP + m.FN ? m.TP / (m.TP + m.FN) : 0;
  m.f1 = m.precision + m.recall ? (2 * m.precision * m.recall) / (m.precision + m.recall) : 0;
  m.latenciaMedia = prom(m.latencias);
  for (const pf of Object.values(m.porFalla)) pf.latenciaMedia = prom(pf.latencias);
  return m;
}

// ---------- 4. Ajuste con VALIDACIÓN ----------
// Se prueban muchas combinaciones de parámetros (una "rejilla") sobre los datos de validación.
// Criterio para elegir la ganadora: 1) cero falsas alarmas, 2) mayor F1, 3) menor latencia.
const menor = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
function mejor(candidatos, nombre) {
  let ganador = null;
  for (const p of candidatos) {
    const params = { k: K, baseline, mad: p.mad ?? { ventana: 60, zLim: 4 }, ewma: p.ewma ?? { lambda: 0.2, L: 3 } };
    const m = evaluar(nombre, params, validacion);
    const clave = [m.FP === 0 ? 0 : 1, -m.f1, m.latenciaMedia ?? 1e9]; // más chico = mejor
    if (!ganador || menor(clave, ganador.clave)) ganador = { p, clave, m };
  }
  return ganador;
}
const rejillaMad = [30, 60, 120].flatMap((ventana) => [3, 3.5, 4, 5].map((zLim) => ({ mad: { ventana, zLim } })));
const rejillaEwma = [0.1, 0.2, 0.3].flatMap((lambda) => [2.5, 3, 3.5, 4, 4.5].map((L) => ({ ewma: { lambda, L } })));
const gMad = mejor(rejillaMad, 'mad'), gEwma = mejor(rejillaEwma, 'ewma');
const params = { k: K, umbral: LIMITES, mad: gMad.p.mad, ewma: gEwma.p.ewma, baseline };
writeFileSync(RAIZ + 'backend/params.json', JSON.stringify(params, null, 2) + '\n');
console.log('Parámetros elegidos con VALIDACIÓN:', JSON.stringify({ k: K, mad: params.mad, ewma: params.ewma }));

// ---------- 5. Evaluación FINAL con PRUEBA (datos que no se usaron para ajustar) ----------
const metodos = ['umbral', 'mad', 'ewma'];
const res = Object.fromEntries(metodos.map((n) => [n, evaluar(n, params, prueba)]));
const f2 = (x) => (x === null ? '—' : x.toFixed(2));
let md = `# Resultados (datos SIMULADOS)\n\nPrueba: ${prueba.length} corridas de ${N} s a 1 Hz (${prueba.filter((c) => !c.falla).length} normales y ${prueba.filter((c) => c.falla).length} con condición inducida desde el s ${INICIO}). Persistencia k = ${K} para todos los métodos.\n\n`;
md += `Parámetros: MAD ventana=${params.mad.ventana}, zLim=${params.mad.zLim}; EWMA λ=${params.ewma.lambda}, L=${params.ewma.L}. Elegidos con validación (${validacion.length} corridas).\n\n`;
md += `| Método | TP | FP (falsas alarmas) | FN | TN | Precisión | Recall | F1 | Latencia media (s) |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const n of metodos) { const m = res[n]; md += `| ${n} | ${m.TP} | ${m.FP} | ${m.FN} | ${m.TN} | ${f2(m.precision)} | ${f2(m.recall)} | ${f2(m.f1)} | ${f2(m.latenciaMedia)} |\n`; }
md += `\n## Por condición inducida (detectadas / ensayos · latencia media en s)\n\n| Condición | ${metodos.join(' | ')} |\n|---|---|---|---|\n`;
for (const f of Object.keys(FALLAS)) md += `| ${f} | ${metodos.map((n) => { const p = res[n].porFalla[f]; return `${p.detectadas}/${p.total} · ${f2(p.latenciaMedia)}`; }).join(' | ')} |\n`;
mkdirSync(RAIZ + 'docs/resultados', { recursive: true });
writeFileSync(RAIZ + 'docs/resultados/tablas.md', md);
writeFileSync(RAIZ + 'docs/resultados/resultados.json', JSON.stringify({ params, res }, null, 2) + '\n');

// Gráfica sencilla en SVG: F1 y latencia por método.
const barras = (clave, max, y0) => metodos.map((n, i) => {
  const val = res[n][clave] ?? 0, w = Math.round((val / max) * 300);
  return `<text x="10" y="${y0 + 30 + i * 28}" font-size="13">${n}</text><rect x="90" y="${y0 + 16 + i * 28}" width="${w}" height="18" fill="#2563eb"/><text x="${96 + w}" y="${y0 + 30 + i * 28}" font-size="13">${f2(res[n][clave])}</text>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" font-family="sans-serif"><rect width="480" height="260" fill="white"/><text x="10" y="18" font-size="14" font-weight="bold">F1 (más alto es mejor)</text>${barras('f1', 1, 0)}<text x="10" y="138" font-size="14" font-weight="bold">Latencia media en s (más bajo es mejor)</text>${barras('latenciaMedia', 60, 120)}</svg>`;
writeFileSync(RAIZ + 'docs/resultados/comparacion.svg', svg);

// CSV de las corridas de prueba: evidencia reproducible y material para el plan B (reproducción).
mkdirSync(RAIZ + 'datos/prueba', { recursive: true });
for (const c of prueba) {
  const csv = ['t,' + VARS.join(',') + ',etiqueta', ...c.filas.map((f) => [f.t, ...VARS.map((v) => f[v]), f.etiqueta].join(','))].join('\n') + '\n';
  writeFileSync(`${RAIZ}datos/prueba/${c.falla ?? 'normal'}-${c.seed}.csv`, csv);
}
console.log(md);
