const express = require('express');
const { SerialPort } = require('serialport'); // Updated import
const app = express();
const port = 3000;

// Variable to hold the current status
let currentStatus = 'Not home';

// Set up the serial port (adjust the path to your Arduino's COM port)
const serialPort = new SerialPort({
  path: 'COM8', // Replace 'COM#' with your actual COM port
  baudRate: 9600
});

app.use(express.static('public')); // Serve static files from the 'public' directory

app.get('/motor/:action', (req, res) => {
  const action = req.params.action;

  if (action === 'start') {
    serialPort.write('S'); // Send command to start motor
    res.send('Motor started');
  } else if (action === 'stop') {
    serialPort.write('P'); // Send command to stop motor
    res.send('Motor stopped');
  } else if (action === 'changeDirection') {
    serialPort.write('D'); // Send command to change direction
    res.send('Motor direction changed');
  } else {
    res.status(400).send('Invalid action');
  }
});

app.get('/status', (req, res) => {
  res.send(currentStatus);
});


// Read from serial port and update status based on received data
serialPort.on('data', (data) => {
  const message = data.toString().trim();
  console.log(`Received from Arduino: ${message}`);
  if (message === 'H') {
    currentStatus = 'Reached home';
  } else if (message === 'N'){
    currentStatus = 'Not home';
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
