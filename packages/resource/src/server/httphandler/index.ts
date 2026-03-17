import { API_TOKEN } from "../utils/env";
import { HttpServer } from "./class";

const api = new HttpServer(API_TOKEN);

// ToDo
api.post('/drop', (req) => {
  return { status: 200, headers: {} };
})
