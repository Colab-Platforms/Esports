import React from 'react';
import { Link } from 'react-router-dom';
import { FiTwitter, FiInstagram, FiYoutube, FiMail } from 'react-icons/fi';

const Footer = () => {
  // Environment indicator
  const isDev = window.location.hostname.includes('esports-eciq') || 
                window.location.hostname === 'localhost';
  
  return (
    <footer className="bg-gaming-charcoal border-t border-gaming-slate mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-neon rounded-lg flex items-center justify-center">
                <span className="text-gaming-dark font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-gaming font-bold text-gaming-neon">
                Colab Esports
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              India's premier esports tournament platform. Compete in BGMI, Valorant, and CS2 tournaments. 
              Win real money prizes and climb the leaderboards.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiTwitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiInstagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiYoutube className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiMail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/tournaments" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Tournaments
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/rules" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Rules & Guidelines
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/refund" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/responsible-gaming" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200 text-sm">
                  Responsible Gaming
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gaming-slate mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3">
            <p className="text-gray-400 text-sm">
              © 2024 Colab Esports. All rights reserved.
            </p>
            {isDev && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded border border-yellow-500/30">
                DEV
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2 md:mt-0">
            Made with ❤️ for Indian gamers
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;