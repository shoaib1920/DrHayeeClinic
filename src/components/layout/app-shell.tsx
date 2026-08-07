"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Monitor,
  Search,
  Settings,
  Stethoscope,
  TestTube,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type StaffRole } from "@/types/staff";

interface NavLink {
  href: string;
  label: string;
  icon: typeof UserPlus;
}

/** Each station sees only its own screens. */
const NAV_BY_ROLE: Record<StaffRole, NavLink[]> = {
  reception: [
    { href: "/queue", label: "Reception", icon: UserPlus },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/closing", label: "Closing", icon: Wallet },
  ],
  attendant: [
    { href: "/attendant", label: "Token Desk", icon: BellRing },
    { href: "/display", label: "Waiting Room", icon: Monitor },
  ],
  doctor: [
    { href: "/consultation", label: "Consultation", icon: Stethoscope },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/closing", label: "Closing", icon: Wallet },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  lab: [
    { href: "/lab", label: "Laboratory", icon: TestTube },
    { href: "/patients", label: "Patients", icon: Users },
  ],
};

interface AppShellProps {
  children: ReactNode;
  title: string;
  searchPlaceholder?: string;
  actions?: ReactNode;
}

export function AppShell({ children, title, searchPlaceholder, actions }: AppShellProps) {
  const pathname = usePathname();
  const { user, staff } = useAuth();

  const navLinks = staff ? NAV_BY_ROLE[staff.role] : [];
  const showSidebar = navLinks.length > 1;

  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      {showSidebar && (
        <aside className="fixed top-0 left-0 hidden h-screen w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container py-lg lg:flex">
          <div className="mb-xl px-md">
            <div className="mb-xs flex items-center gap-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-headline-md leading-none font-bold text-on-surface">AH Medical</h2>
                <p className="text-xs text-on-surface-variant">Nankana Sahib Branch</p>
              </div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "mx-2 flex items-center gap-md rounded-xl p-md transition-all",
                    isActive
                      ? "bg-secondary-container font-bold text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-highest",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-label-md">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant px-2 pt-md">
            <button className="mx-2 flex items-center gap-md rounded-xl p-md text-on-surface-variant transition-all hover:bg-surface-container-highest">
              <Settings className="h-5 w-5" />
              <span className="text-label-md">Settings</span>
            </button>
            <button className="mx-2 flex items-center gap-md rounded-xl p-md text-on-surface-variant transition-all hover:bg-surface-container-highest">
              <HelpCircle className="h-5 w-5" />
              <span className="text-label-md">Help</span>
            </button>
          </div>
        </aside>
      )}

      <div className={cn("flex flex-1 flex-col", showSidebar && "lg:ml-64")}>
        <header className="sticky top-0 z-40 flex w-full items-center justify-between bg-surface-container-lowest px-margin-mobile py-4 shadow-sm md:px-margin-desktop">
          <div className="flex items-center gap-md">
            {!showSidebar && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
                <Stethoscope className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="font-headline-md font-bold text-primary">{title}</h1>
              {staff && (
                <p className="text-xs text-on-surface-variant">
                  {ROLE_LABEL[staff.role]}
                  {staff.name ? ` · ${staff.name}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-lg">
            {searchPlaceholder && (
              <div className="hidden items-center rounded-full border border-outline-variant bg-surface-container-low px-md py-sm md:flex">
                <Search className="mr-xs h-4 w-4 text-on-surface-variant" />
                <input
                  className="w-48 border-none bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant"
                  placeholder={searchPlaceholder}
                  type="text"
                />
              </div>
            )}
            {actions}
            <div className="flex items-center gap-md">
              {user?.email && (
                <span className="hidden text-label-md text-on-surface-variant xl:inline">
                  {user.email}
                </span>
              )}
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-xs rounded-full bg-error-container px-md py-sm text-label-md font-bold text-on-error-container transition-all hover:opacity-80"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {showSidebar && (
        <nav className="fixed right-0 bottom-0 left-0 z-50 flex justify-around border-t border-outline-variant bg-surface-container-lowest px-xs py-sm lg:hidden">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-xs",
                  isActive ? "text-primary" : "text-on-surface-variant",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
