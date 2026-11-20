# DWSSR · Monitoreo y detección de anomalías en una bomba de agua

Sensores (temperatura, humedad y caudal) → MQTT (Mosquitto) → Node.js + Express → MongoDB → SSE → página web (Vite + Tailwind).
La detección se hace en JavaScript con tres métodos: umbrales fijos, MAD y EWMA.
Los resultados incluidos son de **datos simulados**; los sensores no están calibrados.

Documentación en `docs/`: `arquitectura.md` (diagrama, flujo, temas y mensajes MQTT), `protocolo.md` (diseño experimental y variables) y `analisis.md` (resultados).

## Instalación
Requisitos: Node.js 20.6 o superior, Git y Docker con `docker compose`.
```bash
npm install
(cd frontend && npm install)
cp .env.example .env     # cambia las dos contraseñas (sin espacios ni comillas)
```

## Ejecución
```bash
set -a; . ./.env; set +a
docker run --rm -v "$PWD/mosquitto:/work" eclipse-mosquitto:2 sh -c \
  "mosquitto_passwd -b -c /work/passwd backend '$MQTT_PASS_BACKEND' && mosquitto_passwd -b /work/passwd dispositivo '$MQTT_PASS_DISP'"
docker compose up -d      # Mosquitto y MongoDB
npm start                 # terminal 1: backend en :3000
(cd frontend && npm run dev)                                      # terminal 2: página en :5173
npm run simular -- --falla fuga --inicio 60 --n 180 --run demo-1  # terminal 3: simulador
```
Si Mosquitto se queja de permisos: `sudo chown 1883:1883 mosquitto/passwd mosquitto/acl && sudo chmod 0700 mosquitto/passwd` y `docker compose restart mosquitto`.

Fallas del simulador: `sobrecalentamiento`, `fuga`, `obstruccion`. Sin `--falla` la corrida es normal.

## Experimento y plan B
```bash
npm run evaluar           # ajusta con validación, evalúa con prueba y escribe docs/resultados/
npm run simular -- --csv datos/prueba/fuga-221.csv --hz 5 --run replay-1   # plan B
```
El plan B reproduce datos grabados y la página lo muestra como **REPRODUCCIÓN · datos grabados**.

## Operación
- Comprobar que todo está arriba: `curl http://localhost:3000/api/salud` (debe decir `mqtt:true` y `mongo:true`).
- Probar una desconexión: `docker compose stop mosquitto`, esperar unos segundos y `docker compose start mosquitto`. El backend reconecta solo.
- Con el ESP32: copiar `firmware/bomba_esp32/secrets.h.example` a `secrets.h`, poner la IP de la computadora con Docker y subir el sketch.
