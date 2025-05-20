#include <PID_v1.h>
#include <AsyncWebSocket.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <max6675.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <Preferences.h>

#include "aWOT.h"
#include "config.h"
#include "StaticFiles.h"

// Preferences for storing persistent data
Preferences preferences;

unsigned long thermoTimer;
unsigned long myTime;
unsigned long shotTime;
unsigned long wsTimer;
// Flow tracking variables
unsigned long pumpRunTime = 0;
unsigned long pumpStartTime = 0;
unsigned long shotGrams = 0;
unsigned long flowCounter = 0;
uint8_t currentPumpDuty = 0;
bool shotStarted, scalesStarted;

// Extraction parameters with defaults from config.h
float currentPreInfusionTime = preInfusionTime;
float currentPreInfusionPressure = preInfusionPressure;
float currentShotPressure = shotPressure;

volatile unsigned int value; //dimmer value

WiFiServer server(8080);
Application app;

AsyncWebServer webSocketServer(90);
AsyncWebSocket ws("/ws");

AsyncWebServer asyncServer(80);
hw_timer_t *timer = NULL;

const unsigned int windowSize = 1000;
unsigned int isrCounter = 0; // counter for ISR

AsyncWebSocketClient *globalClient = NULL;
const float voltageOffset = 0.49;

bool brewSwitch, steamSwitch, lastSteamSwitch;  // Add lastSteamSwitch to track state changes
double Setpoint, Input, Output, temperature, pressure_bar;
double manualSetpoint = espressoSetPoint;  // Add manualSetpoint to store user-set value

// PID Values
double Kp = kpValue, Ki = kiValue, Kd = kdValue;
PID myPID(&temperature, &Output, &Setpoint, Kp, Ki, Kd, DIRECT);
int WindowSize = 5000;

// Init the thermocouples with the appropriate pins defined above with the prefix "thermo"
MAX6675 thermocouple(thermoCLK, thermoCS, thermoDO);

