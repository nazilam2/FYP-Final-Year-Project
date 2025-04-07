// AdminRegister.js 
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, createUserWithEmailAndPassword, setDoc, doc, collection } from "./firebase";
import "./AdminRegister.css";

function AdminRegister() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save admin info in Firestore under 'admins' collection
      await setDoc(doc(db, "admins", user.uid), {
        email: user.email,
        name: name,
        role: "admin",
        userId: user.uid,
        createdAt: new Date()
      });

      localStorage.setItem("admin", JSON.stringify(user));
      navigate("/");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2 className="register-title">Registration</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleRegister} className="register-form">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Create password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="submit-button">Submit</button>
          <p className="login-link">Already have an account? <a href="/admin-login">Login</a></p>
        </form>
      </div>
    </div>
  );
}

export default AdminRegister;
