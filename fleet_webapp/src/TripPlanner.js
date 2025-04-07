import React, { useState, useEffect } from "react";
import { collection, doc, addDoc, getDoc, getDocs , onSnapshot, query } from "firebase/firestore";
import { db } from "./firebase";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./TripPlanner.css";
import { useNavigate } from "react-router-dom";
import polyline from "polyline"; // Import polyline for decoding
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


const ORS_API_KEY = "5b3ce3597851110001cf624870ee4fdffebe4466afe36ccea5eac325"; // Ensure API Key is correct

const AutoZoom = ({ route }) => {
  const map = useMap();
  useEffect(() => {
    if (route.length > 0) {
      const bounds = route.map(point => [point[0], point[1]]);
      map.fitBounds(bounds);
    }
  }, [route, map]);
  return null;
};

function TripPlanner() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trips, setTrips] = useState([]);
  const [activeTab, setActiveTab] = useState("ongoing"); // 🆕 Controls the trip tab (Ongoing/Completed)
  const [selectedTrip, setSelectedTrip] = useState(null); // 🆕 Stores the selected trip

 // Define state for date and estimated time
 const [selectedDate, setSelectedDate] = useState(null);
 

  useEffect(() => {
    const fetchDrivers = async () => {
      const driversRef = collection(db, "users");
      const snapshot = await getDocs(driversRef);
      setDrivers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchDrivers();
  }, []);

  useEffect(() => {
    const fetchAllTrips = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        let allTrips = [];
  
        const fetchTripsForUser = async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const userTripsCollection = collection(db, "users", userId, "trips");
  
          // Subscribe to real-time updates
          onSnapshot(userTripsCollection, (tripsSnapshot) => {
            let userTrips = tripsSnapshot.docs.map((tripDoc) => ({
              id: tripDoc.id,
              driverName: userData.name, // Include driver name
              ...tripDoc.data(),
            }));
  
            // Merge user trips into all trips list
            allTrips = [...allTrips, ...userTrips];
  
            setTrips(allTrips); // ✅ Update state with all trips
            setLoading(false);
          });
        };
  
        // Fetch trips for each driver
        const tripPromises = usersSnapshot.docs.map((userDoc) => fetchTripsForUser(userDoc));
        await Promise.all(tripPromises);
      } catch (error) {
        setErrorMessage("Error fetching trips. Check Firestore rules.");
        console.error("🔥 Error fetching trips:", error);
        setLoading(false);
      }
    };
  
    fetchAllTrips();
  }, []); // ✅ No selectedDriver dependency
  
  
  const geocodeAddress = async (address) => {
    const apiUrl = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}`;
    
    try {
      console.log(`Fetching coordinates for: ${address}`);
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log("Geocode API Response:", data);

      if (data.features && data.features.length > 0) {
        return {
          lat: data.features[0].geometry.coordinates[1],  // Latitude
          lng: data.features[0].geometry.coordinates[0],  // Longitude
        };
      } else {
        console.error("Geocoding error: No results found for", address);
        setErrorMessage(`Invalid address: ${address}. Please check.`);
        return null;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setErrorMessage("Error fetching location data.");
      return null;
    }
  };

  const fetchRoute = async () => {
    if (!startAddress || !destinationAddress) return;
    setLoading(true);
    setErrorMessage("");

    const startLocation = await geocodeAddress(startAddress);
    const destination = await geocodeAddress(destinationAddress);

    if (!startLocation || !destination) {
        console.error("Invalid coordinates:", startLocation, destination);
        setErrorMessage("Could not retrieve valid locations. Check addresses.");
        setLoading(false);
        return;
    }

    const coordinates = [[startLocation.lng, startLocation.lat], [destination.lng, destination.lat]];
    const apiUrl = `https://api.openrouteservice.org/v2/directions/driving-car`;

    console.log("Sending request with coordinates:", JSON.stringify(coordinates));

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": ORS_API_KEY,
            },
            body: JSON.stringify({
                coordinates: coordinates,
                format: "geojson", // Ensure correct format
            }),
        });

        const data = await response.json();
        console.log("Full Route API Response:", data);

        // ✅ Ensure `routes` exists and contains geometry
        if (!data.routes || data.routes.length === 0) {
            console.error("No valid route found:", data);
            setErrorMessage("Route data is missing or invalid.");
            setRoute([]);
            setLoading(false);
            return;
        }

        // ✅ Decode polyline geometry
        const encodedPolyline = data.routes[0]?.geometry;
        if (!encodedPolyline) {
            console.error("Invalid route geometry:", data.routes[0]);
            setErrorMessage("Route data is missing or invalid.");
            setRoute([]);
            setLoading(false);
            return;
        }

        // 🛑 Decode the polyline geometry
        const decodedRoute = polyline.decode(encodedPolyline).map(([lat, lng]) => [lat, lng]);

        setRoute(decodedRoute);
        setEstimatedTime(`${(data.routes[0].summary.duration / 60).toFixed(1)} min`);
        setErrorMessage("");

    } catch (error) {
        console.error("Error fetching route from OpenRouteService:", error);
        setErrorMessage("Error retrieving route data. Check API key and quota.");
        setRoute([]);
    }
    setLoading(false);
};


  useEffect(() => {
    fetchRoute();
  }, [startAddress, destinationAddress]);

  const handleSubmit = async () => {
    if (!selectedDriver || !startAddress || !destinationAddress) {
      setErrorMessage("Please select a driver and enter valid addresses.");
      return;
    }

    const tripData = {
      startAddress,
      destinationAddress,
      estimatedTime,
      status: "pending",
      createdAt: new Date(),
    };

    try {
      const userRef = doc(db, "users", selectedDriver);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setErrorMessage("Driver data not found in database.");
        return;
      }

      const tripsCollectionRef = collection(db, "users", selectedDriver, "trips");
      await addDoc(tripsCollectionRef, tripData);
      navigate("/");
    } catch (error) {
      setErrorMessage("Failed to create trip. Check Firestore permissions.");
    }
  };

  const handleTripClick = async (trip) => {
    setSelectedTrip(trip); // ✅ Store selected trip
    setErrorMessage("");
    setRoute([]); // ✅ Clear old route
    
    // Convert Firestore Timestamp to JavaScript Date
    if (trip.createdAt) {
        const tripDate = trip.createdAt.toDate ? trip.createdAt.toDate() : new Date(trip.createdAt); 
        setSelectedDate(tripDate);
    }

    // Fetch route for the selected trip
    const startLocation = await geocodeAddress(trip.startAddress);
    const destination = await geocodeAddress(trip.destinationAddress);

    if (!startLocation || !destination) {
        setErrorMessage("Could not retrieve valid locations.");
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
            body: JSON.stringify({ coordinates, format: "geojson" }),
        });

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            setErrorMessage("Route data is missing.");
            return;
        }

        const encodedPolyline = data.routes[0]?.geometry;
        const decodedRoute = polyline.decode(encodedPolyline).map(([lat, lng]) => [lat, lng]);

        setRoute(decodedRoute); // ✅ Show route on map
        setEstimatedTime(`${(data.routes[0].summary.duration / 60).toFixed(1)} min`);
    } catch (error) {
        setErrorMessage("Error retrieving route data.");
    }
};

  

  return (
    <div className="trip-dashboard">
      <div className="top-section">
        {/* LEFT COLUMN: MAP */}
        <div className="left-column">
          <div className="trip-map-container">
            <MapContainer center={[53.35, -6.26]} zoom={8} style={{ width: "100%", height: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <AutoZoom route={route} />
              {route.length > 0 && <Polyline positions={route} color="blue" />}
            </MapContainer>
          </div>
        </div>
  
        {/* RIGHT COLUMN: TRIP FORM */}
        <div className="right-column">
        <div className="trip-form-container">
          <h2 className="form-title">Create Trip</h2>

          <div className="form-group">
            <label className="form-label">👤 Driver</label>
            <select 
              className="form-input" 
              onChange={(e) => setSelectedDriver(e.target.value)} 
              value={selectedDriver}>
              <option value="">Select Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.vehicleId})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">📍 Start Location</label>
            <input
              className="form-input"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              placeholder="Start address"
            />
          </div>

          <div className="form-group">
            <label className="form-label">📌 Destination</label>
            <input
              className="form-input"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="Destination address"
            />
          </div>

          {estimatedTime && !loading && (
            <div className="estimated-time">
              🕒 Estimated: {estimatedTime}
            </div>
          )}

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <button
            className="create-trip-btn"
            onClick={handleSubmit}
            disabled={!selectedDriver || !startAddress || !destinationAddress || loading}
          >
            {loading ? "Loading..." : "✨ Create Trip"}
          </button>
        </div>
      </div>

      </div>
  
      {/* BOTTOM SECTION: TRIPS LIST */}
      <div className="bottom-section">
  {/* Ongoing Trips Column */}
  <div className="bottom-section">
  {/* Ongoing Trips Column */}
  <div className="trips-container">
    <h3 className="trip-heading">🚗 Ongoing Trips</h3>
    <div className="trip-grid">
      {trips.filter(trip => trip.status === "pending").map((trip) => (
        <div className="trip-card" key={trip.id} onClick={() => handleTripClick(trip)}>
          <p><strong>Driver:</strong> {trip.driverName}</p>
          <p><strong>Start:</strong> {trip.startAddress}</p>
          <p><strong>Destination:</strong> {trip.destinationAddress}</p>
        </div>
      ))}
    </div>
  </div>

  {/* Completed Trips Column */}
  <div className="trips-container">
    <h3 className="trip-heading">✅ Completed Trips</h3>
    <div className="trip-grid">
      {trips.filter(trip => trip.status === "complete").map((trip) => (
        <div className="trip-card completed" key={trip.id} onClick={() => handleTripClick(trip)}>
          <p><strong>Driver:</strong> {trip.driverName}</p>
          <p><strong>Start:</strong> {trip.startAddress}</p>
          <p><strong>Destination:</strong> {trip.destinationAddress}</p>
        </div>
      ))}
    </div>
  </div>
</div>

{/* ✅ Combined Calendar & Estimated Time (Stacked) */}
<div className="calendar-estimated-container">
    
    {/* 📅 Calendar on Top */}
    <div className="calendar-container">
        <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            inline
        />
    </div>

    {/* ⏳ Estimated Time Below */}
    <div className="estimated-time-container">
        <h3>🕒 Estimated Time</h3>
        <div className="estimated-time">
            {estimatedTime ? estimatedTime : "Select a trip"}
        </div>
    </div>

</div>   
</div>  
    </div>
  );
  
}  

export default TripPlanner;
