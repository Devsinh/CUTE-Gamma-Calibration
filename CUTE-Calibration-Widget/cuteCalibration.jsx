import React, { useState, useEffect, useRef } from 'react';
import { Grid, Button, OutlinedInput, makeStyles, Typography } from '@material-ui/core';
import { StyledMovementSlider } from './sliderStyles/sStyle.jsx';
import { Line } from 'react-chartjs-2';
import { InputAdornment } from '@material-ui/core';
import KeyboardArrowLeftIcon from '@material-ui/icons/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight';
import NotInterestedIcon from '@material-ui/icons/NotInterested';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const useStyles = makeStyles((theme) => ({
    button: {
        margin: theme.spacing(1),
        width: 100,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
    },
    graphContainer: {
        width: '100%',
        height: '400px',
        marginTop: theme.spacing(2),
    },
    displayContainer: {
        width: '140px',
        height: '50px',
        backgroundColor: '#f9f9f9',
        textAlign: 'center',
    },
    indicator: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: (props) => (props.status === 'Deployed' ? 'lightcoral' : 'lightgreen'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing(1),
    },
    text: {
        fontSize: '0.7rem',
        textAlign: 'center',
    },
}));

const DataDisplay = ({ data }) => {
    const smallGraphData = {
        labels: Array.from({ length: data.length }, (_, i) => i + 1),
        datasets: [{
            label: 'Recent Data',
            data: data,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
        }],
    };

    return (
        <Line
            data={smallGraphData}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { display: false },
                    y: { display: false,
                         min: 0,
                         max: 1000, },
                },
                plugins: {
                    legend: { display: false },
                },
            }}
            style={{ height: '100%', width: '100%' }} // Set to full height           
        />
    );
};

