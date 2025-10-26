import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline - UoLink',
  description: 'You are currently offline. Please check your internet connection.',
};

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}