// PWM functions for pump control
void setupPWM() {
  // Configure PWM for pump control
  ledcSetup(PWM_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttachPin(pumpPin, PWM_CHANNEL);
  // Start with pump off
  ledcWrite(PWM_CHANNEL, 0);
}

// Safely ramp the pump duty cycle to avoid sudden changes
void setPumpDuty(uint8_t targetDuty) {
  // Ensure we don't exceed maximum duty cycle
  if (targetDuty > PWM_MAX_DUTY) {
    targetDuty = PWM_MAX_DUTY;
  }
  
  // Gradually ramp up/down to protect pump
  int step = (targetDuty > currentPumpDuty) ? 1 : -1;
  
  while (currentPumpDuty != targetDuty) {
    currentPumpDuty += step;
    ledcWrite(PWM_CHANNEL, currentPumpDuty);
    delay(PWM_RAMP_DELAY);
  }
  
  // Update flow tracking when pump is running
  if (currentPumpDuty > 0 && pumpStartTime == 0) {
    pumpStartTime = millis();
  } else if (currentPumpDuty == 0 && pumpStartTime > 0) {
    pumpRunTime += (millis() - pumpStartTime);
    pumpStartTime = 0;
  }
}

// Calculate flow estimation based on pump duty and runtime
void updateFlowCounter() {
  if (currentPumpDuty > 0) {
    unsigned long runTime = pumpRunTime;
    if (pumpStartTime > 0) {
      runTime += (millis() - pumpStartTime);
    }
    // Estimate flow based on duty cycle and run time
    flowCounter = (runTime * currentPumpDuty * FLOW_ESTIMATION_FACTOR);
  }
}

void resetFlowCounter() {
  flowCounter = 0;
  pumpRunTime = 0;
  pumpStartTime = (currentPumpDuty > 0) ? millis() : 0;
}

// Timer ISR for PID calculation and heater control
void IRAM_ATTR onTimer() {
  // set interrupt time to 10ms
  timerAlarmWrite(timer, 10000, true);
  
  // PID-based heater control
  if (Output <= isrCounter) {
    digitalWrite(relayPin, LOW);
  } else {
    digitalWrite(relayPin, HIGH);
  }

  isrCounter += 10; // += 10 because one tick = 10ms
  
  // Reset counter at the end of window
  if (isrCounter >= windowSize) {
    isrCounter = 0;
  }

  // Run PID calculation
  myPID.Compute();
}

// Initialize timer for PID control
void initTimer() {
  timer = timerBegin(0, 80, true);             // 80MHz clock divider
  timerAttachInterrupt(timer, &onTimer, true); // Attach interrupt handler
  timerAlarmWrite(timer, 10000, true);         // 10ms interrupt
}

// Enable timer for PID control
void enableTimer() {
  timerAlarmEnable(timer);
}

// Load configuration from preferences
void loadConfig() {
  currentPreInfusionTime = preferences.getFloat("preInfTime", preInfusionTime);
  currentPreInfusionPressure = preferences.getFloat("preInfPress", preInfusionPressure);
  currentShotPressure = preferences.getFloat("shotPress", shotPressure);
  
  Serial.println("Loaded configuration:");
  Serial.print("Pre-infusion time: ");
  Serial.println(currentPreInfusionTime);
  Serial.print("Pre-infusion pressure: ");
  Serial.println(currentPreInfusionPressure);
  Serial.print("Shot pressure: ");
  Serial.println(currentShotPressure);
}

// Save configuration to preferences
void saveConfig() {
  preferences.putFloat("preInfTime", currentPreInfusionTime);
  preferences.putFloat("preInfPress", currentPreInfusionPressure);
  preferences.putFloat("shotPress", currentShotPressure);
  
  Serial.println("Saved configuration");
}

//##############################################################################################################################
//###########################################___________BREWDETECTION________________###########################################
//##############################################################################################################################
void brewDetection(bool isBrewingActivated)
{
  if (otpimisedBrewing)
  {
    if (!isBrewingActivated)
    {
      Serial.println("Brewing activated");
      myPID.SetTunings(kpOptimised, kiOptimised, kdOptimised);
    }
    else
    {
      Serial.println("Brewing deactivated");
      myPID.SetTunings(Kp, Ki, Kd);
    }
  }
}

//##############################################################################################################################
//###########################################___________SETUP____________________###############################################
//##############################################################################################################################
void setup()
{
  // Initialize preferences for persistent storage
  preferences.begin("gaggia", false);  // "gaggia" is the namespace
  
  // Load setpoint and extraction parameters from preferences
  manualSetpoint = preferences.getDouble("setpoint", espressoSetPoint);
  Setpoint = manualSetpoint;
  loadConfig();
  
  pinMode(relayPin, OUTPUT);
  // pumpPin is now controlled by PWM
  pinMode(solenoidPin, OUTPUT);
  pinMode(optoPin, INPUT);
  pinMode(steamPin, INPUT_PULLUP);  
  // Initialize pump using PWM control
  setupPWM();
  digitalWrite(solenoidPin, LOW);
  
  // Initialize the steam switch state to avoid overriding setpoint on first read
  lastSteamSwitch = digitalRead(steamPin);
  
  // If currently in steam mode, use steam setpoint regardless of saved preference
  if (lastSteamSwitch == 0) {
    Setpoint = steamSetPoint;
  }

  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.localIP());

  ArduinoOTA
      .onStart([]()
               {
      String type;
      if (ArduinoOTA.getCommand() == U_FLASH)
        type = "sketch";
      else // U_SPIFFS
        type = "filesystem";

      // NOTE: if updating SPIFFS this would be the place to unmount SPIFFS using SPIFFS.end()
      Serial.println("Start updating " + type); })
      .onEnd([]()
             { Serial.println("\nEnd"); })
      .onProgress([](unsigned int progress, unsigned int total)
                  { Serial.printf("Progress: %u%%\r", (progress / (total / 100))); })
      .onError([](ota_error_t error)
               {
      Serial.printf("Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
      else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
      else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
      else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
      else if (error == OTA_END_ERROR) Serial.println("End Failed"); });

  ArduinoOTA.begin();

  app.route(staticFiles());

  asyncServer.on("/brewing", HTTP_POST, [](AsyncWebServerRequest *request) {
      bool isBrewing = false;
      if (request->hasParam("brewing", true)) {
          AsyncWebParameter *p = request->getParam("brewing", true);
          isBrewing = (p->value() != "0");
          brewDetection(isBrewing);
          request->send(200);
      }
  });

  asyncServer.on("/setPoint", HTTP_POST, [](AsyncWebServerRequest *request) {
      if (request->hasParam("setpoint", true)) {
          AsyncWebParameter *p = request->getParam("setpoint", true);
          double newSetpoint = p->value().toDouble();
          
          // Only update if steam switch is not active
          if (digitalRead(steamPin) != 0) {
              // Store the manual setpoint preference
              manualSetpoint = newSetpoint;
              Setpoint = newSetpoint;
              // Store setpoint in preferences
              preferences.putDouble("setpoint", newSetpoint);
              Serial.print("Manual setpoint updated and saved to: ");
              Serial.println(newSetpoint);
          } else {
              Serial.println("Cannot change setpoint while in steam mode");
          }
          request->send(200);
      }
  });

  // Endpoint to handle configuration updates
  asyncServer.on("/config", HTTP_POST, [](AsyncWebServerRequest *request) {
      bool configChanged = false;
      
      if (request->hasParam("preInfusionTime", true)) {
          AsyncWebParameter *p = request->getParam("preInfusionTime", true);
          float newValue = p->value().toFloat();
          if (newValue >= 0 && newValue <= 15) {
              currentPreInfusionTime = newValue;
              configChanged = true;
              Serial.print("Updated pre-infusion time: ");
              Serial.println(currentPreInfusionTime);
          }
      }
      
      if (request->hasParam("preInfusionPressure", true)) {
          AsyncWebParameter *p = request->getParam("preInfusionPressure", true);
          float newValue = p->value().toFloat();
          if (newValue >= 1 && newValue <= 6) {
              currentPreInfusionPressure = newValue;
              configChanged = true;
              Serial.print("Updated pre-infusion pressure: ");
              Serial.println(currentPreInfusionPressure);
          }
      }
      
      if (request->hasParam("shotPressure", true)) {
          AsyncWebParameter *p = request->getParam("shotPressure", true);
          float newValue = p->value().toFloat();
          if (newValue >= 4 && newValue <= 12) {
              currentShotPressure = newValue;
              configChanged = true;
              Serial.print("Updated shot pressure: ");
              Serial.println(currentShotPressure);
          }
      }
      
      if (configChanged) {
          saveConfig();
      }
      
      request->send(200);
  });

  // Endpoint to get current configuration
  asyncServer.on("/getConfig", HTTP_GET, [](AsyncWebServerRequest *request) {
      StaticJsonDocument<200> doc;
      doc["preInfusionTime"] = currentPreInfusionTime;
      doc["preInfusionPressure"] = currentPreInfusionPressure;
      doc["shotPressure"] = currentShotPressure;
      
      String response;
      serializeJson(doc, response);
      
      request->send(200, "application/json", response);
  });

  asyncServer.onNotFound([](AsyncWebServerRequest *request) {
      if (request->method() == HTTP_OPTIONS) {
          AsyncWebServerResponse *response = request->beginResponse(200);
          response->addHeader("Access-Control-Max-Age", "10000");
          response->addHeader("Access-Control-Allow-Methods", "PUT,POST,GET,OPTIONS");
          response->addHeader("Access-Control-Allow-Headers", "*");
          request->send(response);
      } else {
          request->send(404);
      }
  });


  // Enable cors
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  server.begin();
  asyncServer.begin();
  webSocketServer.begin();

  ws.onEvent(onWsEvent);
  webSocketServer.addHandler(&ws);

  thermoTimer = millis();

  // tell the PID to range between 0 and the full window size
  myPID.SetOutputLimits(0, WindowSize);

  // turn the PID on
  myPID.SetMode(AUTOMATIC);

  // Initialize and enable timer for PID control
  initTimer();
  enableTimer();
}

//##############################################################################################################################
//###########################################___________WEBSOCKET________________###############################################
//##############################################################################################################################
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len)
{
  if (type == WS_EVT_CONNECT)
  {
    Serial.println("Websocket client connection received");
    globalClient = client;
  }
  else if (type == WS_EVT_DISCONNECT)
  {
    Serial.println("Websocket client connection finished");
    globalClient = NULL;
  }
}

