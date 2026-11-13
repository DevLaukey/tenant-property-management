import Link from 'next/link';
import { Building2 } from 'lucide-react';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <span className="text-lg font-bold text-gray-900">PropManage</span>
    </Link>
  );
}

export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/pricing" className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:inline">
            Pricing
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 sm:px-4"
              >
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-gray-500">Property management built for Kenyan landlords.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <Link href="/pricing" className="hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-gray-900">
            Login
          </Link>
          <Link href="/signup" className="hover:text-gray-900">
            Start free trial
          </Link>
        </nav>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} PropManage. All prices in Kenyan Shillings (KES).
      </div>
    </footer>
  );
}
