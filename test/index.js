const { readFileSync } = require("fs");
const { join } = require("path");

const img = readFileSync(join(__dirname, "./1680158336604.jpg"));
const mark = readFileSync(join(__dirname, "./watermark.png"));

const BASE_URL = "http://localhost:7575";

fetch(BASE_URL + "/test", {
  method: "PUT",
  body: img.buffer,
});

fetch(BASE_URL + "/watermark", {
  method: "PUT",
  body: mark.buffer,
});
