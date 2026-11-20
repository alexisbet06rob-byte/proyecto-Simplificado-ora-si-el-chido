// backend/detectores/index.js
// Junta los tres métodos y les aplica el MISMO filtro de persistencia (criterios equivalentes).
import { crearUmbral } from './umbral.js';
import { crearMad } from './mad.js';
import { crearEwma } from './ewma.js';

// Persistencia: solo se declara alerta si hubo "k" lecturas anómalas SEGUIDAS.
// Así un pico aislado no dispara una falsa alarma.
function conPersistencia(detector, k) {
  let seguidas = 0;
  return {
    nombre: detector.nombre,
    paso(lectura) {
      const r = detector.paso(lectura);
      seguidas = r.alerta ? seguidas + 1 : 0;
      return { alerta: seguidas >= k, vars: r.vars };
    },
  };
}

// params viene de backend/params.json (lo genera scripts/evaluar.js).
export function crearDetectores(params) {
  const k = params.k;
  return {
    umbral: conPersistencia(crearUmbral(), k),
    mad: conPersistencia(crearMad(params.mad), k),
    ewma: conPersistencia(crearEwma(params.ewma, params.baseline), k),
  };
}
