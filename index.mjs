import fetch from "node-fetch";
import WebSocket from "ws";
import fs from "fs";
import iwlist from "wireless-tools/iwlist.js";
import dgram from "dgram";

const token = process.env.CRISISLAB_SENSOR_TOKEN;
// const host = "ws://192.168.1.153:8787"
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

var jsonString = "";

var lastTimestamp = 0;
var timestamp = 0;
var numPackets = 0;
var message = "";

function flushData() {
    if (message.length > 0) {

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

        numPackets = 0
        message = ""

        lastStream = streamKey;
    }
}

const server = dgram.createSocket("udp4");

server.on("message", (msg, rinfo) => {
    const dataString = msg
        .toString()
        .replaceAll("'", '"')
        .replace("{", "[")
        .replace("}", "]");

    const data = JSON.parse(dataString)

    timestamp = data[1]

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

    message += dataString;

    if (lastTimestamp !== timestamp || numPackets === 4) {
        flushData();
    }

    lastTimestamp = timestamp

    numPackets += 1;


});


server.on("listening", () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(2543);