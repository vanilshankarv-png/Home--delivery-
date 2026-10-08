export const demoLocation = { lat: 17.6868, lng: 83.2185 };

export function getCurrentLocation() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : error.code === error.TIMEOUT
            ? "Location request timed out."
            : "Unable to determine your location.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}
