/** 
 * Name: Nazila Malekzadah C21414344
 * Date: 11/04/2025
 * Description: display a visual metrics for a driver's trips, safety, health, and vhicle stats 
 * Features: 
 * - fetch data from firestore + asyncdtorage and render dynamic charts using the Charts compoment 
 */

// import lib
import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text,View, ActivityIndicator, StyleSheet, ScrollView,ImageBackground  } from "react-native";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Charts from "./Charts"; // import the reusable chat UI componrnt 


const MetricsScreen = ({ navigation }) => {

  // states for holding metric data 
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [avgSpeeds, setAvgSpeeds] = useState([]);
  const [brakingEvents, setBrakingEvents] = useState([]);
  const [tripsPerDay, setTripsPerDay] = useState({ labels: [], counts: [] });
  const [fuelLevel, setFuelLevel] = useState(100);
  const [drowsinessCount, setDrowsinessCount] = useState(0);
  const [coffeeBreakCount, setCoffeeBreakCount] = useState(0);
  const [heartRateData, setHeartRateData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("Trip Metrics");

  // constrins for calculations
  const TIME_GAP_THRESHOLD = 5 * 60 * 1000;
  const BRAKING_THRESHOLD = 8;
  const SPEED_CONVERSION_FACTOR = 0.01;
  const EMPTY_FUEL_VALUE = 272;
  const FULL_FUEL_VALUE = 65535;

  // fetch user ID and iniate pulls 
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          fetchSensorData(userId); // load driving metrics
          fetchAlertData(userId);  // load alerts 

        }
      } catch (error) {
        console.error("Error fetching user ID:", error);
      }
    };

    fetchUserId();
  }, []);

  // fetch alert count - coffee break, drowsiness from  firestore 
  const fetchAlertData = async (userId) => {
    try {
      const snapshot = await firestore()
        .collection("users")
        .doc(userId)
        .collection("alerts") 
        .get();

      let drowsyAlerts = 0;
      let coffeeAlerts = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === "drowsiness") drowsyAlerts++;
        if (data.type === "coffee_break") coffeeAlerts++;
      });

      console.log("Total Drowsiness Alerts:", drowsyAlerts);
      console.log("Total Coffee Break Alerts:", coffeeAlerts);
      
      setDrowsinessCount(drowsyAlerts);
      setCoffeeBreakCount(coffeeAlerts);
    } catch (error) {
      console.error("Error fetching alert counts:", error);
    }
  };

  // fetch all trip related sensor data 
  const fetchSensorData = async (userId) => {
    try {
      const snapshot = await firestore()
        .collection("users")
        .doc(userId)
        .collection("sensor_data")
        .orderBy("timestamp", "desc")
        .get();
      
      // parse raw sensor readings 
      const rawSensorData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          timestamp: data.timestamp?.toDate().getTime() || new Date().getTime(),
          accelerometer: data.data?.Accelerometer || { x: 0, y: 0, z: 0 },
          potentiometer: data.data?.Potentiometer,
        };
      });

      console.log("Raw Sensor Data:", rawSensorData);
      rawSensorData.sort((a, b) => a.timestamp - b.timestamp);

      // process trips, braking, speed 
      let tripData = [];
      let avgSpeedsArr = [];
      let brakingCounts = [];
      let currentTrip = [];
      let lastTimestamp = null;
      let lastAcceleration = null;
      let lastSpeed = 0;

      rawSensorData.forEach((entry) => {
        // trip separator 5+ mins
        if (lastTimestamp && entry.timestamp - lastTimestamp > TIME_GAP_THRESHOLD) {
          const avgSpeed = currentTrip.length > 0
            ? Math.round(currentTrip.reduce((sum, e) => sum + e.speed, 0) / currentTrip.length)
            : 0;
          avgSpeedsArr.push(avgSpeed);
          brakingCounts.push(currentTrip.filter(e => e.harshBraking).length);
          tripData.push(currentTrip);
          console.log("Trip Avg Speed:", avgSpeed);
          console.log("Harsh Braking Count:", brakingCounts[brakingCounts.length - 1]);
          currentTrip = [];
          lastSpeed = 0;
        }

        // calculatr speed and braking from accelerometer
        const { x, y, z } = entry.accelerometer;
        let harshBraking = false;
        let accelerationMag = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        accelerationMag = (accelerationMag - 16384) * (9.81 / 16384);
        accelerationMag = Math.min(Math.max(accelerationMag, -15), 15);

        let deltaTime = (entry.timestamp - lastTimestamp) / 1000;
        if (deltaTime > 10) deltaTime = 0.5;
        if (deltaTime > 60) lastSpeed = 0;

        let newSpeed = lastSpeed + accelerationMag * deltaTime * SPEED_CONVERSION_FACTOR;
        newSpeed = Math.max(0, Math.min(newSpeed, 50));

        let deltaA = lastAcceleration ?
          Math.sqrt(
            (lastAcceleration.x - x) ** 2 +
            (lastAcceleration.y - y) ** 2 +
            (lastAcceleration.z - z) ** 2
          ) * (9.81 / 16384) : 0;

        if (deltaA > BRAKING_THRESHOLD) harshBraking = true;

        currentTrip.push({ ...entry, speed: Math.round(newSpeed), harshBraking });
        lastAcceleration = entry.accelerometer;
        lastTimestamp = entry.timestamp;
        lastSpeed = newSpeed;
      });

      // push final trip 
      if (currentTrip.length > 0) {
        const avgSpeed = currentTrip.length > 0
          ? Math.round(currentTrip.reduce((sum, e) => sum + e.speed, 0) / currentTrip.length)
          : 0;
        avgSpeedsArr.push(avgSpeed);
        brakingCounts.push(currentTrip.filter(e => e.harshBraking).length);
        tripData.push(currentTrip);
        console.log("Final Trip Avg Speed:", avgSpeed);
        console.log("Final Harsh Braking Count:", brakingCounts[brakingCounts.length - 1]);
      }

      // update state with trip metrics
      setTrips(tripData);
      setAvgSpeeds(avgSpeedsArr);
      setBrakingEvents(brakingCounts);

      // fuel level calculation
      if (rawSensorData.length > 0) {
        let rawFuel = rawSensorData[rawSensorData.length - 1]?.potentiometer;

        console.log(`🔹 Raw Potentiometer Value: ${rawFuel}`);

        if (rawFuel === undefined || rawFuel === null) {
            console.warn("⚠️ Potentiometer value missing! Defaulting to empty tank.");
            rawFuel = EMPTY_FUEL_VALUE;
        }
        // esnure values are within expected rnage
        rawFuel = Math.max(EMPTY_FUEL_VALUE, Math.min(FULL_FUEL_VALUE, rawFuel));

        let fuelPercent = ((rawFuel - EMPTY_FUEL_VALUE) / (FULL_FUEL_VALUE - EMPTY_FUEL_VALUE)) * 100;

        // ensure percentage satys between 0 - 100 %
        fuelPercent = Math.max(0, Math.min(100, fuelPercent));

        console.log(`Calculated Fuel Percentage: ${fuelPercent}%`);

        setFuelLevel(Math.round(fuelPercent));
    }

      // trips per day
      const tripsPerDayMap = {};
      tripData.forEach(trip => {
        const tripDate = new Date(trip[0].timestamp).toISOString().split("T")[0];
        tripsPerDayMap[tripDate] = (tripsPerDayMap[tripDate] || 0) + 1;
      });

      const sortedDates = Object.keys(tripsPerDayMap).sort((a, b) => new Date(a) - new Date(b));
      const tripsCount = sortedDates.map(dateKey => tripsPerDayMap[dateKey]);
      setTripsPerDay({ labels: sortedDates, counts: tripsCount });

      
      // fetching heart rate data 
      const heartRates = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          timestamp: data.timestamp?.toDate().getTime() || new Date().getTime(),
          heartRate: data.data?.["Heart Rate"] || 0, 
        };
      });
  
      console.log("Heart Rate Data:", heartRates);
  
      setHeartRateData(heartRates);


    } catch (error) {
      console.error("Error fetching sensor data:", error);
    } finally {
      setLoading(false);
    }
  };

  // load while fetching 
  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <ScrollView style={styles.container}>
      
      {/** top banner backgound image */}
      <View style={styles.topContainer}>
        <ImageBackground
          source={require("../../assets/images/background1.jpg")}
          style={styles.backgroundImage}
        >
        </ImageBackground>
      </View>
  
      {/** Metric selection (horizontal scroll) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricButtons}>
        {["Trip Metrics", "Safety Metrics", "Health Metrics", "Vehicle Metrics"].map((metric) => (
          <TouchableOpacity
            key={metric}
            style={[
              styles.metricButton,
              selectedMetric === metric && styles.selectedMetricButton
            ]}
            onPress={() => setSelectedMetric(metric)}
          >
            <Text style={[
              styles.metricText,
              selectedMetric === metric && styles.selectedMetricText
            ]}>
              {metric}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
  
      {/**chart continer */}
      <View style={styles.chartContainer}>
        {selectedMetric === "Trip Metrics" && (
          <Charts selectedMetric={selectedMetric} trips={trips} avgSpeeds={avgSpeeds} tripsPerDay={tripsPerDay} />
        )}
  
        {selectedMetric === "Safety Metrics" && (
          <Charts selectedMetric={selectedMetric} brakingEvents={brakingEvents} drowsinessCount={drowsinessCount} coffeeBreakCount={coffeeBreakCount} />
        )}
  
        {selectedMetric === "Health Metrics" && (
          <Charts selectedMetric={selectedMetric} heartRateData={heartRateData} />
        )}
  
        {selectedMetric === "Vehicle Metrics" && (
          <Charts selectedMetric={selectedMetric} fuelLevel={fuelLevel} />
        )}
      </View>
  
    </ScrollView>
  );
  
};
// style section
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  topContainer: {
    width: "100%",
    height: 220,
    position: "relative",
    borderBottomLeftRadius: 10,  
    borderBottomRightRadius: 10, 
    overflow: "hidden", 
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
    paddingVertical: 10,
    backgroundColor: "#f0f0f0", 
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#ccc",
    borderRadius: 10,
  },
  selectedButton: {
    backgroundColor: "#007bff", 
  },
  buttonText: {
    color: "black",
    fontWeight: "bold",
  },
  selectedButtonText: {
    color: "white",
  },
  backgroundImage: {
    position: "absolute", 
    width: "100%",
    height: "100%",
    resizeMode: "cover", 
  },
  metricButtons: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 15,
  },
  metricButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: "#EEE",
    marginHorizontal: 8,
  },
  selectedMetricButton: {
    backgroundColor: "#000",
  },
  metricText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
  },
  selectedMetricText: {
    color: "#FFF", 
  },
  chartContainer: {
    width: "100%", 
    backgroundColor: "#FFFFFF", 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 10,
    paddingBottom: 50,
    marginTop: 10,
    elevation: 5, 
  },
});

export default MetricsScreen;
