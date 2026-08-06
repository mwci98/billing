import React from 'react';
import {
  ArrowRight,
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  Cloud,
  FileText,
  LayoutDashboard,
  Laptop,
  PackageCheck,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tablet,
  Users,
  Wifi,
  Zap,
  ChefHat,
  CreditCard,
  Printer,
  Wrench,
} from 'lucide-react';

type LandingPageProps = {
  onGetStarted: () => void;
};

const features = [
  {
    icon: ShoppingCart,
    title: 'Billing that fits the business',
    description: 'Run retail POS, service invoices or restaurant orders from any phone, tablet or computer.',
  },
  {
    icon: Boxes,
    title: 'Inventory down to each device',
    description: 'Track stock, purchases, low-stock alerts and every handset separately by IMEI.',
  },
  {
    icon: Users,
    title: 'Staff permissions',
    description: 'Give billing and purchasing access without exposing revenue or sensitive reports.',
  },
  {
    icon: Building2,
    title: 'Isolated multi-store workspaces',
    description: 'Switch branches from one account while products, sales, staff and store configuration stay separate.',
  },
  {
    icon: FileText,
    title: 'GST invoices and thermal receipts',
    description: 'Create branded GST invoices and print compact 80mm receipts after payment settlement.',
  },
  {
    icon: BarChart3,
    title: 'Business insights',
    description: 'See sales, revenue, estimated profit and customer activity as it happens.',
  },
  {
    icon: ChefHat,
    title: 'Restaurant open orders',
    description: 'Manage tables, guests, variants and kitchen notes. Edit unpaid tickets and settle them later.',
  },
  {
    icon: CreditCard,
    title: 'Flexible payment settlement',
    description: 'Record Cash, UPI, Card, Split and credit payments with customer due tracking.',
  },
  {
    icon: Smartphone,
    title: 'Visual menu and catalog',
    description: 'Upload compressed dish pictures, organize variants and create touch-friendly menu cards.',
  },
];

const businessModes = [
  {icon: ShoppingCart, title: 'Retail', accent: 'emerald', description: 'Barcode billing, purchasing, suppliers, stock and loyalty.'},
  {icon: Wrench, title: 'Services', accent: 'blue', description: 'Service catalog, clients, GST invoices and professional billing.'},
  {icon: Boxes, title: 'Hybrid', accent: 'amber', description: 'Sell products and services together from one workspace.'},
  {icon: ChefHat, title: 'Restaurant', accent: 'rose', description: 'Tables, open orders, food variants, kitchen notes and thermal print.'},
];

