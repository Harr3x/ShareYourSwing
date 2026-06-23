export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function bearingDegrees(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
           - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function dmsToDecimal(str) {
  const parts = str.trim().match(/^(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])$/);
  if (!parts) return null;
  const latDeg = parseInt(parts[1]) + parseInt(parts[2]) / 60 + parseFloat(parts[3]) / 3600;
  const lngDeg = parseInt(parts[5]) + parseInt(parts[6]) / 60 + parseFloat(parts[7]) / 3600;
  return {
    lat: parts[4] === 'S' ? -latDeg : latDeg,
    lng: parts[8] === 'W' ? -lngDeg : lngDeg,
  };
}