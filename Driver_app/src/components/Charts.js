import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Dimensions, StyleSheet } from "react-native";
import { LineChart, BarChart, PieChart, XAxis, YAxis, Grid } from "react-native-svg-charts";
import * as d3 from "d3-shape";
import { Defs, LinearGradient, Stop, Svg, Circle, G, Text as SvgText } from "react-native-svg";
import database from '@react-native-firebase/database'; // Firebase Integration
import VerticalGridLines from "./VerticalGridLines"; // ✅ Import the component

const screenWidth = Dimensions.get("window").width - 20;

const Charts = ({ selectedMetric, avgSpeeds, brakingEvents, tripsPerDay, drowsinessCount = 0, coffeeBreakCount = 0, heartRateData, fuelLevel }) => {
  //const [fuelLevel, setFuelLevel] = useState(100); // Default: Full Tank
  console.log("📊 Debugging Pie Chart Data:");
  console.log("☕ Coffee Break Count:", coffeeBreakCount);
  console.log("⚠️ Drowsiness Count:", drowsinessCount);


  const alertsData = [
    { key: "coffee", value: coffeeBreakCount, svg: { fill: "#7A5FFF" }, label: "Coffee Break" },
    { key: "drowsiness", value: drowsinessCount, svg: { fill: "#FF6666" }, label: "Drowsiness" },
  ].filter(item => item.value > 0); // Ensure only non-zero values are included



  const hasAlertData = (coffeeBreakCount ?? 0) + (drowsinessCount ?? 0) > 0;



  useEffect(() => {
    const ref = database().ref("/sensor/fuel_level");
    const listener = ref.on("value", (snapshot) => {
      if (snapshot.exists()) {
        const resistance = snapshot.val();
        const fuelPercentage = mapResistanceToFuelLevel(resistance);
        console.log(`🚗 Raw Fuel Sensor Resistance: ${resistance}`);
        console.log(`⛽ Calculated Fuel Level: ${fuelPercentage}%`);
        setFuelLevel(fuelPercentage);
      }
    });

    return () => ref.off("value", listener);
  }, []);

  const mapResistanceToFuelLevel = (resistance) => {
    console.log(`🚗 Raw Fuel Sensor Resistance: ${resistance}`);

    const minResistance = 272;
    const maxResistance = 65535;

    // Keep resistance within expected bounds
    if (resistance < minResistance) resistance = minResistance;
    if (resistance > maxResistance) resistance = maxResistance;

    let fuelLevel = ((maxResistance - resistance) / (maxResistance - minResistance)) * 100;

    // Ensure percentage stays between 0-100%
    fuelLevel = Math.max(0, Math.min(100, fuelLevel));

    console.log(`⛽ Calculated Fuel Level: ${fuelLevel}%`);
    return Math.round(fuelLevel);
  };

  const Labels = ({ slices }) => {
    return slices.map((slice, index) => {
      if (!slice || !slice.pieCentroid || !slice.data) return null;

      const { pieCentroid, data } = slice;
      return (
        <SvgText
          key={index}
          x={pieCentroid[0]}
          y={pieCentroid[1]}
          fill="white"
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={14}
          fontWeight="bold"
        >
          {data.value}
        </SvgText>
      );
    });
  };


  // heart rate data 
 

  const heartRates = heartRateData?.map((item) => item.heartRate) || [];
  const timestamps = heartRateData?.map((item) => 
  new Date(item.timestamp || Date.now()).toLocaleTimeString()
) || [];

  console.log(`🟢 Fuel Level: ${fuelLevel}%`);
  console.log(`🟢 strokeDasharray Value: ${(fuelLevel / 100) * 565} 565`);
  console.log("🚀 Pie Chart Data:", JSON.stringify(alertsData, null, 2));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Debugging Logs */}

       {/* Trip Metrics */}
    {selectedMetric === "Trip Metrics" && (     
        <>
        {/* Average Speed Per Trip */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Average Speed per Trip</Text>
          <View style={styles.chartWrapper}>
            <YAxis
              data={avgSpeeds}
              contentInset={{ top: 20, bottom: 20 }}
              svg={{ fill: "grey", fontSize: 12 }}
              formatLabel={(value) => `${value.toFixed(1)} km/h`}
            />
            <LineChart
              style={{ height: 200, flex: 1 }}
              data={avgSpeeds}
              svg={{ strokeWidth: 3, stroke: "url(#grad1)" }}
              curve={d3.curveNatural}
              contentInset={{ top: 20, bottom: 20 }}
            >
              <Defs>
                <LinearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FF6384" stopOpacity="1" />
                  <Stop offset="1" stopColor="#FF9F40" stopOpacity="1" />
                </LinearGradient>
              </Defs>
            </LineChart>
          </View>
          <XAxis
            style={{ marginTop: 10 }}
            data={avgSpeeds}
            formatLabel={(value, index) => `T${index + 1}`}
            contentInset={{ left: 10, right: 10 }}
            svg={{ fontSize: 12, fill: "black" }}
          />
        </View>

        {/* Trips Per Day */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Trips Per Day</Text>
          <View style={styles.chartWrapper}>
            <YAxis
              data={tripsPerDay.counts}
              numberOfTicks={5}
              contentInset={{ top: 20, bottom: 20 }}
              svg={{ fill: "grey", fontSize: 12 }}
              formatLabel={(value) => Math.round(value)}
              min={0}
              max={Math.max(...tripsPerDay.counts)}
            />
            <BarChart
              style={{ height: 200, flex: 1 }}
              data={tripsPerDay.counts}
              svg={{ fill: "#4BC0C0" }}
              spacingInner={0.4}
              spacingOuter={0.3}
              gridMin={0}
              contentInset={{ top: 20, bottom: 20 }}
            />
          </View>
          <XAxis
            style={{ marginTop: 10 }}
            data={tripsPerDay.counts}
            xAccessor={({ index }) => index}
            formatLabel={(value, index) => `D${index + 1}`}
            contentInset={{
              left: (screenWidth / tripsPerDay.counts.length) / 2,
              right: (screenWidth / tripsPerDay.counts.length) / 2,
            }}
            svg={{ fontSize: 12, fill: "black" }}
          />
        </View>
        </>
      )} 

    {/* Safety Metrics */}
    {selectedMetric === "Safety Metrics" && (
    <>

        {/* Harsh Braking Events */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Harsh Braking</Text>
          <View style={styles.chartWrapper}>
            <YAxis
              data={brakingEvents}
              contentInset={{ top: 20, bottom: 20 }}
              svg={{ fill: "grey", fontSize: 12 }}
              formatLabel={(value) => `${value} times`}
            />
            <BarChart
              style={{ height: 200, flex: 1 }}
              data={brakingEvents}
              svg={{ fill: "#36A2EB" }}
              spacingInner={0.3}
              spacingOuter={0.2}
              gridMin={0}
              contentInset={{ top: 20, bottom: 20 }}
            />
          </View>
          <XAxis
            style={{ marginTop: 10 }}
            data={brakingEvents}
            formatLabel={(value, index) => `T${index + 1}`}
            contentInset={{ left: 10, right: 10 }}
            svg={{ fontSize: 12, fill: "black" }}
          />
        </View>

        {/*  Alert    */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Alerts</Text>

          {/* Centered Pie Chart */}
          <View style={styles.pieChartContainer}>
            {hasAlertData ? (
              <PieChart
                style={{ height: 225, width: 225 }}
                data={alertsData}
                innerRadius={"30%"}
                outerRadius={"90%"}
                padAngle={0.02}
                valueAccessor={({ item }) => item.value}
              >
                <Labels />
              </PieChart>
            ) : (
              <Text style={styles.noDataText}>No alerts detected yet</Text>
            )}
          </View>

          {/* Legends: Side-by-Side at Bottom */}
          <View style={styles.legendContainer}>
            {alertsData.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.svg.fill }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        </>
    )}

    
    {/* Health Metrics */}
    {/* ❤️ Health Metrics */}
{/* ❤️ Health Metrics */}
{/* ❤️ Health Metrics */}
{selectedMetric === "Health Metrics" && (
  <View style={styles.chartContainer}>
    <Text style={styles.chartTitle}>Heart Rate Over Time</Text>

    {/* ✅ Ensure heartRateData is always an array */}
    {Array.isArray(heartRateData) && heartRateData.length > 0 ? (
      <View style={styles.chartWrapper}>
        {/* Y-Axis */}
        <YAxis
          data={heartRateData?.map((item) => item.heartRate) || []}
          contentInset={{ top: 20, bottom: 20 }}
          svg={{ fill: "grey", fontSize: 12 }}
          formatLabel={(value) => `${value} BPM`}
        />

        {/* Line Chart */}
        <View style={{ flex: 1 }}>
          <LineChart
            style={{ height: 200, flex: 1 }}
            data={heartRateData?.map((item) => item.heartRate) || []}
            svg={{ strokeWidth: 3, stroke: "red" }}
            curve={d3.curveMonotoneX}
            contentInset={{ top: 20, bottom: 20 }}
          >
            <Grid svg={{ stroke: "lightgray", strokeWidth: 1 }} belowChart={true} />
            <VerticalGridLines />
          </LineChart>
        </View>
      </View>
    ) : (
      // Show "No Data" message inside the chart container
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No Heart Rate Data Found</Text>
      </View>
    )}

    {/* X-Axis (Only if data is available) */}
    {Array.isArray(heartRateData) && heartRateData.length > 0 && (
      <XAxis
        style={{ marginTop: 10 }}
        data={heartRateData || []}
        formatLabel={(value, index) =>
          new Date(heartRateData[index]?.timestamp || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        }
        contentInset={{ left: 10, right: 10 }}
        svg={{ fontSize: 12, fill: "black" }}
      />
    )}
  </View>
)}

    

      
    {/* Vehicle Metrics */}
    {/* Vehicle Metrics */}
    {selectedMetric === "Vehicle Metrics" && (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Fuel Level</Text>
        <View style={styles.doughnutContainer}>
          <Svg height="200" width="200" viewBox="0 0 200 200">
            <G rotation="-90" origin="100, 100">
              {/* Background Circle (Fuel Used - Red) */}
              <Circle cx="100" cy="100" r="90" stroke="#dc3545" strokeWidth="20" fill="none" />

              {/* Foreground Circle (Fuel Left - Green) */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="#28a745"
                strokeWidth="20"
                fill="none"
                strokeDasharray={`${(fuelLevel / 100) * 565 // ✅ Correct calculation of green section
                  } 565`}
                strokeDashoffset="0"
                strokeLinecap="round"
                rotation="0"
                origin="100, 100"
              />
            </G>

            {/* Center Text (Display Actual Fuel Percentage) */}
            <SvgText x="100" y="105" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000">
              {fuelLevel.toFixed(1)}%
            </SvgText>
          </Svg>
        </View>
      </View>
    )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  chartContainer: {
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  chartWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  fuelText: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
    color: "#FF9F40",
  },
  doughnutContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  pieChartContainer: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column", // Ensure vertical stacking
    marginBottom: 10, // Add space between pie chart and legend
    height: 220,  // Increased height
    // Ensures chart doesn't get cut off
  },
  noDataContainer: {
    height: 200, // Match chart height
    justifyContent: "center",
    alignItems: "center",
  },
  noDataText: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
    marginTop: 20,
  },
  legendContainer: {
    flexDirection: "row",  // Align side by side
    justifyContent: "center",  // Center at the bottom
    alignItems: "center",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10, // Space between items
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6, // Make it a circle
    marginRight: 5,
  },
  legendText: {
    fontSize: 14,
    color: "black",
  },




});

export default Charts;
