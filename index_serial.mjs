import fetch from "node-fetch";
import WebSocket from "ws";
import fs from "fs";
import iwlist from "wireless-tools/iwlist.js";
import dgram from "dgram";

const token = process.env.CRISISLAB_SENSOR_TOKEN;
const host = "wss://ingest.benhong.me";

let segmentDuration = 25;

let packetLength = 0;

let SI = 0;

let controller = new WebSocket(
	`${host}/ingest/websocket?time=${timestamp}&SI=${SI}&duration=${segmentDuration}`,
	{
		perMessageDeflate: false,
		headers: {
			authorization: "Bearer " + token,
			"sensor-type": "RS4D-direct",
		},
	},
);

async function updateMetadata() {
	iwlist.scan(
		{ iface: "wlan0", show_hidden: true },
		function (err, networks) {
			fetch(
				"https://internship-worker.benhong.workers.dev/api/v0/sensors/updateMetadata",
				{
					method: "POST",
					body: JSON.stringify({
						SI,
						segmentDuration,
						packetLength,
						networks,
					}),
					headers: {
						Authorization: "Bearer " + token,
					},
				},
			);
		},
	);
}

function hexToInt(hex) {
	if (hex.length % 2 != 0) {
		hex = "0" + hex;
	}
	var num = parseInt(hex, 16);
	var maxVal = Math.pow(2, (hex.length / 2) * 8);
	if (num > maxVal / 2 - 1) {
		num = num - maxVal;
	}
	return num;
}

const server = dgram.createSocket("udp4");

server.on("message", (msg, rinfo) => {
	const dataString = msg
		.toString()
		.replaceAll("'", '"')
		.replace("{", "[")
		.replace("}", "]");

	const data = JSON.parse(dataString);

	timestamp = data[1];

	if (
		Math.floor((timestamp + 5) / segmentDuration) !==
			Math.floor(timestamp / segmentDuration) &&
		!madeStreams[
			Math.floor((timestamp + 5) / segmentDuration) * segmentDuration
		]
	)
		createStream(
			Math.floor((timestamp + 5) / segmentDuration) * segmentDuration,
		);

	controller.send(msg);
});

server.on("listening", () => {
	const address = server.address();
	console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(2543);
