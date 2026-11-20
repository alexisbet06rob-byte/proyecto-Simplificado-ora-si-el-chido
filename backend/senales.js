// backend/senales.js
// Generador de señales SIMULADAS de una bomba de agua (se usa cuando no hay hardware).
// Es reproducible: la misma "semilla" (seed) produce exactamente los mismos datos.
// Lo usan el simulador (para publicar por MQTT) y el script de evaluación (para los experimentos).

// Variables medidas y sus unidades (las mismas que manda el microcontrolador).
export const UNIDADES = { temperatura_C: '°C', humedad_pct: '%HR', caudal_Lmin: 'L/min' };

// Comportamiento NORMAL: promedio (mu) y ruido típico (sd) de cada variable.
const NORMAL = {
  temperatura_C: { mu: 40, sd: 0.4 },
  humedad_pct: { mu: 45, sd: 1.0 },
  caudal_Lmin: { mu: 6, sd: 0.15 },
};

// Condiciones anómalas ENSAYADAS (inducidas a propósito, no son fallas reales).
// Cada una cambia una o más variables de forma gradual hasta alcanzar "delta".
export const FALLAS = {
  sobrecalentamiento: { temperatura_C: +9 },
  fuga: { humedad_pct: +20 },
  obstruccion: { caudal_Lmin: -2.6, temperatura_C: +3 },
};
const RAMPA = 90; // segundos que tarda la condición en llegar a su valor final

// Generador de números aleatorios con semilla (mulberry32).
function aleatorio(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido con forma de campana (Box-Muller) a partir de dos números uniformes.
function gauss(rnd) {
  const u = 1 - rnd(), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Devuelve una "corrida": un arreglo con una lectura por segundo.
//  seed   -> semilla (reproducibilidad)
//  n      -> cuántos segundos dura la corrida
//  falla  -> null (normal) o nombre de una condición de FALLAS
//  inicio -> segundo en que empieza la condición anómala
export function generarCorrida({ seed, n = 300, falla = null, inicio = 150 }) {
  const rnd = aleatorio(seed);
  const filas = [];
  for (let t = 0; t < n; t++) {
    const fila = { t, etiqueta: 'normal' };
    const avance = falla && t >= inicio ? Math.min(1, (t - inicio) / RAMPA) : 0;
    for (const [v, { mu, sd }] of Object.entries(NORMAL)) {
      let x = mu + sd * gauss(rnd);
      if (falla) x += (FALLAS[falla][v] ?? 0) * avance;
      if (rnd() < 0.004) x += (rnd() < 0.5 ? -1 : 1) * 6 * sd; // pico aislado ocasional (ruido real)
      fila[v] = Number(x.toFixed(3));
    }
    if (falla && t >= inicio) fila.etiqueta = falla;
    filas.push(fila);
  }
  return filas;
}
