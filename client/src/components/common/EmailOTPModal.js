import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import secureRequest from '../../utils/secureRequest';

const RESEND_COOLDOWN = 60;

const EmailOTPModal = ({ email, onVerified, onClose }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  // Start countdown on mount
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-focus first input on open
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const updated = [...otp];
    updated[index] = value.slice(-1); // one digit per box
    setOtp(updated);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const updated = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(updated);
    const nextEmpty = updated.findIndex(d => !d);
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const data = await secureRequest.post('/api/auth/verify-email-otp', { email, otp: code });
      if (data.success) {
        onVerified();
      } else {
        const msg = data.error?.message || 'Invalid OTP';
        setError(msg);
        if (data.error?.attemptsLeft !== undefined) {
          setError(`${msg} — ${data.error.attemptsLeft} attempt${data.error.attemptsLeft !== 1 ? 's' : ''} left`);
        }
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [otp, email, onVerified]);

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await secureRequest.post('/api/auth/send-email-otp', { email });
      toast.success('A new OTP has been sent to your email');
      setOtp(['', '', '', '', '', '']);
      setCountdown(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    } catch {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative bg-gaming-charcoal border border-gaming-slate rounded-2xl p-8 w-full max-w-md shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-gaming-neon/10 border border-gaming-neon/30 flex items-center justify-center">
              <FiMail className="w-7 h-7 text-gaming-neon" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">Verify Your Email</h2>
          <p className="text-gray-400 text-sm text-center mb-1">
            We sent a 6-digit OTP to
          </p>
          <p className="text-gaming-neon text-sm text-center font-medium mb-6 break-all">
            {maskedEmail}
          </p>

          {/* OTP Input boxes */}
          <div className="flex justify-center gap-3 mb-4" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 bg-gaming-dark text-white focus:outline-none transition-all duration-200
                  ${error ? 'border-red-500' : digit ? 'border-gaming-neon' : 'border-gaming-slate focus:border-gaming-neon'}`}
                style={{ height: '52px' }}
              />
            ))}
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-xs text-center mb-4"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleVerify}
            disabled={isVerifying || otp.join('').length < 6}
            className="w-full py-3 rounded-lg font-semibold text-gaming-dark bg-gradient-neon hover:shadow-gaming disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mb-4"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gaming-dark border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : 'Verify OTP'}
          </motion.button>

          {/* Resend */}
          <p className="text-center text-sm text-gray-400">
            Didn't receive it?{' '}
            {countdown > 0 ? (
              <span className="text-gray-500">Resend in <span className="text-gaming-neon">{countdown}s</span></span>
            ) : (
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-gaming-neon hover:underline font-medium disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend OTP'}
              </button>
            )}
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EmailOTPModal;
