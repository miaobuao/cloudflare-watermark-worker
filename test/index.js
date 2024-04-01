const { readFileSync } = require("fs");
const { join } = require("path");

const img = readFileSync(join(__dirname, "./1680158336604.jpg"));
const mark = readFileSync(join(__dirname, "./watermark.png"));

fetch("http://localhost:7575/test", {
  method: "PUT",
  body: img.buffer,
});

fetch("http://localhost:7575/watermark", {
  method: "PUT",
  body: mark.buffer,
});
