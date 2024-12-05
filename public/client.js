import * as mediasoupClient from 'mediasoup-client'; // Mediasoup 클라이언트를 가져옵니다.

const socket = io();
let device;

async function initDevice() {
    try {
        const rtpCapabilities = await new Promise((resolve) => {
            socket.emit('getRTPcap', resolve);
        });

        if (!rtpCapabilities) {
            throw new Error('Failed to retrieve RTP capabilities from server.');
        }

        device = new mediasoupClient.Device(); // Mediasoup Device 초기화
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        console.log('Device initialized:', device);
    } catch (error) {
        console.error('Error initializing device:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('consume-button').addEventListener('click', async () => {
        if (!device || !device.rtpCapabilities) {
            console.error('Device is not initialized or RTP capabilities are missing.');
            return;
        }

        try {
            socket.emit('consume', { rtpCapabilities: device.rtpCapabilities }, (response) => {
                if (response.error) {
                    console.error('Error consuming RTP stream:', response.error);
                    return;
                }

                const stream = new MediaStream([response.track]);
                document.getElementById('video-element').srcObject = stream;
                console.log('Stream consumed and attached to video element.');
            });
        } catch (error) {
            console.error('Error consuming stream:', error);
        }
    });

    initDevice(); // Device 초기화
});
