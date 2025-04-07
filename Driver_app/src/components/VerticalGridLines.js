import React from "react";
import { Line } from "react-native-svg";

const VerticalGridLines = ({ x, data }) => {
  return data.map((_, index) => (
    <Line
      key={index}
      x1={x(index)}
      x2={x(index)}
      y1="0"
      y2="100%"
      stroke="lightgray"
      strokeWidth="1"
    />
  ));
};

export default VerticalGridLines;
