import fs from 'fs';

export const port = 443;

export const httpsOptions = {
    key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
    cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
};

export const mediasoupConfig = {
    listenIp: '0.0.0.0',
    mediaCodecs: [
        {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
        },
        {
            kind: 'video',
            mimeType: 'video/H264',
            clockRate: 90000,
        },
    ],
};
