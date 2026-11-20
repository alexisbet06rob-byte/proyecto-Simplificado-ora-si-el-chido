// firmware/bomba_esp32/bomba_esp32.ino
// ESP32 que mide temperatura y humedad (DHT22) y caudal (YF-S201) y publica un JSON por MQTT cada segundo.
// Bibliotecas (Library Manager): "PubSubClient", "DHT sensor library" y "Adafruit Unified Sensor".
// Conexiones: DHT22 datos -> GPIO 4 | YF-S201 señal -> GPIO 27 | alimenta con 3.3 V / 5 V según el módulo.
// OJO: sin calibrar. Los valores son lecturas del sensor, no mediciones calibradas.
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <time.h>
#include "secrets.h"

#define PIN_DHT 4
#define PIN_CAUDAL 27
const char* DEVICE = "bomba-01";
const char* RUN_ID = "run-001";            // cambia el número en cada corrida experimental

DHT dht(PIN_DHT, DHT22);
WiFiClient wifi;
PubSubClient mqtt(wifi);

volatile unsigned long pulsos = 0;         // el sensor de caudal manda pulsos; los contamos
void IRAM_ATTR contarPulso() { pulsos++; }

void conectarMqtt() {
  char temaEstado[48];
  snprintf(temaEstado, sizeof(temaEstado), "motor/%s/estado", DEVICE);
  while (!mqtt.connected()) {
    // Last Will: si el ESP32 se cae, el broker publica "offline" por él.
    if (mqtt.connect(DEVICE, MQTT_USER, MQTT_PASS, temaEstado, 1, true, "{\"estado\":\"offline\"}")) {
      mqtt.publish(temaEstado, "{\"estado\":\"online\"}", true);
    } else {
      delay(2000);                         // reintenta cada 2 s
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(PIN_CAUDAL, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_CAUDAL), contarPulso, FALLING);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  configTime(0, 0, "pool.ntp.org");        // hora real por internet (marca de tiempo)
  mqtt.setServer(MQTT_HOST, 1883);
  mqtt.setBufferSize(512);                 // el JSON es más grande que el tamaño por defecto
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
  if (!mqtt.connected()) conectarMqtt();
  mqtt.loop();

  static unsigned long ultimo = 0;
  if (millis() - ultimo < 1000) return;    // muestreo: 1 lectura por segundo (1 Hz)
  ultimo = millis();

  noInterrupts(); unsigned long p = pulsos; pulsos = 0; interrupts();
  float caudal = p / 7.5;                  // YF-S201: frecuencia (Hz) = 7.5 x caudal (L/min)
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  if (isnan(temp) || isnan(hum)) return;   // lectura inválida: no se publica

  time_t ahora = time(nullptr);
  if (ahora < 100000) return;              // todavía no hay hora de internet
  char ts[25]; strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", gmtime(&ahora));

  char tema[48], json[320];
  snprintf(tema, sizeof(tema), "motor/%s/telemetria", DEVICE);
  snprintf(json, sizeof(json),
    "{\"deviceId\":\"%s\",\"runId\":\"%s\",\"ts\":\"%s\","
    "\"lecturas\":{\"temperatura_C\":%.2f,\"humedad_pct\":%.1f,\"caudal_Lmin\":%.2f},"
    "\"unidades\":{\"temperatura_C\":\"°C\",\"humedad_pct\":\"%%HR\",\"caudal_Lmin\":\"L/min\"}}",
    DEVICE, RUN_ID, ts, temp, hum, caudal);
  mqtt.publish(tema, json);
}
