const socket = io();
let device;

async function initDevice() {
    const rtpCapabilities = await new Promise((resolve) =>
        socket.emit('getRTPcap', resolve)
    );
    device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
}

document.getElementById('consume-button').addEventListener('click', async () => {
    socket.emit('consume', { rtpCapabilities: device.rtpCapabilities }, (response) => {
        if (response.error) {
            console.error('Error consuming RTP stream:', response.error);
            return;
        }

        const stream = new MediaStream([response.track]);
        document.getElementById('video-element').srcObject = stream;
    });
});
