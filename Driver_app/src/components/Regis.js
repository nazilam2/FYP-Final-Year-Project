import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Regis = ({ navigation }) => {
  const [formType, setFormType] = useState('Personal'); // 'Personal' or 'Company'
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    vehicleId: '',
    fleetId: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRegister = async () => {
    const { email, password, confirmPassword, name, vehicleId, fleetId } = formData;

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!email || !password || !name || (formType === 'Company' && (!vehicleId || !fleetId))) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Register user in Firebase Authentication
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Save user information in Firestore
      await firestore().collection('users').doc(user.uid).set({
        email,
        name,
        userId: user.uid, // Store user ID
        type: formType,
        vehicleId: formType === 'Company' ? vehicleId : null,
        fleetId: formType === 'Company' ? fleetId : null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Store user ID in AsyncStorage for sensor access
      await AsyncStorage.setItem('userId', user.uid);

      console.log('User registered:', user);
      navigation.navigate('Login'); // Navigate to Login after success
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage(error.message);  // More descriptive error
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Registration</Text>

      {/* Error message display */}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {/* Form Type Toggle */}
      <View style={styles.radioGroup}>
        <TouchableOpacity onPress={() => setFormType('Personal')} style={styles.radioButton}>
          <Text style={[styles.radioText, formType === 'Personal' && styles.selectedText]}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFormType('Company')} style={styles.radioButton}>
          <Text style={[styles.radioText, formType === 'Company' && styles.selectedText]}>Company</Text>
        </TouchableOpacity>
      </View>

      {/* Registration Form */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) => handleInputChange('email', text)}
      />
      <TextInput
        style={styles.input}
        placeholder={formType === 'Personal' ? "Name" : "Full Name"}
        value={formData.name}
        onChangeText={(text) => handleInputChange('name', text)}
      />

      {formType === 'Company' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Vehicle ID"
            value={formData.vehicleId}
            onChangeText={(text) => handleInputChange('vehicleId', text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Fleet ID"
            value={formData.fleetId}
            onChangeText={(text) => handleInputChange('fleetId', text)}
          />
        </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Create Password"
        secureTextEntry
        value={formData.password}
        onChangeText={(text) => handleInputChange('password', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={formData.confirmPassword}
        onChangeText={(text) => handleInputChange('confirmPassword', text)}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={handleRegister}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit</Text>
        )}
      </TouchableOpacity>

      {/* Navigation to Login */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginText}>Already registered? Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    alignSelf: 'center',
    width: '90%',
    marginTop: 50,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  radioButton: {
    marginHorizontal: 10,
  },
  radioText: {
    fontSize: 16,
    color: '#aaa',
  },
  selectedText: {
    fontWeight: 'bold',
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#00bfff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loginText: {
    textAlign: 'center',
    color: '#00bfff',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default Regis;
