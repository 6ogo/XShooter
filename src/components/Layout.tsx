import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { NavigationBar } from './NavigationBar';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  hideNavigation?: boolean;
  className?: string;
}

export function Layout({ 
  children, 
  hideFooter = false, 
  hideNavigation = false,
  className = ''
}: LayoutProps) {
  const location = useLocation();
  
  // Determine current page for active nav highlighting
  const currentPage = location.pathname.includes('/leaderboard') ? 'leaderboard' :
                     location.pathname.includes('/achievements') ? 'achievements' :
                     location.pathname.includes('/settings') ? 'settings' :
                     location.pathname.includes('/game/') ? 'game' : 
                     'lobby';

  return (
    <div className={`min-h-screen bg-gray-900 flex flex-col ${className}`}>
      {!hideNavigation && <NavigationBar currentPage={currentPage as any} />}
      
      <main className="flex-grow">
        {children}
      </main>
      
      {!hideFooter && <Footer className="bg-gray-800 border-t border-gray-700" />}
    </div>
  );
}

export default Layout;