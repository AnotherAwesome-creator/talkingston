export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="shell-grid grid min-h-screen place-items-center px-4 py-10"><div className="w-full">{children}</div></main>;
}
