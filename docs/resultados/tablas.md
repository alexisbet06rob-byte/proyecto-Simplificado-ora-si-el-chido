# Resultados (datos SIMULADOS)

Prueba: 20 corridas de 300 s a 1 Hz (5 normales y 15 con condición inducida desde el s 150). Persistencia k = 3 para todos los métodos.

Parámetros: MAD ventana=120, zLim=3; EWMA λ=0.1, L=4. Elegidos con validación (29 corridas).

| Método | TP | FP (falsas alarmas) | FN | TN | Precisión | Recall | F1 | Latencia media (s) |
|---|---|---|---|---|---|---|---|---|
| umbral | 10 | 0 | 5 | 5 | 1.00 | 0.67 | 0.80 | 85.00 |
| mad | 15 | 0 | 0 | 5 | 1.00 | 1.00 | 1.00 | 20.07 |
| ewma | 13 | 3 | 0 | 4 | 0.81 | 1.00 | 0.90 | 12.46 |

## Por condición inducida (detectadas / ensayos · latencia media en s)

| Condición | umbral | mad | ewma |
|---|---|---|---|
| sobrecalentamiento | 0/5 · — | 5/5 · 20.40 | 4/5 · 12.25 |
| fuga | 5/5 · 95.40 | 5/5 · 18.20 | 5/5 · 12.20 |
| obstruccion | 5/5 · 74.60 | 5/5 · 21.60 | 4/5 · 13.00 |