//##############################################################################################################################
//###########################################___________THERMOCOUPLE_READ________###############################################
//##############################################################################################################################
void kThermoRead()
{
    temperature = thermocouple.readCelsius();
    if (temperature == NAN) {
      Serial.println("Are you sure there is a thermocouple connected?");
    } else {
      while (temperature <= 0 || temperature > 170.0)
    {
      if ((millis() - thermoTimer) > GET_KTYPE_READ_EVERY)
      {
          Serial.println("Read temp?");
        temperature = thermocouple.readCelsius();
        thermoTimer = millis();
      }
    }
    }
}


//##############################################################################################################################
//###########################################___________OPTOCOUPLER_READ________################################################
//##############################################################################################################################
void readOpto()
{
  brewSwitch = digitalRead(optoPin);
}

//##############################################################################################################################
//###########################################___________STEAM_READ________######################################################
//##############################################################################################################################
void readSteam()
{
    bool currentSteamSwitch = digitalRead(steamPin);
    
    // Only change setpoint if steam switch state has changed
    if (currentSteamSwitch != lastSteamSwitch) {
        if (currentSteamSwitch == 0) {
            // Entering steam mode - use steam setpoint
            Setpoint = steamSetPoint;
        } else {
            // Exiting steam mode - return to manual setpoint
            Setpoint = manualSetpoint;
        }
        lastSteamSwitch = currentSteamSwitch;
    }
}


