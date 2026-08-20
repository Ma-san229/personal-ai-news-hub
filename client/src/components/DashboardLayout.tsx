import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpenText, LayoutDashboard, LogOut, Rss, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "ニュース一覧", path: "/" },
  { icon: Rss, label: "フィード管理", path: "/feeds" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f6f4ef] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-black/[0.06] bg-white p-10 text-center shadow-[0_25px_70px_rgba(36,48,45,0.12)]">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#143b35] text-[#e7f0d2]"><Sparkles className="h-6 w-6" /></div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#152723]">個人用ニュースハブ</h1>
          <p className="mt-3 text-sm leading-6 text-[#64706c]">ニュースを整理・管理するためにサインインしてください。</p>
          <Button onClick={() => startLogin()} className="mt-8 h-11 w-full rounded-xl bg-[#143b35] text-white hover:bg-[#0f302b]">サインインして開く</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const activeItem = menuItems.find(item => item.path === location);

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-[#143b35]/10 bg-[#143b35] text-white">
        <SidebarHeader className="h-[92px] justify-center px-4">
          <button onClick={() => setLocation("/")} className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8e7bb] rounded-xl">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d8e7bb] text-[#143b35] shadow-sm"><BookOpenText className="h-5 w-5" /></div>
            {!collapsed && <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#d8e7bb]">Private library</p><p className="mt-0.5 truncate text-sm font-semibold tracking-tight">AI News Hub</p></div>}
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-5">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 group-data-[collapsible=icon]:hidden">Browse</p>
          <SidebarMenu>
            {menuItems.map(item => {
              const active = item.path === location;
              return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={active} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#d8e7bb] data-[active=true]:text-[#143b35] data-[active=true]:hover:bg-[#d8e7bb]"><item.icon className="h-4.5 w-4.5" /><span className="font-medium">{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8e7bb]">
                <Avatar className="h-9 w-9 shrink-0 border border-white/20"><AvatarFallback className="bg-white/10 text-xs font-semibold text-white">{user?.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar>
                {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name || "ユーザー"}</p><p className="mt-0.5 truncate text-xs text-white/50">個人用ワークスペース</p></div>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />サインアウト</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f6f4ef]">
        {isMobile && <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#143b35]/10 bg-[#f6f4ef]/90 px-4 backdrop-blur"><SidebarTrigger className="rounded-xl" /><span className="text-sm font-semibold text-[#152723]">{activeItem?.label || "AI News Hub"}</span></header>}
        <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8 lg:px-12">{children}</main>
      </SidebarInset>
    </>
  );
}
