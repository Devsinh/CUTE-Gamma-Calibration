const int stepPin = 3;       // Clock (step) pin
const int dirPin = 4;        // Direction pin
const int onOffPin = 5;      // ON/OFF pin for controlling motor power
const int homeSensorPin1 = 7; // Pin for home sensor1
const int homeSensorPin2 = 8; // Pin for home sensor2
const int motionSensorPin = A0; // Analog pin for motion sensor
const int irLedPin = 12;     // Pin for infrared LED

bool motorRunning = false;   // Flag to track motor state
bool homeSensorTriggered = false; // Flag for home sensor trigger

unsigned long lastMotionReadTime = 0;  // Time of the last motion sensor read
const unsigned long motionReadInterval = 100; // Read every 100 milliseconds

void setup() {
  Serial.begin(9600);        // Initialize serial communication
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(onOffPin, OUTPUT);
  pinMode(homeSensorPin1, INPUT_PULLUP); // Assuming the sensor is active low
  pinMode(homeSensorPin2, INPUT_PULLUP); // Assuming the sensor is active low
  pinMode(irLedPin, OUTPUT); // Initialize the IR LED pin

  digitalWrite(onOffPin, LOW); // Start with the motor power OFF (assuming LOW is OFF)
  digitalWrite(dirPin, HIGH);  // Set initial direction
  digitalWrite(irLedPin, HIGH); // Turn on the infrared LED
}

void loop() {
  // Handle serial commands
  if (Serial.available() > 0) {
    char command = Serial.read();
    Serial.print("Received command: ");
    Serial.println(command); // Print received command for debugging

    if (command == 'S') { // Start motor
      motorRunning = true; // Set flag to true
      digitalWrite(onOffPin, HIGH); // Power ON the motor (assuming HIGH is ON)
    } else if (command == 'P') { // Stop motor
      motorRunning = false; // Set flag to false
      digitalWrite(onOffPin, LOW); // Power OFF the motor (assuming LOW is OFF)
    } else if (command == 'D') { // Change direction
      digitalWrite(dirPin, !digitalRead(dirPin));
    }
  }

  // Check if both sensor pins are in the required state
  if (digitalRead(homeSensorPin1) == HIGH && digitalRead(homeSensorPin2) == HIGH) {
    if (!homeSensorTriggered) {
      homeSensorTriggered = true;
      motorRunning = false;
      digitalWrite(onOffPin, LOW);
      Serial.println("H");
    }
  } else {
    if (homeSensorTriggered) {
      homeSensorTriggered = false;
      Serial.println("N"); // Send status to the server when sensors are not triggered
    }
  }

  // Read the motion sensor value periodically
  unsigned long currentMillis = millis();
  if (currentMillis - lastMotionReadTime >= motionReadInterval) {
    lastMotionReadTime = currentMillis;

    int motionSensorValue = analogRead(motionSensorPin);

    // Send the motion sensor value to the Serial Monitor
    Serial.print("Motion Sensor Value: ");
    Serial.println(motionSensorValue);
  }

  // If the motor is running, perform stepping
  if (motorRunning) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(1000); // Adjust delay for stepping speed
    digitalWrite(stepPin, LOW);
    delayMicroseconds(1000);
  }
}
