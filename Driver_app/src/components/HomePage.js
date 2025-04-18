/** 
 * Name: Nazila Malekzadah C21414344
 * Date: 11/04/2025
 * Description: Main entry point for the driver's home UI 
 * Features: 
 * - wecome screen with user greeting 
 * - quick aceess to other screens
 * - displat ongoing todays trips
 * - buttom tab naviagtion 
 */

// import lib
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons'; 

// Screens 
import DriveMonitoring from './DriveMonitoring';
import MetricsScreen from './MetricsScreen';
import DriverTripsScreen from './DriverTripsScreen';

// home page component
const HomePage = () => {
  const navigation = useNavigation();
  const [userName, setUserName] = useState('');
  const [ongoingTrips, setOngoingTrips] = useState([]);

  // fetch user and trip data 
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      let name = currentUser.displayName || (currentUser.email?.split('@')[0] || 'User');
      name = name.split(/[\s.]/)[0]; // get first name 
      setUserName(name);
      fetchOngoingTrips(currentUser.uid);
    }
  }, []);

  // get users ongoing trips from firestore 
  const fetchOngoingTrips = async (userId) => {
    try {
      const tripsRef = firestore().collection('users').doc(userId).collection('trips');
      const snapshot = await tripsRef.where('status', '==', 'pending').get();
      const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOngoingTrips(trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  return (
    <View style={styles.container}>
    
      {/** welcome page */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>👋 Welcome, {userName}!</Text>
        <Text style={styles.subtitle}>Let's get you started!</Text>
      </View>


      {/** categories section */}
      <Text style={styles.sectionTitle}>Category</Text>
      <FlatList
      data={[
        { id: '1', title: 'Drive Monitoring', screen: 'DriveMonitoring', icon: 'car-sport-outline' },
        { id: '2', title: 'Metrics', screen: 'Metrics', icon: 'pie-chart-outline' },
        { id: '3', title: 'My Trips', screen: 'DriverTrips', icon: 'map-outline' },
      ]}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.categoryCard} onPress={() => navigation.navigate(item.screen)}>
          <Ionicons name={item.icon} size={30} color="white" />
          <Text style={styles.categoryText}>{item.title}</Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={{ paddingBottom: 0, marginBottom: 0 }}
    />

    {/** Todays trips section */}
    <View style={styles.todaysTripsContainer}>
      <Text style={styles.sectionTitle}>Today's Trips</Text>
      <FlatList
        data={ongoingTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.tripCard} onPress={() => navigation.navigate('DriverTrips', { tripId: item.id })}>
            <Text style={styles.tripText}>{item.destinationAddress}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  </View>
  );
};

// button tab navigation
const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false, 
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home-outline';
          } else if (route.name === 'Monitoring') {
            iconName = 'eye-outline'; 
          } else if (route.name === 'Trips') {
            iconName = 'car-outline';
          } else if (route.name === 'Metrics') {
            iconName = 'bar-chart-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'white', // active icong color 
        tabBarInactiveTintColor: '#D1D1D6', //inactive icon color
      })}
    >
      <Tab.Screen name="Home" component={HomePage} />
      <Tab.Screen name="Monitoring" component={DriveMonitoring} />
      <Tab.Screen name="Trips" component={DriverTripsScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Profile" component={HomePage} />
    </Tab.Navigator>
  );
};

// style section 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E1DC',
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#8699ac',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5A5A5A',
  },
  subtitle: {
    fontSize: 14,
    color: '#5A5A5A',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5A5A5A',
    marginVertical: 5,
  },
  categoryCard: {
    backgroundColor: '#8699ac',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    marginBottom: 0, 

    width: 120, 
    height: 230,  
    paddingBottom: 15, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
},

  categoryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5, 
  },
  
  todaysTripsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 15,
    marginTop: -110,
    flex: 1,
  },
  tripCard: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 15,
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripText: {
    color: '#5A5A5A',
    fontSize: 16,
  },
  tabBar: {
    backgroundColor: '#8699ac',
    paddingBottom: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    height: 60,
    borderTopWidth: 0,
  },
  tabBarLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AppNavigator;
