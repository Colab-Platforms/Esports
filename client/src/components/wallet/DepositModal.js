import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiX, FiCreditCard, FiShield, FiCheck } from 'react-icons/fi';
import {
  createDepositOrder,
  verifyPayment,
  fetchWalletDetails,
  clearWalletError,
  clearCurrentOrder
} from '../../store/slices/walletSlice';

const DepositModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { currentOrder, loading, error } = useSelector((state) => state.wallet);

  const [amount, setAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [paymentStep, setPaymentStep] = useState('amount'); // 'amount', 'processing', 'success'

  const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setSelectedAmount(null);
      setPaymentStep('amount');
      dispatch(clearCurrentOrder());
      dispatch(clearWalletError('deposit'));
    }
  }, [isOpen, dispatch]);

  const handleAmountSelect = (value) => {
    setSelectedAmount(value);
    setAmount(value.toString());
  };

  const handleCustomAmount = (e) => {
    const value = e.target.value;
    setAmount(value);
    setSelectedAmount(null);
  };

  const validateAmount = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 10) {
      return 'Minimum deposit amount is ₹10';
    }
    if (numAmount > 50000) {
      return 'Maximum deposit amount is ₹50,000';
    }
    return null;
  };

  const handleDeposit = async () => {
    const validationError = validateAmount();
    if (validationError) {
      alert(validationError);
      return;
    }

    setPaymentStep('processing');

    try {
      const result = await dispatch(createDepositOrder(parseFloat(amount))).unwrap();

      // For demo purposes, simulate payment success
      setTimeout(async () => {
        try {
          setPaymentStep('success');
          dispatch(fetchWalletDetails());
        } catch (error) {
          setPaymentStep('amount');
          alert('Payment simulation failed. Please try again.');
        }
      }, 2000);
    } catch (error) {
      setPaymentStep('amount');
    }
  };

  const handleClose = () => {
    if (paymentStep === 'success') {
      dispatch(fetchWalletDetails()); // Refresh wallet on close after success
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gaming-card rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Add Money to Wallet</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {paymentStep === 'amount' && (
            <div>
              {/* Amount Selection */}
              <div className="mb-6">
                <label className="block text-white font-medium mb-3">Select Amount</label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {quickAmounts.map((value) => (
                    <button
                      key={value}
                      onClick={() => handleAmountSelect(value)}
                      className={`p-3 rounded-lg border transition-colors ${selectedAmount === value
                        ? 'border-gaming-neon bg-gaming-neon/20 text-gaming-neon'
                        : 'border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                    >
                      ₹{value}
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <div className="mb-4">
                  <label className="block text-white font-medium mb-2">Or enter custom amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={handleCustomAmount}
                    placeholder="Enter amount (₹10 - ₹50,000)"
                    className="w-full px-4 py-3 bg-gaming-dark border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-gaming-neon focus:outline-none"
                    min="10"
                    max="50000"
                  />
                </div>

                {/* Error Display */}
                {error.deposit && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{error.deposit}</p>
                  </div>
                )}

                {/* Security Info */}
                <div className="bg-gaming-dark/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiShield className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">Secure Payment</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Your payment is secured by Razorpay with 256-bit SSL encryption.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={!amount || loading.deposit}
                    className="flex-1 px-4 py-3 bg-gaming-neon text-black font-medium rounded-lg hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading.deposit ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <FiCreditCard className="h-4 w-4" />
                        <span>Pay ₹{amount || 0}</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {paymentStep === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-white mb-2">Processing Payment</h3>
              <p className="text-gray-400">Please complete the payment in the popup window...</p>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Payment Successful!</h3>
              <p className="text-gray-400 mb-6">
                ₹{amount} has been added to your wallet successfully.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-gaming-neon text-black font-medium rounded-lg hover:bg-gaming-neon/90 transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositModal;