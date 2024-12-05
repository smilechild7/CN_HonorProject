import express from 'express';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import { createPlainRtpTransport } from './webrtc/transport.js';
import { initializeMediasoup} from './webrtc/mediasoupManager.js';

import { signalingHandler } from './sockets/signaling.js';
import { httpsOptions, port } from './config.js';

// Express 서버 설정
const app = express();
const httpsServer = https.createServer(httpsOptions, app);
const io = new Server(httpsServer);

// 정적 파일 제공
app.use(express.static('public'));

// Mediasoup 초기화 및 Router 생성
const mediasoupRouter = await initializeMediasoup();

// RTP Transport 생성 및 포트 출력
(async () => {
    const transport = await createPlainRtpTransport(mediasoupRouter);
    console.log('RTP Transport created:');
    console.log(`RTP Port: ${transport.tuple.localPort}`);
    console.log(`RTCP Port: ${transport.rtcpTuple?.localPort || 'RTCP MUX Enabled'}`);
})();

// 소켓 연결 처리
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // 클라이언트 RTP Capabilities 요청 처리
    socket.on('getRTPcap', async (callback) => {
        try {
            const rtpCapabilities = mediasoupRouter.rtpCapabilities;
            callback(rtpCapabilities); // Router RTP Capabilities 전달
        } catch (error) {
            console.error('Error getting RTP capabilities:', error);
            callback(null);
        }
    });

    // 클라이언트 스트림 소비 요청 처리
    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        try {
            if (!producer) {
                callback({ error: 'No producer available' });
                return;
            }

            const consumer = await mediasoupRouter.createConsumer({
                producerId: producer.id,
                rtpCapabilities,
            });

            callback({
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (error) {
            console.error('Error consuming stream:', error);
            callback({ error: error.message });
        }
    });
});



// 서버 시작
httpsServer.listen(port, () => {
    console.log(`Server running at https://localhost:${port}`);
});
