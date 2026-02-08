import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F1 Timing Dashboard',
  description: 'Professional Formula 1 timing board dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-f1-dark">{children}</body>
    </html>
  );
}
