import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi';

const Toast = ({ message, type = 'success', onClose }) => {
  const icons = {
    success: <FiCheck className="w-5 h-5" />,
    error: <FiX className="w-5 h-5" />,
    warning: <FiAlertCircle className="w-5 h-5" />,
    info: <FiInfo className="w-5 h-5" />
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className="flex items-center space-x-3 bg-gaming-charcoal border border-gaming-border rounded-lg shadow-xl p-4 min-w-[300px] max-w-md"
    >
      <div className={`${colors[type]} p-2 rounded-full text-white`}>
        {icons[type]}
      </div>
      <p className="text-white flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white transition-colors"
      >
        <FiX className="w-5 h-5" />
      </button>
    </motion.div>
  );
};

export default Toast;
