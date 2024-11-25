const int stepPin = 3;        // Clock (step) pin
const int dirPin = 4;         // Direction pin
const int onOffPin = 5;       // ON/OFF pin for controlling motor power
const int homeSensorPin1 = 7; // Pin for home sensor1
const int homeSensorPin2 = 8; // Pin for home sensor2
const int motionSensorPin = A0; // Analog pin for motion sensor
const int irLedPin = 12;      // Pin for infrared LED

// Flags and Variables
bool motorRunning = false;      // Flag to track motor state
bool homeSensorTriggered = false; // Flag for home sensor trigger
unsigned long lastPrintTime = 0;  // Time of the last motion sensor print
const unsigned long printInterval = 100; // Print every 100 milliseconds
const unsigned long positionInterval = 100; // Send position every 100 milliseconds

unsigned long delayValue = 1000; // Initial delay in microseconds
float currentPosition = -10.0;      // Current position in cm
float targetPosition = -10.0;       // Target position in cm
const float home = -10.0;         // Home position at -10 cm

void setup() {
  Serial.begin(9600);             // Initialize serial communication
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(onOffPin, OUTPUT);
  pinMode(homeSensorPin1, INPUT_PULLUP); // Assuming the sensor is active low
  pinMode(homeSensorPin2, INPUT_PULLUP); // Assuming the sensor is active low
  pinMode(irLedPin, OUTPUT);      // Initialize the IR LED pin

  digitalWrite(onOffPin, LOW);    // Start with the motor power OFF
  digitalWrite(irLedPin, HIGH);   // Turn on the infrared LED
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    
    if (command.startsWith("U")) { // Move motor up
      if (currentPosition > home) { // Allow moving up only if not at home
        digitalWrite(dirPin, HIGH);  // Set direction to up
        targetPosition = home;
        motorRunning = true;         // Set flag to true
        digitalWrite(onOffPin, HIGH); // Power ON the motor
      } else {
        Serial.println("Cannot move up; at home position.");
      }
    } else if (command.startsWith("D")) { // Move motor down
      digitalWrite(dirPin, LOW); // Set direction to down
      targetPosition = 150.0;
      motorRunning = true;         // Set flag to true
      digitalWrite(onOffPin, HIGH); // Power ON the motor
    } else if (command.startsWith("P")) { // Stop motor
      motorRunning = false;        // Set flag to false
      digitalWrite(onOffPin, LOW); // Power OFF the motor
    } else if (command.startsWith("S")) { // Set delay
      int newDelay = command.substring(1).toInt(); // Extract the delay value
      if (newDelay > 0) {
        delayValue = newDelay; // Update the delay variable
        Serial.print("Delay set to: ");
        Serial.println(delayValue);
      }
    } else if (command.startsWith("w")) { // Request current position
      Serial.print("Current Position: ");
      Serial.println(currentPosition);
    } else if (command.startsWith("T")) { // Request target position
      Serial.print("Target Position: ");
      Serial.println(targetPosition);
    } else if (command.startsWith("M")) { // Move to target position
      targetPosition = command.substring(1).toFloat(); // Get the target position
      motorRunning = true; // Start moving to target
      digitalWrite(onOffPin, HIGH); // Power ON the motor
      updateDirection(); // Update direction based on target position
    } else if (command.startsWith("Z")) { // Reset position to -10 cm
      int newPos = command.substring(1).toInt(); // Extract the delay value
      currentPosition = newPos;       // Set current position to newPos
      targetPosition = newPos;        // Set target position to newPos
      motorRunning = false;         // Stop the motor
      digitalWrite(onOffPin, LOW);  // Power OFF the motor
      Serial.println("Position reset to -10 cm");
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
  if (currentMillis - lastPrintTime >= printInterval) {
    lastPrintTime = currentMillis;
    int motionSensorValue = analogRead(motionSensorPin);
    Serial.print("Motion Sensor Value: ");
    Serial.println(motionSensorValue);
  }

  // Send current position every 100 ms
  static unsigned long lastPositionTime = 0;
  if (currentMillis - lastPositionTime >= positionInterval) {
    lastPositionTime = currentMillis;
    Serial.print("Current Position: ");
    Serial.println(currentPosition);
  }

  // If the motor is running, perform stepping and update position
  if (motorRunning) {
    // Step the motor
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(delayValue);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(delayValue);
    
    // Update the current position based on speed
    if (digitalRead(dirPin) == HIGH) {
      currentPosition -= (5805.38 / delayValue) * (delayValue / 1000000.0); // Moving up decreases position
    } else {
      currentPosition += (5805.38 / delayValue) * (delayValue / 1000000.0); // Moving down increases position
    }

    // Only check target position if we are in M command mode
    if (targetPosition != currentPosition) {
      checkTargetPosition();
    }
    
    // Stop the motor if the home position is reached
    if (currentPosition <= home) {
      currentPosition = home;      // Ensure current position does not go below home
      motorRunning = false;        // Stop motor
      digitalWrite(onOffPin, LOW); // Power OFF the motor
      Serial.println("Reached Home Position");
    }
  }
}

void checkTargetPosition() {
  // Stop motor if the target position is reached
  if ((digitalRead(dirPin) == LOW && currentPosition > targetPosition) ||
      (digitalRead(dirPin) == HIGH && currentPosition < targetPosition)) {
    motorRunning = false;        // Stop motor
    digitalWrite(onOffPin, LOW); // Power OFF the motor
    Serial.println("Reached Target Position");
  }
}

void updateDirection() {
  // Determine direction based on target position
  if (targetPosition > currentPosition) {
    digitalWrite(dirPin, LOW);   // Set direction to down
  } else if (targetPosition < currentPosition) {
    digitalWrite(dirPin, HIGH);  // Set direction to up
  }
}
