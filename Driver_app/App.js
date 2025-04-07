import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native'; // Add these imports
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomePage from './src/components/HomePage'; // HomePage component
import MetricsScreen from './src/components/MetricsScreen'; // Metrics screen component
import DriveMonitoring from './src/components/DriveMonitoring'; // Drive Monitoring component
import Regis from './src/components/Regis'; // Registration screen component
import LoginForm from './src/components/LoginForm'; // LoginForm component
import auth from '@react-native-firebase/auth'; // Import Firebase Authentication
import 'react-native-reanimated';
import DriverTripsScreen from './src/components/DriverTripsScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
Ionicons.loadFont(); // Ensure the font is loaded
// Create a stack navigator instance
const Stack = createStackNavigator();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // State to track authentication
  const [isLoading, setIsLoading] = useState(true); // State to track initial loading

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (user) {
        // User is logged in
        setIsAuthenticated(true);
      } else {
        // User is logged out
        setIsAuthenticated(false);
      }
      setIsLoading(false); // Set loading to false after checking auth state
    });

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  // Show a loading indicator while checking authentication status
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={isAuthenticated ? "Home" : "Login"}>
        <Stack.Screen
          name="Home"
          component={HomePage}
          options={{ title: 'DriveGuard' }}
        />
        <Stack.Screen
          name="Metrics"
          component={MetricsScreen}
          options={{ title: 'Metrics' }}
        />
        <Stack.Screen
          name="DriveMonitoring"
          component={DriveMonitoring}
          options={{ title: 'Drive Monitoring' }}
        />
        <Stack.Screen
          name="Register"
          component={Regis}
          options={{ title: 'Register' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginForm}
          options={{ title: 'Login' }}
        />
        <Stack.Screen name="DriverTrips" component={DriverTripsScreen} options={{ title: 'Your Trips' }} /> 
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;