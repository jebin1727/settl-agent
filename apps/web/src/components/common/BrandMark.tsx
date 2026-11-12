// The SettlAgent logo badge — a generic blue "P" accent mark (NOT PayPal's
// actual logo; it's an unrelated stock graphic, kept un-labeled as PayPal
// per the decision in Track.md). Unlike a scene illustration, a standalone
// mark like this wants object-fit:contain with a little padding, not a
// crop — there's no "subject" to zoom into, the whole graphic IS the mark.
import Box from "@mui/material/Box";
import Image from "next/image";

interface BrandMarkProps {
  size: number;
  radius: number;
}

export function BrandMark({ size, radius }: BrandMarkProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        bgcolor: "common.white",
        p: `${Math.round(size * 0.12)}px`,
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <Image src="/images/brand-mark.jpg" alt="" fill sizes={`${size}px`} style={{ objectFit: "contain" }} />
      </Box>
    </Box>
  );
}