//##############################################################################################################################
//###########################################___PRESSURE_READ____________________###############################################
//##############################################################################################################################
void pressureReading()
{

  const int numReadings = 16;    // number of readings to average
  int total = 0;                  // the running total of measurements
  int average = 0;                // the average measurement
  const float OffSet = 0.464 ;
  float V;  

  Serial.println("Read pressure");  
  for (int i=0; i<= numReadings; i++)
  {
    total = total + analogRead(pressurePin);
    delay(1);
  }   
  average = total / numReadings;  
  V = average * 3.30 / 4095;
  pressure_bar = (((V*2)-OffSet)*4*0.62)*1.125+0.565; //Calculate water pressure. The 0.62 is the correction factor after measuring with an analogue gauge. Pressure at group head.
  if(pressure_bar <0)
  {
    pressure_bar = 0;
  }
  float pressure_psi = pressure_bar * 14.5038;  
}

void setPressure(int wantedValue)
{
  pressureReading();
  
  // Calculate duty cycle based on pressure difference
  int pressureDiff = wantedValue - pressure_bar;
  uint8_t targetDuty = 0;
  
  if (pressureDiff > 0) {
    // Map pressure difference to duty cycle (0-200)
    // Scale factor 25 can be adjusted for better control
    targetDuty = constrain(pressureDiff * 25, 0, PWM_MAX_DUTY);
  }
  
  Serial.print("Pressure: ");
  Serial.print(pressure_bar);
  Serial.print(" bar, Target: ");
  Serial.print(wantedValue);
  Serial.print(" bar, Setting pump duty to: ");
  Serial.println(targetDuty);
  
  setPumpDuty(targetDuty);
}


//##############################################################################################################################
//###########################################___________READINGS________________################################################
//##############################################################################################################################
void readings() {
    // Reading the temperature every 350ms between the loops
  updateFlowCounter();
  shotGrams = flowCounter;
  readOpto();
  readSteam(); 
  if ((millis() - thermoTimer) > GET_KTYPE_READ_EVERY) {
        Serial.println("Measure");
        pressureReading();
        kThermoRead();
        thermoTimer = millis();
  }
}



//##############################################################################################################################
//###########################################___________SHOT MONITOR____________################################################
//##############################################################################################################################
void shotMonitor() {
  if(!brewSwitch){
    updateFlowCounter();
    if(!shotStarted){
      shotTime = millis();      
      resetFlowCounter();
      Serial.println("Shot started, resetting flow counter");
      shotStarted = true;
    }   
    if((millis() - shotTime) < currentPreInfusionTime*1000){
      setPressure(currentPreInfusionPressure);
      resetFlowCounter();
      Serial.println("Pre-infusion phase, flow counter reset");      
    }            
    else{
      setPressure(currentShotPressure);      
      if(pressure_bar < currentShotPressure - 2){
        if(!scalesStarted){
          resetFlowCounter();
          Serial.println("Scales not started, flow counter reset");            
        }
      }
      else{
        scalesStarted = true;         
      }
    }           
  }
  else{
    // Stop pump when brew switch off
    setPumpDuty(0);
    shotStarted = false;
    scalesStarted = false;
  }
}


//##############################################################################################################################
//###########################################___________WEBSOCKET________________###############################################
//##############################################################################################################################
void wsSendData()
{
  if (globalClient != NULL && globalClient->status() == WS_CONNECTED && (millis() - wsTimer) > GET_KTYPE_READ_EVERY)
  {
    StaticJsonDocument<200> payload;  // Increased size to accommodate new field
    
    updateFlowCounter();
    Serial.print("Flow counter: ");
    Serial.println(flowCounter);

    payload["temp"] = temperature;        //temperature
    payload["brewTemp"] = temperature;    //temperature
    payload["pressure"] = pressure_bar;   //pressure_bar
    payload["setpoint"] = Setpoint;       //current setpoint
    payload["brewSwitch"] = brewSwitch;   //brew switch status
    payload["shotGrams"] = shotGrams;     //Flow calculated weight
    payload["pumpDuty"] = currentPumpDuty; //Current pump duty cycle
    
    // Add pre-infusion status
    bool isPreInfusing = !brewSwitch && shotStarted && ((millis() - shotTime) < currentPreInfusionTime*1000);
    payload["preInfusing"] = isPreInfusing;

    myTime = millis() / 1000;
    payload["brewTime"] = myTime;

    char buffer[200];
    serializeJson(payload, buffer);

    globalClient->text(buffer);
    
    wsTimer = millis();
  }
}

//##############################################################################################################################
//###########################################___________LOOP_____________________###############################################
//##############################################################################################################################
void loop()
{
  ArduinoOTA.handle();
  WiFiClient client = server.available();

  readings();
  shotMonitor();

  if (client.connected())
  {
    app.process(&client);
  }
  wsSendData();
}
