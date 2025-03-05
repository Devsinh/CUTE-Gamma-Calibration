import serial
import time
import argparse
import smtplib
import ssl
from email.message import EmailMessage
import threading
import os
from datetime import datetime

# Configuration
serial_port = '/dev/tty.wchusbserial14230'  # Change this to your Arduino's port
baud_rate = 9600
max_fill_time = 10  # maximum fill time in minutes
min_weight_threshold = 12  # kg
target_weight = 16  # kg
alert_threshold = -4 # weight threshold for big dewar in kg
alert_threshold1 = -3 # weight threshold for small dewar in kg
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
    "muad.ghaith@triumf.ca",
    "chauhandevsinh@gmail.com",
    "matthew.stukel@snolab.ca"
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
def clean_weight(weight_str):
    # Remove 'kg' and any whitespace, then convert to float
    return float(weight_str.replace('kg', '').strip())

def read_weights():
    data_dir = "/Users/cute/fridge_data"
    
    # Function to scan directory for relevant files
    def scan_dir(prefix):
        files = []
        for file in os.listdir(data_dir):
            if file.startswith(prefix) and file.endswith(".txt"):
                files.append(file)
        files.sort(reverse=True)  # Sort files in descending order
        return files
    
    try:
        # Get the most recent files for both scales
        big_files = scan_dir("Scale_Big_")
        small_files = scan_dir("Scale_")
        small_files = [f for f in small_files if not f.startswith("Scale_Big_")]
        
        if not big_files or not small_files:
            print("Warning: Data files missing")
            return 0, 0

        # Read big dewar weight
        latest_big_file = os.path.join(data_dir, big_files[0])
        with open(latest_big_file, 'r') as f:
            lines = f.readlines()
            if lines:
                last_line = lines[-1]
                parts = last_line.replace("    ", " ").split()
                big_weight = clean_weight(parts[2])
            else:
                big_weight = 0
        
        # Read small dewar weight
        latest_small_file = os.path.join(data_dir, small_files[0])
        with open(latest_small_file, 'r') as f:
            lines = f.readlines()
            if lines:
                last_line = lines[-1]
                parts = last_line.replace("    ", " ").split()
                small_weight = clean_weight(parts[2])
            else:
                small_weight = 0
                
        return big_weight, small_weight
            
    except Exception as e:
        print(f"Error reading weights: {e}")
        return 0, 0
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
    total_fill_time = 0  # Track total filling time in minutes
    last_reset_time = time.time()  # Track when we last reset the fill time
    reset_interval = 3 * 3600  # 3 hours in seconds

    while True:
        big_weight, small_weight = read_weights()
        print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg")

        # Reset fill time counter every 3 hours
        current_time = time.time()
        if current_time - last_reset_time >= reset_interval:
            print("Resetting fill time counter after 3 hours")
            total_fill_time = 0
            last_reset_time = current_time

        # Alert if the big dewar is below threshold
        if big_weight < alert_threshold:
            print(f"Alert! Big dewar weight is below threshold: {big_weight} kg")
            send_email(big_weight)

        # Check and fill small dewar if below threshold
        if small_weight < alert_threshold1 and total_fill_time < 10:
            print(f"Small dewar below threshold ({alert_threshold1} kg). Starting fill cycle...")
            
            # Continue filling until weight ≥ 0 or max time reached
            while small_weight < 0 and total_fill_time < 10:
                # Fill for 1 minute
                print("Starting 1-minute fill...")
                send_cmd("FILL10")
                for i in range(60):
                    time.sleep(1)
                    if i % 5 == 0:
                        print(f"Filling... {60 - i} seconds remaining.", end="\r")
                send_cmd("STOP")
                print("\nFill complete. Starting 3-minute wait...")

                total_fill_time += 1  # Increment fill time counter
                
                # Wait for 3 minutes
                for i in range(180):
                    time.sleep(1)
                    if i % 30 == 0:
                        print(f"Waiting... {180 - i} seconds remaining")
                print("Wait complete.")
                
                # Check weight again
                _, small_weight = read_weights()
                print(f"Small Dewar weight after cycle: {small_weight} kg")
                
                if small_weight >= 0:
                    print("Small dewar weight is at or above 0 kg. Stopping fill cycle.")
                    break
                elif total_fill_time >= 10:
                    print("Maximum fill time (10 minutes) reached. Stopping fill cycle.")
                    break
            
        else:
            # Regular monitoring interval if no filling needed
            time.sleep(check_interval)

# Command line functionality
parser = argparse.ArgumentParser()
parser.add_argument('--start', type=float, help='Start filling for X minutes (1-10).')
parser.add_argument('--stop', action='store_true', help='Stop the filling immediately.')
args = parser.parse_args()

if args.start:
    t_m = float(args.start) #time (fill duration) in minutes
    if t_m<1 or t_m> 10:
        raise(Exception("Invalid filling duration. Choose a value between 1 and 10 minutes."))
    t = int(60*t_m) #duration in seconds
    
    # Start the weight monitoring in a separate thread
    weight_monitor_thread = threading.Thread(target=monitor_weights, daemon=True)
    weight_monitor_thread.start()
    
    #start filling
    print("Starting fill...")

    for i in range(0,t):
        if i%5==0:
            send_cmd("FILL10") #every 5 seconds, tell it to fill for 10 seconds.
        print(f"Time left: {t-i} out of {t} seconds.",end="\r")
        time.sleep(1)

    #done filling
    send_cmd("STOP")
    get_resp()
    print("\nDone.")
    print("Fill stopped.")
       
#stop the filling immediately
elif args.stop:
    print("Sending stop command...")
    send_cmd('STOP')
    print(f"Response: {get_resp()}")

else:
    print('Unknown command. Known commands: start, stop')
