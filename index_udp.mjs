// import dgram from "dgram";
import fetch from "node-fetch";
import WebSocket from "ws";
import dgram from "dgram";
// import fetch from "node-fetch";

const server = dgram.createSocket("udp4");

const token = process.env.CRISISLAB_SENSOR_TOKEN;

if (!token) {
	console.error("CRISISLAB_SENSOR_TOKEN environment variable not set");
	process.exit(1);
}

var streamController;

const streamControllers = {};

const madeStreams = {};

const segmentDuration = 50;

var SI = 0;

async function createStream(timestamp) {
	madeStreams[timestamp] = true;

	console.log("created stream", timestamp);

	streamControllers[timestamp] = new WebSocket(
		`ws://192.168.1.164:8787/ingest/websocket?time=${timestamp}&SI=${SI}&duration=${segmentDuration}`,
		{
			perMessageDeflate: false,
			headers: {
				authorization: "Bearer " + token,
				"sensor-type": "RS4D-direct",
			},
		},
	);

	// streamControllers[timestamp] = new WebSocket(`wss://ingest-worker.benhong.workers.dev/ingest/websocket?time=${timestamp}&SI=${SI}&duration=${segmentDuration}`, {
	//   perMessageDeflate: false,
	//   headers: {
	//     "authorization": "Bearer " + token,
	//     "sensor-type": "RS4D-direct"
	//   }
	// });

	streamControllers[timestamp].addEventListener("error", function (err) {
		// Code to handle the error.
		console.error(err); // unexpected server response (521)
	});
}

var lastStream;

var message = "";

var it = 0;

server.on("message", (msg, rinfo) => {
	// console.log(Date.now() - lastThing)
	const data = msg
		.toString()
		.replaceAll("'", '"')
		.replace("{", "[")
		.replace("}", "]");

	const [channel, timestamp, ...channelData] = JSON.parse(data);

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

	var streamKey = Math.floor(timestamp / segmentDuration) * segmentDuration;

	// console.log(data);

	const controller =
		streamControllers[
			Math.floor(timestamp / segmentDuration) * segmentDuration
		];

	message += JSON.stringify([channel, timestamp, ...channelData]);

	it += 1;

	if (it === 4) {
		if (controller && controller.readyState === 1) controller.send(message);
		message = "";
		it = 0;
	}

	if (streamKey !== lastStream) {
		let oldController = streamControllers[lastStream];
		if (oldController && oldController.readyState === 1)
			oldController.send("close");
	}

	lastStream = streamKey;
});

server.on("listening", () => {
	const address = server.address();
	console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(2543);
