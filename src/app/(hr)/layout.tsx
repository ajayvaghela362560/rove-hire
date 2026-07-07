import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireSession } from "@/server/auth/require-session";
import { logoutAction } from "@/server/actions/auth";
import { Logo } from "@/components/common/logo";
import { NavLinks } from "@/components/common/nav";
import { Button } from "@/components/ui/button";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 p-3">
          <NavLinks />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <Link href="/">
              <Logo className="text-sm" />
            </Link>
          </div>
          <div className="hidden flex-1 lg:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit" title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="border-b bg-background px-2 py-2 lg:hidden">
          <NavLinks orientation="horizontal" />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
