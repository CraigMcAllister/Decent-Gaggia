#define WIFI_SSID "TSAI_2.4GHz"
#define WIFI_PASSWORD "Dalcroze2"

#define thermoDO 19 // MAX6675 DO
#define thermoCS 23 // MAX6675 CS
#define thermoCLK 5 // MAX6675 CLK
#define relayPin 14  // SSR VCC pin
#define solenoidPin 13  // Solenoid control pin
#define optoPin 27  // Optocoupler pin
#define steamPin 15  // Steam switch input

#define pumpPin 12  // Pump control pin
// Pump control configuration
#define PUMP_ON_DELAY_MS 2200 // Delay in milliseconds before flow accumulation starts
#define FLOW_ESTIMATION_FACTOR 5.180555  // Updated estimation factor: 37.3g in 7.2s after delay

// Set point for different beans:
// 94C - Cama Decaf
// 89C - Oasis Sonic
// 92C - Ruins
#define espressoSetPoint 98 // around 8-10 dec difference from boiler to group. 89 is a good starting point
#define steamSetPoint 154

#define preInfusionTime 8
#define preInfusionPressure 3
#define shotPressure 8

#define SHOT_DURATION_S 30  // Default total shot duration in seconds
#define SHOT_END_PRESSURE_BAR 4 // Default shot ending pressure in bar

#define pressurePin 35

//PID defaults
#define kpValue 70
#define kiValue 1
#define kdValue 40

//PID for optimised brewing
#define otpimisedBrewing true // fales = DISABLED, true = ENABLED, Enables other PID values while the timer is running
#define kpOptimised 150
#define kiOptimised 0
#define kdOptimised 20 
#define GET_KTYPE_READ_EVERY 350
