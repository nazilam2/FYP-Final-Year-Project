import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Home.css";

// Icons for Online (Green) & Offline (Red) Drivers
const greenMarkerIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const redMarkerIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// ✅ Auto-Zoom Component
const AutoZoom = ({ drivers }) => {
  const map = useMap();

  useEffect(() => {
    if (drivers.length > 0) {
      const bounds = L.latLngBounds(
        drivers.map((driver) => [driver.latitude, driver.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drivers, map]);

  return null;
};


function Home() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [mapDrivers, setMapDrivers] = useState([]);
  const [showPopup, setShowPopup] = useState(false); // ✅ Toggle search pop-up
  // ✅ Define defaultPosition before JSX
  const defaultPosition = mapDrivers.length > 0
    ? [mapDrivers[0].latitude, mapDrivers[0].longitude]
    : [53.4129, -8.2439]; // Default fallback position (Ireland)

    useEffect(() => {
      const fetchDrivers = async () => {
        try {
          const driversRef = collection(db, "users");
          const snapshot = await getDocs(driversRef);
    
          // Fetch active user from Firestore
          const activeUserRef = collection(db, "sensor_users");
          const activeUserDoc = await getDocs(activeUserRef);
          let activeUserId = null;
    
          activeUserDoc.forEach((doc) => {
            if (doc.id === "active_user") {
              activeUserId = doc.data().userId; // Extract active userId
            }
          });
    
          console.log("Active User ID:", activeUserId); // Debugging
    
          const driverPromises = snapshot.docs.map(async (doc) => {
            const userData = doc.data();
            const driverId = doc.id;
    
            if (userData.type !== "Company") {
              return null; // Ignore non-company users
            }
    
            //Fetch latest GPS & activity data
            const sensorDataRef = collection(db, "users", driverId, "sensor_data");
            const sensorQuery = query(sensorDataRef, orderBy("timestamp", "desc"), limit(1));
            const sensorSnapshot = await getDocs(sensorQuery);
    
            let latestGPS = null;
            let isOnline = driverId === activeUserId; // Active user check
    
            if (!sensorSnapshot.empty) {
              const latestSensorData = sensorSnapshot.docs[0].data();
              latestGPS = latestSensorData.data?.GPS || null;
            }
    
            return {
              id: driverId,
              name: userData.name || "Unknown Driver",
              vehicleId: userData.vehicleId || "N/A",
              fleetId: userData.fleetId || "N/A",
              latitude: latestGPS?.Latitude || null,
              longitude: latestGPS?.Longitude || null,
              isOnline: isOnline, // Use Firestore active user data
            };
          });
    
          const driverData = await Promise.all(driverPromises);
          const filteredDrivers = driverData.filter(driver => driver !== null);
    
          setDrivers(filteredDrivers);
          setMapDrivers(filteredDrivers.filter(driver => driver.latitude !== null && driver.longitude !== null));
          
          console.log("Drivers on the map:", filteredDrivers);
        } catch (error) {
          console.error("Error fetching drivers:", error);
        }
      };
    
      fetchDrivers();
    }, []);
    

  const handleLogout = async () => {
    localStorage.clear();
    navigate("/admin-login");
  };

  // Search Logic: Filters all drivers, not just those on the map
  useEffect(() => {
    const results = drivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.vehicleId.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredDrivers(results);
    setShowPopup(searchTerm.length > 0); // Show pop-up only when searching

    // If the searched driver has GPS, add them to the map
    //setMapDrivers(results.filter(driver => driver.latitude !== null && driver.longitude !== null));
  }, [searchTerm, drivers]);

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <h1>DriveGuard</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div className="home-main-content">
        {/* Side Menu */}
        <nav className="home-side-menu">
          <ul>
            <li><Link to="/drivers">Drivers</Link></li>
            <li><Link to="/safety">Safety</Link></li>
            <li><Link to="/trip-planner">Trip Planner</Link></li>
          </ul>
        </nav>

        {/* Map & Search Section */}
        <div className="home-map-section">
          {/* Search Bar */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search for a driver (name/vehicle ID)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-button">🔍</button>
          </div>

          {/* Interactive Map - Always show all drivers */}
          
          <MapContainer
          center={defaultPosition}
          zoom={10}
          className="map-container"
          style={{ height: "500px", width: "100%" }} // ✅ enforce it here
        >

            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <AutoZoom drivers={mapDrivers} />

            {/* Display all drivers on the map */}
            {mapDrivers.map((driver, index) => (
            <Marker
              key={driver.id}
              position={[
                driver.latitude + index * 0.0001,  // Slightly shift latitude
                driver.longitude + index * 0.0001 // Slightly shift longitude
              ]}
              icon={driver.isOnline ? greenMarkerIcon : redMarkerIcon}
            >
              <Popup>
                <div
                  className="popup-content"
                  onClick={() => navigate(`/sensor-data/${driver.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <h3>{driver.name}</h3>
                  <p><strong>Vehicle:</strong> {driver.vehicleId}</p>
                  <p><strong>Fleet:</strong> {driver.fleetId}</p>
                  <p style={{ color: driver.isOnline ? "green" : "red", fontWeight: "bold" }}>
                    {driver.isOnline ? "🟢 Online" : "🔴 Offline"}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          </MapContainer>

          {/* Floating Search Results Pop-Up */}
          {showPopup && (
            <div className="search-popup-overlay" onClick={() => setShowPopup(false)}>
              <div className="search-popup" onClick={(e) => e.stopPropagation()}>
                <button className="close-popup" onClick={() => setShowPopup(false)}>✖</button>
                {filteredDrivers.length > 0 ? (
                  filteredDrivers.map((driver) => (
                    <div key={driver.id} className="search-result-card" onClick={() => navigate(`/sensor-data/${driver.id}`)}>
                      <p><strong>{driver.name}</strong></p>
                      <p>Vehicle ID: {driver.vehicleId}</p>
                      <p>Fleet ID: {driver.fleetId}</p>
                    </div>
                  ))
                ) : (
                  <p>No matching drivers found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
