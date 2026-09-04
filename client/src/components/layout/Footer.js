import React from 'react';
import { Link } from 'react-router-dom';
import { FiInstagram, FiYoutube, FiMail } from 'react-icons/fi';
import { FaXTwitter, FaFacebook, FaRedditAlien, FaDiscord } from 'react-icons/fa6';

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
                <img 
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Coloab_Esports_log-White_KB_1.png?v=1750315800" 
                  alt="Colab Esports Logo"
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <span className="hidden text-gaming-dark font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-gaming font-bold text-gaming-neon">
                Colab Esports
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              India's premier esports tournament platform. Compete in BGMI, Free Fire, and Valorant tournaments. 
              Win real money prizes and climb the leaderboards.
            </p>
            <div className="flex space-x-4">
              <a href="https://x.com/colabesports" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FaXTwitter className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/colabesports/" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiInstagram className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/@ColabEsports" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FiYoutube className="w-5 h-5" />
              </a>
              <a href="https://www.facebook.com/profile.php?id=61577401352848" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FaFacebook className="w-5 h-5" />
              </a>
              <a href="https://www.reddit.com/user/Colab_Esports/" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FaRedditAlien className="w-5 h-5" />
              </a>
              <a href="https://discord.gg/ug3vMxhPdQ" className="text-gray-400 hover:text-gaming-neon transition-colors duration-200">
                <FaDiscord className="w-5 h-5" />
              </a>
            
            </div>

            <div>
              <p className="text-gray-400 text-sm mt-4">
                For inquiries,<br/> Email us at: 
                <a href="#'" className="text-gaming-neon hover:underline ml-1">
                  Colabesports@gmail.com
                </a>
                <p> Contact us:
                  <a href="#" className="text-gaming-neon hover:underline ml-1">
                     +91 8976968901
                  </a>
                </p>
              </p>
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
            
            </ul>
          </div>
        </div>

        <div className="border-t border-gaming-slate mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3">
            <p className="text-gray-400 text-sm">
              © 2026 Colab Esports. All rights reserved.
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