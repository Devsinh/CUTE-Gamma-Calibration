const express = require('express'); // Import for express
const { SerialPort } = require('serialport'); // Import for SerialPort
const { ReadlineParser } = require('@serialport/parser-readline'); // Import for ReadlineParser
 
// Initialize a new Express application instance
const app = express();
 
// Create a file system module instance
const fs = require('fs');
 
// Initialize SerialPort
const port = new SerialPort({ path: 'COM7', baudRate: 9600 });
 
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
 
// Variables to store sensor data
let rightSensorStatus = null;  // Right induction sensor status
let leftSensorStatus = null;   // Left induction sensor status
let pushButtonStatus = null;   // Push button status
 
// Serve static files from 'public' folder
app.use(express.static('public'));
 
// Route to handle motor control commands
app.get('/control_motor', (req, res) => {
    const command = req.query.command;
    let arduinoCommand = command;
 
    // Check if a value is provided for RPM
    if (command === "setRPM" && req.query.value) {
        arduinoCommand += " " + req.query.value;
        currentRPMValue = parseInt(req.query.value, 10);
    }
 
    port.write(arduinoCommand + '\n', (err) => {
        if (err) {
            return res.status(500).send('Error on write: ' + err.message);
        }
        res.send('Command sent to Arduino: ' + arduinoCommand);
    });
});
 
// Route to get the motion sensor signal value stored on the Arduino to use in index.html
app.get('/get_sensor_signal', (req, res) => {
    res.send({ signal: currentSignal });
});
 
// Route to get the source position stored on the Arduino to use in index.html
app.get('/get_source_position', (req, res) => {
    res.send({ sourcePosition: currentSourcePosition });
});
 
// Route to get the direction status stored on the Arduino to use in index.html 
app.get('/get_direction_status', (req, res) => {
    res.send({ direction: currentDirection });
});
 
// Route to get the override status stored on the Arduino to use in index.html  
app.get('/get_override_status', (req, res) => {
    res.send({ overrideOn: currentOverrideStatus });
});
 
// Route to get the RPM value stored on the Arduino to use in index.html 
app.get('/get_RPM_value', (req, res) => {
    res.send({ RPMValue: currentRPMValue });
});
 
// Route to get the motor control enable value stored in the Arduino to use in index.html
app.get('/get_enabled_value', (req, res) => {
    res.send({ motorControlEnabled: currentMotorControlEnabled });
});
 
// Route to get the sensor information
app.get('/get_sensor_info', (req, res) => {
    res.send({
        rightSensorStatus: rightSensorStatus,
        leftSensorStatus: leftSensorStatus,
        pushButtonStatus: pushButtonStatus
    });
});
 
// Route to get the last saved position stored in the DataLog.txt file
app.get('/reset_to_previous_position', (req, res) => {
    const filePath = './DataLog.txt';
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return res.status(500).send('Error reading log file');
        }
        const lines = data.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const match = lastLine.match(/sourcePosition=([\d.]+)/);
        if (match && match[1]) {
            const sourcePosition = parseFloat(match[1]);
            currentSourcePosition = sourcePosition;
            const command = `setSourcePosition ${sourcePosition}`;
            port.write(command + '\n', (err) => {
                if (err) {
                    console.error('Failed to send command to Arduino', err);
                    return res.status(500).send('Error on write: ' + err.message);
                }
                res.send({ sourcePosition: currentSourcePosition });
            });
        } else {
            res.status(404).send('No source position found in log');
        }
    });
});
 
// Open server on port 3000
app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
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
 
// Parses data depending on the incoming data line
parser.on('data', line => {
    // Handle step count
    if (line.startsWith("stepCount:")) {
        currentStepCount = parseInt(line.split("stepCount:")[1]);
    }
 
    // Handle sourcePosition
    if (line.startsWith("sourcePosition:")) {
        if (currentMotorControlEnabled == 'ON') { // Only log the data when the motor is OFF
            currentSourcePosition = parseFloat(line.split("sourcePosition:")[1]);
            logData(currentSourcePosition, currentDirection, currentRPMValue, currentMotorControlEnabled); // Log the updated sourcePosition
        } else if (currentMotorControlEnabled == 'OFF') {
            currentSourcePosition = parseFloat(line.split("sourcePosition:")[1]);
        }
    }
 
    // Handle direction status
    if (line.startsWith("direction:")) {
        currentDirection = line.split("direction:")[1].trim(); // This will be either 'ClockWise' or 'CounterClockWise'
    }
 
    // Handle motorControlEnabled status
    if (line.startsWith("motorControlEnabled:")) {
        currentMotorControlEnabled = line.split("motorControlEnabled:")[1].trim(); // This will be either 'ON' or 'OFF'
    }
 
    // Handle override status
    if (line.startsWith("overrideOn:")) {
        currentOverrideStatus = line.split("overrideOn:")[1].trim(); // This will be either 'ON' or 'OFF'
    }
 
    // Handle signal status
    if (line.startsWith("signal:")) {
        currentSignal = parseFloat(line.split("signal:")[1]);
    }
 
    // Handle sensor data (Right, Left, Push Button)
    if (line.startsWith("Right Sensor Triggered:")) {
        rightSensorStatus = line.split(":")[1].trim();
    }
 
    if (line.startsWith("Left Sensor Triggered:")) {
        leftSensorStatus = line.split(":")[1].trim();
    }
 
    if (line.startsWith("Push Button Pressed:")) {
        pushButtonStatus = line.split(":")[1].trim();
    }
 
    // ... handle other data as needed
});

has context menu
