import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsOfService() {
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
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        </div>

        <div className="prose max-w-none">
          <p className="text-gray-500 mb-6">Last Updated: March 8, 2025</p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Agreement to Terms</h2>
          <p>
            By accessing or using XShooter (the "Game"), you agree to be bound by these Terms of Service ("Terms"). 
            If you disagree with any part of the Terms, you do not have permission to access or use the Game.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Description of Service</h2>
          <p>
            XShooter is a fast-paced 2D multiplayer shooter game where players compete to be the last one standing. 
            Players are represented by their X profile pictures (or custom avatars) and shoot projectiles at each other to reduce opponents' health.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Account Registration and Security</h2>
          
          <h3 className="text-xl font-medium mt-4 mb-2">Account Creation</h3>
          <p>To use the Game, you must create an account either by:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Signing in with your X (Twitter) account via OAuth</li>
            <li>Registering with an email address and password</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Account Responsibilities</h3>
          <p>You are responsible for:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Ensuring that your account information is accurate and up-to-date</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Account Termination</h3>
          <p>
            We reserve the right to suspend or terminate your account at our sole discretion, without notice, 
            for conduct that we determine violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">User Conduct and Content</h2>
          
          <h3 className="text-xl font-medium mt-4 mb-2">Prohibited Activities</h3>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Use the Game for any illegal purpose or in violation of any laws</li>
            <li>Cheat, hack, or exploit bugs in the Game</li>
            <li>Harass, abuse, or harm other players</li>
            <li>Use automated scripts, bots, or other software to play the Game</li>
            <li>Interfere with or disrupt the Game or servers</li>
            <li>Attempt to gain unauthorized access to other user accounts</li>
            <li>Share your account credentials with others</li>
            <li>Create offensive usernames or share inappropriate content</li>
            <li>Impersonate other players or staff</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">User-Generated Content</h3>
          <p>
            If the Game allows you to create or share content (such as usernames or messages), you retain ownership of your content, 
            but grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, and display such 
            content in connection with the Game.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Intellectual Property</h2>
          
          <h3 className="text-xl font-medium mt-4 mb-2">Our Intellectual Property</h3>
          <p>
            The Game, including all content, features, and functionality, is owned by us and is protected by copyright, trademark, 
            and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works of, publicly display, 
            or otherwise use any portion of the Game without our express written consent.
          </p>

          <h3 className="text-xl font-medium mt-4 mb-2">Third-Party Intellectual Property</h3>
          <p>
            The Game may include third-party intellectual property, such as X's logos and branding during the authentication process. 
            These remain the property of their respective owners.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Purchases and Payments</h2>
          <p>If we offer in-game purchases:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>All purchases are final and non-refundable unless required by law</li>
            <li>We reserve the right to modify pricing at any time</li>
            <li>You agree to pay all charges associated with your account</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Disclaimers and Limitations of Liability</h2>
          
          <h3 className="text-xl font-medium mt-4 mb-2">Disclaimer of Warranties</h3>
          <p className="uppercase font-medium">
            THE GAME IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
            INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>

          <h3 className="text-xl font-medium mt-4 mb-2">Limitation of Liability</h3>
          <p className="uppercase font-medium">
            IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, 
            INCLUDING, BUT NOT LIMITED TO, LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THE GAME OR THESE TERMS, 
            EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>

          <h3 className="text-xl font-medium mt-4 mb-2">Indemnification</h3>
          <p>
            You agree to indemnify and hold us harmless from any claims, losses, damages, liabilities, including attorney's fees, 
            arising out of your use of the Game, your violation of these Terms, or your violation of any rights of a third party.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Changes to the Game and Terms</h2>
          <p>
            We reserve the right to modify or discontinue the Game (or any part of it) at any time, with or without notice. 
            We may also update these Terms from time to time. Continued use of the Game after any such changes constitutes your consent to such changes.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Governing Law and Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of EU, without regard to its conflict of law provisions.
          </p>
          <p>
            Any dispute arising out of or relating to these Terms or the Game shall be resolved through binding arbitration in accordance 
            with the rules in EU.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to 
            the minimum extent necessary so that the Terms shall otherwise remain in full force and effect.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Entire Agreement</h2>
          <p>
            These Terms constitute the entire agreement between you and us regarding the Game and supersede all prior agreements and understandings.
          </p>

          <h2 className="text-2xl font-semibold mt-6 mb-4">Contact Information</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
          <p>Email: terms@xshooter.vercel.app</p>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;