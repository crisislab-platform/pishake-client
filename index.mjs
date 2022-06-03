import WebSocket from "ws";
import dgram from "dgram";

const token = process.env.CRISISLAB_SENSOR_TOKEN;
const host = "wss://ingest.benhong.me";

let controller = new WebSocket(`${host}/ingest/websocket`, {
	perMessageDeflate: false,
	headers: {
		authorization: "Bearer " + token,
		"sensor-type": "RS4D-direct",
	},
});

const server = dgram.createSocket("udp4");

server.on("message", (msg) => {
	const dataString = msg
		.toString()
		.replaceAll("'", '"')
		.replace("{", "[")
		.replace("}", "]");

	controller.send(dataString);
});

server.on("listening", () => {
	const address = server.address();
	console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(2543);
