import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from './firebase';
import './Drivers.css';

function Drivers() {
  const [companyDrivers, setCompanyDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [editDriver, setEditDriver] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompanyDrivers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const drivers = [];

        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.vehicleId || userData.fleetId) {
            drivers.push({ id: doc.id, ...userData });
          }
        });

        setCompanyDrivers(drivers);
      } catch (error) {
        setErrorMessage('Failed to fetch company drivers.');
        console.error('Error fetching company drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyDrivers();
  }, []);

  const handleDelete = async (userId) => {
    try {
      await deleteDoc(doc(db, "users", userId));
      setCompanyDrivers(companyDrivers.filter(driver => driver.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      setErrorMessage('Failed to delete user.');
    }
  };

  const handleUpdate = async (userId, updatedData) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, updatedData);
      setCompanyDrivers(companyDrivers.map(driver => 
        driver.id === userId ? { ...driver, ...updatedData } : driver
      ));
      setEditDriver(null);
    } catch (error) {
      console.error('Error updating user:', error);
      setErrorMessage('Failed to update user.');
    }
  };

  return (
    <div className="drivers-container">
      <header className="drivers-header">
        <h1>DriveGuard</h1>
      </header>
      <div className="drivers-main-content">
        <nav className="drivers-side-menu">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/safety">Safety</Link></li>
            <li><Link to="/sensor-data">Sensor Data</Link></li>
          </ul>
        </nav>
        <div className="drivers-content">
          <h2>Company Drivers</h2>
          {loading ? <p>Loading company drivers...</p> : null}
          {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
          <div className="driver-list">
            {companyDrivers.map(driver => (
              <div key={driver.id} className="driver-item">
                <Link to={`/sensor-data/${driver.id}`} className="driver-name">
                  {driver.name}
                </Link>
                <div className="actions">
                  <button className="edit-btn" onClick={() => setEditDriver(driver)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(driver.id)}>Delete</button>
                </div>
                <div className="company-details">
                  {driver.vehicleId && <p><strong>Vehicle ID:</strong> {driver.vehicleId}</p>}
                  {driver.fleetId && <p><strong>Fleet ID:</strong> {driver.fleetId}</p>}
                </div>
              </div>
            ))}
          </div>
          {editDriver && (
            <div className="modal-overlay" onClick={() => setEditDriver(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={() => setEditDriver(null)}>✖</button>
                <h3>Edit Driver: {editDriver.name}</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const updatedData = {
                      name: e.target.name.value,
                      vehicleId: e.target.vehicleId.value,
                      fleetId: e.target.fleetId.value,
                    };
                    handleUpdate(editDriver.id, updatedData);
                  }}
                >
                  <label>
                    Name:
                    <input type="text" defaultValue={editDriver.name} name="name" />
                  </label>
                  <label>
                    Vehicle ID:
                    <input type="text" defaultValue={editDriver.vehicleId} name="vehicleId" />
                  </label>
                  <label>
                    Fleet ID:
                    <input type="text" defaultValue={editDriver.fleetId} name="fleetId" />
                  </label>
                  <button type="submit">Update</button>
                  <button type="button" onClick={() => setEditDriver(null)}>Cancel</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drivers;
