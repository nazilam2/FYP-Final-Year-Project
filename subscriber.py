#Name: Nazila Malekzadah C21414344
#Date: 30:11:2024
#Description : This program is subscriber , it  fetches the data from MQTT broker and then send it to Firebase Firestore database 

##Import Librarys 
import paho.mqtt.client as mqtt  #For MQTT Communication 
import firebase_admin  # Firbase integration 
from firebase_admin import credentials, firestore  # This handle Firebase credentials 
import json  # For processing the received data as JSON

#Initialize Firebase Admin SDK 
cred = credentials.Certificate("/path/to/serviceAccountKey.json") # Firebase database URL 
firebase_admin.initialize_app(cred)  

# Initialize Firestore client
db = firestore.client()

# MQTT Callback function triggered when the MQTT client connects to the broker
def on_connect(client, userdata, flags, rc):
    print("Connected to the MQTT broker with result code " + str(rc))
    client.subscribe("FYP_sensor_data")  # This is the topic the data is sent to

# Callback function triggered when a message is received on a subscribed topic
def on_message(client, userdata, msg):
    try:
        # Decode the received message (assumed to be JSON formatted)
        raw_message = msg.payload.decode()
        print(f"Raw MQTT message: {raw_message}")

        # Try to parse the message as JSON
        try:
            sensor_data = json.loads(raw_message)  # Convert to a dictionary
        except json.JSONDecodeError:
            print("Invalid JSON format received")
            return

        print(f"Received message: {sensor_data} from topic: {msg.topic}")

        # Retrieve the active user ID from Firestore
        user_id_doc = db.collection('sensor_users').document('active_user').get()
        if user_id_doc.exists:
            user_id = user_id_doc.to_dict().get('userId')
            print(f"Active User ID: {user_id}")
        else:
            print("No active user found. Data not saved.")
            return

        # Store sensor data under the user's document in Firestore
        sensor_data_ref = db.collection('users').document(user_id).collection('sensor_data')
        
        # Add the sensor data to Firestore with the current timestamp
        sensor_data_ref.add({
            'data': sensor_data, 
            'timestamp': firestore.SERVER_TIMESTAMP  # Automatically set the server timestamp
        })

        print("Data sent to Firestore.")
    except Exception as e:
        print(f"Error processing data: {e}")

  

# Configuring the MQTT Client 
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

#Connect to MQTT Broker 
client.connect("test.mosquitto.org", 1883, 60)

#Listening for messages 
print("Listening for MQTT messages ...")
client.loop_forever()