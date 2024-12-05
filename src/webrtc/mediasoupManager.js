import { createWorker } from 'mediasoup';
import { mediasoupConfig } from '../config.js';

export const initializeMediasoup = async () => {
    const worker = await createWorker();
    console.log('Mediasoup Worker created');

    const router = await worker.createRouter({ mediaCodecs: mediasoupConfig.mediaCodecs });
    console.log('Mediasoup Router created');

    return router;
};
