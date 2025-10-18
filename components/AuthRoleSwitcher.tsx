"use client";

import React from "react";
import Link from "next/link";
import { User, Users, Shield } from "lucide-react";

type RoleId = "admin" | "manager" | "user";
type Mode = "login" | "register";

interface AuthRoleSwitcherProps {
  /**
   * Current role context for the page (used to hide the current role from the switcher).
   * Defaults to "user".
   */
  currentRole?: RoleId;
  /**
   * Whether this is a login or register page. Affects the label and target URLs.
   */
  mode: Mode;
  /**
   * When false (default) admin links are not shown unless `currentRole === 'admin'`.
   * This allows user/manager pages to never reveal admin auth links.
   */
  showAdmin?: boolean;
  /**
   * Optional additional classes for the wrapper.
   */
  className?: string;
  /**
   * Compact layout: smaller text and tighter spacing.
   */
  compact?: boolean;
}

/**
 * AuthRoleSwitcher
 *
 * Small reusable component that renders a set of role-switch links (e.g. "Login as Manager")
 * to quickly navigate between role-specific auth pages. By default admin-related links are
 * hidden on user/manager pages (see `showAdmin` prop).
 *
 * Styling aims to be small and unobtrusive (suitable for placement at the bottom of an auth form).
 */
export default function AuthRoleSwitcher({
  currentRole = "user",
  mode,
  showAdmin = false,
  className = "",
  compact = false,
}: AuthRoleSwitcherProps) {
  const roles: Array<{ id: RoleId; label: string; Icon: React.ComponentType<any> }> =
    [
      { id: "admin", label: "Admin", Icon: Shield },
      { id: "manager", label: "Manager", Icon: Users },
      { id: "user", label: "User", Icon: User },
    ];

  // Build links excluding current role and optionally hiding admin links
  const links = roles
    .filter((r) => r.id !== currentRole)
    .filter((r) => {
      if (r.id === "admin" && !showAdmin) {
        // Only show admin link when explicitly allowed or when current page is admin
        return currentRole === "admin";
      }
      return true;
    })
    .map((r) => {
      const href =
        mode === "login"
          ? r.id === "user"
            ? "/auth/login"
            : `/auth/login/${r.id}`
          : r.id === "user"
          ? "/auth/register"
          : `/auth/register/${r.id}`;

      const label = `${mode === "login" ? "Login as" : "Register as"} ${r.label}`;
      return { ...r, href, label };
    });

  if (links.length === 0) return null;

  const textClass = compact ? "text-sm" : "text-base";
  const gapClass = compact ? "gap-2" : "gap-3";
  const iconSize = compact ? 14 : 16;
  const wrapperClasses = `w-full ${className}`;

  return (
    <div className={wrapperClasses} aria-hidden={links.length === 0 ? "true" : "false"}>
      <div className="border-t pt-4 mt-6">
        <div className={`text-muted-foreground mb-2 ${compact ? "text-xs" : "text-sm"}`}>
          Quick switch
        </div>

        <div className={`flex flex-col sm:flex-row items-start sm:items-center ${gapClass}`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`inline-flex items-center rounded-md px-2 py-1 transition-colors duration-150 hover:bg-accent/5 hover:text-foreground ${textClass}`}
              aria-label={l.label}
            >
              <l.Icon className="mr-2" size={iconSize} />
              <span className="font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
