import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="بند — الرئيسية">
      <span
        className={
          "grid size-9 place-items-center rounded-lg font-display text-lg font-bold " +
          (light ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")
        }
      >
        ب
      </span>
      <span className={"font-display text-xl font-bold " + (light ? "text-primary-foreground" : "text-foreground")}>بند</span>
    </Link>
  );
}

export function AppHeader() {
  const { session, loading } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/join" className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            انضمام
          </Link>
          {!loading && session ? (
            <>
              <Link to="/archive" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">
                الأرشيف
              </Link>
              <Button asChild variant="secondary" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4" />
                  لوحتي
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="تسجيل الخروج">
                <LogOut className="size-4" />
              </Button>
            </>
          ) : !loading ? (
            <Button asChild size="sm">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
