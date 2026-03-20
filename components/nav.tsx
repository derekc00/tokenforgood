'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun, Menu, Github, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface NavUser {
  github_username: string
  github_avatar_url: string
}

interface NavProps {
  user?: NavUser | null
}

const NAV_LINKS = [
  { label: 'Tasks', href: '/' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Browse Tasks', href: '/tasks' },
] as const

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Fixed-size placeholder prevents layout shift before hydration
    return <div className="size-8" />
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  )
}

function UserSection({ user }: { user: NavUser | null | undefined }) {
  if (user) {
    return (
      <Avatar className="size-8 cursor-pointer ring-2 ring-border transition-all hover:ring-primary">
        <AvatarImage
          src={user.github_avatar_url}
          alt={`@${user.github_username}`}
        />
        <AvatarFallback className="font-mono text-xs uppercase">
          {user.github_username.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      render={
        <Link href="/api/auth/github" className="flex items-center gap-1.5">
          <Github className="size-4" />
          Sign in
        </Link>
      }
    />
  )
}

export function Nav({ user = null }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Zap className="size-4 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            TokenForGood
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {NAV_LINKS.map(({ label, href }) => (
                <NavigationMenuItem key={href}>
                  <NavigationMenuLink
                    href={href}
                    className="inline-flex h-9 w-max items-center justify-center rounded-lg bg-background px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none"
                  >
                    {label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        {/* Desktop right side */}
        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/tasks/request">Request a Task</Link>}
          />
          <Button
            size="sm"
            render={<Link href="/tasks/donate">Donate &amp; Run</Link>}
          />
          <ThemeToggle />
          <UserSection user={user} />
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader className="mb-4 text-left">
                <SheetTitle className="flex items-center gap-2 font-mono text-sm font-semibold">
                  <Zap className="size-4" />
                  TokenForGood
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="mt-4 flex flex-col gap-2 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  render={
                    <Link
                      href="/tasks/request"
                      onClick={() => setMobileOpen(false)}
                    >
                      Request a Task
                    </Link>
                  }
                />
                <Button
                  size="sm"
                  className="w-full justify-center"
                  render={
                    <Link
                      href="/tasks/donate"
                      onClick={() => setMobileOpen(false)}
                    >
                      Donate &amp; Run
                    </Link>
                  }
                />
              </div>

              <div className="mt-6 border-t border-border px-4 pt-4">
                <UserSection user={user} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
