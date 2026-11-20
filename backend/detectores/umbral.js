// backend/detectores/umbral.js
// REFERENCIA BASE: límites fijos por variable, definidos por una persona (no se ajustan con datos).
// Por sí solo NO cuenta como método de detección de anomalías; sirve para comparar.

// Límites mínimo/máximo aceptables para cada variable (supuestos de operación segura).
export const LIMITES = {
  temperatura_C: { min: 30, max: 50 },
  humedad_pct: { min: 20, max: 65 },
  caudal_Lmin: { min: 4, max: 8 },
};

export function crearUmbral(limites = LIMITES) {
  return {
    nombre: 'umbral',
    // Recibe una lectura {variable: valor} y dice qué variables salieron de su rango.
    paso(lectura) {
      const vars = Object.keys(limites).filter((v) => lectura[v] < limites[v].min || lectura[v] > limites[v].max);
      return { alerta: vars.length > 0, vars };
    },
  };
}