function CalibrationSlider() {
    const [homeStatus, setHomeStatus] = useState('Deployed');
    const classes = useStyles({ status: homeStatus });
    const [sliderValue, setSliderValue] = useState(-10);
    const [showGraph, setShowGraph] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newPosition, setNewPosition] = useState('');
    const [graphData, setGraphData] = useState({
        labels: [],
        datasets: [{
            label: 'Motion Sensor Values',
            data: [],
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
        }],
    });
    const [latestData, setLatestData] = useState([]);
    const [delay, setDelay] = useState(5.8);
    const [actionInterval, setActionInterval] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch('http://localhost:8900/status');
                const status = await response.text();
                if (isMounted.current) setHomeStatus(status);
            } catch (error) {
                console.error('Error fetching status:', error);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 100);
        return () => {
            clearInterval(interval);
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        const fetchSmallGraphData = async () => {
            try {
                const response = await fetch('http://localhost:8900/motion-data');
                const data = await response.json();
                const smallLimitedData = data.slice(-30);
                if (isMounted.current) setLatestData(smallLimitedData);
            } catch (error) {
                console.error('Error fetching motion data:', error);
            }
        };

        fetchSmallGraphData();
        const intervalId = setInterval(fetchSmallGraphData, 100);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        let bigGraphIntervalId;
        const fetchBigGraphData = async () => {
            try {
                const response = await fetch('http://localhost:8900/motion-data');
                const data = await response.json();
                const limitedData = data.slice(-50);
                if (isMounted.current) {
                    setGraphData({
                        labels: Array.from({ length: limitedData.length }, (_, i) => ((i + 1)*0.1).toFixed(1)),// Labels from 0.1 to 5
                        datasets: [{
                            label: 'Motion Sensor Values',
                            data: limitedData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: true,
                        }],
                        options: {
                           layout: {
                               padding: {
                                 right: 40 // Adjust this value to your liking
                                          }
                                    }
                              }
                    });
                }
            } catch (error) {
                console.error('Error fetching motion data for big graph:', error);
            }
        };

        if (showGraph) {
            fetchBigGraphData();
            bigGraphIntervalId = setInterval(fetchBigGraphData, 100);
        }

        return () => {
            clearInterval(bigGraphIntervalId);
        };
    }, [showGraph]);

    const [isInputVisible, setIsInputVisible] = useState(false);
    const [resetInput, setResetInput] = useState('');

    const handleResetInputChange = (event) => {
        const value = event.target.value === '' ? '' : Number(event.target.value);
        setResetInput(value);
    };

    const handleResetSubmit = async () => {
        const value = parseFloat(resetInput);
        if (!isNaN(value) && value >= -10 && value <= 150) {
            await handleResetCommand(value);
            setResetInput('');
            setIsInputVisible(false);
        } else {
            console.warn('Input must be a number between -10 and 150.');
        }
    };

    const handleResetCommand = async (input) => {
        try {
            const response = await fetch('http://localhost:8900/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: `Z${input}` }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            console.log(`Reset command sent successfully: Z${input}`);
        } catch (error) {
            console.error('Error sending reset command:', error.message);
        }
    };

    const fetchCurrentPosition = async () => {
        try {
            const response = await fetch('http://localhost:8900/motor/current-position');
            if (!response.ok) throw new Error('Network response was not ok');
            const positionText = await response.text();
            const positionValue = parseFloat(positionText.split(': ')[1]);
            if (isMounted.current) {
                setSliderValue(positionValue);
                setCurrentPosition(positionValue);
            }
        } catch (error) {
            console.error('Error fetching current position:', error);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchCurrentPosition, 100);
        return () => clearInterval(interval);
    }, []);

    const updateMotorPosition = async (position) => {
        try {
            if (typeof position !== 'number') {
                throw new Error('Position must be a number.');
            }

            const url = `http://localhost:8900/motor/action/${position}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            setSliderValue(position);
        } catch (error) {
            console.error('Error sending motor command:', error.message);
        }
    };

    const handleSliderChange = (event, newValue) => {
        setSliderValue(newValue);
        updateMotorPosition(newValue);
    };

    const handleCurrentPositionClick = () => {
        setIsEditing(true);
    };

    const handleInputChange = (event) => {
        let newValue = event.target.value === '' ? '' : Number(event.target.value);
        newValue = Math.min(Math.max(newValue, -10), 150);
        setNewPosition(event.target.value);
    };

    const handleSubmit = async () => {
        const positionValue = parseFloat(newPosition);
        if (!isNaN(positionValue)) {
            await updateMotorPosition(positionValue);
            setCurrentPosition(positionValue);
        }
        setIsEditing(false);
    };

    const handleDelayChange = (event) => {
        setDelay(event.target.value);
    };

    const handleSetDelay = async () => {
        const delayValue = Number(delay);
        if (delayValue <= 0) {
            console.warn('Delay must be greater than zero');
            return;
        }

        const modifiedDelay = 5805.38 / delayValue;
        if (modifiedDelay < 50 || modifiedDelay > 4000) {
            console.warn('Modified delay must be between 50 and 4000');
            return;
        }

        try {
            await fetch('http://localhost:8900/delay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delay: modifiedDelay }),
            });
            console.log(`Delay set to: ${modifiedDelay}`);
        } catch (error) {
            console.error('Error setting delay:', error);
        }
    };

    const handleMotorAction = async (action) => {
        try {
            const response = await fetch(`http://localhost:8900/motor/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const message = await response.text();
            console.log(message);
        } catch (error) {
            console.error(`Error ${action} motor:`, error);
        }
    };

    const handleMouseDown = (action) => {
        handleMotorAction(action);
        const intervalId = setInterval(() => handleMotorAction(action), 50);
        return intervalId;
    };

    const handleResetHomeValue = () => {
        updateMotorPosition(-10);
    };

    return (
        <Grid container direction="column" alignItems="center">
            <Grid item container alignItems="center" style={{ marginTop: '10px',marginLeft: '0px' }}>
                <div className={classes.indicator} >
                </div>
               <Typography variant="body2" className={classes.text} style={{ marginBottom: '58px', position: 'absolute', left: '558px', fontSize: '15px' }}>
                  {homeStatus === 'Deployed' ? 'Deployed' : 'Home'}
               </Typography>
                <Grid container alignItems="center" justify="center" style={{ flexGrow: 1 }}>
                    <StyledMovementSlider
                        order="flipped"
                        value={sliderValue}
                        orientation="horizontal"
                        aria-labelledby="range-slider"
                        onChange={handleSliderChange}
                        step={0.1}
                        min={-10}
                        max={150}
                        valueLabelDisplay="auto"
                        marks={[...Array(17).keys()].map(i => ({ value: i * 10 - 10, label: `${i * 10 - 10} cm` }))}
                    />
                    <div className={classes.displayContainer} onClick={handleCurrentPositionClick}style={{ marginTop: '10px', backgroundColor: 'white' }}>
                        {currentPosition !== null ? `${currentPosition} cm` : 'Loading...'}
                    </div>
                        <OutlinedInput
                            value={newPosition}
                            type="number"
                            onChange={handleInputChange}
                            style={{ marginLeft: '-10px', width: '180px' }}
                            endAdornment={
                                <Button onClick={handleSubmit} color="primary">
                                    Set
                                </Button>
                            }
                        />
                </Grid>
            </Grid>

            <Grid container alignItems="center" spacing={2} style={{ marginTop: '20px' }}>
    <Grid item xs={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Typography variant="caption" style={{ marginRight: '5px' }}>
            Speed in cm/s
        </Typography>
        <OutlinedInput
            className="delay_input"
            value={delay}
            type="number"
            onChange={handleDelayChange}
            size='small'
            style={{ width: '140px', height: '42px' }}
            endAdornment={
                <Button onClick={handleSetDelay} color="primary">
                    Set
                </Button>
            }
        />
    </Grid>

    <Grid item xs={4} container justify="space-evenly">
        <Grid item>
            <Button className={classes.button} variant="outlined" color="primary"
                startIcon={<KeyboardArrowLeftIcon />}
                onMouseDown={() => {
                    const intervalId = handleMouseDown('up');
                    setActionInterval(intervalId);
                }}
                onMouseUp={() => clearInterval(actionInterval)}>
                Up
            </Button>
        </Grid>
        <Grid item>
            <Button className={classes.button} variant="contained" color="primary"
                startIcon={<NotInterestedIcon />}
                onClick={() => handleMotorAction('stop')}>
                Stop
            </Button>
        </Grid>
        <Grid item>
            <Button className={classes.button} variant="outlined" color="primary"
                endIcon={<KeyboardArrowRightIcon />}
                onMouseDown={() => {
                    const intervalId = handleMouseDown('down');
                    setActionInterval(intervalId);
                }}
                onMouseUp={() => clearInterval(actionInterval)}>
                Down
            </Button>
        </Grid>
    </Grid>

    <Grid item xs={4} style={{ textAlign: 'right', height: '60px', width: '150px', display: 'flex', marginBottom: '10px' }}>
        <div className={classes.displayContainer} style={{ height: '60px', width: '150px' }}>
            <DataDisplay data={latestData} />
        </div>
    </Grid>
</Grid>



            <Grid item container justify="center" spacing={2} style={{ marginTop: '20px', marginLeft: '10px', marginBottom: '10px' }}>
                    <Button className={classes.button} variant="contained" color="primary" onClick={() => setShowGraph(!showGraph)}>
                        {showGraph ? 'Hide Graph' : 'Show Graph'}
                    </Button>
                <Button className={classes.button} variant="contained" color="primary" onClick={handleResetHomeValue}>
                    Send home
                </Button>
                <Button className={classes.button} variant="contained" color="primary" onClick={() => setIsInputVisible(!isInputVisible)}>
                    Set Position
                </Button>
            </Grid>

            {isInputVisible && (
                <Grid item>
                    <OutlinedInput
                        value={resetInput}
                        type="number"
                        onChange={handleResetInputChange}
                        style={{ margin: '20px', width: '180px' }}
                        endAdornment={
                            <Button onClick={handleResetSubmit} color="primary">
                                Send
                            </Button>
                        }
                    />
                </Grid>
            )}

            {showGraph && (
                <Grid item className={classes.graphContainer}>
                    <Line
                        data={graphData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: false,
                            layout: {
                    padding: {
                        right: 20, // Adjust the right padding as needed
                    },
                },
                            scales: {
                                x: {
                                    title: { display: true, text: 'Time (seconds)' },
                                    },
                                y: {
                                    title: { display: true, text: 'Sensor Value' },
                                     min: 0,  // Set the minimum value of the Y-axis
                                    max: 1000,  // Set the maximum value of the Y-axis
                                },
                            },
                        }}
                    />
                </Grid>
            )}
        </Grid>
    );
}

export default function CalibrationControl(props) {
    return <CalibrationSlider ws={props.calibWebSock} displayState={props.displayState} />;
}
