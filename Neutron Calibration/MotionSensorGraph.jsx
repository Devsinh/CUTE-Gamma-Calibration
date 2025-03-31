import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

// Register necessary chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Establish WebSocket connection for receiving real-time data
const client = new W3CWebSocket('ws://192.168.44.155:3600');

const MotionSensorGraph = () => {
  const [data, setData] = useState([]); // Store signal data points
  const dataQueue = useRef([]); // Store the last 100 signal values

  // Function to update graph data
  const updateGraphData = (newSignalValue) => {
    if (dataQueue.current.length >= 100) {
      // Remove the first item if we exceed 100 points
      dataQueue.current.shift();
    }
    // Add new signal value to the queue
    dataQueue.current.push(newSignalValue);

    // Update graph data state
    setData(dataQueue.current);
  };

  // WebSocket listener to receive data
  useEffect(() => {
    const handleData = (message) => {
      const dataReceived = JSON.parse(message.data);

      if (dataReceived.signal !== undefined) {
        console.log("Received Signal:", dataReceived.signal); // Log the received signal

        // Update the chart with the new data
        updateGraphData(dataReceived.signal);
      }
    };

    client.onmessage = handleData;

    return () => {
      client.onmessage = null; // Cleanup
    };
  }, []);

  // Graph configuration
  const chartData = {
    labels: Array.from({ length: data.length }, (_, index) => index), // Use index as the x-axis value
    datasets: [
      {
        label: 'Motion Sensor Values',
        data: data, // Signal values
        borderColor: 'rgba(75, 192, 192, 1)', // Line color
        backgroundColor: 'rgba(75, 192, 192, 0.2)', // Fill under the line
        fill: true, // Fill under the line
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Motion Sensor Data',
      },
      legend: {
        position: 'top',
      },
    },
    scales: {
      x: {
        type: 'linear', // X-axis will be a linear scale
        title: {
          display: true,
          text: 'Data Points', // Label for the X-axis
        },
        min: 0, // Fixed minimum for the X-axis
        max: 100, // Fixed maximum for the X-axis
      },
      y: {
        min: 600,
        max: 800, // Sensor signal range
        title: {
          display: true,
          text: 'Signal Value',
        },
      },
    },
    animation: {
      duration: 0, // Disable animation by setting duration to 0
    },
  };

  return (
    <div style={{ width: '400%', height: '500px' }}>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default MotionSensorGraph;
