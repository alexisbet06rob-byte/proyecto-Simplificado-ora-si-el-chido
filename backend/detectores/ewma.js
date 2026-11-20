// backend/detectores/ewma.js
// EWMA (promedio móvil con peso exponencial): detecta cambios pequeños pero SOSTENIDOS.
// Idea: un promedio que da más peso a lo reciente y va olvidando lo viejo.
// Si ese promedio se sale de la banda de lo "normal" (aprendida de datos normales), hay anomalía.

// params: { lambda: peso de lo nuevo (0-1), L: ancho de la banda en desviaciones }
// baseline: { variable: { mu, sigma } } calculado con corridas NORMALES de entrenamiento.
export function crearEwma({ lambda = 0.2, L = 3 }, baseline) {
  const z = {}; // valor actual del promedio de cada variable
  // Ancho de banda del EWMA en estado estable: sigma * sqrt(lambda / (2 - lambda))
  const factor = Math.sqrt(lambda / (2 - lambda));
  return {
    nombre: 'ewma',
    paso(lectura) {
      const vars = [];
      for (const v of Object.keys(lectura)) {
        const { mu, sigma } = baseline[v];
        z[v] = z[v] === undefined ? mu : lambda * lectura[v] + (1 - lambda) * z[v];
        if (Math.abs(z[v] - mu) > L * sigma * factor) vars.push(v);
      }
      return { alerta: vars.length > 0, vars };
    },
  };
}
