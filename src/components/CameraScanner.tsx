/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, ShieldAlert, Sparkles, Search, Zap, Volume2, HardDrive, Keyboard } from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Html5Qrcode } from 'html5-qrcode';

interface CameraScannerProps {
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const { products, triggerToast } = useAppState();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [activeCamera, setActiveCamera] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'simulator'>('simulator');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [customBarcode, setCustomBarcode] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Advanced camera selection and device feedback
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Play a retro-futuristic laser beep on successful barcode scanning
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 950; // crisp high pitch scanner beep
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio beep blocked by browser context policy", e);
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isActive = true;

    if (activeTab === 'camera') {
      setIsInitializing(true);
      setCameraError(null);
      setHasPermission(null);

      // Small delay to ensure interactive-scanner-div container is fully rendered in the DOM
      const delayTimer = setTimeout(() => {
        if (!isActive) return;

        try {
          html5QrCode = new Html5Qrcode("interactive-scanner-div");
          
          // Fall back gracefully if no camera device has been manually chosen yet
          const cameraConstraint = selectedCameraId ? selectedCameraId : { facingMode: "environment" };

          html5QrCode.start(
            cameraConstraint,
            {
              fps: 15,
              // Make wide scanning rect frame for easy linear 1D barcodes
              qrbox: (videoWidth, videoHeight) => {
                const width = Math.min(videoWidth - 40, 290);
                const height = Math.min(videoHeight - 40, 160);
                return { width, height };
              },
              aspectRatio: 1.333333
            },
            (decodedText) => {
              // Beep & forward
              playBeep();
              onScanSuccess(decodedText);
              triggerToast(`Barcode Scanned: ${decodedText} ✔`, "success");
            },
            () => {
              // Frame decoding misses are normal in ongoing scan mode, keep silent
            }
          )
          .then(() => {
            if (isActive) {
              setHasPermission(true);
              setActiveCamera(true);
              setIsInitializing(false);

              // Query all available hardware cameras so user can easily switch them if they have a multi-lens phone!
              Html5Qrcode.getCameras()
                .then((devices) => {
                  if (isActive && devices && devices.length > 0) {
                    setCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.substring(0, 5)}` })));
                  }
                })
                .catch(err => console.warn("Failed carrying out getCameras checklist", err));
            }
          })
          .catch((err) => {
            console.warn("Failed starting Html5Qrcode camera stream", err);
            if (isActive) {
              setHasPermission(false);
              setActiveCamera(false);
              setIsInitializing(false);
              
              let explanation = String(err);
              if (explanation.includes("NotAllowedError") || explanation.includes("Permission denied")) {
                explanation = "Camera access was denied. If prompted by your browser or smartphone, please choose 'Allow' or check your device settings to permit camera usage.";
              } else if (explanation.includes("NotFoundError") || explanation.includes("Requested device not found")) {
                explanation = "No rear-facing environment camera was detected. Note: inside the sandbox iframe, camera hardware may be unavailable. Try launching the app in direct URL tab.";
              } else if (explanation.includes("NotReadableError") || explanation.includes("Could not start video source")) {
                explanation = "Your hardware camera is busy or already active in another app/tab. Please close other camera programs and try again.";
              }
              setCameraError(explanation);
              triggerToast("Live camera stream failed to start.", "error");
            }
          });
        } catch (error) {
          console.error("Critical error in camera setup:", error);
          if (isActive) {
            setHasPermission(false);
            setIsInitializing(false);
            setCameraError(String(error));
          }
        }
      }, 300);

      return () => {
        isActive = false;
        clearTimeout(delayTimer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => console.warn("Failed stopping html5-qrcode standard release", err));
        }
      };
    } else {
      // Clear permissions indicators to allow clean fresh prompt next time they switch tabs
      setHasPermission(null);
      setActiveCamera(false);
      setCameraError(null);
    }
  }, [activeTab, selectedCameraId, retryCount]);

  const handleBarcodeSubmit = (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;
    playBeep();
    onScanSuccess(barcodeValue.trim());
  };

  // Filter products for the sandbox simulator grid
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="camera-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm transition-opacity duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-gray-950 border border-white/10 text-white shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Console */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4 shrink-0 bg-gray-900">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider font-sans text-gray-100 flex items-center gap-1.5">
                Barcode Scanner Console
              </h3>
              <p className="text-[10px] text-gray-400 font-mono">Status: Connected to local POS sandbox</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Audio Toggle indicator */}
            <button 
              id="toggle-beep-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`rounded-lg p-1.5 border transition ${
                soundEnabled 
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' 
                  : 'border-white/5 text-gray-500 bg-white/5'
              }`}
              title={soundEnabled ? "Scanner beep: ON" : "Scanner beep: OFF"}
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button 
              id="close-camera-btn"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white border border-transparent hover:border-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex border-b border-white/5 bg-gray-900/50 p-1 shrink-0">
          <button
            id="tab-scanner-sim"
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'simulator' 
                ? 'bg-white/10 text-emerald-400 font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Interactive Simulator Mode (Recommended)
          </button>
          <button
            id="tab-scanner-live"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'camera' 
                ? 'bg-white/10 text-emerald-400 font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            Live Device Webcam
          </button>
        </div>

        {/* Screen View */}
        <div className="relative aspect-[4/3] w-full bg-black flex items-center justify-center overflow-hidden border-b border-white/5 shrink-0 select-none">
          {activeTab === 'camera' ? (
            hasPermission !== false ? (
              <div className="relative w-full h-full">
                {/* Live Scanner Video mount node */}
                <div 
                  id="interactive-scanner-div" 
                  className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />

                {/* Inline Camera Selector Overlay when Camera is Active */}
                {cameras.length > 0 && (
                  <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-lg">
                    <Camera className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-1" />
                    <select
                      id="active-camera-selector"
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="flex-1 text-[11px] bg-transparent text-gray-200 outline-none cursor-pointer pr-1 font-sans"
                    >
                      <option value="" className="bg-gray-950 text-white">Default Rear Camera</option>
                      {cameras.map((cam) => (
                        <option key={cam.id} value={cam.id} className="bg-gray-950 text-white">
                          {cam.label || `Camera Device ${cam.id.substring(0, 6)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Loading state indicator */}
                {isInitializing && (
                  <div className="absolute inset-0 bg-gray-950/90 z-20 flex flex-col items-center justify-center p-6 text-center">
                    <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mb-3.5" />
                    <p className="text-xs font-semibold text-gray-200">Accessing Camera Hardware...</p>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal max-w-xs">
                      If prompted, select <span className="text-emerald-400 font-bold">"Allow"</span> to connect your phone's webcam to this terminal scanner.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
                <div className="mb-3.5 rounded-full bg-red-950/40 p-3 text-red-400 border border-red-800/40 animate-pulse">
                  <ShieldAlert className="h-6.5 w-6.5" />
                </div>
                <h4 className="text-sm font-semibold text-gray-200">Camera Feed Blocked</h4>
                <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed font-sans px-2">
                  {cameraError || "Webcam is blocked, sandboxed or unavailable in the present frame environment."}
                </p>

                {/* Dropdown to switch cameras even in error state */}
                {cameras.length > 0 && (
                  <div className="mt-4 w-full px-4 text-left">
                    <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider block mb-1">Select Alternate Lens</span>
                    <select
                      id="error-camera-selector"
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        setRetryCount(prev => prev + 1);
                      }}
                      className="w-full text-xs bg-gray-900 text-gray-200 border border-white/10 rounded-lg px-2.5 py-1.5 outline-none font-sans"
                    >
                      <option value="">Default Rear Camera</option>
                      {cameras.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Camera ${cam.id.substring(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    id="camera-manual-retry-btn"
                    onClick={() => setRetryCount(prev => prev + 1)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg active:scale-95 transition cursor-pointer shadow-lg"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry Camera
                  </button>
                  <button
                    id="switch-sim-btn"
                    onClick={() => setActiveTab('simulator')}
                    className="inline-flex items-center gap-1 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 font-semibold text-xs px-3.5 py-1.5 rounded-lg active:scale-95 transition cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    Simulator Tab
                  </button>
                </div>

                <div className="mt-5 border-t border-white/5 pt-3 w-full text-left">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    💡 **Tip for Phones**: Iframe preview windows strictly limit hardware access. Please copy the <strong>Development App URL</strong> from metadata and query it directly inside Safari or Chrome on your mobile device!
                  </p>
                </div>
              </div>
            )
          ) : (
            // Custom high-fidelity retro digital mockup scanning visualization
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-gray-900 flex flex-col items-center justify-center p-6 text-center">
              <div className="relative border border-emerald-500/20 bg-emerald-950/10 rounded-xl px-10 py-5 flex flex-col items-center justify-center backdrop-blur-xs select-none animate-fade-in">
                <div className="flex items-center gap-1.5 text-[#34d399] animate-pulse font-mono text-[9px] uppercase tracking-widest mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  SIMULATION ACTIVE
                </div>

                {/* Simulated Moving Laser Line */}
                <div className="relative py-2 px-1 w-44 h-16 flex flex-col justify-between items-center opacity-70">
                  <div className="w-full flex justify-between tracking-tighter text-gray-400 select-none">
                    <span>|||</span><span>|</span><span>||</span><span>||</span><span>|</span><span>|||</span><span>||</span><span>|</span><span>||</span><span>|</span>
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-bounce shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                  <div className="w-full flex justify-between tracking-tighter text-gray-400 select-none">
                    <span>|||</span><span>||</span><span>|</span><span>||</span><span>|</span><span>|||</span><span>||</span><span>|</span><span>||</span><span>||</span>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-gray-400 font-mono">
                  Ready to trigger high-fidelity virtual scans below
                </div>
              </div>

              {/* Tips */}
              <div className="mt-5 text-[11px] text-gray-500 max-w-sm leading-relaxed">
                Tip: Physical USB hardware scanners can also be used continuously. Simply select any input box inside the dashboard to capture immediate physical inputs!
              </div>
            </div>
          )}

          {/* Retro Scope Overlay */}
          <div className="absolute inset-0 border-2 border-emerald-500/10 pointer-events-none flex flex-col justify-between p-6">
            <div className="flex justify-between">
              <div className="h-5 w-5 border-t-2 border-l-2 border-emerald-400/60"></div>
              <div className="h-5 w-5 border-t-2 border-r-2 border-emerald-400/60"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-5 w-5 border-b-2 border-l-2 border-emerald-400/60"></div>
              <div className="h-5 w-5 border-b-2 border-r-2 border-emerald-400/60"></div>
            </div>
          </div>
        </div>

        {/* Dynamic Simulator Grid with Search and Manual Input */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-950 flex flex-col">
          {/* Custom Code Input injector form */}
          <div className="mb-4 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Keyboard className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider font-mono">Manual Barcode Serial Injector</span>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleBarcodeSubmit(customBarcode);
                setCustomBarcode('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                id="manual-barcode-input"
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                placeholder="Type or paste barcode serial key (e.g. 101010)"
                className="flex-1 rounded-lg bg-gray-900 border border-white/10 px-3 py-1.5 text-xs text-white focus:border-emerald-500/60 focus:outline-none font-mono"
              />
              <button
                type="submit"
                id="inject-manual-barcode-btn"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                Inject Scan
              </button>
            </form>
          </div>

          <div className="border-t border-white/5 my-2 shrink-0" />

          {/* Search Box */}
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              id="sandbox-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search interactive catalog items..."
              className="w-full rounded-lg bg-gray-900 border border-white/10 pl-8 pr-32 py-1.5 text-xs text-white focus:border-emerald-500/60 focus:outline-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {filteredProducts.length} matched
            </div>
          </div>

          {/* Interactive Catalog item tap grid */}
          <div className="flex-1 overflow-y-auto min-h-[140px] pr-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">
                No items matched your search query in the catalog.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    id={`inject-sim-tag-${p.barcode}`}
                    onClick={() => handleBarcodeSubmit(p.barcode)}
                    className="flex items-center gap-2.5 rounded-xl bg-gray-900 hover:bg-gray-850 border border-white/5 hover:border-emerald-500/40 p-2.5 text-left transition duration-150 active:scale-95 group cursor-pointer"
                  >
                    <span className="text-xl shrink-0 h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
                      {p.imageUrl || '📦'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">{p.name}</p>
                      <p className="text-[10px] font-mono text-gray-400 font-medium tracking-tight truncate">SKU: {p.sku}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded">
                          {p.barcode}
                        </span>
                        <span className={`text-[9px] ${p.stock <= 0 ? 'text-red-400 font-mono' : 'text-gray-500'}`}>
                          Stk: {p.stock}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
