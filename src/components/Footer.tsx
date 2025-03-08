import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`py-4 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} XShooter. All rights reserved.
            </p>
          </div>
          
          <nav className="flex space-x-6">
            <Link 
              to="/terms" 
              className="text-gray-400 hover:text-white text-sm transition duration-150"
            >
              Terms of Service
            </Link>
            <Link 
              to="/privacy" 
              className="text-gray-400 hover:text-white text-sm transition duration-150"
            >
              Privacy Policy
            </Link>
            <a 
              href="mailto:contact@xshooter.vercel.app" 
              className="text-gray-400 hover:text-white text-sm transition duration-150"
            >
              Contact Us
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;