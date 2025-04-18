/**Name: Nazila Malekzadah C2141433 
  Date: 11/04/2025
  Descrption: This component displays a detailed driver profile with:
  - real time location
  - avg speed and harsh braking detection per trip 
  - fuel level gauge based on potentiometer sensor 
  - trips per day frequency chart 
*/

// Import Lib
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, doc, getDoc, collection, query, getDocs } from "./firebase";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import "react-circular-progressbar/dist/styles.css";
import "./SensorData.css";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, ArcElement } from "chart.js";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// register chart components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

function SensorData() {
  const { driverId } = useParams();

  // state varaibles 
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fuelLevel, setFuelLevel] = useState(100);
  const [trips, setTrips] = useState([]); 
  const [avgSpeeds, setAvgSpeeds] = useState([]); 
  const [brakingEvents, setBrakingEvents] = useState([]); 
  const [tripsPerDay, setTripsPerDay] = useState({ labels: [], counts: [] });
  const TIME_GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const [driverLocation, setDriverLocation] = useState({ latitude: null, longitude: null });
  const [weather, setWeather] = useState(null);

  // fetch driver profile data 
  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        const userRef = doc(db, "users", driverId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setDriver(userSnap.data());
        } else {
          setErrorMessage("Driver data not found.");
        }
      } catch (error) {
        setErrorMessage("Failed to fetch driver data.");
        console.error("Error fetching driver data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDriverData();
  }, [driverId]);

  // fetch sensor data and process metrics
  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const sensorQuery = query(collection(db, "users", driverId, "sensor_data"));
        const querySnapshot = await getDocs(sensorQuery);
        const rawSensorData = querySnapshot.docs.map((doc) => {
        const data = doc.data();
          console.log("Firestore Document Data:", data); // Debugging
          return {
            id: doc.id,
            timestamp: data.timestamp?.toDate().getTime() || new Date().getTime(),
            speed: data.data?.Speed || 0,
            braking: data.data?.BrakingEvents || 0,
            fuel: data.data?.FuelLevel || 100 ,
            potentiometer: data.data?.Potentiometer, 
            accelerometer: data.data?.Accelerometer || { x: 0, y: 0, z: 0 },  // Extract X, Y, Z values
            gps: data.data?.GPS || null, // Extract latest GPS data
          };
        });

        console.log(" Full Sensor Data from Firestore:", rawSensorData);

        // sort sensor data by timestamp
        rawSensorData.sort((a, b) => a.timestamp - b.timestamp);
        
        // get the latest GPS coordinates
        if (rawSensorData.length > 0 && rawSensorData[rawSensorData.length - 1].gps) {
          const latitude = rawSensorData[rawSensorData.length - 1].gps.Latitude;
          const longitude = rawSensorData[rawSensorData.length - 1].gps.Longitude;
        
          setDriverLocation({ latitude, longitude });
        
          // Fetch weather using updated GPS coordinates 
          fetchWeather(latitude, longitude);
        }

        // gorup data into trips based on time gaps 
        let tripData = [];
        let avgSpeedsArr = [];
        let brakingCounts = [];
        let currentTrip = [];
        let lastTimestamp = null;
        let lastAcceleration = null;
        let lastSpeed = 0; 


        const BRAKING_THRESHOLD = 8000; 
        const SPEED_CONVERSION_FACTOR = 0.01; 



        rawSensorData.forEach((entry) => {
          if (lastTimestamp && entry.timestamp - lastTimestamp > TIME_GAP_THRESHOLD) {

            // comupte averg speed for trip and reset spped foe next trip 
            const avgSpeed = currentTrip.reduce((sum, e) => sum + e.speed, 0) / currentTrip.length;
            avgSpeedsArr.push(isNaN(avgSpeed) ? 0 : avgSpeed); // Prevent NaN errors
            tripData.push(currentTrip);
            brakingCounts.push(currentTrip.filter(e => e.harshBraking).length);
            currentTrip = [];
            lastSpeed = 0;  
          }

          // detect harsh braking using x, y, z
          const { x, y, z } = entry.accelerometer;

          let harshBraking = false;
          let speed = lastSpeed;

          if (lastAcceleration) {
          
            // compute time differnace ms to second
            let deltaTime = (entry.timestamp - lastTimestamp) / 1000;
            if (deltaTime > 10) { 
              console.warn(` Ignoring large ΔTime: ${deltaTime}s`);
              deltaTime = 0.5; 
            }
            // if car was stpped for too long, reset speed 
            if (deltaTime > 60) { 
              lastSpeed = 0;
              console.warn("Car was stopped for too long, resetting speed!");
            }

          
            // compuate acceleration magnitude using Euclidean formula
            let accelerationMag = Math.sqrt(
              Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2)
            );
            accelerationMag = (accelerationMag - 16384) * (9.81 / 16384); // convert accelorometer value to proper m/s^2
            accelerationMag = Math.min(Math.max(accelerationMag, -15), 15); // prevent unrealistic values

            // estimated speed basic  
            let newSpeed = lastSpeed + (accelerationMag * deltaTime * 0.8); // Reduce damping effect
            speed = Math.max(0, Math.min(speed, 50)); 

            // Harsh breaking detection via chnage in acceleration
            let deltaA = Math.sqrt(
              Math.pow(lastAcceleration.x - x, 2) +
              Math.pow(lastAcceleration.y - y, 2) +
              Math.pow(lastAcceleration.z - z, 2)
            );
            deltaA = (deltaA * 9.81) / 16384;
            if (deltaA > 8) {
              harshBraking = true;
              console.warn(`Harsh braking detected! ΔA = ${deltaA.toFixed(2)} m/s²`);
            }
          }

          currentTrip.push({ ...entry, speed, harshBraking });
          lastAcceleration = entry.accelerometer;
          lastTimestamp = entry.timestamp;
          lastSpeed = speed;
              
        });

        // push final trip 
        if (currentTrip.length > 0) {
          const avgSpeed = currentTrip.reduce((sum, e) => sum + e.speed, 0) / currentTrip.length;
          avgSpeedsArr.push(avgSpeed);

          tripData.push(currentTrip);
          brakingCounts.push(currentTrip.filter(e => e.harshBraking).length);
        }

        setTrips(tripData);
        setAvgSpeeds(avgSpeedsArr);
        setBrakingEvents(brakingCounts);

        // calibrate fuel level using the raw potentiometer value range 272 to 65535
        if (rawSensorData.length > 0) {
        let rawFuel = rawSensorData[rawSensorData.length - 1]?.potentiometer;

          // handle missing potneiometer values 
          if (rawFuel === undefined || rawFuel === null) {
            console.warn(" WARNING: Potentiometer value not found! Setting default empty value.");
            rawFuel = 272; // defualt empty thank value 
          }

          const emptyValue = 272;   // raw value for empty tank 
          const fullValue = 65535;  // raw value for full thank
        
          if (rawFuel < emptyValue) {
            console.warn("Raw fuel value is too low! Setting to empty threshold.");
            rawFuel = emptyValue;
          } else if (rawFuel > fullValue) {
            console.warn("Raw fuel value is too high! Setting to full threshold.");
            rawFuel = fullValue;
          }
          // correct fuel percentage calculation 
          let fuelPercent = ((rawFuel - emptyValue) / (fullValue - emptyValue)) * 100;
        
          // ensure fuel percentage is within 0 - 100 %
          fuelPercent = Math.max(0, Math.min(100, fuelPercent));
        
          console.log(" Corrected Fuel Percentage:", fuelPercent);
          setFuelLevel(fuelPercent);
        } else {
          console.log("No sensor data available, setting default fuel level.");
          setFuelLevel(100);
        }

        // calculate trips per day 
        const tripsPerDayMap = {};
        tripData.forEach(trip => {
          const tripDate = new Date(trip[0].timestamp);
          const dateKey = tripDate.toISOString().split('T')[0];
          if (!tripsPerDayMap[dateKey]) {
            tripsPerDayMap[dateKey] = 0;
          }
          tripsPerDayMap[dateKey]++;
        });

        // sort the dates and map them to labes like day1 , day2 ...
        const sortedDates = Object.keys(tripsPerDayMap).sort((a, b) => new Date(a) - new Date(b));
        const dayLabels = sortedDates.map((_, index) => `D${index + 1}`);
        const tripsCount = sortedDates.map(dateKey => tripsPerDayMap[dateKey]);

        setTripsPerDay({ labels: dayLabels, counts: tripsCount });

        
      } catch (error) {
        setErrorMessage("Failed to fetch sensor data.");
        console.error("Error fetching sensor data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSensorData();

    // weather fetcher 
    const fetchWeather = async (latitude, longitude) => {
      const apiKey = "f1549b84966f98b3761bfc7fb6ca2a6c"; // Use your OpenWeather API key
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    
      try {
        const response = await fetch(url);
        const data = await response.json();
    
        if (data.main) {
          setWeather({
            temp: data.main.temp,
            condition: data.weather[0].description,
            icon: `http://openweathermap.org/img/wn/${data.weather[0].icon}.png`,
            windSpeed: data.wind.speed, // Wind speed in m/s
            humidity: data.main.humidity // Humidity percentage
          });
        } else {
          console.error("Weather data not found", data);
        }
      } catch (error) {
        console.error("Error fetching weather data:", error);
      }
    };

  }, [driverId]);

  // loading /erro states 
  if (loading) {
    return <p>Loading driver and sensor data...</p>;
  }

  if (errorMessage) {
    return <p className="error-message">{errorMessage}</p>;
  }

  //prepared data for fuel chart - chart config
  const fuelData = {
    labels: ["Fuel Left", "Fuel Used"],
    datasets: [
      {
        data: [fuelLevel, 100 - fuelLevel],
        backgroundColor: ["#28a745", "#dc3545"],
        borderWidth: 0,
      },
    ],
  };
  

  const fuelOptions = {
    cutout: "70%", // creates a donut aappearnace 
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  return (
    <div className="sensor-data-container">
      <header>
        <h1>DriveGuard</h1>
      </header>

      <div className="sensor-data-wrapper">
        
      {/* Driver profile */}
      <section className="user-info-card">
        {driver ? (
          <>
            <div className="user-header">
              <h2>{driver.name}</h2>
            </div>

            <div className="user-details">
              <div className="user-info-row">
                <span className="label">Email:</span>
                <span className="value">{driver.email}</span>
              </div>
              <div className="user-info-row">
                <span className="label">Vehicle ID:</span>
                <span className="value">{driver.vehicleId}</span>
              </div>
              <div className="user-info-row">
                <span className="label">Fleet ID:</span>
                <span className="value">{driver.fleetId}</span>
              </div>
            </div>

            {/* vehicle location section - move lower */}
            <div className="vehicle-location">
            {driverLocation.latitude !== null && driverLocation.longitude !== null ? (
        <MapContainer
        center={[driverLocation.latitude, driverLocation.longitude]}
        zoom={15}
        className="map-container"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
        {/* show the driver's lates know location */}
        <Marker 
          position={[driverLocation.latitude, driverLocation.longitude]} 
          icon={L.icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png", 
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          })}
        >
          <Popup>Current Location</Popup>
        </Marker>
      </MapContainer>
      
      ) : (
        <p>Location data not available</p>
      )}

       {/* Displa weather information  */}
      {weather && (
      <div className="weather-info">
        <div className="weather-left">
          <img src={weather.icon} alt="Weather icon" className="weather-icon" />
          <p className="temperature">{weather.temp.toFixed(1)}°C</p>
        </div>
        <div className="weather-details">
          <p className="condition">{weather.condition}</p>
          <p className="wind-humidity">
            🌬️ {weather.windSpeed} m/s &nbsp; 💧 {weather.humidity}%
          </p>
        </div>
      </div>
        )}

        </div>
      </>
    ) : (
      <p>No user data available</p>
    )}
  </section>


  {/* Sensor data charts */}
  <section className="sensor-data-section">
    
    {/* avg speed chart */}
    <div className="chart-container">
      <div className="chart">
        <h3>Average Speed per Trip</h3>
        <Line
          data={{
            labels: trips.map((_, i) => `Trip ${i + 1}`),
            datasets: [
              {
                label: "Estimated Speed (m/s)",
                data: avgSpeeds,  // using comupated avg speed 
                borderColor: "rgba(75, 192, 192, 1)",
                tension: 0.4,
                fill: false
              }
            ]
          }}
        />
      </div>

      {/* Harsh breaking chart */}
      <div className="chart">
        <h3>Harsh Braking</h3>
        <Bar
          data={{
            labels: trips.map((_, i) => `Trip ${i + 1}`),
            datasets: [
              {
                label: "Harsh Braking Events",
                data: brakingEvents,  // based on acceleration and detection 
                backgroundColor: "rgba(255, 99, 132, 0.5)",
                borderColor: "rgba(255, 99, 132, 1)",
                borderWidth: 1
              }
            ]
          }}
        />

      </div>
    </div>

     {/*Trips per day */}
    <div className="chart-container">
      {/* trips per day chart*/}
      <div className="chart">
        <h3>Trips Per Day</h3>
        <Bar
          data={{
            labels: tripsPerDay.labels,
            datasets: [
              {
                label: "Number of Trips",
                data: tripsPerDay.counts,
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1,
                barThickness: 35, 
              },
            ],
          }}
        />
      </div>

      {/* fuell level charts */}
      <div className="chart fuel-chart">
      <h3>Fuel Level</h3>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Doughnut
          data={fuelData}
          options={{
            cutout: "70%", 
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true },
            },
          }}
          style={{ width: "185px", height: "185px" }} 
        />
      </div>
      <p style={{ textAlign: "center", marginTop: "10px", fontWeight: "bold" }}>
        {fuelLevel.toFixed(1)}% Fuel Left
      </p>
    </div>
    </div>

        </section>
      </div>
    </div>
  );
}

export default SensorData;
