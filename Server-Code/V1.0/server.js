const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser'); // Ensure this is installed
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const winston = require('winston'); // Logging library

const app = express();
const port = process.env.PORT || 8900;
const serialPortPath = process.env.SERIAL_PORT || 'COM12';

let currentStatus = 'Deployed';
let currentPosition = null; 
let targetPosition = null; 
const motionSensorData = [];

// Initialize CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});

// Initialize serial port
const serialPort = new SerialPort({
  path: serialPortPath,
  baudRate: 9600
});

// Initialize parser with the serial port
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// Handle incoming data from Arduino
parser.on('data', (data) => {
  const message = data.toString().trim();
  logger.info(`Received from Arduino: ${message}`);

  if (message.startsWith('Motion Sensor Value:')) {
    const sensorValue = message.split(':')[1].trim();
    motionSensorData.push(Number(sensorValue));

    if (motionSensorData.length > 100) {
      motionSensorData.shift();
    }
  } else if (message === 'H') {
    currentStatus = 'Home'; 
  } else if (message === 'N') {
    currentStatus = 'Deployed'; 
  } else if (message.startsWith('Current Position:')) {
    currentPosition = Number(message.split(':')[1].trim());
  } else if (message.startsWith('Target Position:')) {
    targetPosition = Number(message.split(':')[1].trim());
  }
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Motor control commands
app.post('/motor/:action', (req, res) => {
  const action = req.params.action;

  const motorCommands = {
    up: 'U\n',
    down: 'D\n',
    stop: 'P\n',
  };

  if (motorCommands[action]) {
    serialPort.write(motorCommands[action], (err) => {
      if (err) {
        logger.error('Failed to communicate with motor:', err);
        return res.status(500).send('Failed to start motor');
      }
      res.send(`Motor going ${action.charAt(0).toUpperCase() + action.slice(1)}`);
    });
  } else {
    res.status(400).send('Invalid action');
  }
});

// Set motor position
app.post('/motor/action/:position', (req, res) => {
  const position = parseFloat(req.params.position);

  // Validate the position
  if (isNaN(position)) {
    return res.status(400).send('Invalid position value. Position must be a number.');
  }

  // Clamping the position within bounds
  const clampedPosition = Math.min(Math.max(position, -10), 150);

  serialPort.write(`M${clampedPosition}\n`, (err) => {
    if (err) {
      logger.error('Error writing to serial port:', err);
      return res.status(500).send('Failed to set motor position');
    }
    currentPosition = clampedPosition; // Update current position
    logger.info(`Motor position set to: ${clampedPosition}`);
    res.send(`Motor position set to ${clampedPosition}`);
  });
});

// Reset position to -10 cm
app.post('/reset', (req, res) => {
    const { command } = req.body; // Expecting command in the format 'Z<number>'

    // Validate the command
    if (typeof command !== 'string' || !command.startsWith('Z')) {
        return res.status(400).send('Invalid command format. Command should start with "Z".');
    }

    // Write the command to the serial port
    serialPort.write(`${command}\n`, (err) => {
        if (err) {
            logger.error('Failed to reset position:', err);
            return res.status(500).send('Failed to reset position');
        }

        // Optionally, you can update the current and target position based on the command
        const newPosition = parseFloat(command.slice(1)); // Extract the number from the command
        if (newPosition >= -10 && newPosition <= 150) {
            currentPosition = newPosition; 
            targetPosition = newPosition; 
            logger.info(`Position reset to ${newPosition} cm`);
            res.send(`Position reset to ${newPosition} cm`);
        } else {
            logger.warn('Reset command received with an out-of-bounds value:', newPosition);
            res.status(400).send('Reset value must be between -10 and 150 cm');
        }
    });
});

// Retrieve current position
app.get('/motor/current-position', (req, res) => {
  if (currentPosition !== null) {
    res.send(`Current Position: ${currentPosition} cm`);
  } else {
    res.status(404).send('Current position not available');
  }
});

// Set motor delay
app.post('/delay', (req, res) => {
  const { delay } = req.body;

  // Validate the delay
  if (typeof delay !== 'number' || delay <= 0) {
    return res.status(400).send('Invalid delay value. Delay must be a positive number.');
  }

  // Send the delay command to the Arduino
  serialPort.write(`S${delay}\n`, (err) => {
    if (err) {
      logger.error('Error writing to serial port:', err);
      return res.status(500).send('Failed to set motor delay');
    }
    logger.info(`Motor delay set to: ${delay}`);
    res.send(`Motor delay set to ${delay}`);
  });
});

// Retrieve target position
app.get('/motor/target-position', (req, res) => {
  if (targetPosition !== null) {
    res.send(`Target Position: ${targetPosition} cm`);
  } else {
    res.status(404).send('Target position not available');
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

// Handle cleanup on exit
const cleanup = () => {
  serialPort.close().then(() => {
    logger.info('Serial port closed.');
    process.exit(0);
  }).catch((err) => {
    logger.error('Error closing serial port:', err);
    process.exit(1);
  });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
