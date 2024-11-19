const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline'); // Updated parser import

const app = express();
const port = 3000;

let currentStatus = 'Not home';
const motionSensorData = [];

// Initialize serial port
const serialPort = new SerialPort({
  path: 'COM8', // Update this to your actual port
  baudRate: 9600
});

// Initialize parser with the serial port
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// Handle incoming data
parser.on('data', (data) => {
  const message = data.toString().trim();
  console.log(`Received from Arduino: ${message}`);
  
  if (message.startsWith('Motion Sensor Value:')) {
    const sensorValue = message.split(':')[1].trim();
    motionSensorData.push(Number(sensorValue)); // Convert to Number for better handling
    
    // Keep only the last 100 data points
    if (motionSensorData.length > 100) {
      motionSensorData.shift();
    }
  } else if (message === 'H') {
    currentStatus = 'Reached home';
  } else if (message === 'N') {
    currentStatus = 'Not home';
  }
});

// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static('public'));

// Handle motor control commands
app.get('/motor/:action', (req, res) => {
  const action = req.params.action;

  if (action === 'start') {
    serialPort.write('S\n', (err) => {
      if (err) {
        return res.status(500).send('Failed to start motor');
      }
      res.send('Motor started');
    });
  } else if (action === 'stop') {
    serialPort.write('P\n', (err) => {
      if (err) {
        return res.status(500).send('Failed to stop motor');
      }
      res.send('Motor stopped');
    });
  } else if (action === 'changeDirection') {
    serialPort.write('D\n', (err) => {
      if (err) {
        return res.status(500).send('Failed to change direction');
      }
      res.send('Motor direction changed');
    });
  } else {
    res.status(400).send('Invalid action');
  }
});

// Provide current status
app.get('/status', (req, res) => {
  res.send(currentStatus);
});

// Provide motion sensor data
app.get('/motion-data', (req, res) => {
  res.json(motionSensorData);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
