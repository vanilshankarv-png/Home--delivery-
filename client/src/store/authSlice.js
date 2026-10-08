import { createSlice } from "@reduxjs/toolkit";

function getInitialState() {
  try {
    const storedAuth = JSON.parse(localStorage.getItem("auth") || "{}");
    return {
      user: storedAuth.user || null,
      token: storedAuth.token || localStorage.getItem("token") || null
    };
  } catch (error) {
    console.error("Unable to restore saved authentication state:", error);
    return { user: null, token: null };
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState: getInitialState(),
  reducers: {
    login(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem("auth", JSON.stringify(action.payload));
      localStorage.setItem("token", action.payload.token);
    },
    updateUser(state, action) {
      state.user = action.payload;
      localStorage.setItem("auth", JSON.stringify({ user: state.user, token: state.token }));
    },
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem("auth");
      localStorage.removeItem("token");
    }
  }
});

export const { login, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
