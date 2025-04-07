// AdminProtectedRoute.js (Updated to Firestore - Separate Collection)
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { db, getDoc, doc } from "./firebase";

const AdminProtectedRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const storedUser = JSON.parse(localStorage.getItem("admin"));
      if (!storedUser) {
        setIsAdmin(false);
        return;
      }
      const adminRef = doc(db, "admins", storedUser.uid);
      const adminSnap = await getDoc(adminRef);
      setIsAdmin(adminSnap.exists());
    };
    checkAdmin();
  }, []);

  if (isAdmin === null) return <p>Loading...</p>;
  return isAdmin ? children : <Navigate to="/admin-login" />;
};

export default AdminProtectedRoute;