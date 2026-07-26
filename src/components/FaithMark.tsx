import React from "react";
import { Image, View } from "react-native";

export type FaithMarkVariant = "neutral" | "jewish" | "christian";

type FaithMarkProps = {
  variant: FaithMarkVariant;
  size?: number;
  color?: string;
  lightColor?: string;
};

const NEUTRAL_LOGO = require("../../assets/kesher-logo.png");

const JEWISH_COLOR = "#2563EB";
const JEWISH_DOT = "#1E40AF";
const CHRISTIAN_COLOR = "#7C3AED";

const DEFAULT_COLORS = {
  neutral: { color: "#2563EB", light: "#DBEAFE" },
  jewish: { color: JEWISH_COLOR, light: "#DBEAFE" },
  christian: { color: CHRISTIAN_COLOR, light: "#EDE9FE" },
};

type Point = { x: number; y: number };

/** A rounded bar drawn between two points. Used to stroke outline shapes. */
function Bar({
  from,
  to,
  thickness,
  color,
}: {
  from: Point;
  to: Point;
  thickness: number;
  color: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;
  return (
    <View
      style={{
        position: "absolute",
        left: cx - length / 2,
        top: cy - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

function triangleEdges(points: Point[]): Array<{ from: Point; to: Point }> {
  return points.map((point, index) => ({
    from: point,
    to: points[(index + 1) % points.length],
  }));
}

/**
 * Outlined Star of David (two overlapping triangle outlines) with a small
 * center dot — matching the Kesher Jewish app icon.
 */
function StarOfDavid({ size, color }: { size: number; color: string }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;
  const stroke = Math.max(2.5, size * 0.075);
  const dot = Math.max(3, size * 0.085);

  const pointAt = (deg: number): Point => ({
    x: cx + radius * Math.cos((deg * Math.PI) / 180),
    y: cy + radius * Math.sin((deg * Math.PI) / 180),
  });

  const upTriangle = [pointAt(-90), pointAt(30), pointAt(150)];
  const downTriangle = [pointAt(90), pointAt(210), pointAt(330)];
  const edges = [...triangleEdges(upTriangle), ...triangleEdges(downTriangle)];

  return (
    <View style={{ width: size, height: size }}>
      {edges.map((edge, index) => (
        <Bar key={`star-edge-${index}`} from={edge.from} to={edge.to} thickness={stroke} color={color} />
      ))}
      <View
        style={{
          position: "absolute",
          left: cx - dot / 2,
          top: cy - dot / 2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: JEWISH_DOT,
        }}
      />
    </View>
  );
}

function CrossMark({ size, color }: { size: number; color: string }) {
  const stroke = Math.max(3, size * 0.16);
  const vertical = size * 0.82;
  const horizontal = size * 0.52;
  const barTop = vertical * 0.26;
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

function NeutralMark({ size }: { size: number }) {
  return (
    <Image
      source={NEUTRAL_LOGO}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

export function FaithMark({ variant, size = 56, color, lightColor }: FaithMarkProps) {
  const palette = DEFAULT_COLORS[variant];
  const accent = color ?? palette.color;
  const light = lightColor ?? palette.light;
  const circle = size * 1.85;

  if (variant === "neutral") {
    return <NeutralMark size={circle} />;
  }

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
    </View>
  );
}
