import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, TextInput, Linking, Platform, ScrollView } from "react-native";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview"; // ✅ Use WebView for Leaflet
import polyline from "@mapbox/polyline";

const ORS_API_KEY = "5b3ce3597851110001cf624870ee4fdffebe4466afe36ccea5eac325";

const DriverTripsScreen = () => {
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [route, setRoute] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentCoords, setCurrentCoords] = useState(null);
  const [selectedTab, setSelectedTab] = useState('ongoing');


  useEffect(() => {
    const fetchUserIdAndGPS = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          fetchTrips(userId);
          const gps = await fetchLatestGPSData(userId);
          if (gps) setCurrentCoords(gps);
        } else {
          setErrorMessage("User ID not found. Please log in again.");
          setLoading(false);
        }
      } catch (error) {
        setErrorMessage("Failed to fetch user ID.");
        setLoading(false);
      }
    };
  
    fetchUserIdAndGPS();
  }, []);
  

  // ✅ Fetch trips from Firestore for the logged-in driver
  const fetchTrips = async (userId) => {
    try {
      const tripsRef = firestore().collection("users").doc(userId).collection("trips");
  
      const unsubscribe = tripsRef.onSnapshot((snapshot) => {
        const driverTrips = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
  
        setTrips(driverTrips);
        setLoading(false);
      });
  
      return () => unsubscribe();
    } catch (error) {
      setErrorMessage("Failed to fetch trips.");
      setLoading(false);
    }
  };

  const markTripAsComplete = async (tripId) => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setErrorMessage("User ID not found.");
        return;
      }
  
      await firestore().collection("users").doc(userId).collection("trips").doc(tripId).update({
        status: "complete",
      });
  
      setTrips((prevTrips) =>
        prevTrips.map((trip) =>
          trip.id === tripId ? { ...trip, status: "complete" } : trip
        )
      );
  
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Failed to update trip status.");
    }
  };
  
  const fetchLatestGPSData = async (userId) => {
    try {
      const snapshot = await firestore()
        .collection("users")
        .doc(userId)
        .collection("sensor_data")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
  
      if (!snapshot.empty) {
        const latestData = snapshot.docs[0].data();
        return {
          latitude: latestData.data.GPS.Latitude,
          longitude: latestData.data.GPS.Longitude,
        };
      } else {
        setErrorMessage("No GPS data found.");
        return null;
      }
    } catch (error) {
      setErrorMessage("Error fetching GPS data.");
      return null;
    }
  };
  

  // ✅ Convert address to coordinates using OpenRouteService
  const geocodeAddress = async (address) => {
    const apiUrl = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        return {
          lat: data.features[0].geometry.coordinates[1], // Latitude
          lng: data.features[0].geometry.coordinates[0], // Longitude
        };
      } else {
        setErrorMessage(`Invalid address: ${address}. Please check.`);
        return null;
      }
    } catch (error) {
      setErrorMessage("Error fetching location data.");
      return null;
    }
  };

  // ✅ Fetch Route from OpenRouteService
  const fetchRoute = async (startAddress, destinationAddress) => {
    if (!startAddress || !destinationAddress) return;

    setLoading(true);
    setErrorMessage("");

    const startLocation = await geocodeAddress(startAddress);
    const destination = await geocodeAddress(destinationAddress);

    if (!startLocation || !destination) {
      setErrorMessage("Could not retrieve valid locations. Check addresses.");
      setLoading(false);
      return;
    }

    const coordinates = [[startLocation.lng, startLocation.lat], [destination.lng, destination.lat]];
    const apiUrl = `https://api.openrouteservice.org/v2/directions/driving-car`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": ORS_API_KEY,
        },
        body: JSON.stringify({ coordinates: coordinates }),
      });

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        setErrorMessage("Route data is missing or invalid.");
        setRoute([]);
        setLoading(false);
        return;
      }

      // ✅ Decode polyline geometry
      const encodedPolyline = data.routes[0]?.geometry;
      if (!encodedPolyline) {
        setErrorMessage("Route data is missing or invalid.");
        setRoute([]);
        setLoading(false);
        return;
      }

      // 🔥 Decode the polyline geometry
      const decodedRoute = polyline.decode(encodedPolyline).map(([lat, lng]) => [lat, lng]);

      setRoute(decodedRoute);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Error retrieving route data. Check API key and quota.");
      setRoute([]);
    }
    setLoading(false);
  };

  // ✅ When a trip is selected, fetch the route
  const handleTripSelect = async (trip) => {
    setSelectedTrip(trip);
    setLoading(true);
  
    const userId = await AsyncStorage.getItem("userId");
    
    const gpsRef = firestore()
      .collection("users")
      .doc(userId)
      .collection("sensor_data")
      .orderBy("timestamp", "desc")
      .limit(1);
  
    gpsRef.onSnapshot(snapshot => {
      if (!snapshot.empty) {
        const latestData = snapshot.docs[0].data();
        const coords = {
          latitude: latestData.data.GPS.Latitude,
          longitude: latestData.data.GPS.Longitude,
        };
  
        // Fetch and update route with new GPS coords
        fetchRouteWithFirestoreGPS(coords, trip.destinationAddress);
      }
    }, error => {
      console.error("Real-time listener error:", error);
      setErrorMessage("Real-time GPS update failed.");
      setLoading(false);
    });
  };
  

  const fetchRouteWithFirestoreGPS = async (currentCoords, destinationAddress) => {
    setLoading(true);
    setErrorMessage("");
  
    const destination = await geocodeAddress(destinationAddress);
    if (!destination) {
      setErrorMessage("Invalid destination address.");
      setLoading(false);
      return;
    }
  
    const coordinates = [
      [currentCoords.longitude, currentCoords.latitude],
      [destination.lng, destination.lat],
    ];
  
    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({ coordinates }),
      });
  
      const data = await response.json();
      const encodedPolyline = data.routes[0]?.geometry;
      const decodedRoute = polyline.decode(encodedPolyline).map(([lat, lng]) => [lat, lng]);
  
      setRoute(decodedRoute);
    } catch (error) {
      setErrorMessage("Failed to fetch route.");
    }
  
    setLoading(false);
  };
  
  

  // ✅ Generate HTML for WebView (Leaflet Map)
  const generateMapHtml = () => {
    const start = route.length > 0
      ? route[0]
      : currentCoords
        ? [currentCoords.latitude, currentCoords.longitude]
        : [53.349805, -6.26031]; // fallback to Dublin coords
  
    const polylineString = JSON.stringify(route);
  
    return `
      <!DOCTYPE html>
      <html style="height:100%; width:100%; margin:0; padding:0;">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      </head>
      <body style="height:100%; width:100%; margin:0; padding:0;">
        <div id="map" style="width:100%; height:100%;"></div>
        <script>
          var map = L.map('map').setView([${start[0]}, ${start[1]}], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);
  
          var route = ${polylineString};
          if (route.length > 0) {
            L.polyline(route, { color: 'blue' }).addTo(map);
            map.fitBounds(route);
  
            L.marker(route[0], {
              icon: L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' })
            }).addTo(map).bindPopup("You (Current Location)").openPopup();
  
            L.marker(route[route.length - 1], {
              icon: L.icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' })
            }).addTo(map).bindPopup("Destination");
          } else {
            L.marker([${start[0]}, ${start[1]}]).addTo(map).bindPopup("Current Location").openPopup();
          }
        </script>
      </body>
      </html>
    `;
  };
  
  
  
  return (
    <View style={styles.container}>
      {/* 🗺️ Map at the top */}
      {(currentCoords || route.length > 0) && (
        <View style={styles.mapWrapper}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: generateMapHtml() }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            scalesPageToFit={false}
          />
        </View>
      )}
  
      {/* 🔻 Curved bottom card */}
      <View style={styles.bottomSheet}>
        {loading && <ActivityIndicator size="large" color="#007bff" />}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
  
        {/* 🔘 Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, selectedTab === 'ongoing' && styles.activeTab]}
            onPress={() => {
              setSelectedTab('ongoing');
              setSelectedTrip(null);
            }}
          >
            <Text style={styles.tabText}>Ongoing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, selectedTab === 'completed' && styles.activeTab]}
            onPress={() => {
              setSelectedTab('completed');
              setSelectedTrip(null);
            }}
          >
            <Text style={styles.tabText}>Completed</Text>
          </TouchableOpacity>
        </View>
  
        {/* 📋 Trip list */}
        <FlatList
          data={trips.filter(trip => 
            trip.status === (selectedTab === 'ongoing' ? 'pending' : 'complete') &&
            trip.id !== selectedTrip?.id
          )}
          
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleTripSelect(item)}>
              <View style={styles.tripCard}>
                <Text style={styles.tripText}><Text style={styles.label}>Start:</Text> {item.startAddress}</Text>
                <Text style={styles.tripText}><Text style={styles.label}>Destination:</Text> {item.destinationAddress}</Text>
                <Text style={styles.tripText}><Text style={styles.label}>ETA:</Text> {item.estimatedTime} min</Text>
              </View>
            </TouchableOpacity>
          )}
        />
  
        {/* 📦 Trip details + action buttons */}
        {selectedTrip && (
          <View style={styles.tripDetails}>
            <Text style={styles.detailText}><Text style={styles.label}>Start:</Text> {selectedTrip.startAddress}</Text>
            <Text style={styles.detailText}><Text style={styles.label}>Destination:</Text> {selectedTrip.destinationAddress}</Text>
            <Text style={styles.detailText}><Text style={styles.label}>Estimated Time:</Text> {selectedTrip.estimatedTime} min</Text>  
            {selectedTrip.status !== "complete" && (
              <>
                <TouchableOpacity style={styles.button} onPress={() => markTripAsComplete(selectedTrip.id)}>
                  <Text style={styles.buttonText}>Mark as Complete</Text>
                </TouchableOpacity>
  
                <TouchableOpacity
                  style={[styles.button, { marginTop: 10, backgroundColor: "#28a745" }]}
                  onPress={() => {
                    const url = Platform.select({
                      ios: `maps:0,0?q=${encodeURIComponent(selectedTrip.destinationAddress)}`,
                      android: `google.navigation:q=${encodeURIComponent(selectedTrip.destinationAddress)}`,
                    });
  
                    Linking.openURL(url).catch((err) => {
                      console.error('An error occurred', err);
                      setErrorMessage("Unable to open Maps. Make sure it's installed.");
                    });
                  }}
                >
                  <Text style={styles.buttonText}>Start Navigation</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
  
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E1DC',
    padding: 0, // remove padding
    position: 'relative',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#8699ac',
    borderRadius: 12,
    marginTop: 15,
    marginBottom: 10,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#A8B3C2',
  },
  activeTab: {
    backgroundColor: '#5A6C7B',
  },
  tabText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripCard: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 15,
    marginVertical: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapWrapper: {
    height: '60%',
    width: '100%',
  },
  
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 20,
    zIndex: 1,
    minHeight: '20%', // make it taller
  },
  
  
  
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  tripText: { fontSize: 16, marginBottom: 5 },
  label: { fontWeight: "bold" },
  mapContainer: { height: 300, marginTop: 10 },
  map: { flex: 1 },
  input: { height: 40, borderWidth: 1, marginBottom: 10, padding: 10, borderRadius: 5, backgroundColor: "#fff" },
  button: { backgroundColor: "#007bff", padding: 10, borderRadius: 5, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  error: { color: "red", marginTop: 10, textAlign: "center" },
  tripDetails: { padding: 20, backgroundColor: "#E3F2FD", marginVertical: 10, borderRadius: 10 },
  detailText: { fontSize: 16, marginBottom: 5 },

});


export default DriverTripsScreen;
