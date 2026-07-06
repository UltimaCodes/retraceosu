import { ImageResponse } from "next/og";

export const alt = "Retrace, replay autopsy for osu!standard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(180deg, #241a20 0%, #170f14 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
          <span>Re</span>
          <span style={{ color: "#ff66ab" }}>trace</span>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "rgba(255,255,255,0.65)" }}>
          Drop an .osr, get the autopsy.
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 22, color: "rgba(255,255,255,0.4)" }}>
          UR · timing bias · tap style · miss map · farm maps priced by real pp gain
        </div>
        <div
          style={{
            position: "absolute",
            right: 90,
            top: 150,
            width: 0,
            height: 0,
            borderLeft: "130px solid transparent",
            borderRight: "130px solid transparent",
            borderBottom: "225px solid rgba(255,102,171,0.25)",
          }}
        />
      </div>
    ),
    size,
  );
}
