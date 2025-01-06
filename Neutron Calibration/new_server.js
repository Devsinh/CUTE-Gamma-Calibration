const express = require('express');
const http = require('http');
const { Server } = require('ws');
const WebSocket = require('ws'); // Add this line

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

const port = new SerialPort({ path: '/dev/tty.usbmodem8301', baudRate: 9600 });  // change to serial port used by Arduino
// Initialize Parser
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

// Assign all initial values of motor
let currentStepCount = 0;
let currentSourcePosition = 0;
let currentDirection = 'CounterClockWise';
let currentOverrideStatus = 'OFF';
let currentRPMValue = 0;
let currentMotorControlEnabled = 'OFF';
let currentSignal = 0;

let clientSocket; // Define a variable to store the WebSocket connection
// Route to handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    // Assign the WebSocket connection to the clientSocket variable
    clientSocket = ws;

    // Send initial data to the client
    ws.send(JSON.stringify({
        sourcePosition: currentSourcePosition,
        direction: currentDirection,
        overrideOn: currentOverrideStatus,
        RPMValue: currentRPMValue,
        motorControlEnabled: currentMotorControlEnabled,
        signal: currentSignal
    }));

    // Handle messages from the client
    ws.on('message', (message) => {
        console.log('Received message:', message);
        try {
            const { command, value } = JSON.parse(message); // Destructure both command and value from the incoming message
            if (command === 'setRPM' && value !== undefined) {
                // The RPM command requires the value to be sent to the Arduino.
                const rpmCommand = `setRPM ${value}`;
                port.write(rpmCommand + '\n', (err) => {
                    if (err) {
                        console.error('Error sending RPM command to Arduino:', err);
                    } else {
                        console.log('RPM command sent to Arduino:', rpmCommand);
                    }
                });
            } else {
                // Handle other commands that don't require additional value.
                port.write(command + '\n', (err) => {
                    if (err) {
                        console.error('Error sending command to Arduino:', err);
                    } else {
                        console.log('Command sent to Arduino:', command);
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle WebSocket closure
    ws.on('close', () => {
        console.log('Client disconnected');
        // Clear the clientSocket variable when the client disconnects
        clientSocket = null;
    });
});
// Continuous data streaming
setInterval(() => {
    sendDataToClient();
}, 100); // Adjust interval as needed

function sendDataToClient() {
    // Construct data object with updated values
    const dataToSend = {
        sourcePosition: currentSourcePosition,
        direction: currentDirection,
        overrideOn: currentOverrideStatus,
        RPMValue: currentRPMValue,
        motorControlEnabled: currentMotorControlEnabled,
        signal: currentSignal
    };

    // Send data to all connected clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(dataToSend));
        }
    });
}

// Function to handle incoming sensor data
function sendSensorDataToClients(sensorType, data) {
    const dataToSend = {
        sourcePosition: currentSourcePosition,
        direction: currentDirection,
        overrideOn: currentOverrideStatus,
        RPMValue: currentRPMValue,
        motorControlEnabled: currentMotorControlEnabled,
        signal: currentSignal,
        [sensorType]: data  // Send sensor-specific data dynamically
    };

    // Send data to all connected clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(dataToSend));
        }
    });
}

// Parses data depending on the incoming data line
parser.on('data', (line) => {
    console.log('Received data from Arduino:', line);

    // Handle Push Button press status
    if (line.includes("Push Button Pressed")) {
        const pushButtonStatus = "Pressed";
        sendSensorDataToClients('pushButton', pushButtonStatus);  // Send push button status to all clients
    }

    // Handle left sensor (Induction Sensor 1) trigger status
    if (line.includes("Left Sensor Triggered")) {
        const parts = line.split(',');  // Split by comma to extract sensor data
        const voltage1 = parseFloat(parts[1].trim()); // Extract voltage of left sensor
        const sensorStatus = "Triggered";
        sendSensorDataToClients('leftSensor', { status: sensorStatus, voltage: voltage1 });  // Send left sensor status to all clients
    }

    // Handle right sensor (Induction Sensor 2) trigger status
    if (line.includes("Right Sensor Triggered")) {
        const parts = line.split(',');  // Split by comma to extract sensor data
        const voltage2 = parseFloat(parts[1].trim()); // Extract voltage of right sensor
        const sensorStatus = "Triggered";
        sendSensorDataToClients('rightSensor', { status: sensorStatus, voltage: voltage2 });  // Send right sensor status to all clients
    }

    // Handle step count
    if (line.startsWith('stepCount:')) {
        currentStepCount = parseInt(line.split('stepCount:')[1]);
    }

    // Handle sourcePosition
    if (line.startsWith('sourcePosition:')) {
        if (currentMotorControlEnabled === 'ON') {
            currentSourcePosition = parseFloat(line.split('sourcePosition:')[1]);
            logData(currentSourcePosition, currentDirection, currentRPMValue, currentMotorControlEnabled); // Log the updated sourcePosition
        } else if (currentMotorControlEnabled === 'OFF') {
            currentSourcePosition = parseFloat(line.split('sourcePosition:')[1]);
        }
    }

    // Handle direction status
    if (line.startsWith('direction:')) {
        currentDirection = line.split('direction:')[1].trim(); // This will be either 'ClockWise' or 'CounterClockWise'
    }

    // Handle motorControlEnabled status
    if (line.startsWith('motorControlEnabled:')) {
        currentMotorControlEnabled = line.split('motorControlEnabled:')[1].trim(); // This will be either 'ON' or 'OFF'
    }

    // Handle override status
    if (line.startsWith('overrideOn:')) {
        currentOverrideStatus = line.split('overrideOn:')[1].trim(); // This will be either 'ON' or 'OFF'
    }

    // Handle signal status
    if (line.startsWith('signal:')) {
        currentSignal = parseFloat(line.split('signal:')[1]);
    }

});

// Function to write the current source position to a txt file in this folder, will create a new file if one is not already created
function logData(sourcePosition, direction, RPMValue, motorControlEnabled) {
    const filePath = './DataLog.txt';
    const now = new Date();
    const logEntry = `${now.toISOString()}: direction=${direction}, RPMValue=${RPMValue}, onOffValue=${motorControlEnabled}, sourcePosition=${sourcePosition}\n`;

    fs.appendFile(filePath, logEntry, (err) => {
        if (err) {
            console.error('Error writing to file', err);
        }
    });
}

// Start the WebSocket server
server.listen(3600, () => {
    console.log('Neutron Calibration WebSocket server started on http://localhost:3600');
});
