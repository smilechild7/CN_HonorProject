import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    entry: './public/client.js', // 클라이언트 진입점
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'),
        library: 'mediasoupClient', // 글로벌로 노출
        libraryTarget: 'var',       // 브라우저 환경에서 사용할 수 있게 설정
    },
    
    mode: 'development', // 개발 모드
    module: {
        rules: [
            {
                test: /\.js$/, // .js 확장자를 가진 파일만 변환
                exclude: /node_modules/, // node_modules 제외
                use: {
                    loader: 'babel-loader', // Babel 로더
                    options: {
                        presets: ['@babel/preset-env'], // 최신 JS를 브라우저 호환 코드로 변환
                    },
                },
            },
        ],
    },
    resolve: {
        alias: {
            'mediasoup-client': path.resolve(__dirname, 'node_modules/mediasoup-client'),
        },
        fallback: {
            fs: false, // Node.js의 fs 모듈을 제거 (브라우저 환경에서 필요 없음)
        },
    },
    devtool: false, // 소스 맵 비활성화
};
