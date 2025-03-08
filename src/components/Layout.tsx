import React, { ReactNode } from 'react';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <main className="flex-grow">
        {children}
      </main>
      
      {!hideFooter && (
        <Footer className="bg-gray-800" />
      )}
    </div>
  );
}

export default Layout;