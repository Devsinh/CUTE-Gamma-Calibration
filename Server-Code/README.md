The steps needed to begin the server locally are :-

For Windows:  

Step 1: Open cisco anyconnect and connect to vpn1.snolab.ca 

Step 2: Select SL-Cute and enter your Snolab Credentials(Need access) 

Step 3: Check if putty or pscp is installed in your computer, if not, install it.(To check, just type pscp in command prompt)(To install putty : https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html) 

Step 4: Download the folder Users/cute/source from the mac mini(192.168.44.155) using command pscp -r cute@192.168.44.155:/Users/cute/source C:\Users\~(any directory you want) 

Step 5: Disconnect from the snolab vpn(Otherwise it will read live data from Cute) 

Step 6: Go to ~\source\CUTE_TRIUMF\cute_hub using terminal(Make sure you have node.js installed. If not, use the website https://nodejs.org/en/download/package-manager) 

Step 7: Execute the following commands in this sequence  

npm install  

npm install react-scripts@latest  

npm install websocket  

npm audit fix  

npm install postcss postcss-safe-parser 

set NODE_OPTIONS=--openssl-legacy-provider 

$env:NODE_OPTIOS='--openssl-legacy-provider"(For powershell) 

Step 8: Finally, you can run the command npm start in the powershell to get the local version of cute hub.  

For a different operating system, you can put these instructions in chatgpt and ask it what to do for that system
