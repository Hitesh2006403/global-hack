import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../common/Modal';
import { useDonations } from '../../context/DonationContext';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Scan,
  Camera,
  CameraOff,
  AlertTriangle,
  Lock,
  ArrowRight,
  MapPin,
  Phone,
  Package,
  RotateCw,
} from 'lucide-react';

export const QrVerifyModal = ({ isOpen, onClose, task, onOpenReceiptQr }) => {
  const { currentUser } = useAuth();
  const { verifyPickupScan, confirmPickup } = useDonations();

  // Step state: 'SCAN' -> 'VALIDATED' -> 'CONFIRMED'
  const [step, setStep] = useState('SCAN');
  const [tokenInput, setTokenInput] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validated data from server
  const [validatedData, setValidatedData] = useState(null);
  const [confirmedReceiptToken, setConfirmedReceiptToken] = useState(null);

  // Mandatory 4-point physical inspection
  const [checklist, setChecklist] = useState({
    sealIntact: true,
    temperatureChecked: true,
    noSpillage: true,
    labelPresent: true,
  });

  const scannerRef = useRef(null);
  const readerElementId = 'delivery-qr-reader';

  // Reset modal state on open/close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('SCAN');
      setTokenInput('');
      setErrorMsg('');
      setCameraError('');
      setValidatedData(null);
      setConfirmedReceiptToken(null);
    }
  }, [isOpen]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      } finally {
        scannerRef.current = null;
        setScannerActive(false);
      }
    }
  };

  const startCamera = async () => {
    setErrorMsg('');
    setCameraError('');
    try {
      setScannerActive(true);
      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText) => {
          // Camera scanned QR successfully!
          await stopCamera();
          setTokenInput(decodedText);
          handleValidateToken(decodedText);
        },
        () => {
          // Normal frame scan tick, no error display needed
        }
      );
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraError(
        'Unable to access camera. Please allow camera permissions in browser settings or use manual token entry below.'
      );
      setScannerActive(false);
      scannerRef.current = null;
    }
  };

  // Validate scanned or entered token with backend
  const handleValidateToken = async (tokenToVerify) => {
    const raw = (tokenToVerify || tokenInput).trim();
    if (!raw) {
      setErrorMsg('Please enter or scan the donor pickup QR token.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await verifyPickupScan({
        token: raw,
        taskId: task?.id,
        donationId: task?.donationId,
        agentId: currentUser?.id || 'user-delivery-1',
      });

      setValidatedData(res);
      setStep('VALIDATED');
    } catch (err) {
      setErrorMsg(err.message || 'QR Verification failed. Token may be invalid or unauthorized.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm physical food collection after checklist
  const handleConfirmPickup = async (e) => {
    e.preventDefault();
    const allPassed =
      checklist.sealIntact &&
      checklist.temperatureChecked &&
      checklist.noSpillage &&
      checklist.labelPresent;

    if (!allPassed) {
      setErrorMsg('All 4 food safety checkpoints must be verified before completing pickup.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await confirmPickup({
        tokenId: validatedData?.tokenRecord?.id,
        token: tokenInput.trim(),
        taskId: task?.id,
        safetyChecklist: checklist,
        agentId: currentUser?.id || 'user-delivery-1',
      });

      setConfirmedReceiptToken(res.receiptToken);
      setStep('CONFIRMED');
    } catch (err) {
      setErrorMsg(err.message || 'Pickup confirmation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to paste active token during testing
  const handleSimulateScan = () => {
    const sampleToken = task?.qrRequiredToken || `SAP-PK-${task?.donationId?.toUpperCase() || 'DON-101'}-SECURE-9921`;
    setTokenInput(sampleToken);
    setErrorMsg('');
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stage 2: Delivery Agent Pickup Handover" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* Task Info Pill */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800">{task.foodName}</span>
            <div className="text-slate-500">
              {task.quantity} • {task.pickup?.donorName}
            </div>
          </div>
          <span className="bg-indigo-50 text-indigo-700 font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-200">
            {task.id}
          </span>
        </div>

        {/* STEP 1: SCAN OR INPUT TOKEN */}
        {step === 'SCAN' && (
          <div className="space-y-4">
            {/* Camera Viewfinder Area */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/70 text-center space-y-3 relative overflow-hidden">
              <div
                id={readerElementId}
                className={`w-full max-w-[280px] mx-auto rounded-xl overflow-hidden bg-black ${
                  scannerActive ? 'block min-h-[220px]' : 'hidden'
                }`}
              />

              {!scannerActive && (
                <div className="space-y-2 py-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-200 text-rose-600">
                    <Scan className="w-7 h-7" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-800">Scan Donor's Handover QR Code</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ask kitchen manager Chef Marco to open their "Handover QR" and point camera at the screen.
                  </p>
                </div>
              )}

              {/* Camera Action Buttons */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {!scannerActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Start Camera Scanner</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-left flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Manual Entry Fallback */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Manual Verification Token Fallback:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste or type token (e.g. SAP-PK-DON-101-SECURE-9921)..."
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shrink-0 transition"
                >
                  Paste Active Token
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleValidateToken()}
                disabled={loading || !tokenInput.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Verifying with Server...</span>
                  </>
                ) : (
                  <>
                    <span>Verify QR Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PHYSICAL FOOD SAFETY CHECKLIST */}
        {step === 'VALIDATED' && (
          <form onSubmit={handleConfirmPickup} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>QR Code Authenticated: {validatedData?.donation?.foodName}</span>
              </div>
              <div className="text-xs text-emerald-800 space-y-1">
                <div>Donor: <strong>{validatedData?.donation?.donorName}</strong></div>
                <div>Address: {validatedData?.donation?.pickupLocation?.address}</div>
                <div>Storage Condition: <strong>{validatedData?.donation?.storageCondition}</strong></div>
              </div>
            </div>

            {/* Mandatory 4-Point Safety Inspection */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Mandatory Physical Collection Inspection
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.sealIntact}
                  onChange={(e) => setChecklist({ ...checklist, sealIntact: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>1. Packaging seal intact (Hygienically closed, no tampering)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.temperatureChecked}
                  onChange={(e) => setChecklist({ ...checklist, temperatureChecked: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>2. Temperature verified (Stored in insulated hot carrier/chill bag)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.noSpillage}
                  onChange={(e) => setChecklist({ ...checklist, noSpillage: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>3. Clean condition (No leaking containers or spillage)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.labelPresent}
                  onChange={(e) => setChecklist({ ...checklist, labelPresent: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>4. Dietary tag & expiry label checked with kitchen staff</span>
              </label>
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('SCAN')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
              >
                Back to Scan
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Confirmation...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Physical Collection & Pick Up</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION & RECEIPT QR ACCESS */}
        {step === 'CONFIRMED' && (
          <div className="py-4 text-center space-y-4">
            <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Food Picked Up Successfully!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Status updated to <strong>PICKED_UP</strong>. Stage 2 Recipient Receipt token generated.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-bold text-slate-800">{task.dropoff?.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dropoff Address:</span>
                <span className="text-slate-700 truncate max-w-[220px]">{task.dropoff?.location}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">New Receipt Token:</span>
                <span className="font-mono font-bold text-indigo-700">{confirmedReceiptToken?.rawToken}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
              >
                Close Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenReceiptQr) onOpenReceiptQr(task, confirmedReceiptToken?.rawToken);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                <span>Show Receipt QR Code (Stage 2)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
