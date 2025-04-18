
/** 
  Name: Nazila Malekzadah C21414344
  Date: 11/04/2025
  Description: allow users to ragister
 */

// import lib
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signInWithEmailAndPassword, getDoc, doc, collection } from "./firebase";
import "./AdminLogin.css";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user is an admin in Firestore 'admins' collection
      const adminRef = doc(db, "admins", user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        setError("Not authorized as an admin.");
        return;
      }

      localStorage.setItem("admin", JSON.stringify(user));
      navigate("/");
    } catch (error) {
      setError("Invalid email or password.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">Login</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="submit-button">Submit</button>
          <p className="register-link">Don't have an account? <a href="/admin-register">Register</a></p>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
