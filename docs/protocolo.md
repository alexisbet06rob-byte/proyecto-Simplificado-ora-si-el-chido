# Diseño experimental, instrumentación y protocolo de pruebas

## 1. Problema y pregunta de investigación
Una bomba de agua pequeña puede empezar a funcionar mal (se calienta, se obstruye, hay una fuga) sin que nadie lo note.
**Pregunta:** ¿qué método de detección —umbrales fijos, MAD en ventana móvil o EWMA— identifica mejor las condiciones
anómalas ensayadas, con menos falsas alarmas y un tiempo de detección razonable?

El objetivo es **académico**: construir un prototipo reproducible y comparar métodos. No es una solución industrial ni
diagnostica fallas mecánicas con certeza.

## 2. Banco de pruebas
Bomba de agua pequeña de corriente directa (5–12 V) con un depósito, manguera y un ESP32. Todo a **bajo voltaje**
(nunca conectar la bomba ni el sensor a la red eléctrica de 127 V). Las pruebas se hacen con **supervisión** de una persona
y se detienen de inmediato si algo se ve inseguro (agua cerca de conexiones, calentamiento anormal, olor a quemado).

## 3. Variables medidas
| Variable | Unidad | Sensor | Método | Qué información aporta |
|---|---|---|---|---|
| `temperatura_C` | °C | DHT22 junto a la bomba | Lectura digital | Calentamiento por esfuerzo o fricción |
| `humedad_pct` | %HR | DHT22 junto a la bomba | Lectura digital | Fugas o salpicaduras cerca del motor |
| `caudal_Lmin` | L/min | YF-S201 en la manguera | Conteo de pulsos: frecuencia (Hz) = 7.5 × caudal | Obstrucciones o falta de agua |

- **Frecuencia de muestreo:** 1 Hz (una lectura por segundo).
- **Calibración:** **ninguna realizada.** Los valores son lecturas de los sensores, no mediciones calibradas. Pendiente:
  comparar el caudal con una probeta y un cronómetro.
- **Limitaciones:** el DHT22 tiene precisión aproximada de ±0.5 °C y ±2–5 %HR y responde lento; mide el aire, no el agua ni el motor;
  el YF-S201 pierde exactitud con caudales muy bajos.
- Si el equipo cambia de sensores (por ejemplo, uno de humedad de suelo o de nivel de agua), se actualiza esta tabla.

## 4. Condiciones de operación
| Condición | Efecto simulado | Cómo se induciría en el banco real (siempre supervisado, ≤ 30 s) |
|---|---|---|
| Normal | Valores estables con ruido | Bomba funcionando con depósito lleno |
| `sobrecalentamiento` | Temperatura sube hasta +9 °C en 90 s | Calentar **el sensor** con aire tibio a distancia. **No** calentar ni forzar el motor |
| `fuga` | Humedad sube hasta +20 %HR en 90 s | Acercar un trapo húmedo al sensor, lejos de conexiones eléctricas |
| `obstruccion` | Caudal baja 2.6 L/min y temperatura sube 3 °C en 90 s | Pellizcar parcialmente la manguera unos segundos |

**Tres cosas distintas que no se deben confundir:** una *anomalía observada* es lo que el detector marca; una *condición
inducida* es la que el equipo provoca a propósito para el experimento; una *falla real* es un daño del equipo. Aquí solo
hay condiciones inducidas (y, por ahora, simuladas). No se generalizan a motores industriales.

## 5. Conjuntos de datos
Cada corrida dura 300 s a 1 Hz (300 observaciones por variable). Si hay condición, empieza en el segundo 150.
Los datos simulados usan una **semilla**: la misma semilla genera siempre los mismos datos.

| Conjunto | Para qué | Corridas |
|---|---|---|
| Entrenamiento | Aprender la línea base de operación normal (media y desviación) para EWMA | 5 normales (semillas 1–5) |
| Validación | Elegir los parámetros de MAD y EWMA | 20 normales (semillas 11–30) y 9 con condición (3 de cada una, semillas 51+) |
| Prueba | Medir el resultado final; **no se ajusta nada con él** | 5 normales (101–105) y 15 con condición (5 de cada una, semillas 201+) |

Los tres conjuntos usan semillas distintas, así que no se ajusta y evalúa con las mismas observaciones.
Los datos simulados incluyen un pico aislado ocasional (probabilidad 0.4 % por lectura) para representar ruido real.

## 6. Detectores y parámetros
- **Umbrales fijos (referencia):** límites puestos a mano (temperatura 30–50 °C, humedad 20–65 %HR, caudal 4–8 L/min). Son supuestos, no se ajustan con datos.
- **MAD:** z-score robusto con mediana y MAD sobre una ventana móvil. Se probaron ventanas de 30, 60 y 120 s y límites z de 3, 3.5, 4 y 5.
- **EWMA:** promedio con peso exponencial, banda ±L·σ·√(λ/(2−λ)) con σ de la línea base. Se probó λ de 0.1, 0.2 y 0.3 y L de 2.5 a 4.5.
- **Persistencia:** todos los métodos exigen **k = 3** lecturas anómalas seguidas, para no alertar por un pico aislado y comparar con criterios equivalentes.
- **Criterio de elección en validación:** 1) cero falsas alarmas (en corridas normales o antes de que empiece la condición), 2) mayor F1, 3) menor latencia. Los parámetros elegidos quedan en `backend/params.json`.

## 7. Métricas y criterio de éxito
Por corrida, con *a* = segundo de la primera alerta:
- normal con alerta → **falsa alarma (FP)**; normal sin alerta → TN;
- con condición y alerta **antes** del inicio → falsa alarma (FP); sin alerta → FN;
- con condición y alerta **después** del inicio → acierto (TP), con latencia = *a* − 150 s.

Se reportan matriz de confusión, precisión, recall, F1, falsas alarmas y latencia media (en segundos, porque hay 1 muestra por segundo).
**Criterio de éxito propuesto:** ninguna falsa alarma en las corridas normales de prueba, recall ≥ 0.8 y latencia media ≤ 30 s.

## 8. Limitaciones
- Los resultados incluidos son de **señales simuladas**. Describen cómo se comparan los métodos en ese simulador, no en un motor real.
- Las condiciones inducidas y su forma (rampa de 90 s) las definimos nosotros; otros comportamientos podrían dar otros resultados.
- 20 corridas de prueba dan una idea, no una garantía estadística.
- Los sensores no están calibrados. Con datos reales hay que repetir la línea base y el ajuste (`npm run evaluar` leyendo los CSV de `datos/`).
