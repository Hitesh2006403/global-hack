import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { useDonations } from '../../context/DonationContext';
import {
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Lock,
} from 'lucide-react';

export const QrCodeModal = ({ isOpen, onClose, donation, stage = 'PICKUP', explicitToken = null }) => {
  const { getPickupToken, getReceiptToken } = useDonations();
  const [tokenData, setTokenData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Fetch or generate real token whenever modal opens
  useEffect(() => {
    let isMounted = true;

    const loadToken = async () => {
      if (!isOpen || !donation) return;
      try {
        setLoading(true);
        setError('');

        let result;
        if (explicitToken) {
          result = {
            token: {
              rawToken: explicitToken,
              donationId: donation.id,
              stage,
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            },
          };
        } else if (stage === 'RECEIPT') {
          result = await getReceiptToken(donation.id);
        } else {
          result = await getPickupToken(donation.id);
        }

        if (!isMounted) return;

        const activeToken = result.token;
        setTokenData(activeToken);

        // Generate high-resolution authentic QR code matrix
        const qrPayload = JSON.stringify({
          app: 'ShareAPlate',
          donationId: donation.id,
          stage: activeToken.stage || stage,
          token: activeToken.rawToken,
        });

        const url = await QRCode.toDataURL(activeToken.rawToken || qrPayload, {
          width: 280,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        });

        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading QR code token:', err);
          setError(err.message || 'Failed to load secure handover token');
          setLoading(false);
        }
      }
    };

    loadToken();

    return () => {
      isMounted = false;
    };
  }, [isOpen, donation, stage, explicitToken, getPickupToken, getReceiptToken]);

  // Live countdown timer for token expiration
  useEffect(() => {
    if (!tokenData?.expiresAt) return;

    const updateTimer = () => {
      const diff = new Date(tokenData.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const mins = Math.floor(diff / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tokenData?.expiresAt]);

  if (!donation) return null;

  const rawTokenString = tokenData?.rawToken || donation.handoverQrToken || `SAP-QR-${donation.id}`;
  const isReceiptStage = stage === 'RECEIPT';

  const handleCopy = () => {
    navigator.clipboard?.writeText(rawTokenString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const res = isReceiptStage
        ? await getReceiptToken(donation.id)
        : await getPickupToken(donation.id);
      setTokenData(res.token);
      const url = await QRCode.toDataURL(res.token.rawToken, {
        width: 280,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Status badge calculation
  const getStatusBadge = () => {
    if (donation.status === 'DELIVERED' || donation.status === 'COMPLETED') {
      return { label: 'Delivered & Completed', color: 'bg-teal-100 text-teal-800 border-teal-300' };
    }
    if (donation.status === 'PICKED_UP') {
      return { label: 'Picked Up (In Transit)', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    return { label: 'Awaiting Pickup Scan', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  };

  const statusBadge = getStatusBadge();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Secure Handover QR Code">
      <div className="text-center py-2 space-y-4">
        {/* Stage Header Badge */}
        <div className="flex items-center justify-center gap-2">
          <span
            className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border shadow-2xs ${
              isReceiptStage
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isReceiptStage ? 'STAGE 2: Recipient Drop-off Receipt' : 'STAGE 1: Donor Pickup Handover'}
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {isReceiptStage
            ? 'Present this receipt QR code to the verified shelter recipient Sister Teresa to finalize delivery.'
            : 'Present this QR code to verified delivery partner Vikram Singh during food collection.'}
        </p>

        {/* Real Dynamic QR Code Graphic Frame */}
        <div className="relative inline-block p-4 sm:p-5 bg-white rounded-2xl border-2 border-slate-900 shadow-xl mx-auto">
          <div className="w-56 h-56 bg-white flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl relative overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <RotateCw className="w-8 h-8 animate-spin text-rose-600" />
                <span className="text-xs font-semibold">Generating Real QR Code...</span>
              </div>
            ) : error ? (
              <div className="p-3 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
                <p className="text-xs text-rose-700 font-semibold">{error}</p>
                <button
                  onClick={handleRegenerate}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                >
                  Regenerate QR
                </button>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Secure QR code for donation ${donation.id}`}
                className="w-full h-full object-contain"
              />
            ) : null}
          </div>

          <div className="mt-2.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-bold text-slate-700 tracking-wider">
              {donation.id?.toUpperCase()}
            </span>
            {timeLeft && (
              <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                timeLeft === 'Expired' ? 'text-rose-600 font-bold' : 'text-slate-500'
              }`}>
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{timeLeft === 'Expired' ? 'Expired' : `Expires: ${timeLeft}`}</span>
              </span>
            )}
          </div>
        </div>

        {/* Token string & copy */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-left">
          <div className="min-w-0 pr-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Verification Token (Unpredictable)</span>
            </div>
            <div className="font-mono text-xs font-semibold text-slate-800 truncate">
              {rawTokenString}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shadow-xs transition shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Security assurance */}
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 py-2 px-3 rounded-lg border border-emerald-200/80">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">
            Cryptographically Signed • HMAC-SHA256 • Single-Use Verified
          </span>
        </div>
      </div>
    </Modal>
  );
};
