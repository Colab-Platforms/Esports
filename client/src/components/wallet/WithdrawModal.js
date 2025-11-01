import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiX, FiDollarSign, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { 
  createWithdrawalRequest, 
  clearWalletError 
} from '../../store/slices/walletSlice';

const WithdrawModal = ({ isOpen, onClose, currentBalance }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.wallet);
  
  const [amount, setAmount] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: ''
  });
  const [withdrawalStep, setWithdrawalStep] = useState('form'); // 'form', 'success'
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setBankDetails({
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        accountHolderName: '',
        bankName: ''
      });
      setWithdrawalStep('form');
      setErrors({});
      dispatch(clearWalletError('withdrawal'));
    }
  }, [isOpen, dispatch]);

  const validateForm = () => {
    const newErrors = {};

    // Amount validation
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      newErrors.amount = 'Minimum withdrawal amount is ₹100';
    } else if (numAmount > currentBalance) {
      newErrors.amount = 'Amount exceeds available balance';
    } else if (numAmount > 50000) {
      newErrors.amount = 'Maximum withdrawal amount is ₹50,000 per transaction';
    }

    // Bank details validation
    if (!bankDetails.accountNumber) {
      newErrors.accountNumber = 'Account number is required';
    } else if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
      newErrors.accountNumber = 'Account number must be 9-18 digits';
    }

    if (bankDetails.accountNumber !== bankDetails.confirmAccountNumber) {
      newErrors.confirmAccountNumber = 'Account numbers do not match';
    }

    if (!bankDetails.ifscCode) {
      newErrors.ifscCode = 'IFSC code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode.toUpperCase())) {
      newErrors.ifscCode = 'Invalid IFSC code format';
    }

    if (!bankDetails.accountHolderName) {
      newErrors.accountHolderName = 'Account holder name is required';
    } else if (bankDetails.accountHolderName.length < 2) {
      newErrors.accountHolderName = 'Name must be at least 2 characters';
    }

    if (!bankDetails.bankName) {
      newErrors.bankName = 'Bank name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setBankDetails(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    if (errors.amount) {
      setErrors(prev => ({
        ...prev,
        amount: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(createWithdrawalRequest({
        amount: parseFloat(amount),
        bankDetails: {
          ...bankDetails,
          ifscCode: bankDetails.ifscCode.toUpperCase()
        }
      })).unwrap();
      
      setWithdrawalStep('success');
    } catch (error) {
      // Error is handled by Redux
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gaming-card rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Withdraw Money</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {withdrawalStep === 'form' && (
            <form onSubmit={handleSubmit}>
              {/* Available Balance */}
              <div className="bg-gaming-dark/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Available Balance:</span>
                  <span className="text-white font-semibold">{formatCurrency(currentBalance)}</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-white font-medium mb-2">Withdrawal Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount (₹100 minimum)"
                  className={`w-full px-4 py-3 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                    errors.amount ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                  }`}
                  min="100"
                  max={Math.min(currentBalance, 50000)}
                />
                {errors.amount && (
                  <p className="text-red-400 text-sm mt-1">{errors.amount}</p>
                )}
              </div>

              {/* Bank Details */}
              <div className="space-y-4 mb-6">
                <h3 className="text-white font-medium">Bank Details</h3>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankDetails.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    placeholder="Enter account number"
                    className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                      errors.accountNumber ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                    }`}
                  />
                  {errors.accountNumber && (
                    <p className="text-red-400 text-sm mt-1">{errors.accountNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1">Confirm Account Number</label>
                  <input
                    type="text"
                    value={bankDetails.confirmAccountNumber}
                    onChange={(e) => handleInputChange('confirmAccountNumber', e.target.value)}
                    placeholder="Re-enter account number"
                    className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                      errors.confirmAccountNumber ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                    }`}
                  />
                  {errors.confirmAccountNumber && (
                    <p className="text-red-400 text-sm mt-1">{errors.confirmAccountNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={bankDetails.ifscCode}
                    onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                    placeholder="e.g., SBIN0001234"
                    className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                      errors.ifscCode ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                    }`}
                  />
                  {errors.ifscCode && (
                    <p className="text-red-400 text-sm mt-1">{errors.ifscCode}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={bankDetails.accountHolderName}
                    onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                    placeholder="As per bank records"
                    className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                      errors.accountHolderName ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                    }`}
                  />
                  {errors.accountHolderName && (
                    <p className="text-red-400 text-sm mt-1">{errors.accountHolderName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankDetails.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    placeholder="e.g., State Bank of India"
                    className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                      errors.bankName ? 'border-red-500' : 'border-gray-600 focus:border-gaming-neon'
                    }`}
                  />
                  {errors.bankName && (
                    <p className="text-red-400 text-sm mt-1">{errors.bankName}</p>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {error.withdrawal && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error.withdrawal}</p>
                </div>
              )}

              {/* Processing Info */}
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <FiAlertCircle className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400 font-medium">Processing Time</span>
                </div>
                <p className="text-gray-300 text-sm">
                  Withdrawal requests are processed within 24-48 hours on business days.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading.withdrawal}
                  className="flex-1 px-4 py-3 bg-gaming-accent text-white font-medium rounded-lg hover:bg-gaming-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading.withdrawal ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <FiDollarSign className="h-4 w-4" />
                      <span>Request Withdrawal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {withdrawalStep === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Withdrawal Request Submitted!</h3>
              <p className="text-gray-400 mb-6">
                Your withdrawal request for {formatCurrency(parseFloat(amount))} has been submitted successfully. 
                It will be processed within 24-48 hours.
              </p>
              <button
                onClick={onClose}
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

export default WithdrawModal;