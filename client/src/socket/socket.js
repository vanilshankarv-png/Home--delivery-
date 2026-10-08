import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
  autoConnect: false,
  auth: (callback) => {
    callback({ token: localStorage.getItem("token") });
  },
  transports: ["websocket", "polling"]
});

export default socket;
