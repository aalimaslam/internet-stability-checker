import axios from "axios";

export const diagnosticsClient = axios.create({
  timeout: 8000,
  headers: {
    "Cache-Control": "no-cache",
  },
});
