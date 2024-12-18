<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>CUTE: Neutron Calibration System</title> 
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style> /* All General Style for the Webapp */

      body {

        font-family: Arial, sans-serif;

        background-color: #f0f0f0;

        text-align: center;

        margin: 0;

        padding: 0;

      }

      h1 {

        color: #007bff;

        font-size: 36px;

        margin-top: 10px; 

        margin-bottom: 10px; 

      }

      button {

        background-color: blue;

        color: #fff;

        font-size: 24px;

        padding: 10px 20px;

        margin: 5px; 

        border: none;

        cursor: pointer;

        border-radius: 5px;

      }

      button:hover {

        background-color: #0056b3;

      }

      label {

        font-size: 20px;

        color: #333;

      }

      input[type="number"] {

        font-size: 20px;

        padding: 5px;

        width: 150px;

      }

      #submitRPM {

        font-size: 24px;

        background-color: #007bff;

        color: #fff;

        padding: 10px 20px;

        border: none;

        cursor: pointer;

        border-radius: 5px;

      }

      #submitRPM:hover {

        background-color: #0056b3;

      }

      p {

        font-size: 18px; 

        margin-top: 10px; 

        margin-bottom: 10px; 

      }

      span {

        font-weight: bold;

      }

    </style>

</head>

<body>

    <!-- Creating all the buttons and text on the Webapp -->

    <h1>CUTE: Neutron Calibration System</h1>

    <button onclick="controlMotor('start')">Start Motor</button>

    <button onclick="controlMotor('stop')">Stop Motor</button>

    <button onclick="controlMotor('changedirection')">Change Direction</button>

    <br>

    <button onclick="controlMotor('goToHousing')">Send Source to Housing</button>

    <button onclick="controlMotor('goToDetector')">Send Source to Detector</button>

    <button onclick="controlMotor('setPosZero')">Set Position to 0</button>

    <button onclick="resetToPreviousPosition()">Restore to Value From Data Log</button>

    <br>

    <label for="RPM">RPM (1.875-187.5):</label>

    <input type="number" id="RPMInput" name="RPM" min="1.875" max="187.5" />

    <button id="submitRPM" onclick="submitRPMValue()">Submit</button>

    <br>

    <p style="margin-top: 2cm;">Source Position: <span id="currentSourcePosition">0</span> meters</p>

    <p>Current Direction: <span id="currentDirection">CounterClockWise</span></p>

    <p style="margin-bottom: 2cm;">Motor Status: <span id="motorControlEnabled">OFF</span></p>

    <button id="overrideButton" style="background-color: blue;" onclick="controlMotor('overrideOn')">Override Mode</button>

    <p style="font-size: 40px;">Override Mode is <span id="currentOverrideStatus">OFF</span></p>

    <br>
    <button id="toggleGraphButton">Toggle Graph</button>

    <p>Signal Value: <span id="currentSignal"></span></p>
    <p>Chain Status: <span id="chainStatus"></span></p>
    <div class="chartBox">
        <canvas id="myChart"></canvas>
    </div>

    <!-- Added Indicators for Sensor and Push Button Status -->
    <p>Right Sensor Status: <span id="rightSensorStatus">Inactive</span></p>
    <p>Left Sensor Status: <span id="leftSensorStatus">Inactive</span></p>
    <p>Push Button Status: <span id="pushButtonStatus">Not Pressed</span></p>

    <script>

        const ctx = document.getElementById('myChart');

        // Initialize labels for 100 fixed points on the x-axis
        const fixedLabels = Array.from({length: 100}, (_, i) => i + 1);

        const myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: fixedLabels,

                datasets: [{
                    label: 'Sensor Reading',
                    data: new Array(100).fill(null), // Initialize with null values
                    pointRadius: 0,
                    hitRadius: 10,
                    borderWidth: 1,
                    tension: 0.5,
                    fill:{
                        target: 'origin',
                        above: 'rgb(0, 0, 255)',
                    },
                }]
            },
            options: {
                responsive: true,
                animation: false,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false,
                        },
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Get references to the chart canvas and the button
        const chartCanvas = document.getElementById('myChart');
        const toggleGraphButton = document.getElementById('toggleGraphButton');

        // Add event listener to the button
        toggleGraphButton.addEventListener('click', function() {
            // Toggle the visibility of the chart canvas
            if (chartCanvas.style.display === 'none') {
                chartCanvas.style.display = 'block';
            } else {
                chartCanvas.style.display = 'none';
            }
        });

        let dataIndex = 0; // Track the current index for data updates

        function updateChart(dataValue) {
            if (document.getElementById('currentSignal').innerText > 20) {
                // Update data at the current index
                document.getElementById('chainStatus').innerText = 'Chain Detected';
                myChart.data.datasets[0].data[dataIndex] = dataValue;
                myChart.update();

                dataIndex++; // Move to the next index

                // Reset if we've updated 100 points
                if (dataIndex >= 100) {
                    myChart.data.datasets.forEach((dataset) => {
                        dataset.data.fill(null); // Clear the data
                    });
                    dataIndex = 0; // Reset the index
                }
            } else if (document.getElementById('currentSignal').innerText <= 30) {
                document.getElementById('chainStatus').innerText = 'No Chain Detected';
            }
        }

        // Function to update the value of the motionsensor signal on the Webapp as per the value stored in server.js
        function updateSignal() {
            fetch('/get_sensor_signal')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentSignal').innerText = data.signal.toFixed(2);
                    updateChart(data.signal);
                })
                .catch(error => console.error('Error fetching signal:', error));
        }

        // Function to store the RPM value inputted into the Webapp
        function submitRPMValue() {
            var RPMValue = document.getElementById('RPMInput').value;

            controlMotor('setRPM', RPMValue);
        }

        // Function to process the commands inputted on the Webapp and send them to server.js
        function controlMotor(command, value) {
            let url = `/control_motor?command=${command}`;

            if (value !== undefined) {
                url += `&value=${value}`;
            }

            fetch(url)
                .then(response => response.text())
                .then(data => console.log(data));
        }

        // Function to update the current override status of the motor on the Webapp as per the value stored in server.js
        function updateOverrideStatus() {
            fetch('/get_override_status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentOverrideStatus').innerText = data.overrideOn;
                })
                .catch(error => console.error('Error fetching override status:', error));
        }

        // Function to update the current RPM value of the motor on the Webapp as per the value stored in server.js
        function updateRPMInput() {
            fetch('/get_RPM_value')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentRPMValue').innerText = data.RPMValue;
                })
                .catch(error => console.error('Error fetching RPM value:', error));
        }

        // Function to update the direction status of the motor on the Webapp as per the value stored in server.js
        function updateDirectionStatus() {
            fetch('/get_direction_status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentDirection').innerText = data.direction;
                })
                .catch(error => console.error('Error fetching direction status:', error));
        }

        // Function to update the on/off status of the motor on the webapp as per the value of currentMotorControlEnabled stored in server.js
        function updateMotorControlEnabled() {
            fetch('/get_enabled_value')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('motorControlEnabled').innerText = data.motorControlEnabled;
                })
                .catch(error => console.error('Error fetching Motor Control Enabled Status:', error));
        }

        // Function to update the source position of the motor on the Webapp as per the value stored in server.js
        function updateSourcePosition() {
            fetch('/get_source_position')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('currentSourcePosition').innerText = data.sourcePosition;
                })
                .catch(error => console.error('Error fetching source position:', error));
        }

        // Function to get the right sensor, left sensor, and push button status
        function updateSensorInfo() {
            fetch('/get_sensor_info')
                .then(response => response.json())
                .then(data => {
                    // Update the right sensor status
                    document.getElementById('rightSensorStatus').innerText = data.rightSensorStatus === 'Triggered' ? 'Triggered' : 'Inactive';
                    document.getElementById('leftSensorStatus').innerText = data.leftSensorStatus === 'Triggered' ? 'Triggered' : 'Inactive';
                    document.getElementById('pushButtonStatus').innerText = data.pushButtonStatus === 'Pressed' ? 'Pressed' : 'Not Pressed';
                })
                .catch(error => console.error('Error fetching sensor info:', error));
        }

        // Update sensor and button statuses every 100 milliseconds
        setInterval(updateSensorInfo, 100);

    </script>

</body>

</html>
