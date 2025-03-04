import serial
import time
import argparse
import smtplib
import ssl
from email.message import EmailMessage
import threading

# Configuration
serial_port = '/dev/tty.wchusbserial14230'  # Change this to your Arduino's port
baud_rate = 9600
max_fill_time = 10  # maximum fill time in minutes
min_weight_threshold = 12  # kg
target_weight = 16  # kg
alert_threshold = 13.9  # weight threshold for big dewar in kg
check_interval = 60  # seconds
reset_interval = 5 * 3600  # 5 hours in seconds

# Email configuration
sender = "cute.facility.alert@gmail.com"
password = "June_17_2021"
to = [
    "wrau@triumf.ca",
    "rchrdgermond@gmail.com",
    "jeter.hall@snolab.ca",
    "15jtc@queensu.ca",
    "andy.kubik@snolab.ca",
    "silvia.scorza@triumf.ca",
    "jasmine.gauthier@triumf.ca",
    "muad.ghaith@triumf.ca"
    "chauhandevsinh@gmail.com"
]

# Open the serial connection
ser = serial.Serial(serial_port, baudrate=baud_rate, timeout=3)

# Allow the Arduino to set up its serial connection
print("Arduino serial connection setting up...")
time.sleep(1.5)
print("Done.")

# Function to send commands to Arduino
def send_cmd(cmd):
    cmd += '\n'
    ser.write(cmd.encode('utf-8'))

# Function to get responses from Arduino
def get_resp():
    resp = ser.readline()
    resp = resp.decode("utf-8").strip()
    return resp

# Function to read weights (modify as needed)
def read_weights():
    # Replace with actual logic to read weights from a file or sensor
    with open('weights.txt', 'r') as file:
        line = file.readline().strip()
        big_weight, small_weight = map(float, line.split(','))
    return big_weight, small_weight

# Function to send email alerts
def send_email(dewar_weight):
    subject = "Warning: CUTE LN2 Dewar Level Low"
    body = f"Alert: The big dewar weight is low at {dewar_weight} kg."
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls(context=context)
        server.login(sender, password)
        server.send_message(msg)

# Function to continuously read weights
def monitor_weights():
    while True:
        big_weight, small_weight = read_weights()
        print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg")

        # Alert if the big dewar is below threshold
        if big_weight < alert_threshold:
            print(f"Alert! Big dewar weight is below threshold: {big_weight} kg")
            send_email(big_weight)

        time.sleep(check_interval)

# Function to control filling
def control_fill(t_m):
    total_fill_time = 0
    start_time = time.time()  # Track the start time

    # Start filling for the specified duration
    for _ in range(t_m):
        if total_fill_time < max_fill_time:
            print("Starting fill...")
            send_cmd("FILL10")  # Start filling for 10 seconds

            for i in range(60):
                time.sleep(1)
                if i % 5 == 0:
                    print(f"Filling... {60 - i} seconds remaining.", end="\r")

            send_cmd("STOP")
            print("\nDone filling.")

            total_fill_time += 1  # Increment fill time

            # Check weights after filling
            big_weight, small_weight = read_weights()
            print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg")

            # Check if small dewar is sufficient
            if small_weight >= target_weight:
                print("Target weight reached.")
                break
        else:
            print("Maximum fill time reached. Waiting for reset.")
            time.sleep(check_interval)

        # Reset fill time every 5 hours
        if time.time() - start_time >= reset_interval:
            print("Resetting total fill time after 5 hours.")
            total_fill_time = 0
            start_time = time.time()  # Reset start time

# Command line functionality
parser = argparse.ArgumentParser()
parser.add_argument('--start', type=int, help='Start filling for X minutes (1-10).')
parser.add_argument('--stop', action='store_true', help='Stop the filling immediately.')
args = parser.parse_args()

if args.start:
    if args.start < 1 or args.start > 10:
        raise Exception("Invalid filling duration. Choose a value between 1 and 10 minutes.")

    # Start the weight monitoring in a separate thread
    weight_monitor_thread = threading.Thread(target=monitor_weights, daemon=True)
    weight_monitor_thread.start()

    control_fill(args.start)
elif args.stop:
    print("Sending stop command...")
    send_cmd('STOP')
    print(f"Response: {get_resp()}")
else:
    print('Unknown command. Known commands: --start, --stop')
