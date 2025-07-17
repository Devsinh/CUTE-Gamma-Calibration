import serial
import time
import argparse
import smtplib
import ssl
from email.message import EmailMessage
import threading
import os
import requests
from datetime import datetime
import signal
import sys

# Configuration
serial_port = '/dev/tty.usbserial-211130'
baud_rate = 9600
max_fill_time = 30  # maximum fill time in minutes
big_min_weight_threshold = 10 # kg, weight of big dewar after which automatic refill is stopped
target_weight = 23  # what we want the weight of the small dewar to automatically fill to in kg
smallnormalweight = 28 # Normal weight of small dewar in kg
bignormalweight = 75 # Normal weight of big dewar in kg
alert_threshold = 15 # weight threshold for big dewar in kg
alert_threshold1 = 16.2 # weight threshold for small dewar in kg
check_interval = 60  # seconds
reset_interval = 3 * 3600  # 3 hours in seconds

alert_sent = False
alert_sent_big = False
alert_sent_big_stop = False

SLACK_WEBHOOK_URL = ''#'add webhook here'
SLACK_WEBHOOK_CUTE_ALARMS = ''#'add webhook here'

fill_stop_event = threading.Event()

def send_slack_message(message):
    payload = {"text": message}
    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=payload)
        if response.status_code == 200:
            print("Slack message sent to LN2_alarms")
        else:
            print(f"Slack failed: {response.status_code}, {response.text}")

        response1 = requests.post(SLACK_WEBHOOK_CUTE_ALARMS, json=payload)
        if response1.status_code == 200:
            print("Slack message sent to CUTE_alarms")
        else:
            print(f"Slack failed: {response1.status_code}, {response1.text}")
    except Exception as e:
        print(f"Error sending Slack message: {e}")

def handle_shutdown(signal_received, frame):
    print("Shutdown signal received. Cleaning up...")
    send_slack_message("LN2_automation has stopped")
    ser.close()
    sys.exit(0)

# Register SIGINT/SIGTERM handlers
signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

# Email Configuration
sender = "cute.facility.alert@gmail.com"
password = "ornp iozd aayv pndh"
to = [
    "wrau@triumf.ca",
    "andy.kubik@snolab.ca",
    "dev.chauhan@snolab.ca",
    "matthew.stukel@snolab.ca",
    "josemarco.olivares@snolab.ca",
    "tyler.reynolds@utoronto.ca"
]

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

def send_cmd(cmd):
    ser.write((cmd + '\n').encode('utf-8'))

def get_resp():
    return ser.readline().decode("utf-8").strip()

def clean_weight(weight_str):
    return float(weight_str.replace('kg', '').strip())

def read_weights():
    data_dir = "/Users/cute/fridge_data"

    def scan_dir(prefix):
        return sorted(
            [f for f in os.listdir(data_dir) if f.startswith(prefix) and f.endswith(".txt")],
            reverse=True
        )

    try:
        big_files = scan_dir("Scale_Big_")
        small_files = scan_dir("Scale_")
        small_files = [f for f in small_files if not f.startswith("Scale_Big_")]

        if not big_files or not small_files:
            print("Missing data files.")
            return 0, 0

        with open(os.path.join(data_dir, big_files[0]), 'r') as f:
            lines = f.readlines()
            big_weight = clean_weight(lines[-1].split()[2]) if lines else 0

        with open(os.path.join(data_dir, small_files[0]), 'r') as f:
            lines = f.readlines()
            small_weight = clean_weight(lines[-1].split()[2]) if lines else 0

        return big_weight, small_weight

    except Exception as e:
        print(f"Error reading weights: {e}")
        return 0, 0

def continuous_fill_loop():
    start_time = time.time()
    print("Starting fill cycle")
    while not fill_stop_event.is_set():
        for i in range(300):
            if fill_stop_event.is_set():
                break
            if i % 5 == 0:
                send_cmd("FILL10")
            time.sleep(1)
            elapsed = int(time.time()- start_time)
            if elapsed >=7200:
                print("\nFill has exceeded 2 hours. Stopping")
                send_slack_message(
                        ":warning: Fill has been going on for over 2 hours. \n"
                        "Target weight has not been reached. There may be a leak in the system. Stopping automatic fill"
                        )
                fill_stop_event.set()
                break

            print(f"Filling... Elapsed time: {elapsed} seconds", end="\r")
    total_time = int(time.time()-start_time)
    print("\nFill stopped. Total fill time: {total_time} seconds")

