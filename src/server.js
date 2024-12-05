import express from 'express';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import { initializeMediasoup } from './webrtc/mediasoupManager.js';
import { signalingHandler } from './sockets/signaling.js';
import { httpsOptions, port } from './config.js';

const app = express();
const httpsServer = https.createServer(httpsOptions, app);
const io = new Server(httpsServer);

// 정적 파일 제공
app.use(express.static('public'));

// Mediasoup 초기화
const mediasoupRouter = await initializeMediasoup();

// 소켓 연결 처리
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    signalingHandler(socket, mediasoupRouter);
});

// 서버 시작
httpsServer.listen(port, () => {
    console.log(`Server running at https://localhost:${port}`);
});
