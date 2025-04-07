import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./Home";
import SensorData from "./SensorData";
import Drivers from "./Drivers";
import AdminRegister from "./AdminRegister";
import AdminLogin from "./AdminLogin";
import TripPlanner from "./TripPlanner";  // ✅ Import the new page
import AdminProtectedRoute from "./AdminProtectedRoute";
import 'font-awesome/css/font-awesome.min.css';


function App() {
  return (
    <Router>
      <Routes>
        {/* Protected Routes - Only logged-in admins can access */}
        <Route
          path="/"
          element={
            <AdminProtectedRoute>
              <Home />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/sensor-data"
          element={
            <AdminProtectedRoute>
              <SensorData />
            </AdminProtectedRoute>
          }
        />
        {/* ✅ Add dynamic sensor-data route for a specific driver */}
        <Route
          path="/sensor-data/:driverId"
          element={
            <AdminProtectedRoute>
              <SensorData />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <AdminProtectedRoute>
              <Drivers />
            </AdminProtectedRoute>
          }
        />

        {/* ✅ Added Trip Planner Route */}
        <Route
          path="/trip-planner"
          element={
            <AdminProtectedRoute>
              <TripPlanner />
            </AdminProtectedRoute>
          }
        />

        {/* Public Routes */}
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/admin-login" element={<AdminLogin />} />
      </Routes>
    </Router>
  );
}

export default App;
