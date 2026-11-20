// frontend/src/historial.js
// Consulta los datos guardados en MongoDB (no solo el último mensaje) a través de la API REST.
const $ = (id) => document.getElementById(id);

// Crea un <li> o <td> con textContent: seguro aunque el texto venga de un mensaje MQTT.
const celda = (tag, texto, clase = '') => { const e = document.createElement(tag); e.textContent = texto; e.className = clase; return e; };

async function cargarCorridas() {
  const corridas = await (await fetch('/api/corridas')).json();
  $('corridas').replaceChildren(...corridas.map((c) => {
    const o = celda('option', `${c._id} · ${c.n} lecturas${c.reproduccion ? ' · reproducción' : ''}`);
    o.value = c._id;
    return o;
  }));
  if (corridas.length) await cargarHistorial();
}

async function cargarHistorial() {
  const q = `runId=${encodeURIComponent($('corridas').value)}`;
  const [anomalias, mediciones] = await Promise.all([
    fetch(`/api/anomalias?${q}&limite=50`).then((r) => r.json()),
    fetch(`/api/mediciones?${q}&limite=50`).then((r) => r.json()),
  ]);
  $('hist-anomalias').replaceChildren(...(anomalias.length ? anomalias.map((a) =>
    celda('li', `${new Date(a.ts).toLocaleTimeString()} · ${a.algoritmo} · ${a.variables.join(', ')}`, 'rounded bg-red-900/60 px-2 py-1'))
    : [celda('li', 'Sin eventos anómalos en esta corrida.', 'text-slate-400')]));
  $('hist-tabla').replaceChildren(...mediciones.map((m) => {
    const tr = document.createElement('tr');
    const alertas = Object.entries(m.resultados).filter(([, r]) => r.alerta).map(([d]) => d).join(', ') || '–';
    tr.append(celda('td', new Date(m.ts).toLocaleTimeString(), 'pr-3'),
      celda('td', m.lecturas.temperatura_C.toFixed(1), 'pr-3'),
      celda('td', m.lecturas.humedad_pct.toFixed(1), 'pr-3'),
      celda('td', m.lecturas.caudal_Lmin.toFixed(2), 'pr-3'),
      celda('td', alertas));
    return tr;
  }));
}

$('corridas').addEventListener('change', cargarHistorial);
$('recargar').addEventListener('click', cargarCorridas);
cargarCorridas().catch(() => {}); // si el backend aún no está, la página sigue funcionando
