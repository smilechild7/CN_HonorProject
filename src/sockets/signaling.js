import { createPlainRtpTransport, createProducer } from '../webrtc/transport.js';

export const signalingHandler = (socket, router) => {
    let producer; // Producer 인스턴스를 저장

    socket.on('registerRtpStream', async ({ ssrc }, callback) => {
        try {
            const transport = await createPlainRtpTransport(router);
            producer = await createProducer(transport, ssrc);
            console.log(`Producer created with ID: ${producer.id}`);
            callback({ producerId: producer.id });
        } catch (error) {
            console.error('Error registering RTP stream:', error);
            callback({ error: error.message });
        }
    });

    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        if (!producer) {
            callback({ error: 'No producer available' });
            return;
        }

        try {
            const consumer = await producer.createConsumer(rtpCapabilities);
            callback({
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (error) {
            console.error('Error creating consumer:', error);
            callback({ error: error.message });
        }
    });
};
