import React, { useState, useEffect } from 'react';
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import LensIcon from '@material-ui/icons/Lens';
import { green, red, orange } from "@material-ui/core/colors";
import axios from 'axios';
import InputLabel from "@material-ui/core/InputLabel";
import Input from "@material-ui/core/Input";
import MotionSensorGraph from './MotionSensorGraph';

const MotorTab = () => {
  // Set values
  const onStyle = { color: green[500] };
  const offStyle = { color: red[500] };
  const orangeStyle = { color: orange[500] };

  // Setting the initial values and their corresponding functions to change the values
  const [currentSourcePosition, setCurrentSourcePosition] = useState(0);
  const [currentDirection, setCurrentDirection] = useState('CounterClockWise');
  const [currentMotorControlEnabled, setCurrentMotorControlEnabled] = useState('OFF');
  const [currentOverrideStatus, setCurrentOverrideStatus] = useState('OFF');
  const [currentSignal, setCurrentSignal] = useState(0);
  const [chartData, setChartData] = useState(new Array(100).fill(null));
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGraphVisible, setIsGraphVisible] = useState(true);
  const [isChainDetected, setIsChainDetected] = useState(false);

  // States for sensor status
  const [pushbuttonPressed, setPushbuttonPressed] = useState(false);
  const [rightSensorPressed, setRightSensorPressed] = useState(false);
  const [leftSensorPressed, setLeftSensorPressed] = useState(false);

  // Fetch data from the server
  const fetchData = async () => {
    try {
      const sourcePositionResponse = await axios.get('http://localhost:5001/get_source_position');
      setCurrentSourcePosition(sourcePositionResponse.data.sourcePosition);

      const directionResponse = await axios.get('http://localhost:5001/get_direction_status');
      setCurrentDirection(directionResponse.data.direction);

      const enabledValueResponse = await axios.get('http://localhost:5001/get_enabled_value');
      setCurrentMotorControlEnabled(enabledValueResponse.data.motorControlEnabled);

      const signalResponse = await axios.get('http://localhost:5001/get_sensor_signal');
      setCurrentSignal(signalResponse.data.signal);

      const overrideStatusResponse = await axios.get('http://localhost:5001/get_override_status');
      setCurrentOverrideStatus(overrideStatusResponse.data.overrideOn);

      // Fetch sensor status
      const sensorsResponse = await axios.get('http://localhost:5001/get_sensor_status');
      setPushbuttonPressed(sensorsResponse.data.pushbuttonPressed);
      setRightSensorPressed(sensorsResponse.data.rightSensorPressed);
      setLeftSensorPressed(sensorsResponse.data.leftSensorPressed);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error);
    }
  };

  // Fetch initial data when the component mounts
  useEffect(() => {
    fetchData();
  }, []); // Empty array ensures the effect runs only once when the component mounts

  // Periodically fetch data every 100ms
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 100);
    return () => clearInterval(interval); // Cleanup the interval when the component unmounts
  }, [currentSignal]);

  // Timeout for resetting sensor states
  useEffect(() => {
    if (pushbuttonPressed) {
      const timer = setTimeout(() => {
        setPushbuttonPressed(false);
      }, 10000); // Reset after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [pushbuttonPressed]);

  useEffect(() => {
    if (rightSensorPressed) {
      const timer = setTimeout(() => {
        setRightSensorPressed(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [rightSensorPressed]);

  useEffect(() => {
    if (leftSensorPressed) {
      const timer = setTimeout(() => {
        setLeftSensorPressed(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [leftSensorPressed]);

  // Route to control motor
  const controlMotor = async (command, value) => {
    let url = `http://localhost:5001/control_motor?command=${command}`;

    if (value !== undefined) {
      url += `&value=${value}`;
    }

    try {
      const response = await axios.get(url);
      console.log(response.data);
      // Update state based on the response
      if (response.data.sourcePosition !== undefined) {
        setCurrentSourcePosition(response.data.sourcePosition);
      }
      if (response.data.direction !== undefined) {
        setCurrentDirection(response.data.direction);
      }
      if (response.data.motorControlEnabled !== undefined) {
        setCurrentMotorControlEnabled(response.data.motorControlEnabled);
      }
      if (response.data.overrideOn !== undefined) {
        setCurrentOverrideStatus(response.data.overrideOn);
      }
      if (response.data.signal !== undefined) {
        setCurrentSignal(response.data.signal);
      }
    } catch (error) {
      console.error('Error controlling motor:', error);
      setError(error);
    }
  };

  // Set RPM value
  const submitRPMValue = () => {
    const RPMValue = document.getElementById('RPMInput').value;
    controlMotor('setRPM', RPMValue);
  };

  // Reset to previous position
  const resetToPreviousPosition = async () => {
    try {
      const sourcePositionResponse = await axios.get('http://localhost:5001/reset_to_previous_position');
      setCurrentSourcePosition(sourcePositionResponse.data.sourcePosition);
    } catch (error) {
      console.error('Error resetting to previous position:', error);
      setError(error);
    }
  };

  // Handle password change
  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  // Handle password submit
  const handlePasswordSubmit = () => {
    if (password === 'Californium') {
      setIsAuthenticated(true);
    }
  };

  // Toggle graph visibility
  const toggleGraphVisibility = () => {
    setIsGraphVisible((prevIsGraphVisible) => !prevIsGraphVisible);
  };

  // JSX when the password has not been submitted
  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm">
        <Grid container spacing={1} direction="column" justifyContent="center" alignItems="center">
          <Grid item>
            <Typography variant="h4" align="center" gutterBottom>
              Enter Password
            </Typography>
          </Grid>
          <Grid item>
            <Input
              id="passwordInput"
              type="password"
              value={password}
              onChange={handlePasswordChange}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={handlePasswordSubmit}
            >
              Submit
            </Button>
          </Grid>
        </Grid>
      </Container>
    );
  }

  // JSX after the password is submitted
  return (
    <Container maxWidth="sm">
      <Grid container spacing={1} direction="column" justifyContent="center" alignItems="center">
        <Grid item>
          <Typography variant="h4" align="center" gutterBottom>
            Neutron Calibration System
          </Typography>
        </Grid>
        <Grid item>
          <Grid container spacing={1} direction="column" justifyContent="center" alignItems="center">
            <Grid container item xs={12} spacing={1}>
              <Grid item xs={1}>
                <LensIcon style={currentMotorControlEnabled === 'ON' ? onStyle : offStyle} />
              </Grid>
              <Grid item xs={11}>
                <ButtonGroup variant="contained" color="primary">
                  <Button onClick={() => controlMotor('start')}>Start Motor</Button>
                  <Button onClick={() => controlMotor('stop')}>Stop Motor</Button>
                  <Button onClick={() => controlMotor('changedirection')}>Change Direction</Button>
                </ButtonGroup>
              </Grid>
            </Grid>
            <Grid container item xs={12} spacing={1}>
              <Grid item xs={11}>
                <ButtonGroup variant="contained" color="primary">
                  <Button onClick={() => controlMotor('goToHousing')}>Send Source to Housing</Button>
                  <Button onClick={() => controlMotor('goToDetector')}>Send Source to Detector</Button>
                  <Button onClick={() => controlMotor('setPosZero')}>Set Position to 0</Button>
                  <Button onClick={resetToPreviousPosition}>Restore to Value From Data Log</Button>
                </ButtonGroup>
              </Grid>
            </Grid>
            <Grid container item xs={6} spacing={0}>
              <Grid item xs={6}>
                <InputLabel htmlFor="RPMInput">RPM (1.875-187.5):</InputLabel>
                <Input
                  id="RPMInput"
                  type="number"
                  name="RPM"
                  min="1.875"
                  max="187.5"
                />
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={submitRPMValue}
                >
                  Submit RPM
                </Button>
              </Grid>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Source Position: {currentSourcePosition} meters
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Current Direction: {currentDirection}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Motor Control: {currentMotorControlEnabled}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Override Status: {currentOverrideStatus}
              </Typography>
            </Grid>
            <Grid item>
              <Button id="overrideButton" variant="contained" color="primary" onClick={() => controlMotor('overrideOn')}>
                Override Mode:
              </Button>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Signal Value: {currentSignal}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="h8" align="center" gutterBottom>
                Chain Status: {isChainDetected ? 'Detected' : 'Not Detected'}
              </Typography>
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" onClick={toggleGraphVisibility}>
                Toggle Graph
              </Button>
            </Grid>
            {isGraphVisible && (
              <Grid item>
                <MotionSensorGraph />
              </Grid>
            )}

            {/* Display sensor statuses */}
            <Grid item>
              {pushbuttonPressed && (
                <Typography variant="h6" color="primary" align="center" gutterBottom>
                  Pushbutton Pressed
                </Typography>
              )}
            </Grid>

            <Grid item>
              {rightSensorPressed && (
                <Typography variant="h6" color="primary" align="center" gutterBottom>
                  Right Sensor triggered
                </Typography>
              )}
            </Grid>

            <Grid item>
              {leftSensorPressed && (
                <Typography variant="h6" color="primary" align="center" gutterBottom>
                  Left Sensor triggered
                </Typography>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Container>
  );
};

export default MotorTab;