const workflow = [
  ['01', 'Create your workspace', 'Sign in with Google and add your business, GST and store information.'],
  ['02', 'Choose how you operate', 'Use Retail, Service, Hybrid or Restaurant mode and add your products, menu or services.'],
  ['03', 'Bill, settle and grow', 'Collect payments, print receipts and monitor every workspace from anywhere.'],
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-[#09090A] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70" aria-hidden="true">
        <div className="absolute left-1/2 top-[-24rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]" />
        <div className="absolute right-[-18rem] top-[34rem] h-[34rem] w-[34rem] rounded-full bg-teal-400/8 blur-[120px]" />
      </div>

      <header className="relative z-30 border-b border-white/[0.06] bg-[#09090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="QPOS home">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-500 text-[#07110D] shadow-[0_0_30px_rgba(16,185,129,0.18)]">
              <Store className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.03em]">QPOS</span>
              <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-400">Smart business terminal</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-xs font-semibold text-white/60 md:flex">
            <a href="#business-modes" className="transition hover:text-white">Business modes</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onGetStarted}
              className="hidden rounded-xl px-4 py-2.5 text-xs font-bold text-white/70 transition hover:bg-white/5 hover:text-white sm:block"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-[#06130E] shadow-[0_10px_35px_rgba(16,185,129,0.2)] transition hover:bg-emerald-400"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 flex flex-col">
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="relative mx-auto max-w-6xl">
            <div className="absolute -inset-7 rounded-[3rem] bg-emerald-500/[0.06] blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111113] p-2 shadow-[0_40px_100px_rgba(0,0,0,0.55)] sm:p-3">
              <div className="overflow-hidden rounded-[1.25rem] border border-white/[0.06] bg-[#0D0D0F]">
                <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4 sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/15" />
                      <span className="h-2 w-2 rounded-full bg-white/15" />
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                    <span className="hidden text-[10px] font-bold text-white/35 sm:inline">QPOS · Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider">
                    <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-emerald-400 sm:flex">
                      <Wifi className="h-3 w-3" /> Cloud synced
                    </span>
                    <span className="rounded-full bg-emerald-500 px-2.5 py-1.5 text-[#07110D]">Pro</span>
                  </div>
                </div>

                <div className="grid min-h-[26rem] grid-cols-1 md:grid-cols-[12rem_1fr]">
                  <aside className="hidden border-r border-white/[0.06] bg-[#101012] p-4 md:block">
                    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-[11px] font-black text-[#07110D]">Q</span>
                      <span>
                        <span className="block text-[10px] font-extrabold">QPOS</span>
                        <span className="block text-[7px] font-bold uppercase text-emerald-400">Active workspace</span>
                      </span>
                    </div>
                    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400"><ChefHat className="h-3.5 w-3.5" /></span>
                      <span><span className="block text-[10px] font-extrabold">QPOS Restaurant</span><span className="block text-[7px] font-bold uppercase text-white/30">Kohima workspace</span></span>
                    </div>
                    <div className="space-y-1 text-[9px] font-bold text-white/38">
                      {[
                        [LayoutDashboard, 'Dashboard', true],
                        [ShoppingCart, 'POS Billing'],
                        [ChefHat, 'Restaurant Orders'],
                        [PackageCheck, 'Products'],
                        [Boxes, 'Inventory'],
                        [Users, 'Customers'],
                        [BarChart3, 'Reports'],
                      ].map(([Icon, label, active]) => {
                        const ItemIcon = Icon as React.ComponentType<{ className?: string }>;
                        return (
                          <div key={label as string} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${active ? 'bg-emerald-500 text-[#07110D]' : ''}`}>
                            <ItemIcon className="h-3.5 w-3.5" />
                            {label as string}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400">Live business overview</p>
                        <h2 className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl">Welcome back, Store Owner</h2>
                      </div>
                      <span className="hidden rounded-xl bg-emerald-500 px-4 py-2.5 text-[9px] font-extrabold text-[#07110D] sm:block">Retail + Restaurant</span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      {[
                        ['Today’s revenue', '₹38,640', '12 invoices', 'emerald'],
                        ['Inventory value', '₹2.4L', '486 products', 'blue'],
                        ['Low stock', '8', 'Needs attention', 'amber'],
                        ['Open orders', '6', 'Restaurant workspace', 'purple'],
                      ].map(([label, value, detail, tone]) => (
                        <div key={label} className="rounded-xl border border-white/[0.07] bg-[#151517] p-3.5 sm:p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-semibold text-white/45 sm:text-[9px]">{label}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              tone === 'emerald' ? 'bg-emerald-400' : tone === 'blue' ? 'bg-blue-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-purple-400'
                            }`} />
                          </div>
                          <strong className="mt-3 block text-lg tracking-tight text-white sm:text-xl">{value}</strong>
                          <span className="mt-1 block text-[8px] text-white/30">{detail}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
                      <div className="rounded-xl border border-white/[0.07] bg-[#151517] p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold">Sales momentum</span>
                          <span className="text-[8px] font-bold text-emerald-400">THIS WEEK</span>
                        </div>
                        <div className="mt-6 flex h-24 items-end gap-2">
                          {[35, 54, 42, 70, 58, 88, 72, 96, 64, 82, 93, 78].map((height, index) => (
                            <span
                              key={index}
                              className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-600/25 to-emerald-400"
                              style={{ height: `${height}%`, opacity: 0.45 + index / 24 }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/[0.07] bg-[#151517] p-4">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-extrabold">Restaurant workspace</span><ChefHat className="h-3.5 w-3.5 text-emerald-400" /></div>
                        <div className="mt-4 space-y-3">
                          {['Table 4 · 3 items', 'Table 1 · 2 items', 'Takeaway · 4 items'].map((item, index) => (
                            <div key={item} className="flex items-center justify-between border-b border-white/[0.05] pb-2.5 last:border-0">
                              <span className="text-[8px] font-semibold text-white/55">{item}</span>
                              <span className="text-[8px] font-mono text-emerald-400">{index === 0 ? '₹850' : index === 1 ? '₹450' : '₹720'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.018]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4 sm:px-8">
            {[
              ['5 days', 'Free trial'],
              ['₹6,000', 'Per year'],
              ['₹500', 'Extra store · one time'],
              ['24/7', 'Cloud access'],
            ].map(([value, label]) => (
              <div key={label} className="px-3 py-5 text-center">
                <strong className="block text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">{value}</strong>
                <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-white/30">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="business-modes" className="border-y border-white/[0.06] bg-[#0D0D0F]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl"><span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">One QPOS, four ways to work</span><h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">The workspace changes with your business.</h2></div>
              <p className="max-w-md text-sm leading-7 text-white/40">QPOS shows the right billing and inventory tools for each operation, without forcing every business into the same POS screen.</p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {businessModes.map(({icon: Icon, title, description}, index) => <article key={title} className="group relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[#141416] p-6 transition hover:-translate-y-1 hover:border-emerald-400/25"><span className="absolute right-4 top-3 font-mono text-4xl font-black text-white/[0.025]">0{index + 1}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/[0.08] text-emerald-400"><Icon className="h-5 w-5" /></span><h3 className="mt-8 text-xl font-extrabold">{title}</h3><p className="mt-2 text-xs leading-6 text-white/40">{description}</p></article>)}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-2xl">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">Everything in one place</span>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">
              From the first item to the final report.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/45">
              Billing, stock, customers, staff, payments and reporting stay connected inside the correct workspace.
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="group rounded-[1.4rem] border border-white/[0.07] bg-[#121214] p-6 transition hover:-translate-y-1 hover:border-emerald-400/20 hover:bg-[#151517]"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[9px] text-white/15">0{index + 1}</span>
                </div>
                <h3 className="mt-7 text-lg font-extrabold tracking-tight">{title}</h3>
                <p className="mt-2.5 text-xs leading-6 text-white/40">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[0.06] bg-[#0D0D0F]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">Simple from day one</span>
                <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.05em]">Your store, live in three steps.</h2>
                <p className="mt-5 text-sm leading-7 text-white/40">No complicated setup. QPOS guides every new business through its workspace configuration.</p>
              </div>
              <div className="space-y-3">
                {workflow.map(([number, title, description]) => (
                  <div key={number} className="grid gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:grid-cols-[3.5rem_1fr] sm:items-center sm:p-6">
                    <span className="font-mono text-xl font-bold text-emerald-400">{number}</span>
                    <div>
                      <h3 className="text-base font-extrabold">{title}</h3>
                      <p className="mt-1.5 text-xs leading-5 text-white/38">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="order-first relative mx-auto w-full max-w-7xl px-5 pb-10 pt-5 sm:px-8 sm:pb-12 sm:pt-6">
          <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#121214] shadow-[0_40px_120px_rgba(0,0,0,0.48)]">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
              <div className="flex flex-col justify-center p-7 sm:p-8 lg:p-9">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Cloud business operating system
                </div>
                <h1 className="mt-4 max-w-xl text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.06em] sm:text-5xl lg:text-[3.3rem]">
                  One QPOS.
                  <span className="block text-emerald-400">Every kind of business.</span>
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-white/45">
                  One cloud platform for retail stores, service businesses, mixed operations and restaurants. Keep every workspace isolated while billing, inventory and reporting stay connected.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-white/55">
                  {[
                    [ScanBarcode, 'Barcode + IMEI'],
                    [Printer, 'GST + thermal print'],
                    [CreditCard, 'Cash · UPI · Card'],
                    [Building2, 'Multi-workspace'],
                  ].map(([Icon, label]) => {
                    const TerminalIcon = Icon as React.ComponentType<{ className?: string }>;
                    return (
                      <div key={label as string} className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                        <TerminalIcon className="h-4 w-4 text-emerald-400" />
                        {label as string}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={onGetStarted}
                    className="group flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-xs font-extrabold text-[#06130E] shadow-[0_14px_40px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
                  >
                    Start QPOS free
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </button>
                  <a
                    href="#features"
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-xs font-bold text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Explore QPOS
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold text-white/45">
                  <span className="uppercase tracking-[0.12em] text-white/28">Use QPOS on</span>
                  <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-emerald-400" /> Mobile</span>
                  <span className="h-1 w-1 rounded-full bg-white/15" />
                  <span className="flex items-center gap-1.5"><Tablet className="h-3.5 w-3.5 text-emerald-400" /> Tablet</span>
                  <span className="h-1 w-1 rounded-full bg-white/15" />
                  <span className="flex items-center gap-1.5"><Laptop className="h-3.5 w-3.5 text-emerald-400" /> Laptop</span>
                </div>
              </div>

              <div className="relative flex min-h-[26rem] items-center overflow-hidden border-t border-white/[0.06] bg-[radial-gradient(circle_at_70%_20%,rgba(16,185,129,0.18),transparent_42%)] p-5 sm:p-7 lg:border-l lg:border-t-0">
                <div className="w-full rounded-[1.6rem] border border-white/10 bg-[#0B0D0C]/95 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:p-5">
                  <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400">Restaurant workspace</p><h3 className="mt-1 text-xl font-extrabold">Open orders</h3></div><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[9px] font-black text-emerald-400">3 pending</span></div>
                  <div className="mt-4 space-y-2">{[['Table 04', '3 items', '₹850'], ['Table 01', '2 items', '₹450'], ['Takeaway', '4 items', '₹720']].map(([name, items, total], index) => <div key={name} className={`rounded-2xl border px-4 py-3 ${index === 0 ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">{name}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-white/35">{items} · unpaid</p></div><strong className="font-mono text-sm text-emerald-400">{total}</strong></div>{index === 0 && <div className="mt-2 grid grid-cols-4 gap-1.5 text-[9px] font-black"><span className="rounded-lg border border-white/10 px-2 py-1.5 text-center text-white/55">Edit</span>{['Cash', 'UPI', 'Card'].map(method => <span key={method} className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-center text-emerald-400">{method}</span>)}</div>}</div>)}</div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-white/10 px-4 py-2.5"><span className="flex items-center gap-2 text-[10px] font-bold text-white/45"><Printer className="h-4 w-4 text-emerald-400" />Settle, print, and clear the queue</span><span className="text-[9px] font-black text-emerald-400">80MM</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">Straightforward pricing</span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">One plan. The complete QPOS.</h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/40">Start free for five days, then keep your entire business connected for one simple annual price.</p>
          </div>

          <div className="mx-auto mt-12 max-w-lg rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-b from-emerald-400/[0.09] to-[#121214] p-2 shadow-[0_30px_100px_rgba(16,185,129,0.09)]">
            <div className="rounded-[1.35rem] border border-white/[0.07] bg-[#101513]/90 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">QPOS Pro</span>
                  <h3 className="mt-2 text-xl font-extrabold">Everything your store needs</h3>
                </div>
                <Zap className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="mt-8 flex items-end gap-2">
                <strong className="text-5xl font-extrabold tracking-[-0.06em]">₹6,000</strong>
                <span className="pb-1.5 text-xs text-white/40">/ year</span>
              </div>
              <p className="mt-2 text-xs text-white/35">Five days free, followed by yearly billing.</p>
              <div className="my-7 h-px bg-white/[0.07]" />
              <div className="grid gap-3 text-xs font-semibold text-white/65 sm:grid-cols-2">
                {[
                  'Retail & service billing',
                  'Restaurant open orders',
                  'GST & thermal receipts',
                  'Barcode & IMEI inventory',
                  'Isolated store workspaces',
                  'Staff controls',
                  'Business reports',
                  'Customer loyalty',
                  'Cash, UPI & Card settlement',
                  'Menu picture uploads',
                ].map(item => (
                  <span key={item} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
              <button
                onClick={onGetStarted}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-4 text-sm font-extrabold text-[#06130E] transition hover:bg-emerald-400"
              >
                Start my free trial
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-white/32">
                <BadgeIndianRupee className="h-3.5 w-3.5 text-emerald-400" />
                Add another store anytime for ₹500 one time
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8 lg:pb-32">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-400/15 bg-emerald-500 px-6 py-14 text-center text-[#06130E] sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
              <div className="absolute -right-16 -top-28 h-64 w-64 rounded-full border-[40px] border-[#06130E]" />
              <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full border-[46px] border-[#06130E]" />
            </div>
            <div className="relative">
              <ShieldCheck className="mx-auto h-8 w-8" />
              <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">Give your business a smarter operating system.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-[#06130E]/65">Set up your QPOS workspace today and start billing in minutes.</p>
              <button
                onClick={onGetStarted}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#07110D] px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-black"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 text-center sm:flex-row sm:px-8 sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500 text-[#07110D]">
              <Store className="h-4 w-4" />
            </span>
            <span className="text-xs font-extrabold">QPOS</span>
          </div>
          <div className="text-[10px] text-white/30">
            <p>&copy; 2026 QPOS. Smart billing and inventory for modern businesses.</p>
            <a
              href="https://neospec.co.in"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-semibold text-white/50 transition hover:text-emerald-400"
            >
              QPOS is a Neospec Services product
            </a>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-semibold text-white/35">
            <span className="flex items-center gap-1.5"><Cloud className="h-3 w-3 text-emerald-400" /> Cloud connected</span>
            <span className="flex items-center gap-1.5"><ScanBarcode className="h-3 w-3 text-emerald-400" /> Barcode ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
