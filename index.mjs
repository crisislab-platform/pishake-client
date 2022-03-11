import fetch from "node-fetch";
import WebSocket from "ws";
import fs from "fs";
import iwlist from "wireless-tools/iwlist.js";
// import exec from "child_process";
import { exec } from "child_process";
import stream from "stream";

var child = exec("bash", ["-"], function (err, stdout, stderr) {
        console.log(err);
        console.log(stdout);
        console.log(stderr);
});

var input = "docker kill $(docker ps -q)";

var stdinStream = new stream.Readable();
stdinStream.push(input); // Add data to the internal queue for users of the stream to consume
stdinStream.push(null); // Signals the end of the stream (EOF)
stdinStream.pipe(child.stdin);

const token = process.env.CRISISLAB_SENSOR_TOKEN;
// const host = "ws://192.168.1.164:8787"
const host = "wss://ingest-worker.benhong.workers.dev"

var streamController;

const streamControllers = {};

const madeStreams = {};

const segmentDuration = 25;

var packetLength = 0;

var SI = 0;

async function createStream(timestamp) {
        madeStreams[timestamp] = true;

        console.log("created stream", timestamp);

        streamControllers[timestamp] = new WebSocket(
                `${host}/ingest/websocket?time=${timestamp}&SI=${SI}&duration=${segmentDuration}`,
                {
                        perMessageDeflate: false,
                        headers: {
                                authorization: "Bearer " + token,
                                "sensor-type": "RS4D-direct",
                        },
                },
        );

        fs.appendFile("streams.txt", `${timestamp}\n`, () => { })

        streamControllers[timestamp].addEventListener("error", function (err) {
                // Code to handle the error.
                console.error(err); // unexpected server response (521)
        });
}

async function updateMetadata() {
        iwlist.scan(
                { iface: "wlan0", show_hidden: true },
                function (err, networks) {
                        fetch(
                                "https://internship-worker.benhong.workers.dev/api/v1/sensors/updateMetadata",
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

var lastStream;

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

const filePath = "/dev/ttyS0";

const readableStream = fs.createReadStream(filePath, "utf8");

var jsonString = "";

var measurements = {};

var lastThing = 0;
var timestamp = 0;
var it = 0;
var message = "";

readableStream.on("data", (chunk) => {
        jsonString += chunk;
        if (jsonString.charAt(jsonString.length - 1) == "}") {
                if (jsonString.charAt(0) == "{") {
                        for (var data of JSON.parse(
                                "[" + jsonString.replaceAll("}{", "},{") + "]",
                        )) {
                                // console.log(Date.now() - lastThing)
                                lastThing = Date.now();
                                if (data.MSEC) {
                                        // console.log(measurements)
                                        measurements = {};
                                        // measurements.timestamp = Date.now() / 1000
                                        timestamp = Date.now() / 1000;
                                        // measurements.timestamp = data['MSEC']
                                }
                                if (data.CN) {
                                        // measurements[data.CN] = data.DS.map(hexToInt)
                                        if (
                                                Math.floor((timestamp + 5) / segmentDuration) !==
                                                Math.floor(timestamp / segmentDuration) &&
                                                !madeStreams[
                                                Math.floor((timestamp + 5) / segmentDuration) *
                                                segmentDuration
                                                ]
                                        )
                                                createStream(
                                                        Math.floor((timestamp + 5) / segmentDuration) *
                                                        segmentDuration,
                                                );


                                        // console.log(data);

                                        message += JSON.stringify([
                                                data.CN,
                                                timestamp,
                                                ...data.DS.map(hexToInt),
                                        ]);

                                        it += 1;

                                        if (it === 4) {
                                                var streamKey =
                                                        Math.floor(timestamp / segmentDuration) *
                                                        segmentDuration;

                                                const controller =
                                                        streamControllers[
                                                        Math.floor(timestamp / segmentDuration) *
                                                        segmentDuration
                                                        ];

                                                if (controller && controller.readyState === 1)
                                                        controller.send(message);

                                                if (streamKey !== lastStream) {
                                                        let oldController = streamControllers[lastStream];
                                                        if (oldController && oldController.readyState === 1) {
                                                                oldController.send("close");
                                                                delete streamControllers[lastStream];
                                                        }
                                                }

                                                it = 0
                                                message = ""

                                                lastStream = streamKey;

                                                if (SI !== data.SI || packetLength !== data.DS.length) {
                                                        SI = data.SI;
                                                        packetLength = data.DS.length;
                                                        console.log("updating metadata");
                                                        updateMetadata();
                                                }
                                        }
                                }

                                if (
                                        measurements.timestamp &&
                                        measurements.EN1 &&
                                        measurements.EN2 &&
                                        measurements.EN3 &&
                                        measurements.EH3
                                ) {
                                        // console.log(measurements)
                                        // ws.send(JSON.stringify(measurements))
                                        measurements = {};
                                }
                        }
                }
                jsonString = "";
        }
});
