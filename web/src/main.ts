// P2 でモック（reference/mock/Modelith.html）の UI を移植し、wasm コアに接続する。
const app = document.querySelector<HTMLDivElement>("#app");
if (app) app.textContent = "Modelith (P0 skeleton)";
