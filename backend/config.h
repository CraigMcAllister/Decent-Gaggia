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
#define zeroCross 2 // for boards with CHANGEBLE input pins
//Banoz PSM for more cool shit visit https://github.com/banoz  and don't forget to star
const unsigned int range = 100;
PSM pump(zeroCross, pumpPin, range, RISING, 2, 4);
#define psmToGrams 70.8/10958


// Set point for different beans:
// 94C - Cama Decaf
// 89C - Oasis Sonic
// 92C - Ruins
#define espressoSetPoint 98 // around 8-10 dec difference from boiler to group. 89 is a good starting point
#define steamSetPoint 154

#define preInfusionTime 8
#define preInfusionPressure 3
#define shotPressure 8

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
