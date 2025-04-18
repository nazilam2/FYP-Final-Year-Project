#Name:Nazila Malekzadah C21414344 
#Date 30:11:2024
#Description: This is Raspberry PI Pico W publisher code , it publish heart rate, accelerometer, poteni, and gps data to MQTT broker.

#Import Librarys 
import time
import machine
import max30100
import network
from umqtt.simple import MQTTClient
from machine import Pin, ADC, I2C, UART
import struct
import json
from micropyGPS import MicropyGPS

#WiFi setup (Connected to my phone hotspot)
ssid = 'Nazila'
password = '12345678'

#This method is for wifi conection
def connect_w():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        print('Connecting to WIFI.. ')
        time.sleep(1)
    print('Connected to WIFI')
    print(wlan.ifconfig())
#End of function
    
    
 

#This method is used for MQTT setup 
mqtt_server = "test.mosquitto.org"  #Public MQTT broker 
client_id = "raspberry-pico"    # client ID (Raspberry PI Pico )
topic = "FYP_sensor_data"   # # Topic to publish sensor data 

# #This method is used to handle MQTT connection 
def connect_mqtt():
    client = MQTTClient(client_id, mqtt_server)
    try:
        client.connect()
        print("Connected to MQTT Broker")
        return client
    except Exception as e:
        print(f"Failed to connect to MQTT Broker: {e}")
        return None
#End of function 

#  initialise I2C for MAX30100 heart rate 
i2c = machine.I2C(1, scl=machine.Pin(19), sda=machine.Pin(18), freq=400000)
mx30 = max30100.MAX30100(i2c=i2c)
mx30.set_led_current(50.0, 50.0)
mx30.enable_spo2()

# Heart rate variables
ir_values = []
peak_times = []
prev_ir = 0
min_peak_gap = 0.6
max_peak_gap = 1.5
finger_off_count = 0
peak_detected = False
last_peak_value = 0
rolling_avg_size = 20
bpm = 0

def read_heart_rate():
    global prev_ir, peak_detected, last_peak_value, bpm
    mx30.read_sensor()
    ir_value = mx30.ir

    if ir_value is None or ir_value < 5000:
        return None
    
    ir_values.append(ir_value)
    if len(ir_values) > 200:
        ir_values.pop(0)

    if len(ir_values) >= rolling_avg_size:
        avg_ir = sum(ir_values[-rolling_avg_size:]) / rolling_avg_size
        
        if peak_detected and ir_value < last_peak_value - 6:
            peak_detected = False

        if ir_value > prev_ir and not peak_detected:
            current_time = time.ticks_ms() / 1000

            if peak_times and (current_time - peak_times[-1]) < min_peak_gap:
                prev_ir = ir_value
                return None

            if not peak_times or (min_peak_gap <= (current_time - peak_times[-1]) <= max_peak_gap):
                peak_times.append(current_time)
                peak_detected = True
                last_peak_value = ir_value
                
                if len(peak_times) > 5:
                    peak_times.pop(0)
                
                if len(peak_times) >= 4:
                    intervals = [peak_times[i] - peak_times[i - 1] for i in range(1, len(peak_times))]
                    avg_interval = sum(intervals) / len(intervals)
                    bpm = 60 / avg_interval
    
    prev_ir = ir_value
    return round(bpm, 1) if 50 <= bpm <= 120 else None

# ADC for potentiometer
pot = ADC(Pin(26))

# I2C for accelerometer
i2c_acc = I2C(0, freq=100000, sda=Pin(4), scl=Pin(5))
ACCELEROMETER_ADDRESS = 25

#This method is used to setup accelerometer

def accelerometer_setup():
    try:
        i2c.writeto_mem(ACCELEROMETER_ADDRESS, 0x20, b'\x97')
        i2c.writeto_mem(ACCELEROMETER_ADDRESS, 0x24, b'\x40')
        print("Accelerometer setup complete. ")
    except Exception as e:
        print(f"Error setting up accelerometer: {e}")
#End of function
        

#This function is used read the accelerometer  data 
def read_accelerometer(axis):
    axis_map = {'x': (0x28, 0x29), 'y': (0x2A, 0x2B), 'z': (0x2C, 0x2D)}
    try:
        low_byte = i2c.readfrom_mem(ACCELEROMETER_ADDRESS,axis_map[axis][0], 1)
        high_byte = i2c.readfrom_mem(ACCELEROMETER_ADDRESS,axis_map[axis][1], 1)
        return struct.unpack('<h', bytearray([low_byte[0], high_byte[0]]))[0]
    except Exception as e:
        print(f"Error reading accelerometer {axis} axis: {e}")
        return 0 
#End of funtion 

# GPS set up 
gps_serial = UART(0, baudrate=9600, tx=16, rx=17)
my_gps = MicropyGPS()

def read_gps():
    if gps_serial.any():
        data = gps_serial.read()
        for byte in data:
            my_gps.update(chr(byte))
    
    lat = my_gps.latitude[0] + (my_gps.latitude[1] / 60.0) if my_gps.latitude[0] != 0.0 else 0.0
    lon = my_gps.longitude[0] + (my_gps.longitude[1] / 60.0) if my_gps.longitude[0] != 0.0 else 0.0
    
    if my_gps.latitude[2] == 'S':
        lat = -lat
    if my_gps.longitude[2] == 'W':
        lon = -abs(lon)
    
    return round(lat, 6), round(lon, 6)

def pub_sensor_data():
    client = connect_mqtt()
    if client is None:
        print("MQTT connection failed")
        return
    accelerometer_setup()

    while True:
        try:
            heart_rate = read_heart_rate()
            pot_value = pot.read_u16()
            accelerometer_x = read_accelerometer('x') # Read X-axis of the accelerometer 
            accelerometer_y = read_accelerometer('y') # Read Y-axis of the accelerometer 
            accelerometer_z = read_accelerometer('z') # Read Z-axis of the accelerometer 
            latitude, longitude = read_gps() # lat and long
            
            # these dates are sent 
            sensor_data = {
                "Potentiometer": pot_value,
                "Accelerometer": {"x": accelerometer_x, "y": accelerometer_y, "z": accelerometer_z},
                "GPS": {"Latitude": latitude, "Longitude": longitude},
                "Heart Rate": heart_rate if heart_rate else "No Reading"
            }
            
            print(f"Publishing: {json.dumps(sensor_data)}")
            client.publish(topic, json.dumps(sensor_data))
            time.sleep(1)
        except Exception as e:
            print(f"Error while reading or publishing data: {e}")

connect_w()
pub_sensor_data()
# end of program 



