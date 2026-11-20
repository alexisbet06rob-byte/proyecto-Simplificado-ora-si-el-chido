# Interpretación de resultados (datos simulados)

Tablas completas en `docs/resultados/tablas.md` y gráfica en `docs/resultados/comparacion.svg`. Las cifras de abajo son las de
`npm run evaluar` con las semillas fijas del repositorio; si cambian los datos o los parámetros, hay que actualizar este texto.

| Método | Aciertos (TP) | Falsas alarmas (FP) | F1 | Latencia media |
|---|---|---|---|---|
| Umbrales | 10 de 15 | 0 | 0.80 | 85 s |
| MAD (ventana 120 s, z > 3) | 15 de 15 | 0 | 1.00 | 20 s |
| EWMA (λ = 0.1, L = 4) | 13 de 15 | 3 | 0.90 | 12 s |

## Qué se observa
- **Umbrales:** no vieron el `sobrecalentamiento` (0 de 5), porque la temperatura llega a unos 49 °C y el límite puesto a mano es 50 °C. En `fuga` y `obstruccion` avisaron solo cuando la variable ya cruzó el límite, por eso tardan 75–95 s. No dieron falsas alarmas.
- **MAD:** detectó las 15 condiciones en unos 20 s y no tuvo falsas alarmas en la prueba. Funcionó porque la condición cambia 9 °C, 20 %HR o 2.6 L/min en 90 s, algo claramente fuera de lo reciente.
- **EWMA:** fue el más rápido (12 s), pero tuvo 3 falsas alarmas: una en una corrida normal y dos antes de que empezara la condición. Con L = 4 en validación no hubo falsas alarmas (0 de 29 corridas), pero en prueba sí (3 de 20), señal de que 29 corridas no bastan para fijar bien ese límite. Los picos aislados que incluye la simulación también empujan el promedio.

## Qué se puede y qué no se puede concluir
- En **este simulador y con estas condiciones**, MAD fue el método más equilibrado, EWMA el más rápido pero con más falsas alarmas y los umbrales los más lentos y los únicos que se perdieron una condición.
- **No** se puede concluir que MAD sea mejor en general. Una deriva mucho más lenta (horas) podría escaparse a una ventana de 120 s, pero esto **no se probó**.
- Los resultados dependen de cómo definimos las condiciones y el ruido. Hay que repetir el experimento con datos reales del banco de pruebas antes de afirmar algo sobre la bomba real.
