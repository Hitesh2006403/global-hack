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
  FileText,
  Utensils,
  Truck,
  RotateCw,
  Hash,
  Download,
} from 'lucide-react';

export const RecipientQrScannerModal = ({ isOpen, onClose, targetDonation = null }) => {
  const { currentUser } = useAuth();
  const { verifyReceiptScan, confirmReceipt } = useDonations();

  // Steps: 'SCAN' -> 'VERIFY_CONDITION' -> 'RECEIPT'
  const [step, setStep] = useState('SCAN');
  const [tokenInput, setTokenInput] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validated data from server
  const [validatedData, setValidatedData] = useState(null);

  // Recipient confirmation fields
  const [receivedQuantity, setReceivedQuantity] = useState('');
  const [foodCondition, setFoodCondition] = useState('EXCELLENT');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [explicitAffirmation, setExplicitAffirmation] = useState(false);

  // Completed digital receipt
  const [completedReceipt, setCompletedReceipt] = useState(null);

  const scannerRef = useRef(null);
  const readerElementId = 'recipient-qr-reader';

  // Reset modal state on open/close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('SCAN');
      setTokenInput('');
      setErrorMsg('');
      setCameraError('');
      setValidatedData(null);
      setCompletedReceipt(null);
      setExplicitAffirmation(false);
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
          // Normal frame scanning
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

  // Validate scanned receipt token with backend
  const handleValidateToken = async (tokenToVerify) => {
    const raw = (tokenToVerify || tokenInput).trim();
    if (!raw) {
      setErrorMsg('Please enter or scan the delivery agent receipt token.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await verifyReceiptScan({
        token: raw,
        recipientId: currentUser?.id || 'user-recipient-1',
      });

      setValidatedData(res);
      setReceivedQuantity(
        res.donation?.remainingQuantity || res.donation?.initialQuantity || '35'
      );
      setStep('VERIFY_CONDITION');
    } catch (err) {
      setErrorMsg(err.message || 'QR validation failed. Invalid or expired receipt token.');
    } finally {
      setLoading(false);
    }
  };

  // Explicit confirmation of physical receipt
  const handleConfirmHandover = async (e) => {
    e.preventDefault();
    if (!explicitAffirmation) {
      setErrorMsg('You must check the physical handover confirmation box.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await confirmReceipt({
        tokenId: validatedData?.tokenRecord?.id,
        token: tokenInput.trim(),
        donationId: validatedData?.tokenRecord?.donationId,
        recipientId: currentUser?.id || 'user-recipient-1',
        recipientName: currentUser?.organizationName || 'Grace Hope Children Shelter',
        receivedQuantity: Number(receivedQuantity) || 35,
        foodCondition,
        discrepancyNotes,
      });

      setCompletedReceipt(res.receipt);
      setStep('RECEIPT');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to confirm receipt.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to paste sample token for fast testing
  const handleSimulateScan = () => {
    const sample = targetDonation
      ? `SAP-RC-${targetDonation.id?.toUpperCase()}-VERIFIED`
      : 'SAP-RC-DON-101-SECURE-9921';
    setTokenInput(sample);
    setErrorMsg('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stage 3: Shelter Receipt & Food Verification" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* STEP 1: SCAN OR ENTER RECEIPT QR */}
        {step === 'SCAN' && (
          <div className="space-y-4">
            {/* Camera Viewfinder */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/70 text-center space-y-3 relative overflow-hidden">
              <div
                id={readerElementId}
                className={`w-full max-w-[280px] mx-auto rounded-xl overflow-hidden bg-black ${
                  scannerActive ? 'block min-h-[220px]' : 'hidden'
                }`}
              />

              {!scannerActive && (
                <div className="space-y-2 py-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm border border-emerald-200">
                    <Scan className="w-7 h-7" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-800">Scan Delivery Rider's Receipt QR</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Point your device camera at the receipt QR code displayed on delivery partner Vikram Singh's screen.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
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

            {/* Manual Token Input Fallback */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Manual Receipt Token Fallback:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste or type receipt token (e.g. SAP-RC-DON101...)..."
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Receipt Token...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Receipt QR</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: VERIFY QUANTITY & FOOD CONDITION */}
        {step === 'VERIFY_CONDITION' && (
          <form onSubmit={handleConfirmHandover} className="space-y-4">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Valid Delivery in Transit</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {validatedData?.donation?.id?.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-slate-700">
                <div className="font-bold text-slate-900">{validatedData?.donation?.foodName}</div>
                <div className="text-slate-500">
                  Donor: {validatedData?.donation?.donorName} • Courier: Vikram Singh (Rider #42)
                </div>
              </div>
            </div>

            {/* Quantity Confirmation Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Confirm Actual Food Quantity Received ({validatedData?.donation?.unit || 'servings'}):
              </label>
              <input
                type="number"
                min="1"
                value={receivedQuantity}
                onChange={(e) => setReceivedQuantity(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Food Condition Radio Group */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Inspect Food Physical Condition:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'EXCELLENT', label: 'Fresh & Hot', desc: 'Pristine seal' },
                  { id: 'GOOD', label: 'Good Condition', desc: 'Fully acceptable' },
                  { id: 'DISCREPANCY', label: 'Minor Issue', desc: 'Slight spillage' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition ${
                      foodCondition === item.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={item.id}
                      checked={foodCondition === item.id}
                      onChange={() => setFoodCondition(item.id)}
                      className="sr-only"
                    />
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Discrepancy Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Optional Remarks or Discrepancy Notes:
              </label>
              <textarea
                rows={2}
                value={discrepancyNotes}
                onChange={(e) => setDiscrepancyNotes(e.target.value)}
                placeholder="e.g. Received exactly 35 warm portions. Ready for dinner service."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Explicit Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={explicitAffirmation}
                onChange={(e) => setExplicitAffirmation(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-xs text-slate-700 leading-snug">
                I explicitly confirm physical receipt of this surplus meal batch from the delivery rider, and verify it meets shelter food consumption standards.
              </span>
            </label>

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
                disabled={loading || !explicitAffirmation}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Finalizing Handover...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Complete Handover</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: HANDOVER DIGITAL RECEIPT VIEW */}
        {step === 'RECEIPT' && completedReceipt && (
          <div className="space-y-4 py-2 text-center">
            <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">Food Rescued & Handover Complete!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Status updated to <strong>DELIVERED</strong>. Both donor and delivery partner portals updated.
              </p>
            </div>

            {/* Official Digital Handover Receipt */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 text-left space-y-3 font-mono text-xs shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="text-[10px] tracking-wider text-teal-400 font-bold uppercase">
                  SHAREAPLATE VERIFIED HANDOVER RECEIPT
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(completedReceipt.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="text-white font-bold">{completedReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Donation ID:</span>
                  <span className="text-amber-300 font-bold">{completedReceipt.donationId?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity Delivered:</span>
                  <span className="text-emerald-400 font-bold">{completedReceipt.quantityDelivered}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiary Org:</span>
                  <span className="text-white">{completedReceipt.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verified Courier:</span>
                  <span className="text-white">{completedReceipt.deliveryAgentName}</span>
                </div>
              </div>

              {/* Cryptographic Proof Hash */}
              <div className="border-t border-slate-800 pt-2 text-[10px] space-y-1">
                <div className="text-slate-500 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-teal-400" />
                  <span>SHA-256 Handover Proof:</span>
                </div>
                <div className="text-slate-400 font-mono break-all text-[9px] bg-black/40 p-1.5 rounded">
                  {completedReceipt.cryptographicProof}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition"
              >
                Close & Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
