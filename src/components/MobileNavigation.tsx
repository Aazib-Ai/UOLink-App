'use client';

import { useState, useEffect } from 'react';
import { Home, Upload, Trophy, User, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isMobileDevice } from '@/lib/pwa';

interface MobileNavigationProps {
  onUploadClick?: () => void;
}

export default function MobileNavigation({ onUploadClick }: MobileNavigationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  if (!isMobile) return null;

  const navItems = [
    {
      icon: Home,
      label: 'Home',
      href: '/',
      active: pathname === '/'
    },
    {
      icon: Upload,
      label: 'Upload',
      href: '#',
      active: false,
      onClick: onUploadClick
    },
    {
      icon: Trophy,
      label: 'Leaderboard',
      href: '/leaderboard',
      active: pathname === '/leaderboard'
    },
    {
      icon: User,
      label: 'Profile',
      href: '/profile',
      active: pathname.startsWith('/profile')
    }
  ];

  return (
    <nav className="app-navigation">
      <div className="flex justify-around items-center px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className={`touch-target flex flex-col items-center space-y-1 transition-colors ${
              item.active 
                ? 'text-[#90c639]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          );

          if (item.onClick) {
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="no-select"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className="no-select"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}