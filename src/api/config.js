import axios from "axios";

const API = axios.create({
  baseURL: "https://task-backend-mn8a.onrender.com/api",
  headers: { "Content-Type": "application/json" },
});

API.interceptors.request.use((config) => {
  // Some pages call "/api/tasks", others "/tasks" — both become .../api/tasks
  if (config.url?.startsWith("/api/")) config.url = config.url.slice(4);

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Shows the backend's real error message in the console
    console.error(
      `API ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status}`,
      JSON.stringify(error.response?.data)
    );

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;
