/** 
 * Name: Nazila Malekzadah C21414344
 * Date: 11/04/2025
 * Description: Monitors driver's face in real-time using front camera and ML Kit 
 * detect drowsiness (closed eyes) and coffe break triggers (yawning)
 * alerts are shown on screen and saved in firestore
 */

// import lib
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Alert, Platform, TouchableOpacity } from "react-native";
import { Camera, useCameraDevices } from "react-native-vision-camera";
import Canvas from "react-native-canvas";
import RNFS from "react-native-fs";
import FaceDetector from "@react-native-ml-kit/face-detection";
import SoundPlayer from "react-native-sound-player";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// get screen demension
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const DriveMonitoring = () => {

  // state variable 
  const [cameraPermission, setCameraPermission] = useState(false);
  const [faces, setFaces] = useState([]);
  const [detectionActive, setDetectionActive] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [coffeeBreakAlertActive, setCoffeeBreakAlertActive] = useState(false)
  const [drowsinessCount, setDrowsinessCount] = useState(0);
  const [coffeeBreakCount, setCoffeeBreakCount] = useState(0);
  
  // access front face camera
  const devices = useCameraDevices();
  const frontCamera = devices.find((device) => device.position === "front");

  // refs for tracking timing and events
  const isDrowsinessCounted = useRef(false);
  const isCoffeeBreakCounted = useRef(false);
  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const eyeClosureStartTimeRef = useRef(null);
  const yawnCountRef = useRef(0);
  const isYawningRef = useRef(false);
  const lastYawnTimeRef = useRef(0);

  // request camera permission
  useEffect(() => {
    const checkPermissions = async () => {
      const status = await Camera.getCameraPermissionStatus();
      if (status !== "granted") {
        const newStatus = await Camera.requestCameraPermission();
        if (newStatus !== "granted") {
          Alert.alert("Permission Denied", "Camera access is required.");
          return;
        }
      }
      setCameraPermission(true);
    };
    checkPermissions();
  }, []);

  // start face detection loop 
  const startDetection = () => {
    if (!cameraRef.current) return;
    setDetectionActive(true);
    console.log("Face Monitoring Started");

    detectionIntervalRef.current = setInterval(async () => {
      try {
        // capture image very second
        console.log(" Capturing image...");
        const photo = await cameraRef.current.takePhoto();
        const imageUri = Platform.OS === "android" ? `file://${photo.path}` : photo.path;
        console.log(" Photo captured:", imageUri);
        const imageWidth = photo.width || 2448;
        const imageHeight = photo.height || 3264;
        console.log(`Actual Image Dimensions: ${imageWidth}x${imageHeight}`);
        await processImage(imageUri, imageWidth, imageHeight);
      } catch (error) {
        console.error("Error capturing image:", error);
      }
    }, 1000); // every secons
  };

  // stop detection and rest everthying 
  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setDetectionActive(false);
    setFaces([]);
    clearCanvas();

    // reset drowsiness and yawning states
    eyeClosureStartTimeRef.current = null;
    yawnCountRef.current = 0;
    isYawningRef.current = false;
    lastYawnTimeRef.current = 0;
    if (alertActive) {
      stopWarningSound();
      setAlertActive(false);
    }
    if (coffeeBreakAlertActive) {
      stopWarningSound();
      setCoffeeBreakAlertActive(false);
    }
    console.log("Face Monitoring Stopped");
  };

  // save alert event to firestore 
  const saveAlertToFirestore = async (alertType) => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) return;

      const alertData = {
        type: alertType,
        timestamp: firestore.Timestamp.now(),
      };

      await firestore()
        .collection("users")
        .doc(userId)
        .collection("alerts") // store alerts in alert collection
        .add(alertData);

      console.log(`${alertType} Alert Stored in Firestore`);
    } catch (error) {
      console.error(" Error storing alert:", error);
    }
  };

  //Analyzing captured image
  const processImage = async (imagePath, imageWidth, imageHeight) => {
    try {
      const detectedFaces = await FaceDetector.detect(imagePath, {
        landmarkMode: "all",
        performanceMode: "accurate",
        classificationMode: "all",
      });
      console.log(" Face Detection Result:", JSON.stringify(detectedFaces, null, 2));

      if (detectedFaces.length > 0) {
        setFaces(detectedFaces);
        drawFaceLandmarks(detectedFaces, imageWidth, imageHeight);

        // target the driver's face larget
        const driverFace = detectedFaces.reduce((prev, curr) => {
          const prevArea = prev.frame.width * prev.frame.height;
          const currArea = curr.frame.width * curr.frame.height;
          return currArea > prevArea ? curr : prev;
        });

        // log for debigging
        console.log("Driver face:", driverFace);
        console.log("Left eye probability:", driverFace.leftEyeOpenProbability);
        console.log("Right eye probability:", driverFace.rightEyeOpenProbability);

        
        const leftProb = driverFace.leftEyeOpenProbability !== undefined ? driverFace.leftEyeOpenProbability : 1;
        const rightProb = driverFace.rightEyeOpenProbability !== undefined ? driverFace.rightEyeOpenProbability : 1;

        // drowsiness detection if both eye are closed 
        if (leftProb < 0.2 && rightProb < 0.2) {
          console.log("Drowsiness Detected!");
          if (!eyeClosureStartTimeRef.current) {
            eyeClosureStartTimeRef.current = Date.now();
          } else {
            const elapsed = Date.now() - eyeClosureStartTimeRef.current;
            if (elapsed > 1000 && !alertActive) {
              playWarningSound();
              setAlertActive(true);

              if (!isDrowsinessCounted.current) { // ensure it count only once 
                setDrowsinessCount(prevCount => prevCount + 1);
                saveAlertToFirestore("drowsiness");
                console.log("Drowsiness Alert Triggered! Total:", drowsinessCount + 1);
                isDrowsinessCounted.current = true; // mark as counted
              }
            }
          }
        } else {
          // reset if eyes open
          eyeClosureStartTimeRef.current = null;
          stopWarningSound();
          setAlertActive(false);
          isDrowsinessCounted.current = false; // rest flag when alert stop

        }
        // yawning detection
        if (
          driverFace.landmarks &&
          driverFace.landmarks.mouthLeft &&
          driverFace.landmarks.mouthRight &&
          driverFace.landmarks.mouthBottom
        ) {
          const mouthLeft = driverFace.landmarks.mouthLeft.position;
          const mouthRight = driverFace.landmarks.mouthRight.position;
          const mouthBottom = driverFace.landmarks.mouthBottom.position;
          const mouthCenterY = (mouthLeft.y + mouthRight.y) / 2;
          const mouthOpenDistance = mouthBottom.y - mouthCenterY;
          
          // Use 10% of the face's height as threshold
          const yawnThreshold = driverFace.frame.height * 0.1;

          console.log("Mouth open distance:", mouthOpenDistance, "Threshold:", yawnThreshold);

          const now = Date.now();
          if (mouthOpenDistance > yawnThreshold) {
            // Count a yawn only if at least 1 second has passed since the last counted yawn
            if (!isYawningRef.current && now - (lastYawnTimeRef.current || 0) > 1000) {
              isYawningRef.current = true;
              yawnCountRef.current += 1;
              lastYawnTimeRef.current = now;
              console.log("Yawn detected. Count:", yawnCountRef.current);
            }
          } else {
            isYawningRef.current = false;
          }

          // trigger coffe break alert.
          if (yawnCountRef.current >= 3 && !coffeeBreakAlertActive) {
            SoundPlayer.playSoundFile("coffee_break_alert", "mp3");
            setCoffeeBreakAlertActive(true);

            if (!isCoffeeBreakCounted.current) { // esure counted only once
              setCoffeeBreakCount(prevCount => prevCount + 1);
              saveAlertToFirestore("coffee_break");
              console.log("☕ Coffee Break Alert! Total:", coffeeBreakCount + 1);
              isCoffeeBreakCounted.current = true; // mark as counted
            }

            setTimeout(() => {
              setCoffeeBreakAlertActive(false);
              yawnCountRef.current = 0;
              isCoffeeBreakCounted.current = false; // reset flag when alert stops

            }, 5000);
          }
        }
      } else {
        console.log(" No faces detected.");
        clearCanvas();
        eyeClosureStartTimeRef.current = null;
        stopWarningSound();
        setAlertActive(false);
      }
    } catch (error) {
      console.error(" Error detecting face:", error);
    }
  };

  // play alert sound
  const playWarningSound = () => {
    try {
      SoundPlayer.playSoundFile("alert_sound", "mp3");
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  };

  // Stop Warning sound
  const stopWarningSound = () => {
    try {
      SoundPlayer.stop();
    } catch (error) {
      console.log(" Error stopping sound:", error);
    }
  };

  // draw face, eye, might an canvas overlay
  const drawFaceLandmarks = async (detectedFaces, imageWidth, imageHeight) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("Canvas not found");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("Canvas context not initialized");
      return;
    }
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = screenWidth / imageWidth;
    const scaleY = screenHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY);

    detectedFaces.forEach((face) => {
      const { frame, landmarks } = face;
      if (!landmarks || Object.keys(landmarks).length === 0) {
        console.log(" No landmarks detected.");
        return;
      }

      // Face Bounding Box
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        frame.left * scale,
        frame.top * scale,
        frame.width * scale,
        frame.height * scale
      );

      // Green Boxes Around Eyes
      if (landmarks.leftEye && landmarks.rightEye) {
        ctx.strokeStyle = "green";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          landmarks.leftEye.position.x * scale - 10,
          landmarks.leftEye.position.y * scale - 10,
          20,
          20
        );
        ctx.strokeRect(
          landmarks.rightEye.position.x * scale - 10,
          landmarks.rightEye.position.y * scale - 10,
          20,
          20
        );
      }

      // Red Triangle for Mouth
      if (landmarks.mouthLeft && landmarks.mouthRight && landmarks.mouthBottom) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(landmarks.mouthLeft.position.x * scale, landmarks.mouthLeft.position.y * scale);
        ctx.lineTo(landmarks.mouthRight.position.x * scale, landmarks.mouthRight.position.y * scale);
        ctx.lineTo(landmarks.mouthBottom.position.x * scale, landmarks.mouthBottom.position.y * scale);
        ctx.closePath();
        ctx.stroke();
      }
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
    <Text style={styles.header}>DriveGuard</Text>
  </View>

    {/** camera view with canvas overlay */}
    <View style={styles.cameraContainer}>
      {frontCamera ? (
        <>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={frontCamera}
            isActive={true}
            photo={true}
          />
          <Canvas ref={canvasRef} style={styles.canvas} />
        </>
      ) : (
        <Text>No suitable camera found.</Text>
      )}
    </View>

    {/** Drowsiness alert */}
    {alertActive && (
      <View style={styles.notification}>
        <Text style={styles.notificationText}>
          Drowsiness Warning! Your eyes are closed! Stay alert.
        </Text>
      </View>
    )}

    {/* Coffee Break aler*/}
    {coffeeBreakAlertActive && (
      <View style={styles.coffeeNotification}>
        <Text style={styles.coffeeNotificationText}>
          ☕ Time for a coffee break!
        </Text>
      </View>
    )}

    <TouchableOpacity style={styles.controlButton} onPress={startDetection} disabled={detectionActive}>
      <Text style={styles.controlButtonText}>Start Monitoring</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.controlButton} onPress={stopDetection}>
      <Text style={styles.controlButtonText}>Stop Monitoring</Text>
    </TouchableOpacity>
  </View>
  );
};

// style section 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8E1DC", alignItems: "center", justifyContent: "center" },
  headerContainer: {
    width: "100%",
    backgroundColor: "#8699ac", 
    paddingVertical: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 0, 
  },
  header: {
    fontSize: 20, 
    fontWeight: "bold",
    color: "#5A5A5A", 
    textTransform: "capitalize", 
    letterSpacing: 1,
    textAlign: "center",
  },
  cameraContainer: { width: "100%", height: "65%", position: "relative" },
  camera: { flex: 1 },
  canvas: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10 },
  controlButton: {
    backgroundColor: "#8699ac", 
    padding: 15,
    borderRadius: 12, 
    width: "80%",
    alignItems: "center",
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  
  controlButtonText: {
    color: "#5A5A5A", 
    fontSize: 16,
    fontWeight: "bold",
  },
  
  notification: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: "#FDEEDC", 
    padding: 12,
    borderRadius: 12,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  
  notificationText: { 
    color: "#5A5A5A", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  
  coffeeNotification: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    backgroundColor: "#D4ECDD", 
    padding: 12,
    borderRadius: 12,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  
  coffeeNotificationText: { 
    color: "#5A5A5A", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  
});

export default DriveMonitoring;
