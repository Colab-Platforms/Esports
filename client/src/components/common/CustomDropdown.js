import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

const CustomDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  multiple = false,
  size = 'md',
  className = '',
  error = false,
  label = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOption = multiple
    ? options.filter(option => value?.includes(option.value))
    : options.find(option => option.value === value);

  const handleSelect = (option) => {
    if (multiple) {
      const newValue = value?.includes(option.value)
        ? value.filter(v => v !== option.value)
        : [...(value || []), option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  };

  const getDisplayValue = () => {
    if (multiple && selectedOption?.length > 0) {
      return selectedOption.length === 1
        ? selectedOption[0].label
        : `${selectedOption.length} selected`;
    }
    return selectedOption?.label || placeholder;
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-theme-text-secondary mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full ${sizeClasses[size]} 
            bg-theme-bg-card border border-theme-border rounded-lg
            text-theme-text-primary text-left
            hover:border-theme-border-hover focus:border-theme-border-hover
            focus:outline-none focus:ring-2 focus:ring-gaming-gold/20
            transition-all duration-200
            flex items-center justify-between
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${isOpen ? 'border-theme-border-hover' : ''}
          `}
        >
          <span className={`truncate ${!selectedOption && !multiple ? 'text-theme-text-muted' : ''}`}>
            {getDisplayValue()}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <FiChevronDown className="h-5 w-5 text-theme-text-muted" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 w-full mt-2 bg-theme-bg-card border border-theme-border rounded-lg shadow-2xl max-h-60 overflow-hidden"
            >
              {searchable && (
                <div className="p-3 border-b border-theme-border">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search options..."
                    className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-border rounded-md text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-gaming-gold text-sm"
                  />
                </div>
              )}
              
              <div className="max-h-48 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option, index) => {
                    const isSelected = multiple
                      ? value?.includes(option.value)
                      : value === option.value;

                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`
                          w-full px-4 py-3 text-left hover:bg-theme-bg-hover
                          transition-colors duration-150 flex items-center justify-between
                          ${isSelected ? 'bg-gaming-gold/10 text-gaming-gold' : 'text-theme-text-primary'}
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          {option.icon && (
                            <span className="text-lg">{option.icon}</span>
                          )}
                          <div>
                            <div className="font-medium">{option.label}</div>
                            {option.description && (
                              <div className="text-sm text-theme-text-muted">
                                {option.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <FiCheck className="h-4 w-4 text-gaming-gold" />
                        )}
                      </motion.button>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center text-theme-text-muted">
                    {searchTerm ? 'No options found' : 'No options available'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomDropdown;