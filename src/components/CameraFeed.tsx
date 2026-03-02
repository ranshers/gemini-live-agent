import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import './CameraFeed.css';

export interface CameraFeedRef {
    captureImage: () => Promise<Blob | null>;
}

interface CameraFeedProps {
    onCapture?: (blob: Blob) => void;
}

const CameraFeed = forwardRef<CameraFeedRef, CameraFeedProps>(({ onCapture }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean>(false);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasPermission(true);
            } catch (err: any) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please ensure permissions are granted.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useImperativeHandle(ref, () => ({
        captureImage: (): Promise<Blob | null> => {
            return new Promise((resolve) => {
                if (!videoRef.current || !canvasRef.current || !hasPermission) {
                    resolve(null);
                    return;
                }

                const video = videoRef.current;
                const canvas = canvasRef.current;

                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    console.warn("Video metadata not yet loaded or video size is 0.");
                    resolve(null);
                    return;
                }

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const context = canvas.getContext('2d');
                if (context) {
                    try {
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                            if (blob && onCapture) onCapture(blob);
                            resolve(blob);
                        }, 'image/jpeg', 0.8);
                    } catch (err) {
                        console.error("Error capturing image from canvas:", err);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        }
    }));

    return (
        <div className="camera-feed-container premium-card">
            <div className="camera-header">
                <Camera className="icon-camera" size={20} />
                <h2>Live Analyzer Feed</h2>
                <span className="status-indicator live animate-pulse"></span>
            </div>

            <div className="video-wrapper">
                {error ? (
                    <div className="camera-error">
                        <AlertCircle size={32} />
                        <p>{error}</p>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="video-element"
                    />
                )}
                {/* Hidden canvas for taking snapshots */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="scan-overlay">
                    <div className="scan-line"></div>
                    <div className="corner corner-tl"></div>
                    <div className="corner corner-tr"></div>
                    <div className="corner corner-bl"></div>
                    <div className="corner corner-br"></div>
                </div>
            </div>

            <div className="camera-footer">
                <p className="hint">Point your camera at the ProCyte One screen or sample tube.</p>
            </div>
        </div>
    );
});

export default CameraFeed;
