import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>

        <div className="prose max-w-none">
          <h2 className="text-2xl font-semibold mt-6 mb-4">Introduction</h2>
          <p>
            Welcome to XShooter. We respect your privacy and are committed to protecting your personal data. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our multiplayer 
            shooter game XShooter.
          </p>
          <p>
            Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use the Game.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Information We Collect</h2>
          
          <h3 className="text-xl font-medium mt-4 mb-2">Information You Provide</h3>
          <p>When you register for the Game, we may collect:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Authentication information through X (Twitter) OAuth or email/password</li>
            <li>Username</li>
            <li>Profile information</li>
            <li>Email address</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Information Automatically Collected</h3>
          <p>When you use the Game, we automatically collect:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Game statistics (wins, kills, accuracy, etc.)</li>
            <li>Device information (operating system, browser type, device type)</li>
            <li>IP address and approximate location data</li>
            <li>Game session data and interactions</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Information from Third Parties</h3>
          <p>If you choose to log in using X (Twitter) OAuth:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>We receive profile information provided by X, which may include your username, profile picture, and email address</li>
            <li>We do not have access to your X password</li>
            <li>We store your X profile picture URL to display as your avatar in the Game</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-6 mb-4">How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide, operate, and maintain the Game</li>
            <li>Create and manage your account</li>
            <li>Process your transactions</li>
            <li>Track and display game statistics on leaderboards</li>
            <li>Detect and prevent fraud, cheating, and other unauthorized activities</li>
            <li>Communicate with you regarding the Game</li>
            <li>Improve the Game experience</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Sharing Your Information</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Supabase</strong>: Our authentication and database provider, to manage user accounts and game data</li>
            <li><strong>Service Providers</strong>: Third-party vendors who provide services necessary to run the Game</li>
            <li><strong>Legal Requirements</strong>: To comply with legal obligations, enforce our terms, protect our rights, and ensure the safety of users</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Data Storage and Security</h2>
          <p>
            We use Supabase to store user data and implement appropriate security measures to protect your personal information. 
            However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Third-Party Authentication</h2>
          <p>
            Our Game allows you to sign in using your X (Twitter) account. When you do so, you are subject to X's privacy policy and terms of service. 
            We recommend reviewing these documents to understand how X processes your data.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Your Rights</h2>
          <p>Depending on your location, you may have rights regarding your personal data, including:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Access to your personal data</li>
            <li>Correction of inaccurate data</li>
            <li>Deletion of your data</li>
            <li>Restriction or objection to processing</li>
            <li>Data portability</li>
          </ul>
          <p>To exercise these rights, please contact us using the information provided below.</p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Children's Privacy</h2>
          <p>
            The Game is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. 
            If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The updated version will be indicated by an updated "Last Updated" date. 
            We encourage you to review this Privacy Policy periodically.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <p>Email: privacy@xshooter.vercel.app</p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Consent</h2>
          <p>By using the Game, you consent to our Privacy Policy and agree to its terms.</p>
          
          <p className="mt-8 text-gray-500 text-sm">Last Updated: March 8, 2025</p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;