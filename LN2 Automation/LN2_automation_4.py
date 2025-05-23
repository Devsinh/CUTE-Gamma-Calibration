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
serial_port = '/dev/tty.usbserial-211130'  # Change this to your Arduino's port
baud_rate = 9600
max_fill_time = 30  # maximum fill time in minutes
min_weight_threshold = 12  # kg
target_weight = 16  # kg
smallnormalweight = 28 # kg
bignormalweight = 75 # kg
alert_threshold = 20 # weight threshold for big dewar in kg
alert_threshold1 = target_weight - 3.1 # weight threshold for small dewar in kg
check_interval = 60  # seconds
reset_interval = 3 * 3600  # 5 hours in seconds
alert_sent = False
alert_sent_big = False


# Email configuration
sender = "cute.facility.alert@gmail.com"
password = "ornp iozd aayv pndh"
to = [
    "wrau@triumf.ca",
    "andy.kubik@snolab.ca",
    "dev.chauhan@snolab.ca",
    "matthew.stukel@snolab.ca",
    "josemarco.olivares@snolab.ca"
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

#####STARTUP
#print("Serial connection successful.")
send_cmd("IDN")
print(f"Identity query response: {get_resp()}")

# Function to continuously read weights
def monitor_weights():
    global alert_sent
    global alert_sent_big
    fill_times = []  # List to track fill times
    window_duration = 6 * 3600  # 6 hours in seconds
    alert_threshold_minutes = 50  # Alert if filling exceeds 30 minutes in window

    while True:
        current_time = time.time()
        big_weight, small_weight = read_weights()
        print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg at {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # Remove fill times older than 6 hours
        fill_times = [t for t in fill_times if (current_time - t) < window_duration]

        # Alert if the big dewar is below threshold
        if big_weight < alert_threshold:
            if alert_sent_big == False:
                print(f"Alert! Big dewar weight is below threshold: {big_weight} kg")
                send_email(big_weight)
                alert_sent_big = True

        # Check and fill small dewar if below threshold
        if small_weight < alert_threshold1:
            print(f"Small dewar below threshold ({alert_threshold1} kg). Starting fill cycle...")
            
            # Record start of fill cycle
            fill_start_time = time.time()
            
            # Continue filling until weight ≥ 0
            while small_weight < target_weight:
                # Fill for 1 minute
                print("Starting 2-minute fill...")
                
                # Send FILL10 command every 5 seconds for 1 minute
                for i in range(120):
                    if i % 5 == 0:  # Every 5 seconds
                        send_cmd("FILL10")
                    time.sleep(1)
                    print(f"Filling... {120 - i} seconds remaining.", end="\r")
                
                send_cmd("STOP")
                print("\nFill complete. Starting 60-second wait...")

                # Add this fill minute to our tracking
                fill_times.append(time.time())
                
                # Calculate total fill time in last 6 hours
                total_fill_minutes = 2 * len(fill_times)
                print(f"Fill has been going on for {total_fill_minutes}", end = "\r")
                
                # Check if we should send an alert
                if total_fill_minutes >= alert_threshold_minutes:
                    if alert_sent == False:
                        alert_message = (
                            f"Warning: System has been filling for {total_fill_minutes} minutes "
                            f"in the last 6 hours. This exceeds the {alert_threshold_minutes} "
                            "minute threshold. The system will continue filling but may indicate "
                            "a leak that needs attention."
                        )
                        print(alert_message)
                    
                        # Send email alert
                        msg = EmailMessage()
                        msg["Subject"] = "Warning: Extended LN2 Filling Duration"
                        msg["From"] = sender
                        msg["To"] = ", ".join(to)
                        msg.set_content(alert_message)
                    
                        context = ssl.create_default_context()
                        with smtplib.SMTP("smtp.gmail.com", 587) as server:
                            server.starttls(context=context)
                            server.login(sender, password)
                            server.send_message(msg)

                        alert_sent = True 
                
                # Wait for 3 minutes
                for i in range(60):
                    time.sleep(1)
                    print(f"Waiting... {60 - i} seconds remaining", end="\r")
                print("Wait complete.")
                
                # Check weight again
                _, small_weight = read_weights()
                print(f"Small Dewar weight after cycle: {small_weight} kg")
                
                if small_weight >= target_weight:
                    print("Small dewar weight is at or above {target_weight} kg. Stopping fill cycle.")
                    alert_sent = False
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
    #weight_monitor_thread = threading.Thread(target=monitor_weights, daemon=True)
    #weight_monitor_thread.start()
    
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
    monitor_weights()
    print('Monitoring the weights')
