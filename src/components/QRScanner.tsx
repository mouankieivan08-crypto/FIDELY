import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Only initialize once
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        // Optional: Stop scanning after successful scan
        // scanner.clear();
      },
      (errorMessage) => {
        if (onError) onError(errorMessage);
      }
    );

    scannerRef.current = scanner;
    setIsScanning(true);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Failed to clear html5-qrcode scanner. ", error);
        });
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div id="reader" className="w-full rounded-lg overflow-hidden shadow-lg border-2 border-indigo-500"></div>
      {!isScanning && <p className="text-center mt-4 text-gray-500">Initializing camera...</p>}
    </div>
  );
}
