const EARTH_RADIUS_KM = 6371.0088;
const URBAN_SPEED_KMH = 25;

export function haversineDistanceKm(first, second) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const [firstLng, firstLat] = first;
  const [secondLng, secondLat] = second;
  const latitudeDelta = toRadians(secondLat - firstLat);
  const longitudeDelta = toRadians(secondLng - firstLng);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLat)) * Math.cos(toRadians(secondLat))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function calculateEta({ currentLocation, destination }) {
  const distanceKm = haversineDistanceKm(currentLocation, destination);
  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    etaMinutes: Math.ceil(distanceKm / URBAN_SPEED_KMH * 60),
    averageSpeedKmh: URBAN_SPEED_KMH
  };
}
