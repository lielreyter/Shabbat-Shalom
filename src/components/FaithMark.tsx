import React from "react";
import { View } from "react-native";

export type FaithMarkVariant = "neutral" | "jewish" | "christian";

type FaithMarkProps = {
  variant: FaithMarkVariant;
  size?: number;
  color?: string;
  lightColor?: string;
};

const DEFAULT_COLORS = {
  neutral: { color: "#2563EB", light: "#DBEAFE" },
  jewish: { color: "#2563EB", light: "#DBEAFE" },
  christian: { color: "#7C3AED", light: "#EDE9FE" },
};

function StarOfDavid({ size, color }: { size: number; color: string }) {
  const triangleWidth = size * 0.72;
  const triangleHeight = triangleWidth * 0.86;
  const left = (size - triangleWidth) / 2;
  const upTop = size * 0.1;
  const downTop = size - upTop - triangleHeight;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left,
          top: upTop,
          width: 0,
          height: 0,
          borderLeftWidth: triangleWidth / 2,
          borderRightWidth: triangleWidth / 2,
          borderBottomWidth: triangleHeight,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          opacity: 0.92,
        }}
      />
      <View
        style={{
          position: "absolute",
          left,
          top: downTop,
          width: 0,
          height: 0,
          borderLeftWidth: triangleWidth / 2,
          borderRightWidth: triangleWidth / 2,
          borderTopWidth: triangleHeight,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          opacity: 0.92,
        }}
      />
    </View>
  );
}

function CrossMark({ size, color }: { size: number; color: string }) {
  const stroke = Math.max(3, size * 0.11);
  const vertical = size * 0.72;
  const horizontal = size * 0.46;
  const barTop = vertical * 0.24;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: stroke,
          height: vertical,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: "50%",
          marginTop: -vertical / 2 + barTop,
          width: horizontal,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function ConnectionMark({ size, color }: { size: number; color: string }) {
  const linkWidth = size * 0.44;
  const linkHeight = size * 0.24;
  const stroke = Math.max(2, size * 0.065);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: linkWidth,
          height: linkHeight,
          borderRadius: linkHeight / 2,
          borderWidth: stroke,
          borderColor: color,
          transform: [{ translateX: -size * 0.12 }, { rotate: "-32deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          width: linkWidth,
          height: linkHeight,
          borderRadius: linkHeight / 2,
          borderWidth: stroke,
          borderColor: color,
          transform: [{ translateX: size * 0.12 }, { rotate: "-32deg" }],
        }}
      />
    </View>
  );
}

export function FaithMark({ variant, size = 56, color, lightColor }: FaithMarkProps) {
  const palette = DEFAULT_COLORS[variant];
  const accent = color ?? palette.color;
  const light = lightColor ?? palette.light;
  const circle = size * 1.85;

  return (
    <View
      style={{
        width: circle,
        height: circle,
        borderRadius: circle / 2,
        backgroundColor: light,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {variant === "jewish" && <StarOfDavid size={size} color={accent} />}
      {variant === "christian" && <CrossMark size={size} color={accent} />}
      {variant === "neutral" && <ConnectionMark size={size} color={accent} />}
    </View>
  );
}

