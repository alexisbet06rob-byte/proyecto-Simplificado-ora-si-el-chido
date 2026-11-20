// backend/detectores/mad.js
// Puntuación estadística en ventana móvil con z-score ROBUSTO (mediana y MAD).
// Idea: compara cada lectura contra lo que pasó en los últimos "ventana" segundos.
// Si se aleja mucho de lo reciente, es anomalía. La mediana no se deja engañar por picos aislados.

const mediana = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// params: { ventana: cuántas lecturas recientes se miran, zLim: qué tan lejos es "demasiado lejos" }
export function crearMad({ ventana = 60, zLim = 4 }) {
  const historia = {}; // últimas lecturas de cada variable
  return {
    nombre: 'mad',
    paso(lectura) {
      const vars = [];
      for (const v of Object.keys(lectura)) {
        const h = (historia[v] ??= []);
        if (h.length >= 20) { // se necesitan al menos 20 lecturas para tener "lo reciente"
          const med = mediana(h);
          const mad = mediana(h.map((x) => Math.abs(x - med))) || 1e-6; // evita dividir entre 0
          const z = (0.6745 * (lectura[v] - med)) / mad; // 0.6745 hace al MAD comparable con una desviación estándar
          if (Math.abs(z) > zLim) vars.push(v);
        }
        h.push(lectura[v]);
        if (h.length > ventana) h.shift(); // ventana móvil: se olvida lo más viejo
      }
      return { alerta: vars.length > 0, vars };
    },
  };
}