def monitor_fill_weight():
    global alert_sent_big_stop
    while not fill_stop_event.is_set():
        big_weight, small_weight = read_weights()
        print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg")

        if small_weight >= target_weight:
            send_cmd("STOP")
            fill_stop_event.set()
            send_slack_message(
                f":white_check_mark: *Fill complete* at {datetime.now()}.\n"
                f"*Small Dewar:* {small_weight:.2f} kg\n"
                f"*Big Dewar:* {big_weight:.2f} kg"
            )
            break

        if big_weight < big_min_weight_threshold:
            send_cmd("STOP")
            fill_stop_event.set()
            if not alert_sent_big_stop:
                send_slack_message(
                    f"Big Dewar weight below {big_min_weight_threshold} kg, stopping fill. Big: {big_weight} kg, Small: {small_weight} kg"
                )
                print(f"Big Dewar weight below 10 kg, stopping fill. Big: {big_weight} kg, Small: {small_weight} kg")
                alert_sent_big_stop = True
            break

        time.sleep(30)

def monitor_weights():
    global alert_sent, alert_sent_big, alert_sent_big_stop

    #fill_times = []
    #window_duration = 6 * 3600
    #alert_threshold_minutes = 90

    while True:
        current_time = time.time()
        big_weight, small_weight = read_weights()
        print(f"Big Dewar: {big_weight} kg, Small Dewar: {small_weight} kg")

        #fill_times = [t for t in fill_times if (current_time - t) < window_duration]

        if big_weight < alert_threshold and not alert_sent_big:
            send_email(big_weight)
            send_slack_message(f"Big dewar weight is {big_weight} kg. Please refill.")
            alert_sent_big = True
        elif big_weight >= alert_threshold:
            alert_sent_big = False

        if big_weight < big_min_weight_threshold:
            if not alert_sent_big_stop:
                send_slack_message(f"Big Dewar too low ({big_weight} kg). Waiting...")
                alert_sent_big_stop = True

            # Always pause when too low
            while big_weight < big_min_weight_threshold:
                time.sleep(check_interval)
                big_weight, _ = read_weights()

            send_slack_message(f"Big Dewar back to {big_weight} kg. Resuming automatic fill.")
            alert_sent_big_stop = False

        if small_weight < alert_threshold1:
            fill_stop_event.clear()
            send_slack_message(
                f":droplet: *Fill started* at {datetime.now()}.\n"
                f"*Small Dewar:* {small_weight:.2f} kg\n"
                f"*Big Dewar:* {big_weight:.2f} kg"
            )
            filler = threading.Thread(target=continuous_fill_loop)
            monitor = threading.Thread(target=monitor_fill_weight)
            filler.start()
            monitor.start()
            filler.join()
            monitor.join()
            alert_sent = False
        else:
            time.sleep(check_interval)

# === MAIN ===

ser = serial.Serial(serial_port, baudrate=baud_rate, timeout=3)
#Allow the Arduino to set up its serial connection
print("Arduino serial connection setting up...")
time.sleep(1.5)
print("Done.")
send_cmd("IDN")
print(f"Arduino says: {get_resp()}")

send_slack_message("LN2_automation has begun")

parser = argparse.ArgumentParser()
parser.add_argument('--start', type=float, help='Start filling for X minutes (1-10).')
parser.add_argument('--stop', action='store_true', help='Stop the filling immediately.')
args = parser.parse_args()

if args.start:
    t_m = float(args.start)
    if t_m < 1 or t_m > 10:
        raise Exception("Invalid fill time. Choose 1???10 minutes.")
    t = int(60 * t_m)
    print("Starting timed fill...")
    for i in range(t):
        if i % 5 == 0:
            send_cmd("FILL10")
        print(f"Time left: {t - i} seconds.", end="\r")
        time.sleep(1)
    send_cmd("STOP")
    print("\nFill complete.")

elif args.stop:
    print("Sending STOP command...")
    send_cmd("STOP")
    print(f"Response: {get_resp()}")

else:
    monitor_weights()
