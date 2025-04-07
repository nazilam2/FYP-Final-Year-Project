import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore'; // Import Firestore
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage

const LoginForm = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    const { email, password } = formData;

    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Sign in user with Firebase Authentication
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Store user ID in AsyncStorage for sensor access
      await AsyncStorage.setItem('userId', user.uid);

      // Update Firestore with the active user ID in the "sensor_users" collection
      await firestore().collection('sensor_users').doc('active_user').set({
        userId: user.uid,
      });

      console.log('User logged in successfully.');
      
      // Reset navigation stack and navigate to HomePage
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],  // HomePage after login
      });
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage('Invalid email or password.');  // Update error message
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Login</Text>

      {/* Error message display */}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) => handleInputChange('email', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={formData.password}
        onChangeText={(text) => handleInputChange('password', text)}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* Navigation to Register */}
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.registerText}>Don't have an account? Register</Text>
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
  registerText: {
    textAlign: 'center',
    color: '#00bfff',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default LoginForm;
